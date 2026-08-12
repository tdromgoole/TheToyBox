import * as assert from "node:assert";
import { execFileSync } from "node:child_process";
import * as fs from "node:fs";
import * as path from "node:path";
import * as vscode from "vscode";

suite("Blocked Changes multi-root isolation", () => {
	test("stores each blocked file in its owning workspace root", async () => {
		if (process.env.TOYBOX_TEST_MULTI_ROOT !== "1") {
			return;
		}
		const folders = vscode.workspace.workspaceFolders;
		assert.strictEqual(folders?.length, 2);
		const [rootA, rootB] = folders!;
		const metadataA = path.join(rootA.uri.fsPath, ".toybox-blocked.txt");
		const metadataB = path.join(rootB.uri.fsPath, ".toybox-blocked.txt");
		for (const file of [metadataA, metadataB]) {
			if (fs.existsSync(file)) {
				fs.unlinkSync(file);
			}
		}
		for (const root of [rootA, rootB]) {
			const cwd = root.uri.fsPath;
			if (!fs.existsSync(path.join(cwd, ".git"))) {
				execFileSync("git", ["init", "--quiet"], { cwd });
				execFileSync("git", ["add", "."], { cwd });
				execFileSync("git", ["-c", "user.name=Toy Box Tests", "-c", "user.email=toybox@example.invalid", "commit", "--quiet", "-m", "fixture"], { cwd });
			}
			const fixtureName = root === rootA ? "alpha.txt" : "beta.txt";
			execFileSync("git", ["update-index", "--no-skip-worktree", fixtureName], { cwd });
		}

		try {
			const extension = vscode.extensions.getExtension("ThomasDromgoole.theToyBox");
			assert.ok(extension);
			await extension.activate();
			await vscode.commands.executeCommand("theToyBox.blockChange", {
				resourceUri: vscode.Uri.joinPath(rootA.uri, "alpha.txt"),
			});
			await vscode.commands.executeCommand("theToyBox.blockChange", {
				resourceUri: vscode.Uri.joinPath(rootB.uri, "beta.txt"),
			});

			assert.strictEqual(fs.readFileSync(metadataA, "utf8"), "alpha.txt\n");
			assert.strictEqual(fs.readFileSync(metadataB, "utf8"), "beta.txt\n");
			assert.doesNotMatch(fs.readFileSync(metadataA, "utf8"), /beta/);
			assert.doesNotMatch(fs.readFileSync(metadataB, "utf8"), /alpha/);
			for (const root of [rootA, rootB]) {
				const hook = fs.readFileSync(path.join(root.uri.fsPath, ".git", "hooks", "pre-commit"), "utf8");
				assert.match(hook, /# theToyBox:blocked-changes/);
			}
		} finally {
			for (const file of [metadataA, metadataB]) {
				fs.rmSync(file, { force: true });
			}
		}
	});
});
