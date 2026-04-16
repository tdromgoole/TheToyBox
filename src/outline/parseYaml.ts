import * as vscode from "vscode";

export function parseYaml(document: vscode.TextDocument): any[] {
	const rootItems: any[] = [];
	// Stack tracks the current nesting path. Each entry holds the item and
	// the indent level that *children* of that item must exceed.
	const stack: { item: any; indent: number }[] = [];

	for (let i = 0; i < document.lineCount; i++) {
		const text = document.lineAt(i).text;
		const trimmed = text.trim();

		// Skip blank lines, pure comments, and document separators
		if (
			!trimmed ||
			trimmed.startsWith("#") ||
			trimmed === "---" ||
			trimmed === "..."
		) {
			continue;
		}

		// Measure leading indent (spaces only — YAML forbids tabs)
		let indent = 0;
		while (indent < text.length && text[indent] === " ") {
			indent++;
		}

		// Determine the key (if any) on this line.
		// Matches bare keys, quoted keys, and merge keys (<<).
		const keyMatch = trimmed.match(
			/^(?:-\s+)?("(?:[^"\\]|\\.)*"|'(?:[^'\\]|\\.)*'|<<|[^:#\s][^:#]*):\s*/,
		);
		if (!keyMatch) {
			continue;
		}

		let key = keyMatch[1].trim();
		// Strip surrounding quotes from quoted keys
		if (
			(key.startsWith('"') && key.endsWith('"')) ||
			(key.startsWith("'") && key.endsWith("'"))
		) {
			key = key.slice(1, -1);
		}

		const valueAfterColon = trimmed.slice(keyMatch[0].length).trim();
		// A key that has no inline scalar value (or only an anchor / tag)
		// is a mapping / sequence parent.
		const isParent =
			!valueAfterColon ||
			valueAfterColon.startsWith("#") ||
			valueAfterColon === "|" ||
			valueAfterColon === ">" ||
			valueAfterColon === "|-" ||
			valueAfterColon === ">-" ||
			valueAfterColon === "|+" ||
			valueAfterColon === ">+";

		const label = isParent
			? key
			: `${key}: ${valueAfterColon.replace(/#.*$/, "").trim()}`;

		// Pop stack entries whose indent is >= current (they can't be parents)
		while (stack.length > 0 && indent <= stack[stack.length - 1].indent) {
			stack.pop();
		}

		const item: any = {
			label,
			line: i,
			yamlType: isParent ? "mapping" : "scalar",
			isRegion: false,
			children: [],
		};

		if (stack.length > 0) {
			const parent = stack[stack.length - 1].item;
			parent.children.push(item);
			parent.isRegion = true;
		} else {
			rootItems.push(item);
		}

		// Only mappings (parents) can have children
		if (isParent) {
			stack.push({ item, indent });
		}
	}

	return rootItems;
}
