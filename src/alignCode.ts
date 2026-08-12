import * as vscode from "vscode";
import { getVisualWidth, buildAlignedLines } from "./alignUtils";

export { getVisualWidth, buildAlignedLines };

const OPERATORS: { label: string; description: string; regex: RegExp }[] = [
	{
		label: "=",
		description: "Assignment  (e.g.  $x = 1)",
		regex: /(?<![!<>=+\-*/])=(?![>=])/,
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
	if (!editor) {return;}

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

	const tabSize = Number(editor.options.tabSize) || 4;
	const newLines = buildAlignedLines(selectedLines, picked.regex, tabSize);

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
