import * as assert from "assert";
import { ManagedTimeout } from "../managedTimeout.js";

suite("Extension lifecycle cleanup", () => {
	test("clears pending callbacks during disposal", async () => {
		const timer = new ManagedTimeout();
		let called = false;
		timer.schedule(() => { called = true; }, 20);
		assert.strictEqual(timer.pending, true);

		timer.clear();
		await new Promise((resolve) => setTimeout(resolve, 40));

		assert.strictEqual(timer.pending, false);
		assert.strictEqual(called, false);
	});
});
