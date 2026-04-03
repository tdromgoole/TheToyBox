import * as vscode from "vscode";

const OPERATORS: { label: string; description: string; regex: RegExp }[] = [
	{
		label: "=",
		description: "Assignment  (e.g.  $x = 1)",
		regex: /(?<![!<>=+\-*/])=(?!>)/,
	},
	{
		label: ":",
		description: "Key / property  (e.g.  color: red)",
		regex: /(?<!:):(?![:\/])/,
	},
	{
		label: "=>",
		description: "Fat arrow / PHP array  (e.g.  key => val)",
		regex: /=>/,
	},
	{ label: "+=", description: "Add-assign  (e.g.  $x += 1)", regex: /\+=/ },
	{
		label: "-=",
		description: "Subtract-assign  (e.g.  $x -= 1)",
		regex: /-=/,
	},
];

export async function alignWithTabs() {
	const editor = vscode.window.activeTextEditor;
	if (!editor) return;

	const selection = editor.selection;
	const selectedLines: string[] = [];
	for (let i = selection.start.line; i <= selection.end.line; i++) {
		selectedLines.push(editor.document.lineAt(i).text);
	}

	// 0. Auto-detect operator by priority (most specific first to avoid false matches)
	const priorityOrder = ["=>", "+=", "-=", ":", "="];
	const orderedOperators = priorityOrder
		.map((label) => OPERATORS.find((op) => op.label === label)!)
		.filter(Boolean);

	let picked = orderedOperators.find((op) =>
		selectedLines.some((l) => op.regex.test(l)),
	);

	if (!picked) {
		// Nothing detected — ask the user
		const chosen = await vscode.window.showQuickPick(OPERATORS, {
			title: "Align with Tabs",
			placeHolder: "No operator detected. Choose the operator to align.",
		});
		if (!chosen) {
			return;
		}
		picked = chosen;
	}

	const { regex } = picked;
	const tabSize = Number(editor.options.tabSize) || 4;
	const lines = selectedLines;

	// Helper: visual width, expanding tabs to their tab-stop widths
	const getVisualWidth = (text: string): number => {
		let width = 0;
		for (const char of text) {
			if (char === "\t") {
				width += tabSize - (width % tabSize);
			} else {
				width += 1;
			}
		}
		return width;
	};

	// 1. Parse lines and find the maximum visual prefix width
	let maxVisualWidth = 0;
	const parsedLines = lines.map((line) => {
		const match = regex.exec(line);
		if (match) {
			const prefix = line.substring(0, match.index).trimEnd();
			const rest = line.substring(match.index); // includes the operator
			maxVisualWidth = Math.max(maxVisualWidth, getVisualWidth(prefix));
			return { prefix, rest, isMatch: true as const };
		}
		return { line, isMatch: false as const };
	});

	// 2. Snap to the next tab stop after the longest prefix
	const targetTabColumn = Math.ceil((maxVisualWidth + 1) / tabSize) * tabSize;

	// 3. Reconstruct lines with tabs inserted before the operator
	const newLines = parsedLines.map((item) => {
		if (!item.isMatch) return item.line;

		const currentWidth = getVisualWidth(item.prefix);
		const remainingWidth = targetTabColumn - currentWidth;
		const numTabsNeeded = Math.ceil(remainingWidth / tabSize);

		return `${item.prefix}${"\t".repeat(numTabsNeeded)}${item.rest}`;
	});

	// 4. Apply the edit
	editor.edit((editBuilder) => {
		const range = new vscode.Range(
			selection.start.line,
			0,
			selection.end.line,
			editor.document.lineAt(selection.end.line).text.length,
		);
		editBuilder.replace(range, newLines.join("\n"));
	});
}
