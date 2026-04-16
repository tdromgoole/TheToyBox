import * as vscode from "vscode";

export interface EntityCollection {
	allComments: any[];
	sqlEntities: any[];
	phpFunctions: any[];
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
	const isPhpFile = lang === "php";

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
		let inTemplate = false;
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

	return { allComments, sqlEntities, phpFunctions };
}
