import * as vscode from "vscode";

export function parseKdl(document: vscode.TextDocument): any[] {
	const kdlRoot: any[] = [];
	const kdlStack: any[] = []; // stack of open container nodes

	for (let i = 0; i < document.lineCount; i++) {
		const trimmed = document.lineAt(i).text.trim();

		// Skip blank lines, line comments, and block comment lines
		if (
			!trimmed ||
			trimmed.startsWith("//") ||
			trimmed.startsWith("/*") ||
			trimmed.startsWith("*")
		) {
			continue;
		}

		// Closing brace → pop the stack
		if (trimmed === "}" || trimmed === "};") {
			if (kdlStack.length > 0) {
				kdlStack.pop();
			}
			continue;
		}

		// Extract node name: bare identifier or quoted string
		let nodeName: string | null = null;
		let nameEnd = 0;
		const bareMatch = trimmed.match(/^([-\w$.:]+)/);
		const quotedMatch = trimmed.match(/^"((?:[^"\\]|\\.)*)"/);
		if (bareMatch) {
			nodeName = bareMatch[1];
			nameEnd = bareMatch[0].length;
		} else if (quotedMatch) {
			nodeName = `"${quotedMatch[1]}"`;
			nameEnd = quotedMatch[0].length;
		}
		if (!nodeName) {
			continue;
		}

		// Extract the first argument after the node name.
		// - key="value" or key=bare  → "key value" (no = or quotes)
		// - "positional string"       → the unquoted string
		// - bare positional value     → the value as-is
		// Stops at unquoted `{` or `//`.
		let firstArg = "";
		{
			let j = nameEnd;
			// skip whitespace
			while (
				j < trimmed.length &&
				(trimmed[j] === " " || trimmed[j] === "\t")
			) {
				j++;
			}
			// stop immediately at block opener or comment
			if (
				j < trimmed.length &&
				trimmed[j] !== "{" &&
				!(trimmed[j] === "/" && trimmed[j + 1] === "/")
			) {
				// skip type annotation e.g. (u8)
				if (trimmed[j] === "(") {
					while (j < trimmed.length && trimmed[j] !== ")") {
						j++;
					}
					j++; // skip ')'
					while (
						j < trimmed.length &&
						(trimmed[j] === " " || trimmed[j] === "\t")
					) {
						j++;
					}
				}
				const identMatch = trimmed.slice(j).match(/^([-\w$.:]+)/);
				if (identMatch) {
					const ident = identMatch[1];
					j += ident.length;
					if (trimmed[j] === "=") {
						j++; // skip '='
						let val = "";
						if (trimmed[j] === '"') {
							// quoted value — strip the quotes
							j++;
							while (j < trimmed.length && trimmed[j] !== '"') {
								if (trimmed[j] === "\\") {
									j++;
								}
								if (j < trimmed.length) {
									val += trimmed[j++];
								}
							}
							// skip closing quote
						} else {
							// bare value (number, bool, identifier)
							const valMatch = trimmed
								.slice(j)
								.match(/^[^\s{;\/]+/);
							if (valMatch) {
								val = valMatch[0];
							}
						}
						firstArg = val ? `${ident} ${val}` : ident;
					} else {
						// positional bare value
						firstArg = ident;
					}
				} else if (trimmed[j] === '"') {
					// positional quoted string — strip the quotes
					j++;
					let val = "";
					while (j < trimmed.length && trimmed[j] !== '"') {
						if (trimmed[j] === "\\") {
							j++;
						}
						if (j < trimmed.length) {
							val += trimmed[j++];
						}
					}
					firstArg = val;
				}
			}
		}

		const label = firstArg ? `${nodeName} ${firstArg}` : nodeName;

		// Detect whether this node opens a multi-line children block.
		// A line with `{` but no matching `}` opens a persistent scope.
		const hasBrace = trimmed.includes("{");
		const hasClose = trimmed.includes("}");
		const opensBlock = hasBrace && !hasClose;

		const item: any = {
			label,
			line: i,
			kdlType: "node",
			isRegion: opensBlock,
			children: [],
		};

		if (kdlStack.length > 0) {
			kdlStack[kdlStack.length - 1].children.push(item);
		} else {
			kdlRoot.push(item);
		}

		if (opensBlock) {
			kdlStack.push(item);
		}
	}

	return kdlRoot;
}
