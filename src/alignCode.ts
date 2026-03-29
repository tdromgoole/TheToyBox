import * as vscode from 'vscode';

export async function alignEqualsWithTabs() {
	const editor = vscode.window.activeTextEditor;
	if (!editor) return;

	const selection = editor.selection;
	const tabSize = Number(editor.options.tabSize) || 4;
	const lines: string[] = [];

	for (let i = selection.start.line; i <= selection.end.line; i++) {
		lines.push(editor.document.lineAt(i).text);
	}

	// Helper to calculate visual width: tabs are expanded to their visual space
	const getVisualWidth = (text: string): number => {
		let width = 0;
		for (const char of text) {
			if (char === '\t') {
				width += tabSize - (width % tabSize);
			} else {
				width += 1;
			}
		}
		return width;
	};

	// 1. Parse lines and find the maximum visual width of the prefixes
	let maxVisualWidth = 0;
	const parsedLines = lines.map(line => {
		const equalsIndex = line.indexOf('=');
		if (equalsIndex !== -1) {
			const prefix = line.substring(0, equalsIndex).trimEnd();
			const rest = line.substring(equalsIndex); // includes the '='
			maxVisualWidth = Math.max(maxVisualWidth, getVisualWidth(prefix));
			return { prefix, rest, isMatch: true };
		}
		return { line, isMatch: false };
	});

	// 2. Set the target column to the next available tab stop
	const targetTabColumn = Math.ceil((maxVisualWidth + 1) / tabSize) * tabSize;

	// 3. Reconstruct lines with the correct number of tabs for alignment
	const newLines = parsedLines.map(item => {
		if (!item.isMatch) return (item as any).line;

		const currentWidth = getVisualWidth(item.prefix!);
		const remainingWidth = targetTabColumn - currentWidth;
		const numTabsNeeded = Math.ceil(remainingWidth / tabSize);

		return `${item.prefix}${'\t'.repeat(numTabsNeeded)}${item.rest}`;
	});

	// 4. Apply the edit to the document
	editor.edit(editBuilder => {
		const range = new vscode.Range(
			selection.start.line, 0,
			selection.end.line, editor.document.lineAt(selection.end.line).text.length
		);
		editBuilder.replace(range, newLines.join('\n'));
	});
}