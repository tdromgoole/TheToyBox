import * as assert from "assert";
import {
	normalizeSessions,
	removeSessions,
	Session,
	storeSession,
} from "../sessionState.js";

const first: Session = {
	name: "Feature work",
	files: ["file:///one.ts", "file:///two.ts"],
	active: "file:///two.ts",
	createdAt: "2026-08-10T12:00:00.000Z",
};

suite("Session Restore lifecycle", () => {
	test("loads valid sessions and rejects malformed persisted state", () => {
		assert.deepStrictEqual(normalizeSessions([first]), [first]);
		assert.deepStrictEqual(normalizeSessions({ sessions: [first] }), []);
		assert.deepStrictEqual(
			normalizeSessions([
				first,
				null,
				{ name: "Broken", files: "file:///one.ts", createdAt: "never" },
			]),
			[first],
		);
	});

	test("normalizes names and duplicate files during load", () => {
		assert.deepStrictEqual(
			normalizeSessions([{ ...first, name: "  Feature work  ", files: [first.files[0], first.files[0]] }]),
			[{ ...first, files: [first.files[0]] }],
		);
	});

	test("saves, replaces case-insensitively, and deletes sessions", () => {
		const second: Session = { ...first, name: "Second" };
		assert.deepStrictEqual(storeSession([], first), [first]);
		assert.deepStrictEqual(
			storeSession([first, second], { ...first, name: "FEATURE WORK", files: ["file:///new.ts"] }),
			[{ ...first, name: "FEATURE WORK", files: ["file:///new.ts"] }, second],
		);
		assert.deepStrictEqual(removeSessions([first, second], new Set(["Second"])), [first]);
	});
});
