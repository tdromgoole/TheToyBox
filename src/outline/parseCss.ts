import * as vscode from "vscode";

function findCssBlockEnd(
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

export function parseCss(document: vscode.TextDocument): any[] {
	const atRuleRe =
		/^\s*(@(?:media|keyframes|mixin|include|layer|supports|font-face|charset|import|use|forward|each|for|if|else|while|function|return|debug|warn|error))\b([^{;]*)/i;
	const selectorRe =
		/^\s*([.#]?[\w][\w\s.#>+~[\]:()=*^$|"'-]*)(?:\s*,\s*[\w.#][\w\s.#>+~[\]:()=*^$|"'-]*)?\s*\{/;
	const customPropRe = /^\s*(--[\w-]+)\s*:/;
	const regionStartRe = /^[#\/\-\*\s!]*region\s+(.*)/i;
	const regionEndRe = /^[#\/\-\*\s!]*endregion/i;

	const cssRegionStack: any[] = [];
	const cssRootItems: any[] = [];

	const pushCssItem = (item: any) => {
		if (cssRegionStack.length > 0) {
			cssRegionStack[cssRegionStack.length - 1].children.push(item);
		} else {
			cssRootItems.push(item);
		}
	};

	for (let i = 0; i < document.lineCount; i++) {
		const text = document.lineAt(i).text;
		const trimmed = text.trim();

		// Check for region markers before skipping comment lines
		const regionStartMatch = trimmed.match(regionStartRe);
		if (regionStartMatch) {
			const label =
				regionStartMatch[1].replace(/\*\/\s*$/, "").trim() || "Region";
			cssRegionStack.push({
				label,
				line: i,
				isRegion: true,
				children: [],
			});
			continue;
		}
		if (regionEndRe.test(trimmed)) {
			if (cssRegionStack.length > 0) {
				const region = cssRegionStack.pop();
				if (cssRegionStack.length > 0) {
					cssRegionStack[cssRegionStack.length - 1].children.push(
						region,
					);
				} else {
					cssRootItems.push(region);
				}
			}
			continue;
		}

		if (!trimmed || trimmed.startsWith("//") || trimmed.startsWith("/*")) {
			continue;
		}
		// Skip block-comment continuation lines (e.g. " * ..." or " */")
		// but NOT the universal CSS selector (* or *,div or *{).
		if (
			trimmed.startsWith("*") &&
			!trimmed.startsWith("* {") &&
			!/^\*[\s,{:.>~+[]/.test(trimmed) &&
			trimmed !== "*"
		) {
			continue;
		}

		const atMatch = trimmed.match(atRuleRe);
		if (atMatch) {
			const keyword = atMatch[1].toLowerCase();
			const detail = atMatch[2].trim();
			const label = detail ? `${keyword} ${detail}` : keyword;
			const endLine = trimmed.endsWith("{")
				? findCssBlockEnd(document, i)
				: i;
			pushCssItem({
				label,
				line: i,
				endLine,
				cssType: keyword.slice(1), // strip @
				isRegion: endLine > i,
				children: [],
			});
			continue;
		}

		const propMatch = trimmed.match(customPropRe);
		if (propMatch) {
			pushCssItem({
				label: propMatch[1],
				line: i,
				cssType: "customProp",
				isRegion: false,
				children: [],
			});
			continue;
		}

		if (selectorRe.test(trimmed)) {
			// Collapse multi-line selectors to first 60 chars
			const label = trimmed
				.replace(/\s*\{.*$/, "")
				.trim()
				.slice(0, 60);
			const selectorKind = trimmed.trimStart().startsWith("#")
				? "id"
				: trimmed.trimStart().startsWith(".")
					? "class"
					: "element";
			pushCssItem({
				label,
				line: i,
				endLine: findCssBlockEnd(document, i),
				cssType: "selector",
				cssSelector: selectorKind,
				isRegion: false,
				children: [],
			});
		}
	}

	// Flush any unclosed regions to root
	while (cssRegionStack.length > 0) {
		cssRootItems.push(cssRegionStack.pop());
	}

	return cssRootItems.sort((a, b) => a.line - b.line);
}
