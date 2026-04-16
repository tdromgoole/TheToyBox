import { TokenMatch } from "./types";

// ─── T-SQL keyword / type / function sets (all lowercase) ────────────────────
// Shared by phpSql.ts and jsSql.ts.

export const SQL_KEYWORDS = new Set([
	// DML
	"select",
	"insert",
	"update",
	"delete",
	"merge",
	"truncate",
	// DDL
	"create",
	"alter",
	"drop",
	"use",
	"enable",
	"disable",
	"rename",
	// TCL
	"commit",
	"rollback",
	"transaction",
	"tran",
	"savepoint",
	"save",
	// Control flow
	"if",
	"else",
	"while",
	"case",
	"when",
	"then",
	"return",
	"break",
	"continue",
	"goto",
	"try",
	"catch",
	"throw",
	"raiserror",
	"print",
	"go",
	"begin",
	"end",
	// T-SQL procedural
	"declare",
	"set",
	"exec",
	"execute",
	"output",
	"inserted",
	"deleted",
	"nocount",
	"identity",
	"procedure",
	"proc",
	"function",
	"trigger",
	"view",
	"table",
	"index",
	"database",
	"schema",
	"constraint",
	"primary",
	"foreign",
	"key",
	"references",
	"default",
	"unique",
	"check",
	"with",
	"nolock",
	"tablock",
	"rowlock",
	"holdlock",
	"readpast",
	"apply",
	"pivot",
	"unpivot",
	"over",
	"partition",
	"rows",
	"range",
	"unbounded",
	"preceding",
	"following",
	"current",
	"row",
	"fetch",
	"next",
	"first",
	"last",
	"only",
	"offset",
	"ties",
	"percent",
	"top",
	"grant",
	"revoke",
	"deny",
	"login",
	"user",
	"role",
	// Clause keywords
	"from",
	"where",
	"join",
	"inner",
	"outer",
	"left",
	"right",
	"full",
	"cross",
	"on",
	"group",
	"order",
	"by",
	"having",
	"union",
	"all",
	"distinct",
	"into",
	"values",
	"as",
	"between",
	"like",
	"not",
	"and",
	"or",
	"is",
	"null",
	"exists",
	"any",
	"some",
	"in",
]);

export const SQL_TYPES = new Set([
	"int",
	"integer",
	"bigint",
	"smallint",
	"tinyint",
	"bit",
	"decimal",
	"numeric",
	"float",
	"real",
	"money",
	"smallmoney",
	"char",
	"nchar",
	"varchar",
	"nvarchar",
	"text",
	"ntext",
	"binary",
	"varbinary",
	"image",
	"date",
	"time",
	"datetime",
	"datetime2",
	"smalldatetime",
	"datetimeoffset",
	"timestamp",
	"rowversion",
	"uniqueidentifier",
	"cursor",
	"xml",
	"sql_variant",
	"hierarchyid",
	"geography",
	"geometry",
	"sysname",
]);

export const SQL_FUNCTIONS = new Set([
	// Aggregate
	"avg",
	"count",
	"max",
	"min",
	"sum",
	"stdev",
	"stdevp",
	"var",
	"varp",
	"string_agg",
	"count_big",
	"grouping",
	"grouping_id",
	// String
	"ascii",
	"char",
	"charindex",
	"concat",
	"concat_ws",
	"format",
	"left",
	"len",
	"lower",
	"ltrim",
	"nchar",
	"patindex",
	"quotename",
	"replace",
	"replicate",
	"reverse",
	"right",
	"rtrim",
	"soundex",
	"space",
	"str",
	"string_escape",
	"string_split",
	"stuff",
	"substring",
	"translate",
	"trim",
	"unicode",
	"upper",
	// Date / time
	"dateadd",
	"datediff",
	"datediff_big",
	"datefromparts",
	"datename",
	"datepart",
	"datetime2fromparts",
	"datetimefromparts",
	"datetimeoffsetfromparts",
	"day",
	"eomonth",
	"getdate",
	"getutcdate",
	"isdate",
	"month",
	"smalldatetimefromparts",
	"switchoffset",
	"sysdatetime",
	"sysdatetimeoffset",
	"sysutcdatetime",
	"timefromparts",
	"todatetimeoffset",
	"year",
	// Conversion
	"cast",
	"convert",
	"try_cast",
	"try_convert",
	"try_parse",
	"parse",
	// Math
	"abs",
	"acos",
	"asin",
	"atan",
	"atn2",
	"ceiling",
	"cos",
	"cot",
	"degrees",
	"exp",
	"floor",
	"log",
	"log10",
	"pi",
	"power",
	"radians",
	"rand",
	"round",
	"sign",
	"sin",
	"sqrt",
	"square",
	"tan",
	// Misc / system
	"coalesce",
	"iif",
	"isnull",
	"isnumeric",
	"nullif",
	"choose",
	"newid",
	"newsequentialid",
	"row_number",
	"rank",
	"dense_rank",
	"ntile",
	"lag",
	"lead",
	"first_value",
	"last_value",
	"cume_dist",
	"percent_rank",
	"percentile_cont",
	"percentile_disc",
	"object_id",
	"object_name",
	"schema_id",
	"schema_name",
	"db_id",
	"db_name",
	"scope_identity",
	"error_line",
	"error_message",
	"error_number",
	"error_procedure",
	"error_severity",
	"error_state",
]);

// ─── Core SQL scanner ─────────────────────────────────────────────────────────
// Scans SQL tokens within one string, starting at `start` (after the opening
// quote). Stops at `closeChar` or end of file.
//
// `interpolationSkipper` is an optional language-specific callback. When the
// caller detects an interpolation prefix at position i, it calls this function
// which consumes the entire interpolated expression and returns the new i.

export function scanSqlTokens(
	text: string,
	start: number,
	tokens: TokenMatch[],
	closeChar: string,
	interpolationSkipper?: (text: string, i: number) => number,
): number {
	let i = start;

	while (i < text.length) {
		const ch = text[i];

		// ── End of string ────────────────────────────────────────────────────
		if (ch === closeChar) {
			return i + 1;
		}

		// ── Escape sequence ──────────────────────────────────────────────────
		if (ch === "\\") {
			i += 2;
			continue;
		}

		// ── Language-specific interpolation ──────────────────────────────────
		if (interpolationSkipper) {
			const next = interpolationSkipper(text, i);
			if (next !== -1) {
				i = next;
				continue;
			}
		}

		// ── SQL line comment: -- ─────────────────────────────────────────────
		if (ch === "-" && text[i + 1] === "-") {
			const cstart = i;
			while (i < text.length && text[i] !== "\n") {
				i++;
			}
			tokens.push({ type: "comment", start: cstart, end: i });
			continue;
		}

		// ── SQL block comment: /* */ ─────────────────────────────────────────
		if (ch === "/" && text[i + 1] === "*") {
			const cstart = i;
			i += 2;
			while (
				i < text.length &&
				!(text[i] === "*" && text[i + 1] === "/")
			) {
				i++;
			}
			if (i < text.length) {
				i += 2;
			}
			tokens.push({ type: "comment", start: cstart, end: i });
			continue;
		}

		// ── T-SQL variable: @var or @@system_var ─────────────────────────────
		if (ch === "@") {
			const vstart = i;
			i++;
			if (i < text.length && text[i] === "@") {
				i++;
			}
			if (i < text.length && /[a-zA-Z_]/.test(text[i])) {
				while (i < text.length && /\w/.test(text[i])) {
					i++;
				}
				tokens.push({ type: "sqlVariable", start: vstart, end: i });
			}
			continue;
		}

		// ── Number ───────────────────────────────────────────────────────────
		if (/[0-9]/.test(ch) && (i === 0 || !/\w/.test(text[i - 1]))) {
			const nstart = i;
			while (i < text.length && /[0-9.]/.test(text[i])) {
				i++;
			}
			if (i < text.length && (text[i] === "e" || text[i] === "E")) {
				i++;
				if (i < text.length && (text[i] === "+" || text[i] === "-")) {
					i++;
				}
				while (i < text.length && /[0-9]/.test(text[i])) {
					i++;
				}
			}
			tokens.push({ type: "number", start: nstart, end: i });
			continue;
		}

		// ── Identifier: keyword, type, or function ───────────────────────────
		if (/[a-zA-Z_]/.test(ch) && (i === 0 || !/\w/.test(text[i - 1]))) {
			const wstart = i;
			while (i < text.length && /\w/.test(text[i])) {
				i++;
			}
			const word = text.slice(wstart, i).toLowerCase();

			if (SQL_KEYWORDS.has(word)) {
				tokens.push({ type: "sqlKeyword", start: wstart, end: i });
			} else if (SQL_TYPES.has(word)) {
				tokens.push({ type: "sqlType", start: wstart, end: i });
			} else if (SQL_FUNCTIONS.has(word)) {
				tokens.push({ type: "sqlFunction", start: wstart, end: i });
			}
			continue;
		}

		i++;
	}

	return i;
}

// ─── Shared helper: skip a balanced ${...} block ─────────────────────────────
// Used by both PHP and JS interpolation skippers.

export function skipBracedBlock(text: string, i: number): number {
	let depth = 0;
	while (i < text.length) {
		const ch = text[i];
		// Skip string literals to avoid matching braces inside them
		if (ch === '"' || ch === "'" || ch === "`") {
			const quote = ch;
			i++;
			while (i < text.length) {
				if (text[i] === "\\" && i + 1 < text.length) {
					i += 2;
					continue;
				}
				if (text[i] === quote) {
					i++;
					break;
				}
				i++;
			}
			continue;
		}
		if (ch === "{") {
			depth++;
		} else if (ch === "}") {
			depth--;
			if (depth === 0) {
				return i + 1;
			}
		}
		i++;
	}
	return i;
}
