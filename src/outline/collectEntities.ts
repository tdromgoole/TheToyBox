import * as vscode from "vscode";

function findJqueryHandlerEnd(
	document: vscode.TextDocument,
	startLine: number,
): number {
	let depth = 0;
	let started = false;
	for (let i = startLine; i < document.lineCount; i++) {
		const text = document.lineAt(i).text;
		for (const ch of text) {
			if (ch === "{") {
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

export interface EntityCollection {
	allComments: any[];
	sqlEntities: any[];
	phpFunctions: any[];
	tsJsItems: any[];
}

/**
 * Single-pass scanner that collects all outline-relevant entities from a
 * document. PHP functions, SQL entities, TS/JS symbols, and custom comments
 * are detected in one loop so that a matched entity line is never
 * double-counted as a comment.
 */
export function collectEntities(
	document: vscode.TextDocument,
): EntityCollection {
	const config = vscode.workspace.getConfiguration(
		"theToyBox.customComments",
	);
	const stylingEnabled = config.get<boolean>("enabled", true);
	const commentColors = config.get<{ [key: string]: string }>("colors") || {};
	const labels = config.get<{ [key: string]: string }>("labels") || {};
	const showBackground = config.get<boolean>("showBackground", true);
	const triggerChars = Object.keys(commentColors);

	const lang = document.languageId.toLowerCase();
	const isSqlFile = ["sql", "postgresql", "mssql", "postgres"].includes(lang);

	// Mirror the per-language prefix filtering from customComments.ts so that
	// outline comment detection stays consistent with the highlighter.
	let commentPrefixes = ["//", "--", "#", "%", "'"];
	const excludeSingleQuote = [
		"php",
		"javascript",
		"typescript",
		"sql",
		"mssql",
		"postgres",
		"mysql",
	];
	if (excludeSingleQuote.some((l) => lang.includes(l))) {
		commentPrefixes = commentPrefixes.filter((p) => p !== "'");
	}
	const excludeHash = ["javascript", "typescript", "html", "xml", "css"];
	if (excludeHash.some((l) => lang.includes(l))) {
		commentPrefixes = commentPrefixes.filter((p) => p !== "#");
	}
	commentPrefixes.sort((a, b) => b.length - a.length);

	const allComments: any[] = [];
	const sqlEntities: any[] = [];
	const phpFunctions: any[] = [];
	const tsJsItems: any[] = [];
	const isPhpFile = lang === "php";
	const isTsJsFile = [
		"javascript",
		"typescript",
		"javascriptreact",
		"typescriptreact",
	].includes(lang);
	const isJsFile = ["javascript", "javascriptreact"].includes(lang);

	for (let i = 0; i < document.lineCount; i++) {
		const line = document.lineAt(i);
		const text = line.text;
		const trimmed = text.trim();

		// --- PHP Function Detection ---
		if (isPhpFile) {
			// Match PHP function declarations: function functionName(...) {
			const phpFuncMatch = text.match(
				/^\s*(public|private|protected|static|async)?\s*function\s+(\w+)\s*\(/,
			);

			if (phpFuncMatch) {
				phpFunctions.push({
					label: phpFuncMatch[2] + "()",
					line: i,
					phpType: "function",
					isRegion: false,
					children: [],
				});
				continue;
			}
		}

		// --- TypeScript / JavaScript Detection ---
		if (isTsJsFile) {
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
					jqOnMatch[2].charAt(0).toUpperCase() +
					jqOnMatch[2].slice(1);
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
		}

		// --- SQL Entity Detection ---
		if (isSqlFile) {
			// Regex to match "CREATE [OR REPLACE] TABLE/VIEW/PROCEDURE/FUNCTION name"
			const tableMatch = text.match(/create\s+table\s+([\w\.]+)/i);
			const viewMatch = text.match(
				/create\s+(?:or\s+replace\s+)?view\s+([\w\.]+)/i,
			);
			const procMatch = text.match(
				/create\s+(?:or\s+replace\s+)?(?:stored\s+)?procedure\s+([\w\.]+)/i,
			);
			const funcMatch = text.match(
				/create\s+(?:or\s+replace\s+)?function\s+([\w\.]+)/i,
			);

			if (tableMatch) {
				sqlEntities.push({
					label: tableMatch[1],
					line: i,
					sqlType: "table",
					isRegion: false,
					children: [],
				});
				continue;
			} else if (procMatch) {
				sqlEntities.push({
					label: procMatch[1],
					line: i,
					sqlType: "procedure",
					isRegion: false,
					children: [],
				});
				continue;
			} else if (funcMatch) {
				sqlEntities.push({
					label: funcMatch[1],
					line: i,
					sqlType: "function",
					isRegion: false,
					children: [],
				});
				continue;
			} else if (viewMatch) {
				sqlEntities.push({
					label: viewMatch[1],
					line: i,
					sqlType: "view",
					isRegion: false,
					children: [],
				});
				continue;
			}
		}

		// --- Comment Scanning with String-Safe Logic (O(n) flag-based) ---
		let foundPrefix: string | undefined;
		let prefixIndex = -1;

		let inSingle = false;
		let inDouble = false;
		let hasNonWhitespaceBefore = false;
		for (let charIdx = 0; charIdx < text.length; charIdx++) {
			const ch = text[charIdx];

			// Track closing of open string literals
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

			// Outside any string: check for a comment prefix
			const currentPrefix = commentPrefixes.find((p) =>
				text.startsWith(p, charIdx),
			);
			if (currentPrefix) {
				// Strict check for SQL ' and # (must start the line)
				if (currentPrefix === "'" || currentPrefix === "#") {
					if (hasNonWhitespaceBefore) {
						// Rejected as comment; ' can still open a string
						if (ch === "'") {
							inSingle = true;
						}
						continue;
					}
					const after = text.substring(charIdx + 1);
					if (
						!triggerChars.some((s) =>
							after.trimStart().startsWith(s),
						) &&
						!after.startsWith(" ")
					) {
						// Rejected as comment; ' can still open a string
						if (ch === "'") {
							inSingle = true;
							hasNonWhitespaceBefore = true;
						}
						continue;
					}
				}
				prefixIndex = charIdx;
				foundPrefix = currentPrefix;
				break;
			}

			// Track string openings and non-whitespace
			if (ch === '"') {
				inDouble = true;
				hasNonWhitespaceBefore = true;
			} else if (ch === "'") {
				inSingle = true;
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

			// For PHP dollar signs, don't treat it as a trigger if followed by a word character (variable)
			if (char === "$") {
				const charAfterTrigger = afterPrefix.charAt(char.length);
				if (/\w/.test(charAfterTrigger)) {
					return false; // It's a PHP variable, not a trigger
				}
			}

			return true;
		});

		let displayLabel = afterPrefix;
		if (triggerChar) {
			const replacementWord = labels[triggerChar];
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

	return { allComments, sqlEntities, phpFunctions, tsJsItems };
}
