import * as vscode from "vscode";

// Directives that open a block context in nginx configs
const BLOCK_DIRECTIVES = new Set([
	"http",
	"server",
	"location",
	"upstream",
	"events",
	"stream",
	"mail",
	"map",
	"geo",
	"split_clients",
	"if",
	"limit_except",
	"types",
]);

// Leaf directives worth showing in the outline (key config lines)
const NOTABLE_DIRECTIVES = new Set([
	"listen",
	"server_name",
	"root",
	"alias",
	"proxy_pass",
	"fastcgi_pass",
	"uwsgi_pass",
	"scgi_pass",
	"return",
	"rewrite",
	"include",
	"ssl_certificate",
	"try_files",
	"error_page",
	"index",
	"add_header",
	"auth_basic",
	"auth_request",
	"deny",
	"allow",
]);

function findNginxBlockEnd(
	document: vscode.TextDocument,
	startLine: number,
): number {
	let depth = 0;
	let started = false;
	for (let i = startLine; i < document.lineCount; i++) {
		const text = document.lineAt(i).text;
		let inString: string | null = null;
		for (let j = 0; j < text.length; j++) {
			const ch = text[j];
			if (inString) {
				if (ch === "\\" && j + 1 < text.length) {
					j++;
					continue;
				}
				if (ch === inString) {
					inString = null;
				}
				continue;
			}
			if (ch === "#") {
				break; // rest of line is comment
			}
			if (ch === '"' || ch === "'") {
				inString = ch;
			} else if (ch === "{") {
				depth++;
				started = true;
			} else if (ch === "}" && started) {
				depth--;
				if (depth === 0) {
					return i;
				}
			}
		}
	}
	return document.lineCount - 1;
}

export function parseNginx(document: vscode.TextDocument): any[] {
	const regionStartRe = /^[#\/\-\*\s!]*region\s+(.*)/i;
	const regionEndRe = /^[#\/\-\*\s!]*endregion/i;

	const rootItems: any[] = [];
	const stack: any[] = []; // stack of open block nodes

	const pushItem = (item: any) => {
		if (stack.length > 0) {
			stack[stack.length - 1].children.push(item);
		} else {
			rootItems.push(item);
		}
	};

	// Track block boundaries so we skip lines already inside a recognized block
	// This is handled by the stack + brace counting below.
	const regionStack: any[] = [];

	for (let i = 0; i < document.lineCount; i++) {
		const text = document.lineAt(i).text;
		const trimmed = text.trim();

		// ── Region markers ──
		const regionStartMatch = trimmed.match(regionStartRe);
		if (regionStartMatch) {
			const label =
				regionStartMatch[1].replace(/\*\/\s*$/, "").trim() || "Region";
			regionStack.push({
				label,
				line: i,
				isRegion: true,
				children: [],
			});
			continue;
		}
		if (regionEndRe.test(trimmed)) {
			if (regionStack.length > 0) {
				const region = regionStack.pop();
				if (regionStack.length > 0) {
					regionStack[regionStack.length - 1].children.push(region);
				} else {
					pushItem(region);
				}
			}
			continue;
		}

		// Skip empty lines and pure comment lines
		if (!trimmed || trimmed.startsWith("#")) {
			continue;
		}

		// ── Closing brace: pop the stack ──
		if (trimmed === "}" || trimmed.startsWith("}")) {
			if (stack.length > 0) {
				stack.pop();
			}
			continue;
		}

		// Strip trailing comments for parsing
		let effective = trimmed;
		{
			let inStr: string | null = null;
			for (let j = 0; j < effective.length; j++) {
				const ch = effective[j];
				if (inStr) {
					if (ch === "\\" && j + 1 < effective.length) {
						j++;
						continue;
					}
					if (ch === inStr) {
						inStr = null;
					}
					continue;
				}
				if (ch === '"' || ch === "'") {
					inStr = ch;
				} else if (ch === "#") {
					effective = effective.slice(0, j).trim();
					break;
				}
			}
		}

		// ── Block directive: directive [args] { ──
		const blockMatch = effective.match(/^(\w[\w-]*)\s*(.*?)\s*\{?\s*$/);
		if (blockMatch && effective.includes("{")) {
			const directive = blockMatch[1].toLowerCase();
			const args = blockMatch[2].replace(/\{\s*$/, "").trim();
			const label = args ? `${directive} ${args}` : directive;
			const endLine = findNginxBlockEnd(document, i);

			const nginxType = BLOCK_DIRECTIVES.has(directive)
				? directive
				: "block";
			const item: any = {
				label,
				line: i,
				endLine,
				nginxType,
				isRegion: true,
				children: [],
			};

			pushItem(item);
			stack.push(item);
			continue;
		}

		// ── Notable leaf directive ──
		const directiveMatch = effective.match(/^(\w[\w-]*)\s*(.*?)\s*;?\s*$/);
		if (directiveMatch) {
			const directive = directiveMatch[1].toLowerCase();
			if (NOTABLE_DIRECTIVES.has(directive)) {
				const args = directiveMatch[2].replace(/;\s*$/, "").trim();
				const label = args ? `${directive} ${args}` : directive;
				pushItem({
					label,
					line: i,
					nginxType: "directive",
					isRegion: false,
					children: [],
				});
			}
		}
	}

	// Flush unclosed regions
	while (regionStack.length > 0) {
		const region = regionStack.pop();
		if (regionStack.length > 0) {
			regionStack[regionStack.length - 1].children.push(region);
		} else {
			rootItems.push(region);
		}
	}

	return rootItems.sort((a, b) => a.line - b.line);
}
