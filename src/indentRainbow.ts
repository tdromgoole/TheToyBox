import * as vscode from "vscode";

const defaultRainbowColors = [
	"#FFB3B3", // pink
	"#AADFF0", // sky blue
	"#FFD9A0", // peach
	"#D5B8E8", // lavender
	"#F4A9A8", // rose
	"#B3EAE7", // mint
	"#FFFAAA", // yellow
	"#A8B8F0", // periwinkle
	"#F0B8B8", // blush
	"#B8F0B3", // sage
	"#F5B8E0", // mauve
	"#C4B0F5", // lilac
];

let indentDecorations: vscode.TextEditorDecorationType[] = [];
let activeColors: string[] = [...defaultRainbowColors];

/**
 * Destroys old decorations and creates new ones if enabled.
 */
export function refreshIndentRainbow() {
	const config = vscode.workspace.getConfiguration("theToyBox");
	const isEnabled = config.get<boolean>("indentRainbow", true);
	const userColors = config.get<string[]>("indentRainbowColors", []);
	activeColors =
		userColors.length > 0 ? userColors : [...defaultRainbowColors];

	// Always clear existing decorations first
	if (indentDecorations.length > 0) {
		indentDecorations.forEach((d) => d.dispose());
		indentDecorations = [];
	}

	// Only recreate if the setting is ON
	if (isEnabled) {
		const opacityPercent = config.get<number>("indentRainbowOpacity", 10);
		const opacityHex = Math.round(
			(Math.min(100, Math.max(1, opacityPercent)) / 100) * 255,
		)
			.toString(16)
			.padStart(2, "0")
			.toUpperCase();
		indentDecorations = activeColors.map((color) =>
			vscode.window.createTextEditorDecorationType({
				backgroundColor: color + opacityHex,
				border: "none",
			}),
		);
	}
}

/**
 * Updates the actual ranges in the editor.
 */
export function updateIndentRainbow(editor?: vscode.TextEditor) {
	const activeEditor = editor || vscode.window.activeTextEditor;

	if (!activeEditor) {
		return;
	}

	// If decorations array is empty, it means the feature is likely disabled via refreshIndentRainbow
	if (indentDecorations.length === 0) {
		return;
	}

	const indentRanges: vscode.Range[][] = Array.from(
		{ length: activeColors.length },
		() => [],
	);

	const tabSize = (activeEditor.options.tabSize as number) || 4;

	for (let i = 0; i < activeEditor.document.lineCount; i++) {
		const line = activeEditor.document.lineAt(i);
		if (line.isEmptyOrWhitespace) {
			continue;
		}

		const tabMatch = line.text.match(/^\t+/);
		if (tabMatch) {
			// Tab-based indentation: one color per tab character
			const tabCount = tabMatch[0].length;
			for (let j = 0; j < tabCount; j++) {
				const colorLevel = j % activeColors.length;
				indentRanges[colorLevel].push(new vscode.Range(i, j, i, j + 1));
			}
			continue;
		}

		const spaceMatch = line.text.match(/^ +/);
		if (spaceMatch) {
			// Space-based indentation: one color per tabSize-width group
			const spaceCount = spaceMatch[0].length;
			const levels = Math.floor(spaceCount / tabSize);
			for (let j = 0; j < levels; j++) {
				const colorLevel = j % activeColors.length;
				const startCol = j * tabSize;
				indentRanges[colorLevel].push(
					new vscode.Range(i, startCol, i, startCol + tabSize),
				);
			}
		}
	}

	// Apply decorations
	indentDecorations.forEach((decoration, i) => {
		activeEditor.setDecorations(decoration, indentRanges[i]);
	});
}
