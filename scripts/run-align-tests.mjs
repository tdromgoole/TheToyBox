import { getVisualWidth, buildAlignedLines } from "../out/alignUtils.js";

let passed = 0,
	failed = 0;
function check(label, actual, expected) {
	const ok = JSON.stringify(actual) === JSON.stringify(expected);
	if (ok) {
		console.log("  PASS:", label);
		passed++;
	} else {
		console.error(
			"  FAIL:",
			label,
			"\n    expected:",
			JSON.stringify(expected),
			"\n    got:     ",
			JSON.stringify(actual),
		);
		failed++;
	}
}

const EQ = /(?<![!<>=+\-*/])=(?!>)/;
const FAT = /=>/;
const COLON = /(?<!:):(?![:\/])/;

console.log("\n── getVisualWidth ──");
check("empty string", getVisualWidth("", 4), 0);
check("plain text", getVisualWidth("abc", 4), 3);
check("tab at col 0", getVisualWidth("\t", 4), 4);
check("tab after 1 char", getVisualWidth("a\t", 4), 4);
check("tab after 3 chars", getVisualWidth("abc\t", 4), 4);
check("tab at tab stop", getVisualWidth("abcd\t", 4), 8);
check("two tabs", getVisualWidth("\t\t", 4), 8);
check("tab + text", getVisualWidth("\t$x", 4), 6);
check("tabSize=2 tab", getVisualWidth("\t", 2), 2);
check("tabSize=2 a+tab", getVisualWidth("a\t", 2), 2);
check("tabSize=2 ab+tab", getVisualWidth("ab\t", 2), 4);

console.log("\n── buildAlignedLines (=) ──");
const b1 = buildAlignedLines(["$x = 1", "$longVar = 2"], EQ, 4);
check("$x aligned", b1[0], "$x\t\t\t= 1");
check("$longVar aligned", b1[1], "$longVar\t= 2");

const b2 = buildAlignedLines(["$x   = 1", "$longVar = 2"], EQ, 4);
check("trims whitespace $x", b2[0], "$x\t\t\t= 1");
check("trims whitespace $lv", b2[1], "$longVar\t= 2");

const b3 = buildAlignedLines(b1, EQ, 4);
check("idempotent [0]", b3[0], b1[0]);
check("idempotent [1]", b3[1], b1[1]);

const b4 = buildAlignedLines(["// comment", "$x = 1", "$y = 2"], EQ, 4);
check("non-match passthrough", b4[0], "// comment");
check("non-match $x", b4[1], "$x\t= 1");
check("non-match $y", b4[2], "$y\t= 2");

const noOp = ["// no operator", "/* none at all */"];
check("all non-match unchanged", buildAlignedLines(noOp, EQ, 4), noOp);
check("single line", buildAlignedLines(["$x = 1"], EQ, 4)[0], "$x\t= 1");

const b5 = buildAlignedLines(["\t$x = 1", "\t$longVar = 2"], EQ, 4);
check("tab-indent $x", b5[0], "\t$x\t\t\t= 1");
check("tab-indent $lv", b5[1], "\t$longVar\t= 2");

const b6 = buildAlignedLines(["abcd = 1", "ab = 2"], EQ, 4);
check("at tab-stop abcd", b6[0], "abcd\t= 1");
check("at tab-stop ab", b6[1], "ab\t\t= 2");

const b7 = buildAlignedLines(["a = 1", "abc = 2"], EQ, 2);
check("tabSize=2 a", b7[0], "a\t\t= 1");
check("tabSize=2 abc", b7[1], "abc\t= 2");

const b8 = buildAlignedLines(["$x = 1", "$longVar = 2"], EQ, 8);
check("tabSize=8 $x", b8[0], "$x\t\t= 1");
check("tabSize=8 $lv", b8[1], "$longVar\t= 2");

console.log("\n── buildAlignedLines (=>) ──");
const f1 = buildAlignedLines(["'key' => 'val'", "'longKey' => 'val2'"], FAT, 4);
check("fat-arrow 'key'", f1[0], "'key'\t\t=> 'val'");
check("fat-arrow 'longKey'", f1[1], "'longKey'\t=> 'val2'");

console.log("\n── buildAlignedLines (:) ──");
const c1 = buildAlignedLines(
	["color: red", "background-color: blue"],
	COLON,
	4,
);
check("colon color", c1[0], "color\t\t\t\t: red");
check("colon bg-color", c1[1], "background-color\t: blue");

const c2 = buildAlignedLines(
	["url: https://example.com", "color: red"],
	COLON,
	4,
);
check("url colon", c2[0], "url\t\t: https://example.com");
check("color colon", c2[1], "color\t: red");
check("no :: match", COLON.test("div::before"), false);
check("no :// match", COLON.test("https://x"), false);

console.log("\n─────────────────────");
console.log(`${passed} passed, ${failed} failed`);
process.exit(failed > 0 ? 1 : 0);
