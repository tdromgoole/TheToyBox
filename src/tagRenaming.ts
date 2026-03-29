import * as vscode from 'vscode';

let isApplyingRename = false;
let renameTimeout: NodeJS.Timeout | undefined;

function findStructuralPartner(text: string, offset: number, searchBackwards: boolean): number | null {
	let depth = 0;
	const tagRegex = /<([a-zA-Z0-9_:-]+)(?:\s|>|(?=\/))|<\/([a-zA-Z0-9_:-]+)>/gi;

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
			if (matchText.endsWith('/>')) continue;

			if (matchText.startsWith('</')) {
				depth++;
			} else {
				if (depth === 0) return match.index;
				depth--;
			}
		}
	} else {
		const firstBracketClose = text.indexOf('>', offset);
		if (firstBracketClose === -1) return null;

		tagRegex.lastIndex = firstBracketClose + 1;
		let m: RegExpExecArray | null;
		while ((m = tagRegex.exec(text))) {
			const matchText = m[0];
			if (matchText.endsWith('/>')) continue;

			if (!matchText.startsWith('</')) {
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
	const disposable = vscode.workspace.onDidChangeTextDocument(async (event) => {
		// 1. Initial Guards
		if (isApplyingRename || event.contentChanges.length !== 1) return;

		const editor = vscode.window.activeTextEditor;
		if (!editor || editor.document !== event.document) return;

		const config = vscode.workspace.getConfiguration('theToyBox');
		if (!config.get<boolean>('autoRenameMatchingTags', true)) return;

		const activeLanguages = config.get<string[]>('autoRenameTag.activationOnLanguage') || ["html", "xml", "php", "javascript", "javascriptreact", "typescriptreact"];
		if (!activeLanguages.includes(editor.document.languageId)) return;

		const document = event.document;
		const change = event.contentChanges[0];
		const line = document.lineAt(change.range.start.line).text;
		const charPos = change.range.start.character;

		// 2. Context Detection
		const textBeforeCursor = line.substring(0, charPos + change.text.length);
		const lastOpen = textBeforeCursor.lastIndexOf('<');
		if (lastOpen === -1) return;

		const tagContent = line.substring(lastOpen);
		const nameMatch = tagContent.match(/^<\/?([a-zA-Z0-9_:-]*)/);
		if (!nameMatch) return;

		const tagName = nameMatch[1];
		const isClosing = tagContent.startsWith('</');

		// Blacklist Check
		const voidElementsPref = config.get<string[]>('autoRenameTag.voidElements') || [];
		const voidElements = new Set(voidElementsPref.map(t => t.toLowerCase()));
		if (voidElements.has(tagName.toLowerCase())) return;

		// Verify cursor is in the tag name
		const nameEndInLine = lastOpen + (isClosing ? 2 : 1) + tagName.length;
		if (charPos + change.text.length > nameEndInLine) return;

		// 3. DEBOUNCE LOGIC
		if (renameTimeout) clearTimeout(renameTimeout);

		renameTimeout = setTimeout(async () => {
			const fullText = document.getText();
			const offset = document.offsetAt(new vscode.Position(change.range.start.line, lastOpen));
			let partnerRange: vscode.Range | null = null;

			const partnerPos = findStructuralPartner(fullText, offset, isClosing);
			if (partnerPos !== null) {
				const partnerNameStart = isClosing ? partnerPos + 1 : partnerPos + 2;
				const partnerText = fullText.substring(partnerNameStart);
				const partnerNameMatch = partnerText.match(/[a-zA-Z0-9_:-]*/);
				const oldLen = partnerNameMatch ? partnerNameMatch[0].length : 0;

				partnerRange = new vscode.Range(
					document.positionAt(partnerNameStart),
					document.positionAt(partnerNameStart + oldLen)
				);
			}

			if (partnerRange && tagName !== undefined) {
				try {
					isApplyingRename = true;
					// Re-verify document is still active before applying
					const activeEditor = vscode.window.activeTextEditor;
					if (activeEditor && activeEditor.document === document) {
						await activeEditor.edit(editBuilder => {
							editBuilder.replace(partnerRange!, tagName);
						}, { undoStopBefore: false, undoStopAfter: false });
					}
				} catch (err) {
					console.error("Tag Rename Error:", err);
				} finally {
					isApplyingRename = false;
				}
			}
		}, 150); // 150ms delay for performance
	});

	context.subscriptions.push(disposable);
}