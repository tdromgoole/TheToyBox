import * as vscode from "vscode";
import * as path from "path";

// Store decoration types globally within the module
let decorationTypes: { [key: string]: vscode.TextEditorDecorationType } = {};

export function refreshComments() {
	// 1. Dispose old decorations to prevent memory leaks/ghosting
	Object.values(decorationTypes).forEach((d) => d.dispose());
	decorationTypes = {};

	// 2. Access the 'customComments' section of your package.json
	const config = vscode.workspace.getConfiguration(
		"theToyBox.customComments",
	);

	// Check if the feature is enabled (matches "theToyBox.customComments.enabled")
	const isEnabled = config.get<boolean>("enabled", true);
	if (!isEnabled) {
		return;
	}

	const colors = config.get<{ [key: string]: string }>("colors") || {};
	const showBackground = config.get<boolean>("showBackground", true);
	const fullLineHighlight = config.get<boolean>("fullLineHighlight", true);

	// 3. Create new decoration types based on user settings
	for (const [char, hexColor] of Object.entries(colors)) {
		const style: vscode.DecorationRenderOptions = {
			color: hexColor,
			fontWeight: char === "!" ? "bold" : "normal",
		};

		if (showBackground) {
			// Append '33' for ~20% opacity background
			style.backgroundColor = hexColor + "33";
			style.isWholeLine = fullLineHighlight;
		}
		decorationTypes[char] =
			vscode.window.createTextEditorDecorationType(style);
	}

	// Trigger an initial update for the visible editor
	updateComments();
}

export function updateComments(editor = vscode.window.activeTextEditor) {
	if (!editor || Object.keys(decorationTypes).length === 0) {
		return;
	}

	const config = vscode.workspace.getConfiguration(
		"theToyBox.customComments",
	);

	// Check if the current file's extension is excluded
	const excludedFileTypes = config.get<string[]>("excludedFileTypes", [
		".md",
	]);
	const fileExtension = path.extname(editor.document.fileName).toLowerCase();
	if (excludedFileTypes.some((e) => e.toLowerCase() === fileExtension)) {
		// Clear any existing decorations for this editor and bail out
		Object.values(decorationTypes).forEach((d) =>
			editor.setDecorations(d, []),
		);
		return;
	}
	const fullLineHighlight = config.get<boolean>("fullLineHighlight", true);

	const symbols = Object.keys(decorationTypes);
	const rangesMap = new Map<string, vscode.Range[]>();
	symbols.forEach((s) => rangesMap.set(s, []));

	// Handle language-specific comment logic
	let commentPrefixes = ["//", "--", "#", "%", "'"];
	const lang = editor.document.languageId.toLowerCase();
	const excludeSingleQuote = [
		"php",
		"javascript",
		"typescript",
		"sql",
		"mssql",
		"postgres",
		"mysql",
	];

	if (excludeSingleQuote.some((l) => lang.includes(l))) {
		commentPrefixes = commentPrefixes.filter((p) => p !== "'");
	}

	const excludeHash = ["javascript", "typescript", "html", "xml", "css"];
	if (excludeHash.some((l) => lang.includes(l))) {
		commentPrefixes = commentPrefixes.filter((p) => p !== "#");
	}

	commentPrefixes.sort((a, b) => b.length - a.length);

	for (let i = 0; i < editor.document.lineCount; i++) {
		const line = editor.document.lineAt(i);
		const text = line.text;
		let foundPrefix: string | undefined;
		let prefixIndex = -1;

		// String-aware comment scanning (O(n) flag-based)
		let inSingle = false;
		let inDouble = false;
		let inTemplate = false;
		for (let charIdx = 0; charIdx < text.length; charIdx++) {
			const ch = text[charIdx];

			// Track closing of open string literals
			if (inDouble) {
				if (ch === "\\") {
					charIdx++;
					continue;
				}
				if (ch === '"') {
					inDouble = false;
				}
				continue;
			}
			if (inSingle) {
				if (ch === "\\") {
					charIdx++;
					continue;
				}
				if (ch === "'") {
					inSingle = false;
				}
				continue;
			}
			if (inTemplate) {
				if (ch === "\\") {
					charIdx++;
					continue;
				}
				if (ch === "`") {
					inTemplate = false;
				}
				continue;
			}

			// Outside any string: check for a comment prefix first
			const currentPrefix = commentPrefixes.find((p) =>
				text.startsWith(p, charIdx),
			);
			if (currentPrefix) {
				prefixIndex = charIdx;
				foundPrefix = currentPrefix;
				break;
			}

			// Track opening of string literals
			if (ch === '"') {
				inDouble = true;
			} else if (ch === "'") {
				inSingle = true;
			} else if (ch === "`") {
				inTemplate = true;
			}
		}

		if (!foundPrefix || prefixIndex === -1) {
			continue;
		}

		const afterPrefix = text
			.substring(prefixIndex + foundPrefix.length)
			.trimStart();
		const matchedSymbol = symbols.find((s) => afterPrefix.startsWith(s));

		if (matchedSymbol) {
			const charAfterSymbol = afterPrefix.charAt(matchedSymbol.length);
			// Check if it's a standalone symbol, not part of a variable (e.g., // $var)
			const isVariableOrWord = /^[a-zA-Z0-9_]/.test(charAfterSymbol);

			if (!isVariableOrWord) {
				const startColumn = fullLineHighlight ? 0 : prefixIndex;
				const range = new vscode.Range(i, startColumn, i, text.length);
				rangesMap.get(matchedSymbol)?.push(range);
			}
		}
	}

	// Apply the decorations to the editor
	for (const [symbol, ranges] of rangesMap) {
		const decorationType = decorationTypes[symbol];
		if (decorationType) {
			editor.setDecorations(decorationType, ranges);
		}
	}
}
