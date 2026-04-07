import * as vscode from "vscode";
import * as path from "path";
import { LanguageProfile } from "./syntax/types";
import { tokenizeKdl } from "./syntax/kdl";
import { tokenizeAsp } from "./syntax/asp";
import { tokenizeRazorVb } from "./syntax/razorVb";

// ─── Token style palette ─────────────────────────────────────────────────────
// KDL tokens use VS Code Dark+ colours.
// ASP tokens use Visual Studio IDE Dark theme colours.
const TOKEN_STYLES: Record<string, vscode.DecorationRenderOptions> = {
	// ── Shared ──
	comment: { color: "#57A64A", fontStyle: "italic" }, // VS green
	string: { color: "#D69D85" }, // VS string tan
	number: { color: "#B5CEA8" },
	// ── KDL-specific ──
	boolean: { color: "#569CD6" },
	typeAnnotation: { color: "#4EC9B0" },
	nodeName: { color: "#4FC1FF", fontWeight: "bold" },
	propKey: { color: "#9CDCFE" },
	// ── ASP/HTML-specific ──
	keyword: { color: "#569CD6" }, // VS keyword blue
	vbType: { color: "#4EC9B0" }, // VS teal for built-in types
	htmlTag: { color: "#569CD6" }, // VS HTML element blue
	htmlAttribute: { color: "#FF8C69" }, // VS salmon/orange for HTML attribute names
	htmlString: { color: "#D69D85" }, // VS attribute value
	aspDelimiter: { color: "#DCDCAA", fontWeight: "bold" }, // VS ASP delimiter gold
	// ── Razor-specific ──
	razorDelimiter: { color: "#DCDCAA", fontWeight: "bold" }, // @ / @Code / End Code
	razorDirective: { color: "#CE9178", fontStyle: "italic" }, // @model, @using, @layout etc.
};

// ─── Decoration type instances (rebuilt whenever the setting changes) ──────────
let decorations: Record<string, vscode.TextEditorDecorationType> = {};

// ─── Registered language profiles ─────────────────────────────────────────────
// Add new file types here. Each profile needs a file extensions list and a
// tokenize function that returns non-overlapping TokenMatch objects.
const PROFILES: LanguageProfile[] = [
	{
		extensions: [".kdl"],
		settingKey: "kdl",
		tokenize: tokenizeKdl,
	},
	{
		extensions: [".asp"],
		settingKey: "asp",
		tokenize: tokenizeAsp,
	},
	{
		extensions: [".vbhtml"],
		settingKey: "razorVb",
		tokenize: tokenizeRazorVb,
	},
];

// ─── Public API ───────────────────────────────────────────────────────────────

/**
 * Destroys existing decoration types and recreates them if the feature is
 * enabled. Call this when the extension activates or the setting changes.
 */
export function refreshSyntaxHighlighting() {
	Object.values(decorations).forEach((d) => d.dispose());
	decorations = {};

	for (const [type, style] of Object.entries(TOKEN_STYLES)) {
		decorations[type] = vscode.window.createTextEditorDecorationType(style);
	}
}

/**
 * Applies (or clears) syntax highlight decorations for the given editor.
 * Call this whenever the active editor changes or document content changes.
 */
export function updateSyntaxHighlighting(
	editor = vscode.window.activeTextEditor,
) {
	if (!editor) {
		return;
	}

	// Feature is disabled — decorations object is empty, nothing to apply or clear
	if (Object.keys(decorations).length === 0) {
		return;
	}

	const ext = path.extname(editor.document.fileName).toLowerCase();
	const config = vscode.workspace.getConfiguration(
		"theToyBox.syntaxHighlighting",
	);

	const profile = PROFILES.find((p) => {
		if (!p.extensions.includes(ext)) {
			return false;
		}
		if (p.settingKey && !config.get<boolean>(p.settingKey, true)) {
			return false;
		}
		return true;
	});

	if (!profile) {
		// Unsupported file type — clear any lingering decorations on this editor
		for (const dec of Object.values(decorations)) {
			editor.setDecorations(dec, []);
		}
		return;
	}

	const text = editor.document.getText();
	const tokenList = profile.tokenize(text);

	// Build a range list for each token type
	const rangesMap: Record<string, vscode.Range[]> = {};
	for (const type of Object.keys(TOKEN_STYLES)) {
		rangesMap[type] = [];
	}

	for (const token of tokenList) {
		if (rangesMap[token.type]) {
			rangesMap[token.type].push(
				new vscode.Range(
					editor.document.positionAt(token.start),
					editor.document.positionAt(token.end),
				),
			);
		}
	}

	for (const [type, dec] of Object.entries(decorations)) {
		editor.setDecorations(dec, rangesMap[type] ?? []);
	}
}
