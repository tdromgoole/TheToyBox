import * as assert from "assert";
import * as fs from "fs";
import * as os from "os";
import * as path from "path";
import {
	ensurePreCommitHook,
	HOOK_END,
	HOOK_START,
	removePreCommitHook,
} from "../blockedChangesHook.js";

suite("Blocked Changes hook lifecycle", () => {
	let root: string;
	let hook: string;

	setup(() => {
		root = fs.mkdtempSync(path.join(os.tmpdir(), "toybox-hook-test-"));
		const hooks = path.join(root, ".git", "hooks");
		fs.mkdirSync(hooks, { recursive: true });
		hook = path.join(hooks, "pre-commit");
	});

	teardown(() => {
		fs.rmSync(root, { recursive: true, force: true });
	});

	test("appends the marked section without overwriting an unrelated hook", () => {
		const existing = "#!/bin/sh\nnpm test\n";
		fs.writeFileSync(hook, existing);

		ensurePreCommitHook(root);
		ensurePreCommitHook(root);

		const installed = fs.readFileSync(hook, "utf8");
		assert.ok(installed.startsWith(existing.trimEnd()));
		assert.strictEqual(installed.match(new RegExp(HOOK_START, "g"))?.length, 1);
		assert.ok(installed.includes(HOOK_END));
	});

	test("removes only the Toy Box section", () => {
		const existing = "#!/bin/sh\necho before\n";
		fs.writeFileSync(hook, existing);
		ensurePreCommitHook(root);

		removePreCommitHook(root);

		assert.strictEqual(fs.readFileSync(hook, "utf8"), existing);
	});

	test("removes a hook file created solely by Toy Box", () => {
		ensurePreCommitHook(root);
		assert.strictEqual(fs.existsSync(hook), true);

		removePreCommitHook(root);

		assert.strictEqual(fs.existsSync(hook), false);
	});

	test("upgrades and removes the legacy unbounded section", () => {
		ensurePreCommitHook(root);
		const legacy = fs.readFileSync(hook, "utf8").replace(`${HOOK_END}\n`, "");
		fs.writeFileSync(hook, legacy);

		ensurePreCommitHook(root);
		assert.ok(fs.readFileSync(hook, "utf8").includes(HOOK_END));

		removePreCommitHook(root);
		assert.strictEqual(fs.existsSync(hook), false);
	});
});
