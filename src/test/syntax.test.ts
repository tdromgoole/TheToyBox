import * as assert from "assert";
import { tokenizeKdl } from "../syntax/kdl.js";
import { tokenizeAsp } from "../syntax/asp.js";
import { tokenizeNginx } from "../syntax/nginx.js";
import { tokenizeJsSql } from "../syntax/jsSql.js";
import { tokenizeRazorVb } from "../syntax/razorVb.js";
import { tokenizePhpSql } from "../syntax/phpSql.js";

// ─── Helpers ──────────────────────────────────────────────────────────────────

/** Extract the text of every token with a given type. */
function tokensOfType(
	tokens: { type: string; start: number; end: number }[],
	type: string,
	source: string,
): string[] {
	return tokens
		.filter((t) => t.type === type)
		.map((t) => source.slice(t.start, t.end));
}

/** Assert that all token spans are valid (start <= end, within source). */
function assertValidSpans(
	tokens: { type: string; start: number; end: number }[],
	source: string,
): void {
	for (const t of tokens) {
		assert.ok(
			t.start <= t.end,
			`${t.type}: start ${t.start} > end ${t.end}`,
		);
		assert.ok(t.start >= 0, `${t.type}: start < 0`);
		assert.ok(
			t.end <= source.length,
			`${t.type}: end ${t.end} > source.length ${source.length}`,
		);
	}
}

// ─── tokenizeKdl ─────────────────────────────────────────────────────────────

suite("tokenizeKdl", () => {
	test("empty string → no tokens", () => {
		assert.deepStrictEqual(tokenizeKdl(""), []);
	});

	test("line comment → one comment token", () => {
		const src = "// this is a comment";
		const tokens = tokenizeKdl(src);
		assertValidSpans(tokens, src);
		const comments = tokensOfType(tokens, "comment", src);
		assert.strictEqual(comments.length, 1);
		assert.ok(comments[0].includes("this is a comment"));
	});

	test("block comment → one comment token", () => {
		const src = "/* block */";
		const tokens = tokenizeKdl(src);
		assertValidSpans(tokens, src);
		assert.ok(tokensOfType(tokens, "comment", src).length >= 1);
	});

	test("string literal → string token", () => {
		const src = `node "hello world"`;
		const tokens = tokenizeKdl(src);
		assertValidSpans(tokens, src);
		const strings = tokensOfType(tokens, "string", src);
		assert.ok(strings.some((s) => s.includes("hello world")));
	});

	test("integer → number token", () => {
		const src = "node 42";
		const tokens = tokenizeKdl(src);
		assertValidSpans(tokens, src);
		const nums = tokensOfType(tokens, "number", src);
		assert.ok(nums.includes("42"));
	});

	test("float → number token", () => {
		const src = "node 3.14";
		const tokens = tokenizeKdl(src);
		assertValidSpans(tokens, src);
		assert.ok(tokensOfType(tokens, "number", src).includes("3.14"));
	});

	test("type annotation → typeAnnotation token", () => {
		const src = `node (u8)42`;
		const tokens = tokenizeKdl(src);
		assertValidSpans(tokens, src);
		const ann = tokensOfType(tokens, "typeAnnotation", src);
		assert.ok(ann.some((a) => a.includes("u8")));
	});

	test("node name → nodeName token", () => {
		const src = "my-node";
		const tokens = tokenizeKdl(src);
		assertValidSpans(tokens, src);
		const names = tokensOfType(tokens, "nodeName", src);
		assert.ok(names.includes("my-node"));
	});

	test("slashdash /- → comment token", () => {
		const src = "node /- 42";
		const tokens = tokenizeKdl(src);
		assertValidSpans(tokens, src);
		assert.ok(tokensOfType(tokens, "comment", src).length >= 1);
	});

	test("hex number → number token", () => {
		const src = "node 0xFF";
		const tokens = tokenizeKdl(src);
		assertValidSpans(tokens, src);
		assert.ok(tokensOfType(tokens, "number", src).length >= 1);
	});

	test("multiple nodes on separate lines", () => {
		const src = "a 1\nb 2\nc 3";
		const tokens = tokenizeKdl(src);
		assertValidSpans(tokens, src);
		assert.ok(tokensOfType(tokens, "number", src).length === 3);
	});
});

// ─── tokenizeAsp ─────────────────────────────────────────────────────────────

suite("tokenizeAsp", () => {
	test("empty string → no tokens", () => {
		assert.deepStrictEqual(tokenizeAsp(""), []);
	});

	test("VBScript apostrophe comment → comment token", () => {
		const src = "<% ' this is a comment %>";
		const tokens = tokenizeAsp(src);
		assertValidSpans(tokens, src);
		assert.ok(tokensOfType(tokens, "comment", src).length >= 1);
	});

	test("REM comment → comment token", () => {
		const src = "<% REM this is also a comment %>";
		const tokens = tokenizeAsp(src);
		assertValidSpans(tokens, src);
		assert.ok(tokensOfType(tokens, "comment", src).length >= 1);
	});

	test("string literal → string token", () => {
		const src = `<% Dim s = "hello" %>`;
		const tokens = tokenizeAsp(src);
		assertValidSpans(tokens, src);
		const strings = tokensOfType(tokens, "string", src);
		assert.ok(strings.some((s) => s.includes("hello")));
	});

	test("VBScript keyword → keyword token", () => {
		const src = "<% Dim x %>"; // 'Dim' should be a keyword
		const tokens = tokenizeAsp(src);
		assertValidSpans(tokens, src);
		const kws = tokensOfType(tokens, "keyword", src).map((s) =>
			s.toLowerCase(),
		);
		assert.ok(kws.includes("dim"));
	});

	test("number literal → number token", () => {
		const src = "<% x = 123 %>";
		const tokens = tokenizeAsp(src);
		assertValidSpans(tokens, src);
		assert.ok(tokensOfType(tokens, "number", src).includes("123"));
	});

	test("HTML tag outside ASP block → htmlTag token", () => {
		const src = "<b>hello</b>";
		const tokens = tokenizeAsp(src);
		assertValidSpans(tokens, src);
		assert.ok(tokensOfType(tokens, "htmlTag", src).length >= 1);
	});

	test("no tokens for plain whitespace", () => {
		const tokens = tokenizeAsp("   \n   ");
		assert.deepStrictEqual(tokens, []);
	});
});

// ─── tokenizeNginx ────────────────────────────────────────────────────────────

suite("tokenizeNginx", () => {
	test("empty string → no tokens", () => {
		assert.deepStrictEqual(tokenizeNginx(""), []);
	});

	test("# comment → comment token", () => {
		const src = "# this is a comment";
		const tokens = tokenizeNginx(src);
		assertValidSpans(tokens, src);
		assert.ok(tokensOfType(tokens, "comment", src).length >= 1);
	});

	test("known directive → keyword token", () => {
		const src = "listen 80;";
		const tokens = tokenizeNginx(src);
		assertValidSpans(tokens, src);
		const kws = tokensOfType(tokens, "keyword", src);
		assert.ok(kws.some((k) => k === "listen"));
	});

	test("block directive → nginxBlock token", () => {
		const src = "server { }";
		const tokens = tokenizeNginx(src);
		assertValidSpans(tokens, src);
		const blocks = tokensOfType(tokens, "nginxBlock", src);
		assert.ok(blocks.some((b) => b === "server"));
	});

	test("nginx variable → nginxVariable token", () => {
		const src = "proxy_pass $upstream;";
		const tokens = tokenizeNginx(src);
		assertValidSpans(tokens, src);
		const vars = tokensOfType(tokens, "nginxVariable", src);
		assert.ok(vars.some((v) => v.includes("upstream")));
	});

	test("quoted string → string token", () => {
		const src = `server_name "example.com";`;
		const tokens = tokenizeNginx(src);
		assertValidSpans(tokens, src);
		assert.ok(tokensOfType(tokens, "string", src).length >= 1);
	});

	test("port number → number token", () => {
		const src = "listen 443;";
		const tokens = tokenizeNginx(src);
		assertValidSpans(tokens, src);
		assert.ok(tokensOfType(tokens, "number", src).includes("443"));
	});
});

// ─── tokenizeJsSql ───────────────────────────────────────────────────────────

suite("tokenizeJsSql", () => {
	test("empty string → no tokens", () => {
		assert.deepStrictEqual(tokenizeJsSql(""), []);
	});

	test("plain JS without SQL → no sql tokens", () => {
		const src = `const x = "hello world";`;
		const tokens = tokenizeJsSql(src);
		assert.strictEqual(
			tokens.filter((t) => t.type.startsWith("sql")).length,
			0,
		);
	});

	test("SQL in double-quoted string → sqlKeyword tokens", () => {
		const src = `const q = "SELECT id FROM users";`;
		const tokens = tokenizeJsSql(src);
		assertValidSpans(tokens, src);
		const sqlKws = tokensOfType(tokens, "sqlKeyword", src).map((k) =>
			k.toUpperCase(),
		);
		assert.ok(sqlKws.includes("SELECT"));
		assert.ok(sqlKws.includes("FROM"));
	});

	test("SQL in template literal → sqlKeyword tokens", () => {
		const src = "const q = `SELECT name FROM products`;";
		const tokens = tokenizeJsSql(src);
		assertValidSpans(tokens, src);
		const sqlKws = tokensOfType(tokens, "sqlKeyword", src).map((k) =>
			k.toUpperCase(),
		);
		assert.ok(sqlKws.includes("SELECT"));
	});

	test("JS line comment skipped", () => {
		const src = `// const q = "SELECT * FROM t";`;
		const tokens = tokenizeJsSql(src);
		assert.strictEqual(
			tokens.filter((t) => t.type === "sqlKeyword").length,
			0,
		);
	});

	test("valid token spans within source", () => {
		const src = `const q = "SELECT id, name FROM users WHERE id = 1";`;
		const tokens = tokenizeJsSql(src);
		assertValidSpans(tokens, src);
	});
});

// ─── tokenizeRazorVb ─────────────────────────────────────────────────────────

suite("tokenizeRazorVb", () => {
	test("empty string → no tokens", () => {
		assert.deepStrictEqual(tokenizeRazorVb(""), []);
	});

	test("VB comment ' → comment token", () => {
		const src = "@Code\n' This is a comment\nEnd Code";
		const tokens = tokenizeRazorVb(src);
		assertValidSpans(tokens, src);
		assert.ok(tokensOfType(tokens, "comment", src).length >= 1);
	});

	test("VB keyword → keyword token", () => {
		const src = "@Code\nDim x As Integer\nEnd Code";
		const tokens = tokenizeRazorVb(src);
		assertValidSpans(tokens, src);
		const kws = tokensOfType(tokens, "keyword", src).map((k) =>
			k.toLowerCase(),
		);
		assert.ok(kws.includes("dim") || kws.includes("as"));
	});

	test("string → string token", () => {
		const src = `@Code\nDim s = "hello"\nEnd Code`;
		const tokens = tokenizeRazorVb(src);
		assertValidSpans(tokens, src);
		const strings = tokensOfType(tokens, "string", src);
		assert.ok(strings.some((s) => s.includes("hello")));
	});

	test("@ razor delimiter → razorDelimiter token", () => {
		const src = "@Model.Name";
		const tokens = tokenizeRazorVb(src);
		assertValidSpans(tokens, src);
		// Either razorDelimiter or similar razor token type
		const razorTokens = tokens.filter((t) => t.type.startsWith("razor"));
		assert.ok(razorTokens.length >= 1);
	});

	test("valid token spans within source", () => {
		const src = "@Code\nDim x As Integer = 42\nEnd Code";
		const tokens = tokenizeRazorVb(src);
		assertValidSpans(tokens, src);
	});
});

// ─── tokenizePhpSql ──────────────────────────────────────────────────────────

suite("tokenizePhpSql", () => {
	for (const [label, value] of [
		["interpolation", "'$email'"],
		["concatenation", "'\".$email.\"'"],
	] as const) {
		test(`DECLARE batch with PHP ${label} highlights both statements`, () => {
			const src = `<?php $sql = "DECLARE @email VARCHAR(255) = ${value};
				SELECT isActive, userID FROM e_test WHERE email = @email";`;
			const tokens = tokenizePhpSql(src, true);
			assertValidSpans(tokens, src);
			assert.deepStrictEqual(tokensOfType(tokens, "sqlKeyword", src), ["DECLARE", "SELECT", "FROM", "WHERE"]);
			assert.deepStrictEqual(tokensOfType(tokens, "sqlType", src), ["VARCHAR"]);
			assert.deepStrictEqual(tokensOfType(tokens, "sqlVariable", src), ["@email", "@email"]);
			assert.deepStrictEqual(tokensOfType(tokens, "number", src), ["255"]);
			const emailStart = src.indexOf("$email");
			assert.ok(tokens.every((token) => token.end <= emailStart || token.start >= emailStart + 6));
		});
	}

	test("DECLARE does not enable highlighting for subsequent unrelated strings", () => {
		const src = `<?php $sql = "DECLARE @email VARCHAR(255)"; $label = "declare your name";
			$html = "<select name='email'>1</select>"; $other = "'".$email."'; SELECT id FROM users";`;
		const tokens = tokenizePhpSql(src, true);
		assert.deepStrictEqual(tokensOfType(tokens, "sqlKeyword", src), ["DECLARE"]);
		assert.ok(tokens.every((token) => token.end < src.indexOf("$label")));
	});

	test("SQL editor mode preserves HTML and ordinary PHP colors", () => {
		const src = `<select class="select" data-query="SELECT id FROM users"><option>1</option></select>
<?php $name = "Hello $user"; $count = 42; if ($count) { echo 'update'; } // comment
?> <div title="SELECT id FROM users">update</div>`;
		assert.deepStrictEqual(tokenizePhpSql(src, true), []);
	});

	test("SQL editor mode skips interpolated PHP variables and properties", () => {
		const src = `<?php $q = "SELECT id FROM users WHERE id = $user->count AND name = {$row["name"]}"; ?>`;
		const tokens = tokenizePhpSql(src, true);
		assert.deepStrictEqual(tokensOfType(tokens, "sqlKeyword", src), ["SELECT", "FROM", "WHERE", "AND"]);
		assert.ok(tokens.every((token) => !src.slice(token.start, token.end).includes("count")));
		assertValidSpans(tokens, src);
	});

	test("short echo blocks highlight only SQL strings", () => {
		const src = `<div><?= "SELECT id FROM users" ?></div>`;
		assert.deepStrictEqual(tokensOfType(tokenizePhpSql(src, true), "sqlKeyword", src), ["SELECT", "FROM"]);
	});

	test("empty string → no tokens", () => {
		assert.deepStrictEqual(tokenizePhpSql(""), []);
	});

	test("plain PHP string without SQL → no sql tokens", () => {
		const src = `$msg = "hello world";`;
		const tokens = tokenizePhpSql(src);
		assert.strictEqual(
			tokens.filter((t) => t.type.startsWith("sql")).length,
			0,
		);
	});

	test("highlights general PHP syntax", () => {
		const src = `<?php\n$token = getenv('TOKEN');\nif ($token === false) { throw new RuntimeException('missing'); }`;
		const tokens = tokenizePhpSql(src);
		assertValidSpans(tokens, src);
		assert.ok(tokensOfType(tokens, "phpVariable", src).includes("$token"));
		assert.ok(tokensOfType(tokens, "phpFunction", src).includes("getenv"));
		assert.ok(tokensOfType(tokens, "keyword", src).includes("if"));
		assert.ok(tokensOfType(tokens, "string", src).includes("'TOKEN'"));
	});

	test("SQL in PHP double-quoted string → sqlKeyword tokens", () => {
		const src = `$q = "SELECT id FROM users";`;
		const tokens = tokenizePhpSql(src);
		assertValidSpans(tokens, src);
		const sqlKws = tokensOfType(tokens, "sqlKeyword", src).map((k) =>
			k.toUpperCase(),
		);
		assert.ok(sqlKws.includes("SELECT"));
		assert.ok(sqlKws.includes("FROM"));
	});

	test("SQL keyword column type → sqlType token", () => {
		const src = `$q = "CREATE TABLE t (id INT NOT NULL)";`;
		const tokens = tokenizePhpSql(src);
		assertValidSpans(tokens, src);
		const types = tokensOfType(tokens, "sqlType", src).map((t) =>
			t.toUpperCase(),
		);
		assert.ok(types.includes("INT"));
	});

	test("valid token spans within source", () => {
		const src = `$q = "SELECT name, age FROM people WHERE age > 18";`;
		const tokens = tokenizePhpSql(src);
		assertValidSpans(tokens, src);
	});
});

suite("embedded SQL boundaries", () => {
	for (const [language, tokenize] of [
		["PHP", (text: string) => tokenizePhpSql(text, true)],
		["JS", tokenizeJsSql],
	] as const) {
		test(`${language}: labels and HTML containing SQL words stay unchanged`, () => {
			for (const value of ["select", "update user", "Please select a user", "<select name='user'>1</select>", "<div>SELECT id FROM users</div>"]) {
				assert.deepStrictEqual(tokenize(`value = "${value}";`), [], value);
			}
		});

		test(`${language}: SQL comments cannot consume following host code`, () => {
			for (const comment of ["-- comment", "/* unfinished comment"]) {
				const src = `q = "SELECT id FROM users ${comment}"; count = 42;\nnext = "SELECT name FROM people";`;
				const tokens = tokenize(src);
				assert.deepStrictEqual(tokensOfType(tokens, "sqlKeyword", src), ["SELECT", "FROM", "SELECT", "FROM"]);
				assert.deepStrictEqual(tokensOfType(tokens, "comment", src), [comment]);
				assert.deepStrictEqual(tokensOfType(tokens, "number", src), []);
				assertValidSpans(tokens, src);
			}
		});

		test(`${language}: common SQL statements remain highlighted`, () => {
			for (const sql of ["SELECT id FROM users", "SELECT 1", "INSERT INTO users VALUES (1)", "UPDATE users SET name = 1", "DELETE FROM users", "CREATE TABLE t (id INT)", "WITH cte AS (SELECT id FROM users) SELECT * FROM cte"]) {
				const src = `q = "${sql}";`;
				assert.ok(tokensOfType(tokenize(src), "sqlKeyword", src).length > 0, sql);
			}
		});
	}

	test("JS template expressions keep their own highlighting", () => {
		const src = 'const q = `SELECT id FROM users WHERE id = ${user.count + 1}`;';
		const tokens = tokenizeJsSql(src);
		assert.deepStrictEqual(tokensOfType(tokens, "sqlKeyword", src), ["SELECT", "FROM", "WHERE"]);
		assert.deepStrictEqual(tokensOfType(tokens, "number", src), []);
	});
});
