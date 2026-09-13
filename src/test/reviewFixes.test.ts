import * as assert from "assert";
import * as vscode from "vscode";
import * as vm from "vm";
import * as fs from "fs/promises";
import * as os from "os";
import * as path from "path";
import { literalLines } from "../cleanupStrings.js";
import { getCleanEdits, registerSaveListener } from "../cleanup.js";
import { findStructuralPartner } from "../tagRenaming.js";
import { BookmarksProvider } from "../bookmarks.js";
import { tokenizePhpSql } from "../syntax/phpSql.js";
import { tokenizeJsSql } from "../syntax/jsSql.js";

suite("Review regressions", () => {
	test("cleanup protects multiline data, including blank lines and selected interiors", async () => {
		for (const [language, content] of [
			["javascript", 'const s = `\n    text  \n    \n    ${`nested`}\n`;'],
			["php", '<?php $s = "\n    text  \n    \n";'],
			["php", "<?php $s = <<<'DATA'\n    text  \n    \n    DATA;"],
			["python", 's = """\n    text  \n    \n"""'],
		]) {
			const doc = await vscode.workspace.openTextDocument({ content, language });
			assert.deepStrictEqual(getCleanEdits(doc), [], language);
			assert.deepStrictEqual(getCleanEdits(doc, undefined, 1, 2), [], language);
		}
		assert.deepStrictEqual([...literalLines('// `ignored\n    code\n/* "ignored */', "javascript")], []);
	});

	test("tag matching skips void tags in both directions", () => {
		const voids = new Set(["img", "br", "input"]);
		for (const tag of ['<img src="x">', '<BR>', '<input>', '<img />']) {
			const text = `<div><span>${tag}</span></section>`;
			assert.strictEqual(findStructuralPartner(text, text.indexOf("</section>"), true, voids), 0);
			assert.strictEqual(findStructuralPartner(text, 0, false, voids), text.indexOf("</section>"));
		}
	});

	test("SQL literal markers and escaped quotes do not hide following clauses", () => {
		for (const tokenize of [(text: string) => tokenizePhpSql(text, true), tokenizeJsSql]) {
			for (const literal of ["'--'", "'/* not a comment */'", "'it''s -- text'", "[--column]"]) {
				const text = `q = "SELECT ${literal} AS marker FROM users";`;
				const tokens = tokenize(text);
				assert.deepStrictEqual(tokens.filter(t => t.type === "comment"), []);
				assert.deepStrictEqual(tokens.filter(t => t.type === "sqlKeyword").map(t => text.slice(t.start, t.end)), ["SELECT", "AS", "FROM"]);
			}
		}
		const text = String.raw`const q = 'SELECT \'--\' AS marker FROM users';`;
		assert.deepStrictEqual(tokenizeJsSql(text).filter(t => t.type === "sqlKeyword").map(t => text.slice(t.start, t.end)), ["SELECT", "AS", "FROM"]);
	});

	test("bookmark actions execute from the nonce script without inline handlers", () => {
		const uri = "file:///test/it's%20a%20note.txt";
		const context = {
			extensionUri: vscode.Uri.file(process.cwd()),
			workspaceState: { get: () => [{ uri, line: 3, label: "sample" }] },
		} as unknown as vscode.ExtensionContext;
		const webview = { html: "", options: {}, cspSource: "vscode-webview:", asWebviewUri: (uri: vscode.Uri) => uri, onDidReceiveMessage: () => ({ dispose() {} }) };
		new BookmarksProvider(context).resolveWebviewView({ webview, onDidDispose: () => ({ dispose() {} }) } as unknown as vscode.WebviewView);
		assert.doesNotMatch(webview.html, /\sonclick=/);
		const script = webview.html.match(/<script nonce="([^"]+)">([\s\S]*?)<\/script>/)!;
		assert.ok(script);
		assert.ok(webview.html.includes(`script-src 'nonce-${script[1]}'`));
		const messages: unknown[] = [];
		let clear = () => {};
		let click = (_event: unknown) => {};
		vm.runInNewContext(script[2], {
			acquireVsCodeApi: () => ({ postMessage: (message: unknown) => messages.push(JSON.parse(JSON.stringify(message))) }),
			document: {
				querySelector: () => ({ addEventListener: (_type: string, fn: () => void) => { clear = fn; } }),
				querySelectorAll: () => [{ dataset: { uri: encodeURIComponent(uri), line: "3" }, addEventListener: (_type: string, fn: typeof click) => { click = fn; } }],
			},
		});
		click({ target: { closest: () => null } });
		click({ target: { closest: () => ({}) } });
		clear();
		assert.deepStrictEqual(messages, [{ command: "goTo", uri, line: 3 }, { command: "remove", uri, line: 3 }, { command: "clearAll" }]);
	});

	test("background document cleanup is included in the saved file", async () => {
		const folder = await fs.mkdtemp(path.join(os.tmpdir(), "toybox-save-test-"));
		const file = path.join(folder, "background.txt");
		const subscriptions: vscode.Disposable[] = [];
		try {
			await fs.writeFile(file, "initial\n");
			const background = await vscode.workspace.openTextDocument(vscode.Uri.file(file));
			const other = await vscode.workspace.openTextDocument({ content: "active", language: "plaintext" });
			await vscode.window.showTextDocument(other);
			registerSaveListener({ subscriptions } as vscode.ExtensionContext, () => {}, () => {}, () => {});
			const edit = new vscode.WorkspaceEdit();
			edit.replace(background.uri, new vscode.Range(0, 0, 1, 0), "background content  \n");
			assert.ok(await vscode.workspace.applyEdit(edit));
			assert.ok(await background.save());
			assert.strictEqual(await fs.readFile(file, "utf8"), "background content\n");
		} finally {
			subscriptions.forEach(s => s.dispose());
			await fs.rm(folder, { recursive: true, force: true });
		}
	});
});
