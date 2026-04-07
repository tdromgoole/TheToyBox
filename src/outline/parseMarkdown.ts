import * as vscode from "vscode";

export function parseMarkdown(document: vscode.TextDocument): any[] {
	const headingConfig = vscode.workspace.getConfiguration(
		"theToyBox.markdownHeadings",
	);
	const headingEnabled = headingConfig.get<boolean>("enabled", true);
	const headingColors =
		headingConfig.get<{ [key: string]: string }>("colors") || {};
	const headingShowBackground = headingConfig.get<boolean>(
		"showBackground",
		true,
	);

	const rootHeadings: any[] = [];
	const stack: { level: number; item: any }[] = [];

	for (let i = 0; i < document.lineCount; i++) {
		const text = document.lineAt(i).text;
		const match = text.match(/^(#{1,6})\s+(.*)/);
		if (!match) {
			continue;
		}

		const level = match[1].length;
		const levelKey = `h${level}`;
		const color = headingEnabled ? headingColors[levelKey] : null;

		const item: any = {
			label: match[2].trim(),
			line: i,
			isMarkdownHeading: true,
			headingLevel: level,
			color: color || null,
			backgroundColor:
				color && headingShowBackground ? color + "33" : null,
			isBold: level === 1,
			isRegion: false,
			children: [],
		};

		// Pop the stack until we find a heading of a higher level
		while (stack.length > 0 && stack[stack.length - 1].level >= level) {
			stack.pop();
		}

		if (stack.length > 0) {
			const parent = stack[stack.length - 1].item;
			parent.children.push(item);
		} else {
			rootHeadings.push(item);
		}

		stack.push({ level, item });
	}

	return rootHeadings;
}
