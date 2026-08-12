import * as assert from "node:assert";
import * as vscode from "vscode";

suite("Blocked Changes activation without vscode.git", () => {
	test("registers commands without activating the built-in Git extension", async () => {
		if (process.env.TOYBOX_TEST_GIT_DISABLED !== "1") {
			return;
		}
		const gitExtension = vscode.extensions.getExtension("vscode.git");
		assert.ok(!gitExtension?.isActive, "vscode.git must be inactive for this test");

		const extension = vscode.extensions.getExtension("ThomasDromgoole.theToyBox");
		assert.ok(extension, "The Toy Box extension was not found");
		await extension.activate();

		assert.ok(!gitExtension?.isActive, "Toy Box activation must not activate vscode.git");
		const commands = await vscode.commands.getCommands(true);
		assert.ok(commands.includes("theToyBox.blockChange"));
		assert.ok(commands.includes("theToyBox.unblockChange"));
		assert.ok(commands.includes("theToyBox.discardBlockedChange"));
		assert.ok(commands.includes("theToyBox.savePdf"));
	});
});
