import * as vscode from "vscode";
import { updateDecorations, initDecorations } from "./decorations";
import { refreshIndentRainbow, updateIndentRainbow } from "./indentRainbow";
import { registerAutoTagRenaming } from "./tagRenaming";
import { registerCleanupCommand, registerSaveListener } from "./cleanup";
import { refreshComments, updateComments } from "./customComments";
import { registerBetterOutline } from "./outline";
import { alignEqualsWithTabs } from "./alignCode";
import { formatSelectedJson } from "./jsonFormatter";
import {
  registerMarkdownPreviewProvider,
  extendMarkdownItWithAlerts,
} from "./markdownPreview";

export function activate(context: vscode.ExtensionContext) {
  // 1. Initial Setup & Module Registration
  initDecorations(context);
  refreshComments();
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
    });
  };

  // 2. Configuration Change Listener
  context.subscriptions.push(
    vscode.workspace.onDidChangeConfiguration((e) => {
      // Watch for Indent Rainbow toggle or color changes
      if (e.affectsConfiguration("theToyBox.indentRainbow")) {
        refreshIndentRainbow(); // Rebuild or Dispose the styles
        triggerVisualUpdates();
      }

      // Watch for Custom Comment settings (Requires a refresh to rebuild styles)
      if (e.affectsConfiguration("theToyBox.customComments")) {
        refreshComments();
        triggerVisualUpdates();
      }

      // Watch for Tag Renaming master toggle or language list
      if (
        e.affectsConfiguration("theToyBox.autoRenameMatchingTags") ||
        e.affectsConfiguration("theToyBox.autoRenameTag.activationOnLanguage")
      ) {
        // No refresh needed for tags, they check config on-the-fly in tagRenaming.ts
      }
    }),
    vscode.commands.registerCommand("theToyBox.alignEquals", () => {
      alignEqualsWithTabs();
    }),
    vscode.commands.registerCommand("theToyBox.formatJson", () => {
      formatSelectedJson();
    }),
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
  } else {
    const listener = vscode.window.onDidChangeActiveTextEditor((editor) => {
      if (editor) {
        triggerVisualUpdates(editor);
        listener.dispose(); // Only run once for the initial load
      }
    });
  }

  // Return the markdown-it extension hook so the built-in preview picks up alert styling
  return {
    extendMarkdownIt(md: any) {
      return extendMarkdownItWithAlerts(md);
    },
  };
}

export function deactivate() {
  // VS Code handles disposal of decoration types if we pushed them to context.subscriptions,
  // but manual cleanup can go here if needed.
}
