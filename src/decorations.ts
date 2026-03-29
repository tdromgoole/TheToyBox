import * as vscode from "vscode";

const trailingSpacesDecoration = vscode.window.createTextEditorDecorationType({
  backgroundColor: "rgba(255, 0, 0, 0.4)",
});

export function initDecorations(context: vscode.ExtensionContext) {
  context.subscriptions.push(trailingSpacesDecoration);
}

export function updateDecorations(editor?: vscode.TextEditor) {
  const activeEditor = editor || vscode.window.activeTextEditor;
  if (!activeEditor) {
    return;
  }

  const text = activeEditor.document.getText();
  const trailingSpaces: vscode.Range[] = [];
  const regex = /[ \t]+$/gm;
  let match;

  while ((match = regex.exec(text)) !== null) {
    const startPos = activeEditor.document.positionAt(match.index);
    const endPos = activeEditor.document.positionAt(match.index + match.length);
    trailingSpaces.push(new vscode.Range(startPos, endPos));
  }

  activeEditor.setDecorations(trailingSpacesDecoration, trailingSpaces);
}
