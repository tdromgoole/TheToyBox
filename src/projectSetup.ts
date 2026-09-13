import * as vscode from "vscode";
import * as fs from "fs/promises";
import * as path from "path";
import { addSetupScripts, buildSetupPlan, detectManager, parseManifest, PackageManager, SetupOptions, SetupTool } from "./projectSetupPlan.js";

async function readFile(file: string): Promise<string | undefined> {
	try {
		if ((await fs.lstat(file)).isSymbolicLink()) { throw new Error(`Setup will not modify a symbolic link: ${file}`); }
		return await fs.readFile(file, "utf8");
	} catch (error) {
		if ((error as NodeJS.ErrnoException).code === "ENOENT") { return undefined; }
		throw error;
	}
}

function requireTrust() {
	if (!vscode.workspace.isTrusted) { throw new Error("Trust this workspace before installing project tools."); }
}

function requireSaved(file: string) {
	if (vscode.workspace.textDocuments.some(doc => doc.uri.fsPath === file && doc.isDirty)) {
		throw new Error(`Save your changes to ${path.basename(file)} before running setup.`);
	}
}

async function chooseRoot(tool: SetupTool): Promise<string | undefined> {
	const folders = vscode.workspace.workspaceFolders ?? [];
	if (!folders.length) { throw new Error("Open a project folder before running setup."); }
	const roots = new Set(folders.filter(folder => folder.uri.scheme === "file").map(folder => folder.uri.fsPath));
	const active = vscode.window.activeTextEditor?.document.uri;
	const owning = active && vscode.workspace.getWorkspaceFolder(active);
	if (active?.scheme === "file" && owning) {
		let current = path.dirname(active.fsPath);
		while (current !== owning.uri.fsPath && current !== path.dirname(current)) {
			if (await readFile(path.join(current, tool === "eslint" ? "package.json" : "composer.json")) !== undefined) { roots.add(current); }
			current = path.dirname(current);
		}
	}
	if (!roots.size) { throw new Error("Setup requires a filesystem workspace folder."); }
	if (roots.size === 1) { return [...roots][0]; }
	return (await vscode.window.showQuickPick([...roots].map(root => ({ label: path.basename(root), description: root, root })), { title: "Project Setup: Choose project folder" }))?.root;
}

/** Run as a VS Code task so output, missing executables, and cancellation are visible. */
export async function runSetupInstall(root: string, command: string, args: string[]): Promise<boolean> {
	requireTrust();
	const task = new vscode.Task({ type: "toybox-project-setup" }, vscode.TaskScope.Workspace,
		`Install ${command} development dependencies`, "The Toy Box",
		new vscode.ShellExecution(command, args.map(value => ({ value, quoting: vscode.ShellQuoting.Strong })), { cwd: root }), []);
	task.presentationOptions = { reveal: vscode.TaskRevealKind.Always, panel: vscode.TaskPanelKind.Dedicated, clear: true };
	return new Promise<boolean>((resolve, reject) => {
		let execution: vscode.TaskExecution | undefined;
		const processListener = vscode.tasks.onDidEndTaskProcess(event => {
			if (event.execution === execution || event.execution.task === task) {
				processListener.dispose(); endListener.dispose(); resolve(event.exitCode === 0);
			}
		});
		const endListener = vscode.tasks.onDidEndTask(event => {
			if (event.execution === execution || event.execution.task === task) {
				// A task that fails to start may never produce a process-exit event.
				processListener.dispose(); endListener.dispose(); resolve(false);
			}
		});
		void vscode.tasks.executeTask(task).then(result => { execution = result; }, error => {
			processListener.dispose(); endListener.dispose(); reject(error);
		});
	});
}

export function registerProjectSetup(context: vscode.ExtensionContext) {
	const previews = new Map<string, string>();
	context.subscriptions.push(vscode.workspace.registerTextDocumentContentProvider("toybox-setup", {
		provideTextDocumentContent: uri => previews.get(uri.toString()) ?? "Preview expired. Run setup again.",
	}));
	let running = false;
	for (const tool of ["eslint", "phpstan"] as const) {
		context.subscriptions.push(vscode.commands.registerCommand(tool === "eslint" ? "theToyBox.setupEslint" : "theToyBox.setupPhpstan", async () => {
			if (running) { void vscode.window.showInformationMessage("A Project Setup is already in progress."); return; }
			running = true;
			try { await setup(tool, previews); }
			catch (error) { void vscode.window.showErrorMessage(`Project Setup: ${error instanceof Error ? error.message : String(error)}`); }
			finally { running = false; }
		}));
	}
}

async function setup(tool: SetupTool, previews: Map<string, string>) {
	requireTrust();
	const root = await chooseRoot(tool);
	if (!root) { return; }
	const manifestPath = path.join(root, tool === "eslint" ? "package.json" : "composer.json");
	requireSaved(manifestPath);
	const original = await readFile(manifestPath);
	const manifest = parseManifest(original ?? (tool === "eslint" ? '{"private":true}' : "{}"));
	const entries = await fs.readdir(root, { withFileTypes: true });
	const files = entries.map(entry => entry.name);
	const options: SetupOptions = { tool, manager: "npm", typescript: false, runtime: "node", level: 5, paths: ["."], framework: "none" };
	let integration = "none";
	if (tool === "eslint") {
		const detected = detectManager(manifest, files);
		const managers = ["npm", "pnpm", "yarn", "bun"] as PackageManager[];
		if (detected) { managers.sort(a => a === detected ? -1 : 1); }
		const manager = await vscode.window.showQuickPick(managers.map(value => ({ label: value, description: value === detected ? "Detected from project" : undefined })), { title: "ESLint: Package manager" });
		if (!manager) { return; }
		options.manager = manager.label;
		const tsDetected = files.includes("tsconfig.json") || !!manifest.devDependencies?.typescript;
		const languages = tsDetected ? ["TypeScript and JavaScript", "JavaScript"] : ["JavaScript", "TypeScript and JavaScript"];
		const language = await vscode.window.showQuickPick(languages, { title: "ESLint: Languages" });
		if (!language) { return; }
		options.typescript = language.startsWith("TypeScript");
		const runtime = await vscode.window.showQuickPick(["node", "browser", "both"], { title: "ESLint: Where does the code run?" });
		if (!runtime) { return; }
		options.runtime = runtime as SetupOptions["runtime"];
		const editor = await vscode.window.showQuickPick([
			{ label: "Project files only", value: "none" },
			{ label: "Install the VS Code ESLint extension", value: "extension" },
			{ label: "Install ESLint extension and enable fix-on-save", value: "fix" },
		], { title: "ESLint: Editor integration" });
		if (!editor) { return; }
		integration = editor.value;
	} else {
		const level = await vscode.window.showQuickPick([5, 0, 1, 2, 3, 4, 6, 7, 8, 9, 10].map(n => ({ label: String(n), description: n === 5 ? "Suggested starting point" : n === 10 ? "Strictest" : undefined })), { title: "PHPStan: Analysis level" });
		if (!level) { return; }
		options.level = Number(level.label);
		const directories = entries.filter(entry => entry.isDirectory() && !entry.name.startsWith(".") && !["vendor", "node_modules", "dist", "build"].includes(entry.name));
		const paths = await vscode.window.showQuickPick([{ label: ".", description: "Whole project", picked: directories.length === 0 }, ...directories.map(entry => ({ label: entry.name, picked: ["src", "app"].includes(entry.name) }))], { title: "PHPStan: Paths to analyse", canPickMany: true });
		if (!paths) { return; }
		options.paths = paths.map(p => p.label);
		const framework = await vscode.window.showQuickPick(["none", "laravel", "symfony"], { title: "PHPStan: Optional framework integration" });
		if (!framework) { return; }
		options.framework = framework as SetupOptions["framework"];
	}
	const plan = buildSetupPlan(options, manifest, files);
	const folder = vscode.workspace.getWorkspaceFolder(vscode.Uri.file(root))!;
	const editorConfig = vscode.workspace.getConfiguration("editor", folder.uri);
	const savedActions = editorConfig.inspect<Record<string, unknown> | string[]>("codeActionsOnSave")?.workspaceFolderValue;
	const actions = editorConfig.get<Record<string, unknown> | string[]>("codeActionsOnSave", {});
	const fixActions = Array.isArray(actions) ? Object.fromEntries(actions.map(key => [key, "explicit"])) : { ...actions };
	fixActions["source.fixAll.eslint"] = "explicit";
	const proposedManifest = addSetupScripts(original ?? JSON.stringify(manifest), plan.scripts);
	const preview = [
		`# Set Up ${tool === "eslint" ? "ESLint" : "PHPStan"}`, `Project: ${root}`,
		`Install project dependencies${plan.packages.length ? " and add the listed development tools" : " using the existing manifest"}:\n\n\`\`\`text\n${plan.command} ${plan.args.join(" ")}\n\`\`\`\n\nThe package manager may run project/dependency scripts and update its lockfile.`,
		...plan.notes,
		`## ${plan.manifestName} (scripts added; installed dependencies will be retained)\n\n\`\`\`json\n${proposedManifest}\`\`\``,
		plan.config ? `## Create ${plan.configName}\n\n\`\`\`text\n${plan.config}\`\`\`` : "Configuration files will remain unchanged.",
		integration !== "none" ? "Install VS Code extension: dbaeumer.vscode-eslint" : "",
		integration === "fix" ? `Workspace folder: ${folder.uri.fsPath}\neditor.codeActionsOnSave:\n\n\`\`\`json\n${JSON.stringify(fixActions, null, 2)}\n\`\`\`` : "",
		tool === "phpstan" ? "Requires PHP and Composer on PATH. Framework packages must be compatible with your PHP/framework version." : "Requires Node.js and the selected package manager on PATH.",
	].filter(Boolean).join("\n\n");
	const uri = vscode.Uri.parse(`toybox-setup:/${tool}-${Date.now()}.md`);
	previews.set(uri.toString(), preview);
	await vscode.window.showTextDocument(await vscode.workspace.openTextDocument(uri), { preview: true });
	try {
		const approval = await vscode.window.showInformationMessage("Review the setup plan, then select Apply Setup to install the listed tools and apply the changes.", { modal: false }, "Apply Setup");
		if (approval !== "Apply Setup") { return; }
		requireTrust();
		requireSaved(manifestPath);
		requireSaved(path.join(root, plan.configName));
		if (await readFile(manifestPath) !== original) { throw new Error("The manifest changed while reviewing. Run setup again."); }
		if (plan.config && await readFile(path.join(root, plan.configName)) !== undefined) { throw new Error("A configuration appeared while reviewing. Run setup again."); }
		if (!original) { await fs.writeFile(manifestPath, JSON.stringify(manifest, null, 2) + "\n", { flag: "wx" }); }
		if (!await runSetupInstall(root, plan.command, plan.args)) {
			throw new Error("Installation failed or was cancelled. See the task terminal. The package manager may have changed the manifest or lockfile; config and editor settings were not applied. Resolve the error and run setup again.");
		}
		requireTrust();
		requireSaved(manifestPath);
		requireSaved(path.join(root, plan.configName));
		const current = await readFile(manifestPath);
		if (!current) { throw new Error("The package manager did not leave a project manifest."); }
		if (plan.config && !buildSetupPlan(options, parseManifest(current), await fs.readdir(root)).config) {
			throw new Error("A tool configuration appeared during setup. It was preserved; run setup again to review the remaining changes.");
		}
		if (Object.keys(plan.scripts).length) { await fs.writeFile(manifestPath, addSetupScripts(current, plan.scripts)); }
		if (plan.config) { await fs.writeFile(path.join(root, plan.configName), plan.config, { flag: "wx" }); }
		if (integration !== "none") { await vscode.commands.executeCommand("workbench.extensions.installExtension", "dbaeumer.vscode-eslint"); }
		if (integration === "fix") {
			if (JSON.stringify(editorConfig.inspect("codeActionsOnSave")?.workspaceFolderValue) !== JSON.stringify(savedActions)) { throw new Error("Editor settings changed during setup. Project setup finished; enable fix-on-save manually."); }
			await editorConfig.update("codeActionsOnSave", fixActions, vscode.ConfigurationTarget.WorkspaceFolder);
		}
		void vscode.window.showInformationMessage(`${tool === "eslint" ? "ESLint" : "PHPStan"} setup complete. Run ${tool === "phpstan" ? "composer analyse" : `${options.manager} run lint`} from ${root}.`);
	} finally { previews.delete(uri.toString()); }
}
