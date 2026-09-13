import * as assert from "assert";
import * as vscode from "vscode";
import { runSetupInstall } from "../projectSetup.js";

suite("Project Setup task execution", () => {
	test("reports successful and failed process exits", async function () {
		this.timeout(20000);
		const root = vscode.workspace.workspaceFolders?.[0]?.uri.fsPath;
		if (!root || !vscode.workspace.isTrusted) { this.skip(); return; }
		assert.strictEqual(await runSetupInstall(root, "node", ["-e", "process.exit(0)"]), true);
		assert.strictEqual(await runSetupInstall(root, "node", ["-e", "process.exit(7)"]), false);
	});
});
