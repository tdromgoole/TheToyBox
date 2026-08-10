/**
 * codeTokenizer.ts
 *
 * Shared syntax-highlighting helpers used by both the code PDF printer
 * (printer.ts) and the markdown PDF renderer (markdownToPdf.ts).
 */

import type { TokenMatch } from "./syntax/types";
import { tokenizeKdl } from "./syntax/kdl";
import { tokenizeAsp } from "./syntax/asp";
import { tokenizeRazorVb } from "./syntax/razorVb";
import { tokenizePhpSql } from "./syntax/phpSql";
import { tokenizeJsSql } from "./syntax/jsSql";
import { tokenizeNginx } from "./syntax/nginx";
import { tokenizeHttp } from "./syntax/http";
import { tokenizeShell } from "./syntax/shell";

export interface StyledRun {
	text: string;
	color?: string;
	bold?: boolean;
	italic?: boolean;
}

export const TOKEN_COLORS: Record<string, string> = {
	comment: "#57A64A",
	string: "#D69D85",
	number: "#B5CEA8",
	boolean: "#569CD6",
	typeAnnotation: "#4EC9B0",
	nodeName: "#4FC1FF",
	propKey: "#9CDCFE",
	keyword: "#569CD6",
	vbType: "#4EC9B0",
	htmlTag: "#569CD6",
	htmlAttribute: "#FF8C69",
	htmlString: "#D69D85",
	aspDelimiter: "#DCDCAA",
	razorDelimiter: "#DCDCAA",
	razorDirective: "#CE9178",
	sqlKeyword: "#569CD6",
	sqlType: "#4EC9B0",
	sqlFunction: "#DCDCAA",
	sqlVariable: "#9CDCFE",
	nginxVariable: "#9CDCFE",
	nginxBlock: "#4EC9B0",
	httpMethod: "#8250df",
	httpPath: "#0969da",
	httpVersion: "#57606a",
	httpStatus2xx: "#1a7f37",
	httpStatus4xx: "#cf222e",
	httpHeaderName: "#0550ae",
	httpHeaderValue: "#57606a",
	httpParamKey: "#0550ae",
	shellVar: "#8250df",
	shellString: "#0a3069",
	shellFlag: "#0969da",
	phpVariable: "#8250df",
	phpConstant: "#0550ae",
	phpFunction: "#953800",
};

export const TOKEN_BOLD = new Set([
	"nodeName",
	"aspDelimiter",
	"razorDelimiter",
	"nginxBlock",
]);

export const TOKEN_ITALIC = new Set(["comment", "razorDirective"]);

export const CODE_TOKENIZERS: Array<{
	extensions: string[];
	tokenize: (text: string) => TokenMatch[];
}> = [
	{ extensions: [".kdl"], tokenize: tokenizeKdl },
	{ extensions: [".asp"], tokenize: tokenizeAsp },
	{ extensions: [".vbhtml"], tokenize: tokenizeRazorVb },
	{ extensions: [".php"], tokenize: tokenizePhpSql },
	{
		extensions: [".js", ".ts", ".jsx", ".tsx", ".mjs", ".cjs"],
		tokenize: tokenizeJsSql,
	},
	{ extensions: [".conf"], tokenize: tokenizeNginx },
	{ extensions: [".http"], tokenize: tokenizeHttp },
	{ extensions: [".sh", ".bash"], tokenize: tokenizeShell },
];

export function buildStyledRuns(
	text: string,
	tokens: TokenMatch[],
): StyledRun[] {
	const sorted = [...tokens].sort((a, b) => a.start - b.start);
	const runs: StyledRun[] = [];
	let pos = 0;

	for (const token of sorted) {
		if (pos < token.start) {
			runs.push({ text: text.slice(pos, token.start) });
		}
		runs.push({
			text: text.slice(token.start, token.end),
			color: TOKEN_COLORS[token.type],
			bold: TOKEN_BOLD.has(token.type) || undefined,
			italic: TOKEN_ITALIC.has(token.type) || undefined,
		});
		pos = token.end;
	}

	if (pos < text.length) {
		runs.push({ text: text.slice(pos) });
	}

	return runs;
}

/** Splits an array of styled runs into per-line arrays, respecting multi-line tokens. */
export function runsToLines(runs: StyledRun[]): StyledRun[][] {
	const lines: StyledRun[][] = [[]];

	for (const run of runs) {
		const parts = run.text.split("\n");
		for (let i = 0; i < parts.length; i++) {
			if (i > 0) {
				lines.push([]);
			}
			if (parts[i].length > 0) {
				lines[lines.length - 1].push({ ...run, text: parts[i] });
			}
		}
	}

	return lines;
}
