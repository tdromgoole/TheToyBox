import * as vscode from "vscode";
import { updateDecorations, initDecorations } from "./decorations";
import { refreshIndentRainbow, updateIndentRainbow } from "./indentRainbow";
import { registerAutoTagRenaming, refreshTagRenaming } from "./tagRenaming";
import { registerCleanupCommand, registerSaveListener } from "./cleanup";
import { refreshComments, updateComments } from "./customComments";
import {
	refreshMarkdownHeadings,
	updateMarkdownHeadings,
} from "./markdownHeadings";
import { registerBetterOutline } from "./outline";
import { alignWithTabs } from "./alignCode";
import { formatSelectedJson } from "./jsonFormatter";
import {
	registerMarkdownPreviewProvider,
	extendMarkdownItWithAlerts,
} from "./markdownPreview";
import { installJetBrainsMonoNerdFont } from "./fontInstaller";
import { registerWordFrequency } from "./wordFrequency";
import {
	refreshSyntaxHighlighting,
	updateSyntaxHighlighting,
} from "./syntaxHighlighting";
import { registerNginxHoverProvider } from "./syntax/nginxHover";
import { registerAspHoverProvider } from "./syntax/aspHover";

let startupTimeout: NodeJS.Timeout | undefined;

export function activate(context: vscode.ExtensionContext) {
	// 1. Initial Setup & Module Registration
	initDecorations(context);
	refreshComments();
	refreshMarkdownHeadings();
	refreshIndentRainbow();
	registerAutoTagRenaming(context);
	registerCleanupCommand(context, updateDecorations, updateIndentRainbow);
	registerSaveListener(
		context,
		updateDecorations,
		updateIndentRainbow,
		updateComments,
	);
	registerBetterOutline(context);
	registerMarkdownPreviewProvider(context);
	registerWordFrequency(context);
	refreshSyntaxHighlighting();
	registerNginxHoverProvider(context);
	registerAspHoverProvider(context);

	/**
	 * Helper to refresh all visual UI elements at once.
	 * Using setImmediate ensures the Tag Renamer's WorkspaceEdit finishes
	 * before we try to redraw decorations on the text.
	 */
	const triggerVisualUpdates = (editor?: vscode.TextEditor) => {
		const activeEditor = editor || vscode.window.activeTextEditor;
		if (!activeEditor) {
			return;
		}

		setImmediate(() => {
			updateDecorations(activeEditor);
			updateIndentRainbow(activeEditor);
			updateComments(activeEditor);
			updateMarkdownHeadings(activeEditor);
			updateSyntaxHighlighting(activeEditor);
		});
	};

	// 2. Configuration Change Listener
	context.subscriptions.push(
		vscode.workspace.onDidChangeConfiguration((e) => {
			// Watch for Indent Rainbow toggle or color changes
			if (
				e.affectsConfiguration("theToyBox.indentRainbow") ||
				e.affectsConfiguration("theToyBox.indentRainbowOpacity") ||
				e.affectsConfiguration("theToyBox.indentRainbowColors")
			) {
				refreshIndentRainbow(); // Rebuild or Dispose the styles
				triggerVisualUpdates();
			}

			// Watch for Custom Comment settings (Requires a refresh to rebuild styles)
			if (e.affectsConfiguration("theToyBox.customComments")) {
				refreshComments();
				triggerVisualUpdates();
			}

			// Watch for Markdown Heading settings (Requires a refresh to rebuild styles)
			if (e.affectsConfiguration("theToyBox.markdownHeadings")) {
				refreshMarkdownHeadings();
				triggerVisualUpdates();
			}

			// Watch for Tag Renaming void elements list
			if (
				e.affectsConfiguration("theToyBox.autoRenameTag.voidElements")
			) {
				refreshTagRenaming();
			}

			// Watch for Markdown Preview enabled toggle — tell the built-in
			// markdown preview to re-run all markdown-it plugins so the new
			// enabled/disabled state takes effect immediately.
			if (e.affectsConfiguration("theToyBox.markdownPreview")) {
				vscode.commands.executeCommand("markdown.api.reloadPlugins");
			}

			if (e.affectsConfiguration("theToyBox.wordFrequency")) {
				vscode.commands.executeCommand("wordFrequency.refresh");
			}

			if (e.affectsConfiguration("theToyBox.syntaxHighlighting")) {
				refreshSyntaxHighlighting();
				triggerVisualUpdates();
			}
		}),
		vscode.commands.registerCommand("theToyBox.alignEquals", () => {
			alignWithTabs();
		}),
		vscode.commands.registerCommand("theToyBox.formatJson", () => {
			formatSelectedJson();
		}),
		vscode.commands.registerCommand(
			"theToyBox.installJetBrainsMonoNerdFont",
			() => {
				installJetBrainsMonoNerdFont();
			},
		),
	);

	let updateTimeout: NodeJS.Timeout | undefined;

	// 3. Editor Event Listeners
	context.subscriptions.push(
		// Triggered when switching between different files (Immediate)
		vscode.window.onDidChangeActiveTextEditor((editor) => {
			if (editor) {
				triggerVisualUpdates(editor);
			}
		}),

		// Triggered when typing or deleting text (Debounced)
		vscode.workspace.onDidChangeTextDocument((event) => {
			const editor = vscode.window.activeTextEditor;
			if (editor && event.document === editor.document) {
				// Clear the previous timer if the user is still typing
				if (updateTimeout) {
					clearTimeout(updateTimeout);
				}
				// Set a new timer to wait 300ms after the last change
				updateTimeout = setTimeout(() => {
					triggerVisualUpdates(editor);
				}, 300);
			}
		}),
	);

	// 4. Initial Run for the currently open file
	if (vscode.window.activeTextEditor) {
		triggerVisualUpdates(vscode.window.activeTextEditor);
		// VS Code may not have fully rendered the editor at activation time,
		// so schedule a second pass after a short delay to ensure decorations
		// are applied even when the file was already open on launch.
		startupTimeout = setTimeout(() => {
			startupTimeout = undefined;
			for (const editor of vscode.window.visibleTextEditors) {
				triggerVisualUpdates(editor);
			}
		}, 500);
	} else {
		const listener = vscode.window.onDidChangeActiveTextEditor((editor) => {
			if (editor) {
				triggerVisualUpdates(editor);
				listener.dispose(); // Only run once for the initial load
			}
		});
		context.subscriptions.push(listener);
	}

	// Return the markdown-it extension hook so the built-in preview picks up alert styling
	return {
		extendMarkdownIt(md: any) {
			return extendMarkdownItWithAlerts(md);
		},
	};
}

export function deactivate() {
	if (startupTimeout) {
		clearTimeout(startupTimeout);
		startupTimeout = undefined;
	}
}
