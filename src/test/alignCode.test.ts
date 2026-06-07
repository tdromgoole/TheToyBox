import * as assert from "assert";
import { getVisualWidth, buildAlignedLines } from "../alignUtils.js";

// ─── getVisualWidth ────────────────────────────────────────────────────────────

suite("getVisualWidth", () => {
	test("empty string → 0", () => {
		assert.strictEqual(getVisualWidth("", 4), 0);
	});

	test("plain text counts one per character", () => {
		assert.strictEqual(getVisualWidth("abc", 4), 3);
		assert.strictEqual(getVisualWidth("hello", 4), 5);
	});

	test("single tab at column 0 snaps to tabSize", () => {
		assert.strictEqual(getVisualWidth("\t", 4), 4);
		assert.strictEqual(getVisualWidth("\t", 2), 2);
		assert.strictEqual(getVisualWidth("\t", 8), 8);
	});

	test("tab after text snaps to the NEXT tab stop (not += tabSize)", () => {
		assert.strictEqual(getVisualWidth("a\t", 4), 4); // 1 → 4
		assert.strictEqual(getVisualWidth("ab\t", 4), 4); // 2 → 4
		assert.strictEqual(getVisualWidth("abc\t", 4), 4); // 3 → 4
	});

	test("tab exactly at a tab-stop boundary jumps a full width", () => {
		assert.strictEqual(getVisualWidth("abcd\t", 4), 8); // 4 → 8
		assert.strictEqual(getVisualWidth("abcdefgh\t", 4), 12); // 8 → 12
	});

	test("two consecutive tabs from column 0", () => {
		assert.strictEqual(getVisualWidth("\t\t", 4), 8);
		assert.strictEqual(getVisualWidth("\t\t\t", 4), 12);
	});

	test("mixed tab + text", () => {
		assert.strictEqual(getVisualWidth("\t$x", 4), 6); // 4 + 2
		assert.strictEqual(getVisualWidth("\t$longVar", 4), 12); // 4 + 8
	});

	test("tabSize = 2", () => {
		assert.strictEqual(getVisualWidth("\t", 2), 2);
		assert.strictEqual(getVisualWidth("a\t", 2), 2); // 1 → 2
		assert.strictEqual(getVisualWidth("ab\t", 2), 4); // 2 → 4
	});
});

// ─── buildAlignedLines — "=" operator ─────────────────────────────────────────

// Assignment regex: "=" not preceded by !, <, >, =, +, -, *, / and not followed by > or =
const EQ = /(?<![!<>=+\-*/])=(?![>=])/;

suite('buildAlignedLines  ("=" operator)', () => {
	test("aligns two lines to the first tab stop past the longest prefix", () => {
		// $x=2, $longVar=8 → max=8 → target=12
		// $x      (2): ceil((12-2)/4)=3 tabs  2→4→8→12
		// $longVar(8): ceil((12-8)/4)=1 tab   8→12
		const out = buildAlignedLines(["$x = 1", "$longVar = 2"], EQ, 4);
		assert.strictEqual(out[0], "$x\t\t\t= 1");
		assert.strictEqual(out[1], "$longVar\t= 2");
	});

	test("strips existing whitespace between prefix and operator", () => {
		const out = buildAlignedLines(["$x   = 1", "$longVar = 2"], EQ, 4);
		assert.strictEqual(out[0], "$x\t\t\t= 1");
		assert.strictEqual(out[1], "$longVar\t= 2");
	});

	test("re-aligning already-aligned lines is idempotent", () => {
		const first = buildAlignedLines(["$x = 1", "$longVar = 2"], EQ, 4);
		const second = buildAlignedLines(first, EQ, 4);
		assert.deepStrictEqual(first, second);
	});

	test("non-matching lines pass through unchanged", () => {
		// // comment has no =, $x and $y both have width 2 → target=4
		const out = buildAlignedLines(
			["// comment", "$x = 1", "$y = 2"],
			EQ,
			4,
		);
		assert.strictEqual(out[0], "// comment");
		assert.strictEqual(out[1], "$x\t= 1");
		assert.strictEqual(out[2], "$y\t= 2");
	});

	test("all non-matching lines → array returned unchanged", () => {
		const lines = ["// no operator", "/* none at all */"];
		assert.deepStrictEqual(buildAlignedLines(lines, EQ, 4), lines);
	});

	test("single matching line gets exactly one tab gap", () => {
		// $x=2 → max=2 → target=4 → 1 tab
		const out = buildAlignedLines(["$x = 1"], EQ, 4);
		assert.strictEqual(out[0], "$x\t= 1");
	});

	test("preserves tab-based indentation", () => {
		// \\t$x=6, \\t$longVar=12 → max=12 → target=16
		// \\t$x      (6):  ceil((16-6)/4)=3 tabs  6→8→12→16
		// \\t$longVar(12): ceil((16-12)/4)=1 tab  12→16
		const out = buildAlignedLines(["\t$x = 1", "\t$longVar = 2"], EQ, 4);
		assert.strictEqual(out[0], "\t$x\t\t\t= 1");
		assert.strictEqual(out[1], "\t$longVar\t= 2");
	});

	test("prefix exactly at a tab stop still inserts a tab gap", () => {
		// abcd=4 (at stop), ab=2 → max=4 → target=8
		// abcd(4): ceil((8-4)/4)=1 tab   4→8
		// ab  (2): ceil((8-2)/4)=2 tabs  2→4→8
		const out = buildAlignedLines(["abcd = 1", "ab = 2"], EQ, 4);
		assert.strictEqual(out[0], "abcd\t= 1");
		assert.strictEqual(out[1], "ab\t\t= 2");
	});

	test("tabSize = 2", () => {
		// a=1, abc=3 → max=3 → target=4
		// a  (1): ceil((4-1)/2)=2 tabs  1→2→4
		// abc(3): ceil((4-3)/2)=1 tab   3→4
		const out = buildAlignedLines(["a = 1", "abc = 2"], EQ, 2);
		assert.strictEqual(out[0], "a\t\t= 1");
		assert.strictEqual(out[1], "abc\t= 2");
	});

	test("tabSize = 8", () => {
		// $x=2, $longVar=8 → max=8 → target=16
		// $x      (2): ceil((16-2)/8)=2 tabs  2→8→16
		// $longVar(8): ceil((16-8)/8)=1 tab   8→16
		const out = buildAlignedLines(["$x = 1", "$longVar = 2"], EQ, 8);
		assert.strictEqual(out[0], "$x\t\t= 1");
		assert.strictEqual(out[1], "$longVar\t= 2");
	});

	test("does not match +=, -=, >=, <=, ==, !=, or =>", () => {
		const operators = [
			"$x += 1",
			"$x -= 1",
			"$x >= 1",
			"$x <= 1",
			"$x == 1",
			"$x != 1",
			"$x => 1",
		];
		operators.forEach((line) => {
			assert.ok(!EQ.test(line), `EQ regex should not match: ${line}`);
		});
	});
});

// ─── buildAlignedLines — "=>" operator ────────────────────────────────────────

const FAT = /=>/;

suite('buildAlignedLines  ("=>" operator)', () => {
	test("aligns fat-arrow operator", () => {
		// 'key'=5, 'longKey'=9 → max=9 → target=12
		// 'key'   (5): ceil((12-5)/4)=2 tabs  5→8→12
		// 'longKey'(9): ceil((12-9)/4)=1 tab  9→12
		const out = buildAlignedLines(
			["'key' => 'val'", "'longKey' => 'val2'"],
			FAT,
			4,
		);
		assert.strictEqual(out[0], "'key'\t\t=> 'val'");
		assert.strictEqual(out[1], "'longKey'\t=> 'val2'");
	});
});

// ─── buildAlignedLines — ":" operator ─────────────────────────────────────────

const COLON = /(?<!:):(?![:\/])/;

suite('buildAlignedLines  (":" operator)', () => {
	test("aligns colon operator", () => {
		// color=5, background-color=16 → max=16 → target=20
		// color           (5):  ceil((20-5)/4)=4 tabs  5→8→12→16→20
		// background-color(16): ceil((20-16)/4)=1 tab  16→20
		const out = buildAlignedLines(
			["color: red", "background-color: blue"],
			COLON,
			4,
		);
		assert.strictEqual(out[0], "color\t\t\t\t: red");
		assert.strictEqual(out[1], "background-color\t: blue");
	});

	test("does not match the :// in a URL, but does match the property colon", () => {
		// url=3, color=5 → max=5 → target=8
		// url  (3): ceil((8-3)/4)=2 tabs  3→4→8
		// color(5): ceil((8-5)/4)=1 tab   5→8
		const out = buildAlignedLines(
			["url: https://example.com", "color: red"],
			COLON,
			4,
		);
		assert.strictEqual(out[0], "url\t\t: https://example.com");
		assert.strictEqual(out[1], "color\t: red");
	});

	test("does not match :: (CSS pseudo-elements)", () => {
		assert.ok(
			!COLON.test("div::before"),
			"COLON should not match ::before",
		);
		assert.ok(!COLON.test(".cls::after"), "COLON should not match ::after");
	});
});
