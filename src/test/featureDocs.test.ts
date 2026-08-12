import * as assert from "assert";
import * as path from "path";
import { findFeatureDocMarkers, resolveFeatureDocPath } from "../featureDocs.js";

suite("Feature documentation markers", () => {
	test("finds markers in common comment styles", () => {
		assert.deepStrictEqual(findFeatureDocMarkers("// @docs: docs/login.md\nconst x = 1;"), [
			{ line: 0, path: "docs/login.md" },
		]);
		assert.deepStrictEqual(findFeatureDocMarkers("/* @doc: 'docs/login flow.md' */"), [
			{ line: 0, path: "docs/login flow.md" },
		]);
	});

	test("only scans the top twenty lines", () => {
		const text = `${Array(20).fill("// header").join("\n")}\n// @docs: docs/late.md`;
		assert.deepStrictEqual(findFeatureDocMarkers(text), []);
	});

	test("resolves workspace and source-relative paths", () => {
		const root = path.resolve("workspace");
		const source = path.join(root, "src", "login.ts");
		assert.strictEqual(resolveFeatureDocPath(source, "docs/login.md", root), path.join(root, "docs", "login.md"));
		assert.strictEqual(resolveFeatureDocPath(source, "../docs/login.md", root), path.join(root, "docs", "login.md"));
	});
});
