/** Returns the visual column width of `text`, expanding each tab to the next tab stop. */
export function getVisualWidth(text: string, tabSize: number): number {
	let width = 0;
	for (const char of text) {
		if (char === "\t") {
			width += tabSize - (width % tabSize);
		} else {
			width += 1;
		}
	}
	return width;
}

/**
 * Aligns each line's first match of `regex` to the same tab column.
 * Lines that don't contain the operator are returned unchanged.
 */
export function buildAlignedLines(
	lines: string[],
	regex: RegExp,
	tabSize: number,
): string[] {
	let maxVisualWidth = 0;
	const parsedLines = lines.map((line) => {
		const match = regex.exec(line);
		if (match) {
			const prefix = line.substring(0, match.index).trimEnd();
			const rest = line.substring(match.index); // includes the operator
			maxVisualWidth = Math.max(
				maxVisualWidth,
				getVisualWidth(prefix, tabSize),
			);
			return { prefix, rest, isMatch: true as const };
		}
		return { line, isMatch: false as const };
	});

	// Snap to the next tab stop after the longest prefix
	const targetTabColumn = Math.ceil((maxVisualWidth + 1) / tabSize) * tabSize;

	return parsedLines.map((item) => {
		if (!item.isMatch) return item.line;
		const currentWidth = getVisualWidth(item.prefix, tabSize);
		const remainingWidth = targetTabColumn - currentWidth;
		const numTabsNeeded = Math.ceil(remainingWidth / tabSize);
		return `${item.prefix}${"\t".repeat(numTabsNeeded)}${item.rest}`;
	});
}
