import * as assert from "assert";
import * as vscode from "vscode";
import * as fs from "fs/promises";
import * as os from "os";
import * as path from "path";
import { CustomMarkdownPreviewProvider } from "../markdownPreview.js";
import { registerQuickNotes, deactivateQuickNotes } from "../quickNotes.js";

suite("Privacy settings", () => {
	test("remote images require explicit user opt-in and update the existing preview", async () => {
		const config = vscode.workspace.getConfiguration("theToyBox.markdownPreview");
		const previous = config.inspect("allowRemoteImages")?.globalValue;
		const webview = { html: "", asWebviewUri: (uri: vscode.Uri) => uri };
		const panel = { webview } as unknown as vscode.WebviewPanel;
		const provider = new CustomMarkdownPreviewProvider({ extensionUri: vscode.Uri.file(process.cwd()) } as vscode.ExtensionContext);
		const document = await vscode.workspace.openTextDocument({ content: "![remote](https://example.com/pixel.png)" });
		try {
			await config.update("allowRemoteImages", undefined, vscode.ConfigurationTarget.Global);
			provider.updatePreview(panel, document);
			assert.match(webview.html, /img-src data:;/);
			await config.update("allowRemoteImages", true, vscode.ConfigurationTarget.Global);
			provider.refreshPrivacy(panel);
			assert.match(webview.html, /img-src https: data:;/);
			await config.update("allowRemoteImages", false, vscode.ConfigurationTarget.Global);
			provider.refreshPrivacy(panel);
			assert.match(webview.html, /img-src data:;/);
		} finally { await config.update("allowRemoteImages", previous, vscode.ConfigurationTarget.Global); }
	});

	test("ordinary untitled changes are not persisted by default", async () => {
		const directory = await fs.mkdtemp(path.join(os.tmpdir(), "toybox-privacy-"));
		const subscriptions: vscode.Disposable[] = [];
		const state = new Map<string, unknown>();
		const config = vscode.workspace.getConfiguration("theToyBox.quickNotes");
		const priorCapture = config.inspect("captureUntitled")?.globalValue;
		const priorFolder = config.inspect("notesFolder")?.globalValue;
		const context = {
			subscriptions, globalStorageUri: vscode.Uri.file(directory),
			globalState: { get: (key: string) => state.get(key), update: async (key: string, value: unknown) => { state.set(key, value); } },
		} as unknown as vscode.ExtensionContext;
		try {
			await config.update("captureUntitled", undefined, vscode.ConfigurationTarget.Global);
			await config.update("notesFolder", directory, vscode.ConfigurationTarget.Global);
			registerQuickNotes(context);
			const doc = await vscode.workspace.openTextDocument({ content: "" });
			const edit = new vscode.WorkspaceEdit();
			edit.insert(doc.uri, new vscode.Position(0, 0), "sensitive scratch text");
			assert.ok(await vscode.workspace.applyEdit(edit));
			await new Promise(resolve => setTimeout(resolve, 650));
			assert.deepStrictEqual(await fs.readdir(directory), []);
			assert.strictEqual(state.has("toybox.quickNotes.untitledMap"), false);
		} finally {
			deactivateQuickNotes();
			subscriptions.forEach(s => s.dispose());
			await config.update("captureUntitled", priorCapture, vscode.ConfigurationTarget.Global);
			await config.update("notesFolder", priorFolder, vscode.ConfigurationTarget.Global);
			await fs.rm(directory, { recursive: true, force: true });
		}
	});
});
