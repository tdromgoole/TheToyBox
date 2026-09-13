import * as assert from "assert";
import * as vscode from "vscode";
import { getCleanEdits, getCleanupCommandEdits } from "../cleanup.js";

suite("Cleanup indentation", () => {
	let editor: vscode.TextEditor;

	async function open(content: string, insertSpaces = false, tabSize = 4, language = "plaintext") {
		const document = await vscode.workspace.openTextDocument({ content, language });
		editor = await vscode.window.showTextDocument(document);
		editor.options = { insertSpaces, tabSize };
		return document;
	}

	async function clean(startLine?: number, endLine?: number) {
		const edits = getCleanEdits(editor.document, undefined, startLine, endLine);
		const edit = new vscode.WorkspaceEdit();
		edit.set(editor.document.uri, edits);
		assert.ok(await vscode.workspace.applyEdit(edit));
		return editor.document.getText();
	}

	teardown(async () => {
		await vscode.commands.executeCommand("workbench.action.revertAndCloseActiveEditor");
	});

	test("PHP arrays after HTML apostrophes still convert spaces to tabs", async () => {
		const lines = ["<p>Here's the user's profile</p>", "<?php", "// Defining an associative array", "$user = [",
			'    "username" => "PixelPioneer",', '    "email" => "hello@example.com",',
			'    "level" => 42,', '    "is_active" => true', "];"];
		// A single apostrophe previously made the rest of the file a literal.
		lines[0] = "<p>Here's the profile</p>";
		await open(lines.join("\n"), false, 4, "php");
		editor.selection = new vscode.Selection(3, 0, 8, 2);
		const edit = new vscode.WorkspaceEdit();
		edit.set(editor.document.uri, getCleanupCommandEdits(editor));
		assert.ok(await vscode.workspace.applyEdit(edit));
		assert.strictEqual(editor.document.getText(), lines.map(line => line.replace(/^ {4}/, "\t")).join("\n"));
	});

	test("PHP string interpolation preserves literals without hiding following code", async () => {
		const source = '<?php\n$message = "Hello {$user["name"]}";\n    $level = 42;\n$text = "\n    keep this string\n";';
		await open(source, false, 4, "php");
		assert.strictEqual(await clean(), source.replace("    $level", "\t$level"));
	});

	test("deeply indented selection keeps its visual depth", async () => {
		await open("outside\n        first\n            nested\n        last\noutside");
		assert.strictEqual(await clean(1, 3), "outside\n\t\tfirst\n\t\t\tnested\n\t\tlast\noutside");
		assert.deepStrictEqual(getCleanEdits(editor.document), []);
	});

	test("mixed whitespace uses tab stops and preserves continuation columns", async () => {
		await open("  \t  \t x  \n\t  y\n \tz");
		assert.strictEqual(await clean(), "\t\t x\n\t  y\n\tz");
		assert.deepStrictEqual(getCleanEdits(editor.document), []);
	});

	test("spaces mode expands tabs using the current editor options", async () => {
		await open(" \tfirst\n\t  next\n    last", true, 4);
		assert.strictEqual(await clean(), "    first\n      next\n    last");
		assert.deepStrictEqual(getCleanEdits(editor.document), []);
	});

	test("status-bar tab width wins over saved configuration", async () => {
		await open("      first\n \t next", false, 3);
		assert.strictEqual(await clean(), "\t\tfirst\n\t next");
	});

	test("cleanup changes only leading and trailing whitespace", async () => {
		await open('    const text = "a  b\tc";  ');
		assert.strictEqual(await clean(), '\tconst text = "a  b\tc";');
	});

	test("save-style exclusions preserve cursor and blank lines", async () => {
		await open("    cursor  \n    \n    code  ");
		const edits = getCleanEdits(editor.document, [0], undefined, undefined, false);
		assert.strictEqual(edits.length, 1);
		assert.strictEqual(edits[0].range.start.line, 2);
		assert.strictEqual(edits[0].newText, "\tcode");
	});

	test("selected final line is cleaned but line at an exclusive end is untouched", async () => {
		await open("    first\n        second\n    outside  ");
		editor.selection = new vscode.Selection(0, 0, 2, 0);
		const edit = new vscode.WorkspaceEdit();
		edit.set(editor.document.uri, getCleanupCommandEdits(editor));
		assert.ok(await vscode.workspace.applyEdit(edit));
		assert.strictEqual(editor.document.getText(), "\tfirst\n\t\tsecond\n    outside  ");
	});

	test("reversed selection includes the active line", async () => {
		await open("    first\n        second\n    outside  ");
		editor.selection = new vscode.Selection(1, 14, 0, 0);
		const edit = new vscode.WorkspaceEdit();
		edit.set(editor.document.uri, getCleanupCommandEdits(editor));
		assert.ok(await vscode.workspace.applyEdit(edit));
		assert.strictEqual(editor.document.getText(), "\tfirst\n\t\tsecond\n    outside  ");
	});

	test("multiple selections clean only selected lines without duplicate edits", async () => {
		await open("    first\n    outside  \n        second\n    third");
		editor.selections = [new vscode.Selection(0, 0, 0, 9), new vscode.Selection(2, 0, 3, 9)];
		const edit = new vscode.WorkspaceEdit();
		edit.set(editor.document.uri, getCleanupCommandEdits(editor));
		assert.ok(await vscode.workspace.applyEdit(edit));
		assert.strictEqual(editor.document.getText(), "\tfirst\n    outside  \n\t\tsecond\n\tthird");
	});
});
