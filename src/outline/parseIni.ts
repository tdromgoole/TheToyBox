import * as vscode from "vscode";

export function parseIni(document: vscode.TextDocument): any[] {
	const rootItems: any[] = [];
	let currentSection: any | null = null;

	for (let i = 0; i < document.lineCount; i++) {
		const text = document.lineAt(i).text;
		const trimmed = text.trim();

		// Skip blank lines and comments (; or #)
		if (!trimmed || trimmed.startsWith(";") || trimmed.startsWith("#")) {
			continue;
		}

		// Section header: [SectionName] or [[subsection]]
		const sectionMatch = trimmed.match(/^\[([^\]]+)\]/);
		if (sectionMatch) {
			currentSection = {
				label: sectionMatch[1].trim(),
				line: i,
				iniType: "section",
				isRegion: false,
				children: [],
			};
			rootItems.push(currentSection);
			continue;
		}

		// Key = Value pair
		const kvMatch = trimmed.match(/^([^=]+?)=(.*)$/);
		if (kvMatch) {
			const key = kvMatch[1].trim();
			const value = kvMatch[2]
				.trim()
				.replace(/[;#].*$/, "")
				.trim();
			const label = value ? `${key} = ${value}` : key;
			const item: any = {
				label,
				line: i,
				iniType: "key",
				isRegion: false,
				children: [],
			};

			if (currentSection) {
				currentSection.children.push(item);
				currentSection.isRegion = true;
			} else {
				rootItems.push(item);
			}
		}
	}

	return rootItems;
}
