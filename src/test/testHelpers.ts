/**
 * Minimal vscode.TextDocument mock for use in outline parser unit tests.
 * The VS Code host is available via @vscode/test-cli, but creating a real
 * document requires opening a file. This lightweight mock satisfies the
 * subset of the TextDocument interface that the outline parsers consume.
 */
export function makeDoc(
	lines: string[],
	languageId = "plaintext",
	fileName = "/test/test.txt",
): any {
	const text = lines.join("\n");

	return {
		lineCount: lines.length,
		languageId,
		fileName,
		uri: { fsPath: fileName },

		lineAt(i: number) {
			const lineText = lines[i] ?? "";
			return {
				text: lineText,
				isEmptyOrWhitespace: lineText.trim() === "",
			};
		},

		getText(): string {
			return text;
		},

		/** Map a flat character offset to { line, character }. */
		positionAt(offset: number): { line: number; character: number } {
			let remaining = offset;
			for (let i = 0; i < lines.length; i++) {
				const lineLen = lines[i].length + 1; // +1 for '\n'
				if (remaining < lineLen) {
					return { line: i, character: remaining };
				}
				remaining -= lineLen;
			}
			return {
				line: lines.length - 1,
				character: lines[lines.length - 1].length,
			};
		},
	};
}
