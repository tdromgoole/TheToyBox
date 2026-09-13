import * as vscode from "vscode";
import * as path from "path";
import { getVisualWidth } from "./alignUtils.js";
import { literalLines } from "./cleanupStrings.js";

export function getCleanEdits(
	document: vscode.TextDocument,
	cursorLines?: number | number[],
	startLine?: number,
	endLine?: number,
	clearWhitespaceOnlyLines: boolean = true,
): vscode.TextEdit[] {
	const edits: vscode.TextEdit[] = [];
	const protectedLines = literalLines(document.getText(), document.languageId);

	// 1. Configuration: Get ignored extensions for tab conversion
	const config = vscode.workspace.getConfiguration("theToyBox", document);
	const convertSpacesToTabs = config.get<boolean>(
		"convertSpacesToTabs",
		true,
	);
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
	const skipTrimWhitespace = ignoreTrimExtensions.includes(fileExtension);

	// Live options include status-bar changes and VS Code's detected indentation.
	const activeEditor = vscode.window.activeTextEditor;
	const editor = activeEditor?.document === document
		? activeEditor
		: vscode.window.visibleTextEditors.find((candidate) => candidate.document === document);
	const editorConfig = vscode.workspace.getConfiguration(
		"editor",
		document,
	);
	const configuredTabSize = editorConfig.get<number>("tabSize", 4);
	const tabSize = Number(editor?.options.tabSize ?? configuredTabSize);
	const indentUnit = Number.isInteger(tabSize) && tabSize > 0 ? tabSize : 4;
	const editorInsertSpaces = typeof editor?.options.insertSpaces === "boolean"
		? editor.options.insertSpaces
		: editorConfig.get<boolean>("insertSpaces", true);
	const skipTabConversion = ignoredExtensions.includes(fileExtension);

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

	for (let i = lineStart; i <= lineEnd; i++) {
		const line = document.lineAt(i);

		// Skip processing lines with cursors
		if (ignoredLines.has(i) || protectedLines.has(i)) {
			continue;
		}

		// 1. Handle Empty or Whitespace-only Lines
		if (line.isEmptyOrWhitespace) {
			if (clearWhitespaceOnlyLines && line.text.length > 0) {
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

		// 3. Normalize indentation without moving code to a different visual column.
		if (convertSpacesToTabs && !skipTabConversion) {
			const leadingMatch = newText.match(/^[ \t]+/);
			if (leadingMatch) {
				const raw = leadingMatch[0];
				const width = getVisualWidth(raw, indentUnit);
				const newLeading = editorInsertSpaces
					? " ".repeat(width)
					: "\t".repeat(Math.floor(width / indentUnit)) + " ".repeat(width % indentUnit);

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

/** Build edits for selected lines, or the file when there is no selection. */
export function getCleanupCommandEdits(editor: vscode.TextEditor): vscode.TextEdit[] {
	const selections = editor.selections.filter((selection) => !selection.isEmpty);
	if (selections.length > 0) {
		const selectedLines = new Set<number>();
		for (const selection of selections) {
			const endLine = selection.end.line - (selection.end.character === 0 ? 1 : 0);
			for (let line = selection.start.line; line <= endLine; line++) {
				selectedLines.add(line);
			}
		}
		const lines = [...selectedLines].sort((a, b) => a - b);
		return getCleanEdits(editor.document, undefined, lines[0], lines[lines.length - 1])
			.filter((edit) => selectedLines.has(edit.range.start.line));
	} else {
		return getCleanEdits(editor.document, editor.selections.map((selection) => selection.active.line));
	}
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
				const edits = getCleanupCommandEdits(editor);

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
		const config = vscode.workspace.getConfiguration("theToyBox", event.document);
		if (!config.get("cleanOnSave", true)) {
			return;
		}

		const document = event.document;
		const editor = vscode.window.activeTextEditor?.document === document
			? vscode.window.activeTextEditor : undefined;

		let edits: vscode.TextEdit[];

		// Collect every line touched by every active selection so that lines the
		// user is actively editing (including all lines in a block-tab selection)
		// are not modified during save.
		const selectionLines: number[] = [];
		for (const sel of editor?.selections ?? []) {
			const start = Math.min(sel.start.line, sel.end.line);
			const end = Math.max(sel.start.line, sel.end.line);
			for (let l = start; l <= end; l++) {
				selectionLines.push(l);
			}
		}
		edits = getCleanEdits(
			document,
			selectionLines,
			undefined,
			undefined,
			false,
		);

		if (edits.length > 0) {
			event.waitUntil(Promise.resolve(edits));
		}

		// Schedule visual refresh after the save completes
		setImmediate(() => {
			if (!editor) { return; }
			updateDecorations(editor);
			updateIndentRainbow(editor);
			updateComments(editor);
		});
	});

	context.subscriptions.push(saveListener);
}
