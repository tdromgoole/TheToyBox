import * as vscode from "vscode";

function findJqueryHandlerEnd(
	document: vscode.TextDocument,
	startLine: number,
): number {
	let depth = 0;
	let started = false;
	for (let i = startLine; i < document.lineCount; i++) {
		const text = document.lineAt(i).text;
		let inSingle = false;
		let inDouble = false;
		let inTemplate = false;
		for (let j = 0; j < text.length; j++) {
			const ch = text[j];
			if (inDouble) {
				if (ch === "\\" && j + 1 < text.length) {
					j++;
					continue;
				}
				if (ch === '"') {
					inDouble = false;
				}
				continue;
			}
			if (inSingle) {
				if (ch === "\\" && j + 1 < text.length) {
					j++;
					continue;
				}
				if (ch === "'") {
					inSingle = false;
				}
				continue;
			}
			if (inTemplate) {
				if (ch === "\\" && j + 1 < text.length) {
					j++;
					continue;
				}
				if (ch === "`") {
					inTemplate = false;
				}
				continue;
			}
			if (ch === '"') {
				inDouble = true;
			} else if (ch === "'") {
				inSingle = true;
			} else if (ch === "`") {
				inTemplate = true;
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

export function parseJs(
	document: vscode.TextDocument,
	symbols: vscode.DocumentSymbol[],
): any[] {
	const lang = document.languageId.toLowerCase();
	const isJsFile = ["javascript", "javascriptreact"].includes(lang);

	// ── Comment detection config ──
	const config = vscode.workspace.getConfiguration(
		"theToyBox.customComments",
	);
	const stylingEnabled = config.get<boolean>("enabled", true);
	const commentColors = config.get<{ [key: string]: string }>("colors") || {};
	const labelMap = config.get<{ [key: string]: string }>("labels") || {};
	const showBackground = config.get<boolean>("showBackground", true);
	const triggerChars = Object.keys(commentColors);

	// JS/TS: exclude ' (used in strings) and # (not a JS comment prefix)
	const commentPrefixes = ["//", "--", "%"];

	const allComments: any[] = [];
	const tsJsItems: any[] = [];

	// ── Single-pass scan: detect items and comments ──
	for (let i = 0; i < document.lineCount; i++) {
		const line = document.lineAt(i);
		const text = line.text;
		const trimmed = text.trim();

		// Classes: TS only — JS outline is limited to functions, jQuery events, and comments
		if (!isJsFile) {
			const classMatch = text.match(
				/^\s*(?:export\s+(?:default\s+)?)?(?:abstract\s+)?class\s+(\w+)/,
			);
			if (classMatch) {
				tsJsItems.push({
					label: classMatch[1],
					line: i,
					tsJsType: "class",
					isRegion: false,
					children: [],
				});
				continue;
			}
		}

		const funcMatch = text.match(
			/^\s*(?:export\s+(?:default\s+)?)?(?:async\s+)?function\s+(\w+)\s*\(/,
		);
		if (funcMatch) {
			tsJsItems.push({
				label: funcMatch[1] + "()",
				line: i,
				tsJsType: "function",
				isRegion: false,
				children: [],
			});
			continue;
		}

		const arrowMatch = text.match(
			/^\s*(?:export\s+)?(?:const|let|var)\s+(\w+)\s*=\s*(?:async\s+)?(?:\([^)]*\)|\w+)\s*=>/,
		);
		if (arrowMatch) {
			tsJsItems.push({
				label: arrowMatch[1] + "()",
				line: i,
				tsJsType: "arrowFunction",
				isRegion: false,
				children: [],
			});
			continue;
		}

		// jQuery .on() — $("#id").on("event", fn) or $(".cls").on("event", fn)
		const jqOnMatch = text.match(
			/\$\(["']([.#][\w-]+)["']\)\.on\(["'](\w+)["']\s*,\s*function/,
		);
		if (jqOnMatch) {
			const raw = jqOnMatch[1];
			const isId = raw.startsWith("#");
			const name = raw.slice(1);
			const event =
				jqOnMatch[2].charAt(0).toUpperCase() + jqOnMatch[2].slice(1);
			tsJsItems.push({
				label: `${name}.${event}`,
				line: i,
				endLine: findJqueryHandlerEnd(document, i),
				tsJsType: "jqueryEvent",
				jquerySelector: isId ? "id" : "class",
				isRegion: false,
				children: [],
			});
			continue;
		}

		// jQuery .delegate() — $(...).delegate(".cls", "event", fn) or $(...).delegate("#id", "event", fn)
		const jqDelegateMatch = text.match(
			/\.delegate\(["']([.#][\w-]+)["']\s*,\s*["'](\w+)["']\s*,\s*function/,
		);
		if (jqDelegateMatch) {
			const raw = jqDelegateMatch[1];
			const isId = raw.startsWith("#");
			const name = raw.slice(1);
			const event =
				jqDelegateMatch[2].charAt(0).toUpperCase() +
				jqDelegateMatch[2].slice(1);
			tsJsItems.push({
				label: `${name}.${event}.Delegate`,
				line: i,
				endLine: findJqueryHandlerEnd(document, i),
				tsJsType: "jqueryEvent",
				jquerySelector: isId ? "id" : "class",
				isRegion: false,
				children: [],
			});
			continue;
		}

		// ── Comment scanning (string-safe, O(n) flag-based) ──
		let foundPrefix: string | undefined;
		let prefixIndex = -1;

		let inSingle = false;
		let inDouble = false;
		let inTemplate = false;
		let hasNonWhitespaceBefore = false;
		for (let charIdx = 0; charIdx < text.length; charIdx++) {
			const ch = text[charIdx];

			if (inDouble) {
				if (ch === "\\") {
					charIdx++;
					continue;
				}
				if (ch === '"') {
					inDouble = false;
				}
				continue;
			}
			if (inSingle) {
				if (ch === "\\") {
					charIdx++;
					continue;
				}
				if (ch === "'") {
					inSingle = false;
				}
				continue;
			}
			if (inTemplate) {
				if (ch === "\\") {
					charIdx++;
					continue;
				}
				if (ch === "`") {
					inTemplate = false;
				}
				continue;
			}

			const currentPrefix = commentPrefixes.find((p) =>
				text.startsWith(p, charIdx),
			);
			if (currentPrefix) {
				prefixIndex = charIdx;
				foundPrefix = currentPrefix;
				break;
			}

			if (ch === '"') {
				inDouble = true;
				hasNonWhitespaceBefore = true;
			} else if (ch === "'") {
				inSingle = true;
				hasNonWhitespaceBefore = true;
			} else if (ch === "`") {
				inTemplate = true;
				hasNonWhitespaceBefore = true;
			} else if (ch !== " " && ch !== "\t") {
				hasNonWhitespaceBefore = true;
			}
		}

		if (!foundPrefix || prefixIndex === -1) {
			continue;
		}

		// Skip region markers
		if (
			/^[#\/\-\*\s!]*region\s+/i.test(trimmed) ||
			/^[#\/\-\*\s!]*endregion/i.test(trimmed)
		) {
			continue;
		}

		const afterPrefix = text
			.substring(prefixIndex + foundPrefix.length)
			.trimStart();
		const triggerChar = triggerChars.find((char) => {
			if (!afterPrefix.startsWith(char)) {
				return false;
			}
			if (char === "$") {
				const charAfterTrigger = afterPrefix.charAt(char.length);
				if (/\w/.test(charAfterTrigger)) {
					return false;
				}
			}
			return true;
		});

		let displayLabel = afterPrefix;
		if (triggerChar) {
			const replacementWord = labelMap[triggerChar];
			const contentOnly = afterPrefix
				.substring(triggerChar.length)
				.trimStart();
			displayLabel = replacementWord
				? `${replacementWord}: ${contentOnly}`
				: `${triggerChar}: ${contentOnly}`;
		}

		allComments.push({
			label: displayLabel,
			line: i,
			isComment: true,
			color:
				stylingEnabled && triggerChar
					? commentColors[triggerChar]
					: null,
			backgroundColor:
				stylingEnabled && triggerChar && showBackground
					? commentColors[triggerChar] + "33"
					: null,
			isBold: stylingEnabled && triggerChar === "!",
			isRegion: false,
			children: [],
		});
	}

	// ── Helpers ──
	const claimedLines = new Set<number>();

	const nestContent = (symbolList: vscode.DocumentSymbol[]): any[] => {
		return symbolList.map((s) => {
			const formatted: any = {
				label: s.name,
				line: s.range.start.line,
				kind: s.kind,
				isRegion: true,
				children: [],
			};
			if (s.children?.length) {
				formatted.children.push(...nestContent(s.children));
			}
			const internalComments = allComments.filter(
				(c) =>
					s.range.contains(new vscode.Position(c.line, 0)) &&
					!claimedLines.has(c.line),
			);
			internalComments.forEach((c) => claimedLines.add(c.line));
			formatted.children.push(...internalComments);
			formatted.children.sort((a: any, b: any) => a.line - b.line);
			if (formatted.children.length === 0) {
				formatted.isRegion = false;
			}
			return formatted;
		});
	};

	// ── Enrich items with LS symbol children ──
	for (const item of tsJsItems) {
		if (item.tsJsType === "jqueryEvent") {
			continue;
		}
		const matchingSym = symbols.find(
			(s) => Math.abs(s.range.start.line - item.line) <= 1,
		);
		if (matchingSym) {
			item.endLine = matchingSym.range.end.line;
			// JS files: only use the LS symbol for endLine — no children,
			// no claimed lines. Comments are nested separately below.
			if (!isJsFile) {
				claimedLines.add(matchingSym.range.start.line);
				if (matchingSym.children?.length) {
					item.children.push(...nestContent(matchingSym.children));
					item.isRegion = true;
				}
			}
		}
	}

	// ── #region marker hierarchy ──
	const rootItems: any[] = [];
	const regionStack: any[] = [];

	for (let i = 0; i < document.lineCount; i++) {
		const text = document.lineAt(i).text.trim();
		const startMatch = text.match(/^[#\/\-\*\s!]*region\s+(.*)/i);
		const endMatch = text.match(/^[#\/\-\*\s!]*endregion/i);

		if (startMatch) {
			regionStack.push({
				label: startMatch[1] || "Region",
				line: i,
				children: [],
				isRegion: true,
			});
		} else if (endMatch && regionStack.length > 0) {
			const region = regionStack.pop();
			const range = new vscode.Range(
				region.line,
				0,
				i,
				document.lineAt(i).text.length,
			);
			const internalSymbols = symbols.filter(
				(s) =>
					range.contains(s.range) &&
					!claimedLines.has(s.range.start.line),
			);
			region.children.push(...nestContent(internalSymbols));
			internalSymbols.forEach((s) =>
				claimedLines.add(s.range.start.line),
			);

			const internalTsJsItems = tsJsItems.filter(
				(t) =>
					t.line > region.line &&
					t.line < i &&
					!claimedLines.has(t.line),
			);
			internalTsJsItems.forEach((t) => claimedLines.add(t.line));
			region.children.push(...internalTsJsItems);

			const internalComments = allComments.filter(
				(c) =>
					c.line > region.line &&
					c.line < i &&
					!claimedLines.has(c.line),
			);
			internalComments.forEach((c) => claimedLines.add(c.line));
			region.children.push(...internalComments);

			region.children.sort((a: any, b: any) => a.line - b.line);
			claimedLines.add(region.line);
			claimedLines.add(i);
			if (regionStack.length > 0) {
				regionStack[regionStack.length - 1].children.push(region);
			} else {
				rootItems.push(region);
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

	// ── JS-specific: nest unclaimed comments inside their containing function ──
	if (isJsFile) {
		const jsFunctions = tsJsItems.filter(
			(t) =>
				(t.tsJsType === "function" ||
					t.tsJsType === "arrowFunction" ||
					t.tsJsType === "jqueryEvent") &&
				!claimedLines.has(t.line),
		);
		for (const fn of jsFunctions) {
			const fnEnd = fn.endLine ?? document.lineCount;
			const nested = allComments.filter(
				(c) =>
					!claimedLines.has(c.line) &&
					c.line > fn.line &&
					c.line <= fnEnd,
			);
			if (nested.length > 0) {
				nested.forEach((c) => claimedLines.add(c.line));
				fn.children.push(...nested);
				fn.children.sort((a: any, b: any) => a.line - b.line);
				fn.isRegion = true;
			}
		}
	}

	// ── Final assembly ──
	const standaloneSymbols = symbols.filter(
		(s) => !claimedLines.has(s.range.start.line),
	);

	return [
		...rootItems,
		...tsJsItems.filter((t) => !claimedLines.has(t.line)),
		...(isJsFile ? [] : nestContent(standaloneSymbols)),
		...allComments.filter((c) => !claimedLines.has(c.line)),
	].sort((a, b) => a.line - b.line);
}
