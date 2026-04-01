import * as vscode from "vscode";

const HEADING_LEVELS = ["h1", "h2", "h3", "h4", "h5", "h6"];

let headingDecorations: { [level: string]: vscode.TextEditorDecorationType } =
	{};

/**
 * Destroys old decorations and creates new ones if enabled.
 */
export function refreshMarkdownHeadings() {
	Object.values(headingDecorations).forEach((d) => d.dispose());
	headingDecorations = {};

	const config = vscode.workspace.getConfiguration(
		"theToyBox.markdownHeadings",
	);
	const isEnabled = config.get<boolean>("enabled", true);
	if (!isEnabled) {
		return;
	}

	const colors = config.get<{ [key: string]: string }>("colors") || {};
	const showBackground = config.get<boolean>("showBackground", true);
	const fullLineHighlight = config.get<boolean>("fullLineHighlight", true);

	for (const level of HEADING_LEVELS) {
		const color = colors[level];
		if (!color) {
			continue;
		}

		const style: vscode.DecorationRenderOptions = {
			color,
			fontWeight: level === "h1" ? "bold" : "normal",
		};

		if (showBackground) {
			style.backgroundColor = color + "33";
			style.isWholeLine = fullLineHighlight;
		}

		headingDecorations[level] =
			vscode.window.createTextEditorDecorationType(style);
	}

	updateMarkdownHeadings();
}

/**
 * Applies heading decorations to the active markdown editor.
 */
export function updateMarkdownHeadings(
	editor = vscode.window.activeTextEditor,
) {
	if (!editor) {
		return;
	}

	// Clear decorations for non-markdown files
	if (editor.document.languageId !== "markdown") {
		Object.values(headingDecorations).forEach((d) =>
			editor.setDecorations(d, []),
		);
		return;
	}

	if (Object.keys(headingDecorations).length === 0) {
		return;
	}

	const rangesMap: { [level: string]: vscode.Range[] } = {};
	for (const level of HEADING_LEVELS) {
		rangesMap[level] = [];
	}

	for (let i = 0; i < editor.document.lineCount; i++) {
		const line = editor.document.lineAt(i);
		const match = line.text.match(/^(#{1,6})\s/);
		if (!match) {
			continue;
		}

		const levelKey = `h${match[1].length}`;
		rangesMap[levelKey].push(new vscode.Range(i, 0, i, line.text.length));
	}

	for (const level of HEADING_LEVELS) {
		if (headingDecorations[level]) {
			editor.setDecorations(headingDecorations[level], rangesMap[level]);
		}
	}
}
