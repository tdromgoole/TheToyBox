import * as path from "path";
import * as vscode from "vscode";

export interface FeatureDocMarker {
	line: number;
	path: string;
}

const MARKER = /@docs?\s*:\s*(.+?)\s*(?:\*\/|-->)?\s*$/i;
const MAX_HEADER_LINES = 20;

/** Find documentation markers near the top of a source file. */
export function findFeatureDocMarkers(text: string): FeatureDocMarker[] {
	return text
		.split(/\r?\n/)
		.slice(0, MAX_HEADER_LINES)
		.flatMap((lineText, line) => {
			const match = MARKER.exec(lineText);
			if (!match) {
				return [];
			}

			const docPath = match[1].trim().replace(/^(?:"([\s\S]*)"|'([\s\S]*)')$/, "$1$2");
			return docPath ? [{ line, path: docPath }] : [];
		});
}

/** Resolve ./ paths beside the source file and all other paths from the workspace root. */
export function resolveFeatureDocPath(
	sourceFile: string,
	docPath: string,
	workspaceRoot?: string,
): string {
	if (path.isAbsolute(docPath) && !docPath.startsWith("/")) {
		return path.normalize(docPath);
	}

	if (docPath.startsWith("./") || docPath.startsWith("../")) {
		return path.resolve(path.dirname(sourceFile), docPath);
	}

	const root = workspaceRoot ?? path.dirname(sourceFile);
	return path.resolve(root, docPath.replace(/^[/\\]+/, ""));
}

class FeatureDocsCodeLensProvider implements vscode.CodeLensProvider {
	provideCodeLenses(document: vscode.TextDocument): vscode.CodeLens[] {
		if (
			document.uri.scheme !== "file" ||
			document.languageId === "markdown" ||
			!vscode.workspace.getConfiguration("theToyBox.featureDocs").get("enabled", true)
		) {
			return [];
		}

		const workspaceRoot = vscode.workspace.getWorkspaceFolder(document.uri)?.uri.fsPath;
		return findFeatureDocMarkers(document.getText()).map((marker) => {
			const target = vscode.Uri.file(
				resolveFeatureDocPath(document.uri.fsPath, marker.path, workspaceRoot),
			);
			return new vscode.CodeLens(new vscode.Range(marker.line, 0, marker.line, 0), {
				title: "$(book) Open feature documentation",
				tooltip: marker.path,
				command: "theToyBox.openFeatureDocumentation",
				arguments: [target],
			});
		});
	}
}

export function registerFeatureDocs(context: vscode.ExtensionContext): void {
	context.subscriptions.push(
		vscode.languages.registerCodeLensProvider(
			{ scheme: "file" },
			new FeatureDocsCodeLensProvider(),
		),
		vscode.commands.registerCommand(
			"theToyBox.openFeatureDocumentation",
			async (target: vscode.Uri) => {
				try {
					await vscode.workspace.fs.stat(target);
					const document = await vscode.workspace.openTextDocument(target);
					await vscode.window.showTextDocument(document);
				} catch {
					void vscode.window.showWarningMessage(
						`The Toy Box: Documentation file not found: ${vscode.workspace.asRelativePath(target)}`,
					);
				}
			},
		),
	);
}
