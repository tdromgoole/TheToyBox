import * as vscode from "vscode";
import * as path from "path";

/**
 * Detects the space indentation unit for a range of lines by finding the
 * minimum pure-space leading width of 2 or more characters. Single-space
 * widths are ignored as they are almost always continuation lines, not real
 * indent levels. Falls back to `fallback` (tabSize) when the range has no
 * qualifying space-indented lines.
 */
function detectSpaceUnit(
	document: vscode.TextDocument,
	lineStart: number,
	lineEnd: number,
	fallback: number,
): number {
	let min = 0;
	for (let i = lineStart; i <= lineEnd; i++) {
		const line = document.lineAt(i);
		if (!line.isEmptyOrWhitespace) {
			const match = line.text.match(/^ {2,}/);
			if (match) {
				const len = match[0].length;
				if (min === 0 || len < min) {
					min = len;
				}
			}
		}
	}
	return min > 0 ? min : fallback;
}

export function getCleanEdits(
	document: vscode.TextDocument,
	cursorLines?: number | number[],
	startLine?: number,
	endLine?: number,
): vscode.TextEdit[] {
	const edits: vscode.TextEdit[] = [];

	// 1. Configuration: Get ignored extensions for tab conversion
	const config = vscode.workspace.getConfiguration("theToyBox");
	const convertSpacesToTabs = config.get<boolean>("convertSpacesToTabs", true);
	const ignoredExtensions = config.get<string[]>("ignoreTabConversion", [
		".yaml",
		".yml",
		".json",
	]);
	const trimWhitespace = config.get<boolean>("trimTrailingWhitespace", true);
	const ignoreTrimExtensions = config.get<string[]>("ignoreTrimWhitespace", [
		".md",
	]);

	// Check if current file extension should skip tab conversion
	const fileExtension = path.extname(document.fileName).toLowerCase();
	const skipTabConversion = ignoredExtensions.includes(fileExtension);
	const skipTrimWhitespace = ignoreTrimExtensions.includes(fileExtension);

	// Use VS Code's tabSize setting for the document (respects per-language overrides)
	const editorConfig = vscode.workspace.getConfiguration("editor", document.uri,);
	const indentUnit = editorConfig.get<number>("tabSize", 4);

	// Normalize cursorLines to a Set for efficient lookup
	const ignoredLines = new Set<number>();
	if (cursorLines !== undefined) {
		if (typeof cursorLines === "number") {
			ignoredLines.add(cursorLines);
		} else if (Array.isArray(cursorLines)) {
			cursorLines.forEach((line) => ignoredLines.add(line));
		}
	}

	// If no range specified, process entire document
	const lineStart = startLine !== undefined ? startLine : 0;
	const lineEnd = endLine !== undefined ? endLine : document.lineCount - 1;

	// Detect the space indentation unit for the lines being processed: the
	// minimum pure-space leading width ≥ 2 in the range. Scoping to the range
	// prevents other code in the file from skewing the result. Widths of 1 are
	// excluded as they are almost always continuation lines, not indent levels.
	// Floor-division then gives the fewest tabs that preserve the hierarchy:
	// e.g. spaceUnit=3 → 3→1 tab, 6→2, 9→3; spaceUnit=2 → 2→1, 4→2, 6→3.
	const spaceUnit =
	convertSpacesToTabs && !skipTabConversion
		? detectSpaceUnit(document, lineStart, lineEnd, indentUnit)
		: indentUnit;

	for (let i = lineStart; i <= lineEnd; i++) {
		const line = document.lineAt(i);

		// Skip processing lines with cursors
		if (ignoredLines.has(i)) {
			continue;
		}

		// 1. Handle Empty or Whitespace-only Lines
		if (line.isEmptyOrWhitespace) {
			if (line.text.length > 0) {
				edits.push(vscode.TextEdit.delete(line.range));
			}
			continue;
		}

		// Compute both transformations in memory so we can emit a single edit per
		// line.  Emitting two separate edits (one for leading, one for trailing)
		// whose positions are both derived from the *original* text is unsafe:
		// if VS Code applies the leading replace first and it shortens the line,
		// the trailing delete's positions become stale and can land inside code.
		let newText = line.text;

		// 2. Trim Trailing Whitespace first (operates on the original text end)
		if (trimWhitespace && !skipTrimWhitespace) {
			newText = newText.replace(/[ \t]+$/, "");
		}

		// 3. Convert Leading Spaces to Tabs (Skip if disabled or file extension is ignored)
		if (convertSpacesToTabs && !skipTabConversion) {
			const leadingMatch = newText.match(/^[ \t]+/);
			if (leadingMatch) {
				const raw = leadingMatch[0];
				let newLeading = "";
				let idx = 0;
				while (idx < raw.length) {
					if (raw[idx] === "\t") {
						newLeading += "\t";
						idx++;
					} else {
						const start = idx;
						while (idx < raw.length && raw[idx] === " ") {
							idx++;
						}
						const count = idx - start;
						newLeading +=
							"\t".repeat(Math.floor(count / spaceUnit)) +
							" ".repeat(count % spaceUnit);
					}
				}

				if (newLeading !== raw) {
					newText = newLeading + newText.slice(raw.length);
				}
			}
		}

		// Emit a single replace for the entire line only if something changed.
		// One edit per line guarantees no positional conflicts.
		if (newText !== line.text) {
			edits.push(vscode.TextEdit.replace(line.range, newText));
		}
	}

	return edits;
}

export function registerCleanupCommand(
	context: vscode.ExtensionContext,
	updateDecorations: (editor?: vscode.TextEditor) => void,
	updateIndentRainbow: (editor?: vscode.TextEditor) => void,
) {
	let cleanCmd = vscode.commands.registerCommand(
		"theToyBox.cleanFile",
		async () => {
			const editor = vscode.window.activeTextEditor;
			if (!editor) {
			vscode.window.showWarningMessage("No active editor");
			return;
			}

			try {
					let edits: vscode.TextEdit[];

			// Handle multi-cursor selection (Ctrl+D)
			if (editor.selections.length > 1) {
				const cursorLines = editor.selections.map((sel) => sel.active.line);
				edits = getCleanEdits(editor.document, cursorLines);
			} else {
				const selection = editor.selection;
				const startLine = Math.min(selection.start.line, selection.end.line);
				const endLine = Math.max(selection.start.line, selection.end.line);
				const isMultilineSelection = startLine !== endLine;

				if (isMultilineSelection) {
				edits = getCleanEdits(
					editor.document,
					selection.active.line,
					startLine,
					endLine,
				);
				} else {
				edits = getCleanEdits(editor.document, selection.active.line);
				}
			}

			const workEdit = new vscode.WorkspaceEdit();
			workEdit.set(editor.document.uri, edits);

			await vscode.workspace.applyEdit(workEdit);
			updateDecorations(editor);
			updateIndentRainbow(editor);
			} catch (error) {
			vscode.window.showErrorMessage(`Error cleaning file: ${error}`);
			}
		},
	);

	context.subscriptions.push(cleanCmd);
}

export function registerSaveListener(
	context: vscode.ExtensionContext,
	updateDecorations: (editor?: vscode.TextEditor) => void,
	updateIndentRainbow: (editor?: vscode.TextEditor) => void,
	updateComments: (editor?: vscode.TextEditor | undefined) => void,
) {
	// Use onWillSaveTextDocument + waitUntil so our edits are injected directly
	// into the save pipeline and written to disk in the same save operation.
	// onDidSaveTextDocument fires after the file is already written, so any
	// applyEdit calls there modify the buffer but are not persisted until the
	// next save — making tab conversion appear broken.
	const saveListener = vscode.workspace.onWillSaveTextDocument((event) => {
		const config = vscode.workspace.getConfiguration("theToyBox");
		if (!config.get("cleanOnSave", true)) {
			return;
		}

		const document = event.document;
		const editor = vscode.window.activeTextEditor;
		if (!editor || editor.document !== document) {
			return;
		}

		let edits: vscode.TextEdit[];

		if (editor.selections.length > 1) {
			const cursorLines = editor.selections.map((sel) => sel.active.line);
			edits = getCleanEdits(document, cursorLines);
		} else {
			const cursorLine = editor.selection.active.line;
			edits = getCleanEdits(document, cursorLine);
		}

		if (edits.length > 0) {
			event.waitUntil(Promise.resolve(edits));
		}

		// Schedule visual refresh after the save completes
		setImmediate(() => {
			updateDecorations(editor);
			updateIndentRainbow(editor);
			updateComments(editor);
		});
	});

	context.subscriptions.push(saveListener);
}