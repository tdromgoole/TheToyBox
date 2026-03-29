import * as vscode from "vscode";

const defaultRainbowColors = [
  "#FF6B6B",
  "#4ECDC4",
  "#ff9900",
  "#9B59B6",
  "#eeff00",
  "#45B7D1",
  "#E74C3C",
  "#2e46cc",
  "#52f312",
  "#451abc",
  "#C0392B",
  "#ff2da7",
];

let indentDecorations: vscode.TextEditorDecorationType[] = [];
let activeColors: string[] = [...defaultRainbowColors];

/**
 * Destroys old decorations and creates new ones if enabled.
 */
export function refreshIndentRainbow() {
  const config = vscode.workspace.getConfiguration("theToyBox");
  const isEnabled = config.get<boolean>("indentRainbow", true);
  activeColors = config.get<string[]>(
    "indentRainbow.colors",
    defaultRainbowColors,
  );

  // Always clear existing decorations first
  if (indentDecorations.length > 0) {
    indentDecorations.forEach((d) => d.dispose());
    indentDecorations = [];
  }

  // Only recreate if the setting is ON
  if (isEnabled) {
    indentDecorations = activeColors.map((color) =>
      vscode.window.createTextEditorDecorationType({
        backgroundColor: color + "30", // ~19% opacity
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

  for (let i = 0; i < activeEditor.document.lineCount; i++) {
    const line = activeEditor.document.lineAt(i);
    if (line.isEmptyOrWhitespace) continue;

    const leadingMatch = line.text.match(/^[	]+/);
    if (!leadingMatch) continue;

    const tabCount = leadingMatch[0].length;
    for (let j = 0; j < tabCount; j++) {
      const colorLevel = j % activeColors.length;
      const indentRange = new vscode.Range(i, j, i, j + 1);
      indentRanges[colorLevel].push(indentRange);
    }
  }

  // Apply decorations
  indentDecorations.forEach((decoration, i) => {
    activeEditor.setDecorations(decoration, indentRanges[i]);
  });
}
