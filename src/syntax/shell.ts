import type { TokenMatch } from "./types.js";

// Token types: comment, shellVar, shellString, shellFlag, keyword

// Patterns applied in priority order; earlier wins at any given position.
const PATTERNS: Array<{ re: RegExp; type: string }> = [
	{ re: /#.*/g, type: "comment" },
	{ re: /\$\{[^}]*\}|\$[A-Za-z_]\w*/g, type: "shellVar" },
	{ re: /"(?:[^"\\]|\\.)*"/g, type: "shellString" },
	{ re: /'[^']*'/g, type: "shellString" },
	{ re: /--?[\w][\w-]*/g, type: "shellFlag" },
	{
		re: /\b(?:if|then|else|elif|fi|for|while|do|done|case|esac|in|function|return|export|local|readonly|declare|source|unset|shift|echo|printf|exit|break|continue|true|false)\b/g,
		type: "keyword",
	},
];

export function tokenizeShell(text: string): TokenMatch[] {
	// Track which character positions have already been claimed.
	const claimed = new Uint8Array(text.length);
	const tokens: TokenMatch[] = [];

	for (const { re, type } of PATTERNS) {
		re.lastIndex = 0;
		let m: RegExpExecArray | null;
		while ((m = re.exec(text)) !== null) {
			const start = m.index;
			const end = start + m[0].length;
			// Skip if any position in this range is already claimed.
			let overlap = false;
			for (let i = start; i < end; i++) {
				if (claimed[i]) {
					overlap = true;
					break;
				}
			}
			if (overlap) {continue;}
			for (let i = start; i < end; i++) {claimed[i] = 1;}
			tokens.push({ start, end, type });
		}
	}

	return tokens.sort((a, b) => a.start - b.start);
}
