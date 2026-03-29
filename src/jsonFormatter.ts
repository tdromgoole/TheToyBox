import * as vscode from 'vscode';

/**
	* Formats a raw JSON string into a pretty-printed version.
	* @param jsonString The unformatted JSON text.
	* @param indentSize Number of spaces (or a tab character) for indentation.
*/
export function formatJson(jsonString: string, indentSize: number | string = 4): string {
	try {
		// Parse the raw string into a JavaScript object
		const obj = JSON.parse(jsonString);

		// Stringify it back with indentation
		return JSON.stringify(obj, null, indentSize);
	} catch (error) {
		vscode.window.showErrorMessage("Invalid JSON: Could not format the selection.");
		return jsonString; // Return original text if parsing fails
	}
}

/**
	* VS Code command implementation to format the current selection.
*/
export async function formatSelectedJson() {
	const editor = vscode.window.activeTextEditor;
	if (!editor) {return;}

	const selection = editor.selection;
	const text = editor.document.getText(selection);

	if (!text) {
		vscode.window.showInformationMessage("Please select some JSON text to format.");
		return;
	}

	// Use the editor's current tabSize setting for consistency
	const tabSize = editor.options.tabSize || 4;
	const formatted = formatJson(text, tabSize);

	if (formatted !== text) {
		editor.edit(editBuilder => {
			editBuilder.replace(selection, formatted);
		});
	}
}