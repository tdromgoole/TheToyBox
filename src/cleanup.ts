import * as vscode from "vscode";
import * as path from "path";

export function getCleanEdits(
  document: vscode.TextDocument,
  cursorLines?: number | number[],
  startLine?: number,
  endLine?: number,
): vscode.TextEdit[] {
  const edits: vscode.TextEdit[] = [];

  // 1. Configuration: Get ignored extensions for tab conversion
  const config = vscode.workspace.getConfiguration("theToyBox");
  const convertSpacesToTabs = config.get<boolean>("convertSpacesToTabs", true);
  const ignoredExtensions = config.get<string[]>("ignoreTabConversion", [
    ".yaml",
    ".yml",
    ".json",
  ]);
  const trimWhitespace = config.get<boolean>("trimTrailingWhitespace", true);
  const ignoreTrimExtensions = config.get<string[]>("ignoreTrimWhitespace", [
    ".md",
  ]);

  // Check if current file extension should skip tab conversion
  const fileExtension = path.extname(document.fileName).toLowerCase();
  const skipTabConversion = ignoredExtensions.includes(fileExtension);
  const skipTrimWhitespace = ignoreTrimExtensions.includes(fileExtension);

  // Use VS Code's tabSize setting for the document (respects per-language overrides)
  const editorConfig = vscode.workspace.getConfiguration(
    "editor",
    document.uri,
  );
  const indentUnit = editorConfig.get<number>("tabSize", 4);

  // Normalize cursorLines to a Set for efficient lookup
  const ignoredLines = new Set<number>();
  if (cursorLines !== undefined) {
    if (typeof cursorLines === "number") {
      ignoredLines.add(cursorLines);
    } else if (Array.isArray(cursorLines)) {
      cursorLines.forEach((line) => ignoredLines.add(line));
    }
  }

  // If no range specified, process entire document
  const lineStart = startLine !== undefined ? startLine : 0;
  const lineEnd = endLine !== undefined ? endLine : document.lineCount - 1;

  for (let i = lineStart; i <= lineEnd; i++) {
    const line = document.lineAt(i);

    // Skip processing lines with cursors
    if (ignoredLines.has(i)) {
      continue;
    }

    // 1. Handle Empty or Whitespace-only Lines
    if (line.isEmptyOrWhitespace) {
      if (line.text.length > 0) {
        edits.push(vscode.TextEdit.delete(line.range));
      }
      continue;
    }

    // 2. Convert Leading Spaces to Tabs (Skip if disabled or file extension is ignored)
    if (convertSpacesToTabs && !skipTabConversion) {
      // Match ALL leading whitespace (tabs and spaces) so that lines like
      // "\t    code" (tab + spaces) are also processed, not just pure-space lines.
      const leadingMatch = line.text.match(/^[ \t]+/);
      if (leadingMatch) {
        const raw = leadingMatch[0];

        // Compute the effective indentation width, respecting tab stops.
        // A tab advances to the next multiple of indentUnit from the current column.
        let effectiveWidth = 0;
        for (const ch of raw) {
          if (ch === "\t") {
            effectiveWidth += indentUnit - (effectiveWidth % indentUnit);
          } else {
            effectiveWidth++;
          }
        }

        const tabCount = Math.floor(effectiveWidth / indentUnit);
        const remainderSpaces = effectiveWidth % indentUnit;

        // Preserve sub-tab-width remainder as spaces rather than discarding them,
        // so indentation depth is never silently changed.
        const newIndentation =
          "\t".repeat(tabCount) + " ".repeat(remainderSpaces);

        // Only create an edit if the indentation actually changed
        if (newIndentation !== raw) {
          edits.push(
            vscode.TextEdit.replace(
              new vscode.Range(i, 0, i, raw.length),
              newIndentation,
            ),
          );
        }
      }
    }

    // 3. Trim Trailing Whitespace
    if (trimWhitespace && !skipTrimWhitespace) {
      const trailingMatch = line.text.match(/[ \t]+$/);
      if (trailingMatch) {
        const startCol = line.text.length - trailingMatch[0].length;
        edits.push(
          vscode.TextEdit.delete(
            new vscode.Range(i, startCol, i, line.text.length),
          ),
        );
      }
    }
  }

  return edits;
}

export function registerCleanupCommand(
  context: vscode.ExtensionContext,
  updateDecorations: (editor?: vscode.TextEditor) => void,
  updateIndentRainbow: (editor?: vscode.TextEditor) => void,
) {
  let cleanCmd = vscode.commands.registerCommand(
    "theToyBox.cleanFile",
    async () => {
      const editor = vscode.window.activeTextEditor;
      if (!editor) {
        vscode.window.showWarningMessage("No active editor");
        return;
      }

      try {
        let edits: vscode.TextEdit[];

        // Handle multi-cursor selection (Ctrl+D)
        if (editor.selections.length > 1) {
          const cursorLines = editor.selections.map((sel) => sel.active.line);
          edits = getCleanEdits(editor.document, cursorLines);
        } else {
          const selection = editor.selection;
          const startLine = Math.min(selection.start.line, selection.end.line);
          const endLine = Math.max(selection.start.line, selection.end.line);
          const isMultilineSelection = startLine !== endLine;

          if (isMultilineSelection) {
            edits = getCleanEdits(
              editor.document,
              selection.active.line,
              startLine,
              endLine,
            );
          } else {
            edits = getCleanEdits(editor.document, selection.active.line);
          }
        }

        const workEdit = new vscode.WorkspaceEdit();
        workEdit.set(editor.document.uri, edits);

        await vscode.workspace.applyEdit(workEdit);
        updateDecorations(editor);
        updateIndentRainbow(editor);
      } catch (error) {
        vscode.window.showErrorMessage(`Error cleaning file: ${error}`);
      }
    },
  );

  context.subscriptions.push(cleanCmd);
}

export function registerSaveListener(
  context: vscode.ExtensionContext,
  updateDecorations: (editor?: vscode.TextEditor) => void,
  updateIndentRainbow: (editor?: vscode.TextEditor) => void,
  updateComments: (editor?: vscode.TextEditor | undefined) => void,
) {
  const saveListener = vscode.workspace.onDidSaveTextDocument(
    async (document) => {
      const config = vscode.workspace.getConfiguration("theToyBox");
      if (config.get("cleanOnSave", true)) {
        const editor = vscode.window.activeTextEditor;
        if (!editor || editor.document !== document) {
          return;
        }

        try {
          let edits: vscode.TextEdit[];

          if (editor.selections.length > 1) {
            const cursorLines = editor.selections.map((sel) => sel.active.line);
            edits = getCleanEdits(document, cursorLines);
          } else {
            const cursorLine = editor.selection.active.line;
            edits = getCleanEdits(document, cursorLine);
          }

          const workEdit = new vscode.WorkspaceEdit();
          workEdit.set(document.uri, edits);

          await vscode.workspace.applyEdit(workEdit);
          updateDecorations(editor);
          updateIndentRainbow(editor);
        } catch (error) {
          console.error("Error during save cleanup:", error);
        }
      }
    },
  );

  context.subscriptions.push(saveListener);
}
