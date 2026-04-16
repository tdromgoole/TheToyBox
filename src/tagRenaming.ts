import * as vscode from "vscode";

let isApplyingRename = false;
let renameTimeout: NodeJS.Timeout | undefined;
let cachedVoidElements: Set<string> = new Set();

/**
 * Rebuilds the cached void-element set from configuration.
 * Call this once on activation and whenever the voidElements setting changes.
 */
export function refreshTagRenaming() {
	const config = vscode.workspace.getConfiguration("theToyBox");
	const voidElementsPref =
		config.get<string[]>("autoRenameTag.voidElements") || [];
	cachedVoidElements = new Set(voidElementsPref.map((t) => t.toLowerCase()));
}

function findStructuralPartner(
	text: string,
	offset: number,
	searchBackwards: boolean,
): number | null {
	let depth = 0;
	const tagRegex =
		/<([a-zA-Z0-9_:-]+)(?:\s[^>]*\/?>|\/?>)|<\/([a-zA-Z0-9_:-]+)>/gi;

	if (searchBackwards) {
		const matches: RegExpExecArray[] = [];
		let m: RegExpExecArray | null;
		const beforeText = text.substring(0, offset);
		while ((m = tagRegex.exec(beforeText))) {
			matches.push(m);
		}

		for (let i = matches.length - 1; i >= 0; i--) {
			const match = matches[i];
			const matchText = match[0];
			if (matchText.endsWith("/>")) continue;

			if (matchText.startsWith("</")) {
				depth++;
			} else {
				if (depth === 0) return match.index;
				depth--;
			}
		}
	} else {
		const firstBracketClose = text.indexOf(">", offset);
		if (firstBracketClose === -1) return null;

		// Check if the current tag is self-closing
		if (text[firstBracketClose - 1] === "/") return null;

		tagRegex.lastIndex = firstBracketClose + 1;
		let m: RegExpExecArray | null;
		while ((m = tagRegex.exec(text))) {
			const matchText = m[0];
			if (matchText.endsWith("/>")) continue;

			if (!matchText.startsWith("</")) {
				depth++;
			} else {
				if (depth === 0) return m.index;
				depth--;
			}
		}
	}
	return null;
}

export function registerAutoTagRenaming(context: vscode.ExtensionContext) {
	// Populate the cache on first registration
	refreshTagRenaming();

	const disposable = vscode.workspace.onDidChangeTextDocument(
		async (event) => {
			// 1. Initial Guards
			if (isApplyingRename || event.contentChanges.length !== 1) return;

			const editor = vscode.window.activeTextEditor;
			if (!editor || editor.document !== event.document) return;

			const config = vscode.workspace.getConfiguration("theToyBox");
			if (!config.get<boolean>("autoRenameMatchingTags", true)) return;

			const activeLanguages = config.get<string[]>(
				"autoRenameTag.activationOnLanguage",
			) || [
				"html",
				"xml",
				"php",
				"asp",
				"aspvbhtml",
				"javascript",
				"javascriptreact",
				"typescriptreact",
			];
			if (!activeLanguages.includes(editor.document.languageId)) return;

			const maxLines = config.get<number>(
				"performance.maxLinesForTagRename",
				5000,
			);
			if (editor.document.lineCount > maxLines) return;

			const document = event.document;
			const change = event.contentChanges[0];
			const line = document.lineAt(change.range.start.line).text;
			const charPos = change.range.start.character;

			// 2. Context Detection
			const textBeforeCursor = line.substring(
				0,
				charPos + change.text.length,
			);
			const lastOpen = textBeforeCursor.lastIndexOf("<");
			if (lastOpen === -1) return;

			const tagContent = line.substring(lastOpen);
			const nameMatch = tagContent.match(/^<\/?([a-zA-Z0-9_:-]*)/);
			if (!nameMatch) return;

			const tagName = nameMatch[1];
			const isClosing = tagContent.startsWith("</");

			// Blacklist Check
			if (cachedVoidElements.has(tagName.toLowerCase())) return;

			// Skip empty tag names (e.g. user deleted entire name, producing "<>")
			if (!tagName) return;

			// Verify cursor is in the tag name
			const nameEndInLine =
				lastOpen + (isClosing ? 2 : 1) + tagName.length;
			if (charPos + change.text.length > nameEndInLine) return;

			// Skip incomplete/new tags that have no closing ">".
			// When typing a brand-new tag like "<di", there is no matching ">"
			// yet, so we must not search for a partner to rename.
			// For multi-line tags (e.g. <div\n  class="x">), we scan ahead.
			const restOfLine = line.substring(nameEndInLine);
			if (!/^[^<]*>/.test(restOfLine)) {
				let isCompleteTag = false;
				scanAhead: for (
					let ln = change.range.start.line + 1;
					ln <
					Math.min(change.range.start.line + 20, document.lineCount);
					ln++
				) {
					for (const ch of document.lineAt(ln).text) {
						if (ch === ">") {
							isCompleteTag = true;
							break scanAhead;
						}
						if (ch === "<") break scanAhead;
					}
				}
				if (!isCompleteTag) return;
			}

			// 3. DEBOUNCE LOGIC
			if (renameTimeout) clearTimeout(renameTimeout);

			renameTimeout = setTimeout(async () => {
				// Re-read the document state to avoid stale closure values
				const currentLine = document.lineAt(
					change.range.start.line,
				).text;
				const currentTextBefore = currentLine.substring(
					0,
					charPos + change.text.length,
				);
				const currentLastOpen = currentTextBefore.lastIndexOf("<");
				if (currentLastOpen === -1) return;

				const currentTagContent =
					currentLine.substring(currentLastOpen);
				const currentNameMatch = currentTagContent.match(
					/^<\/?([a-zA-Z0-9_:-]*)/,
				);
				if (!currentNameMatch || !currentNameMatch[1]) return;

				const currentTagName = currentNameMatch[1];
				const currentIsClosing = currentTagContent.startsWith("</");

				const fullText = document.getText();
				const offset = document.offsetAt(
					new vscode.Position(
						change.range.start.line,
						currentLastOpen,
					),
				);
				let partnerRange: vscode.Range | null = null;

				const partnerPos = findStructuralPartner(
					fullText,
					offset,
					currentIsClosing,
				);
				if (partnerPos !== null) {
					const partnerNameStart = currentIsClosing
						? partnerPos + 1
						: partnerPos + 2;
					const partnerText = fullText.substring(partnerNameStart);
					const partnerNameMatch =
						partnerText.match(/[a-zA-Z0-9_:-]*/);
					const oldLen = partnerNameMatch
						? partnerNameMatch[0].length
						: 0;

					partnerRange = new vscode.Range(
						document.positionAt(partnerNameStart),
						document.positionAt(partnerNameStart + oldLen),
					);
				}

				if (partnerRange && currentTagName !== undefined) {
					try {
						isApplyingRename = true;
						// Re-verify document is still active before applying
						const activeEditor = vscode.window.activeTextEditor;
						if (
							activeEditor &&
							activeEditor.document === document
						) {
							await activeEditor.edit(
								(editBuilder) => {
									editBuilder.replace(
										partnerRange!,
										currentTagName,
									);
								},
								{ undoStopBefore: false, undoStopAfter: false },
							);
						}
					} catch (err) {
						console.error("Tag Rename Error:", err);
					} finally {
						isApplyingRename = false;
					}
				}
			}, 150); // 150ms delay for performance
		},
	);

	context.subscriptions.push(disposable);
}
