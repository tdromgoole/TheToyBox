import * as assert from "assert";
import * as fs from "fs/promises";
import * as os from "os";
import * as path from "path";
import * as vm from "vm";
import * as ts from "typescript";
import { createRequire } from "module";
import { addSetupScripts, buildSetupPlan, detectManager, parseManifest, SetupOptions } from "../projectSetupPlan.js";

const defaults: SetupOptions = { tool: "eslint", manager: "npm", typescript: false, runtime: "node", level: 5, paths: ["src"], framework: "none" };

suite("Project Setup", () => {
	test("detects package manager declarations and conflicting lockfiles", () => {
		assert.strictEqual(detectManager({ packageManager: "pnpm@10.0.0" }, ["package-lock.json"]), "pnpm");
		assert.strictEqual(detectManager({}, ["yarn.lock"]), "yarn");
		assert.strictEqual(detectManager({}, ["bun.lockb"]), "bun");
		assert.strictEqual(detectManager({}, ["yarn.lock", "package-lock.json"]), undefined);
	});

	test("generates TypeScript flat config and development install arguments for each manager", () => {
		for (const manager of ["npm", "pnpm", "yarn", "bun"] as const) {
			const plan = buildSetupPlan({ ...defaults, manager, typescript: true, runtime: "both" }, {}, []);
			assert.ok(plan.packages.includes("typescript-eslint@^8"));
			assert.ok(plan.config?.includes("tseslint.configs.recommended"));
			assert.ok(plan.config?.includes("...globals.browser"));
			assert.strictEqual(plan.command, manager);
			assert.deepStrictEqual(plan.args.slice(0, 2), manager === "npm" ? ["install", "--save-dev"] : ["add", "--dev"]);
			assert.deepStrictEqual(plan.scripts, { lint: "eslint .", "lint:fix": "eslint . --fix" });
		}
	});

	test("preserves configs, script definitions, and installed dependency versions", () => {
		const plan = buildSetupPlan(defaults, { devDependencies: { eslint: "^9.10.0" }, scripts: { lint: "custom-lint" } }, ["eslint.config.mjs"]);
		assert.strictEqual(plan.config, undefined);
		assert.deepStrictEqual(plan.packages, []);
		assert.deepStrictEqual(plan.args, ["install"]);
		assert.strictEqual(plan.scripts.lint, undefined);
		assert.strictEqual(buildSetupPlan(defaults, { devDependencies: { eslint: "^9.30.0" } }, []).packages.includes("@eslint/js@^9"), true);
		assert.strictEqual(buildSetupPlan(defaults, { eslintConfig: {} }, []).config, undefined);
		assert.throws(() => buildSetupPlan(defaults, { devDependencies: { eslint: "^8.0.0" } }, []), /migration/);
	});

	test("PHPStan config includes selected paths, strictness and framework", () => {
		const plan = buildSetupPlan({ ...defaults, tool: "phpstan", framework: "laravel", level: 8, paths: ["app", "tests"] }, {}, []);
		assert.deepStrictEqual(plan.args, ["require", "--dev", "--no-interaction", "phpstan/phpstan", "larastan/larastan"]);
		assert.match(plan.config!, /level: 8/);
		assert.match(plan.config!, /vendor\/larastan\/larastan\/extension.neon/);
		assert.match(plan.config!, /- 'tests'/);
		const existing = buildSetupPlan({ ...defaults, tool: "phpstan", framework: "symfony" }, {}, ["phpstan.neon.dist"]);
		assert.strictEqual(existing.config, undefined);
		assert.deepStrictEqual(existing.packages, ["phpstan/phpstan"]);
		assert.throws(() => buildSetupPlan({ ...defaults, tool: "phpstan", paths: ["../outside"] }, {}, []), /inside/);
		assert.throws(() => buildSetupPlan({ ...defaults, tool: "phpstan", level: 11 }, {}, []), /level/);
	});

	test("manifest merges preserve post-install dependencies and reject script races", () => {
		const after = '{\r\n\t"devDependencies": {"eslint": "^10.0.0"},\r\n\t"scripts": {"test": "node --test"}\r\n}\r\n';
		const merged = addSetupScripts(after, { lint: "eslint ." });
		assert.ok(merged.includes("\r\n\t"));
		assert.strictEqual(JSON.parse(merged).devDependencies.eslint, "^10.0.0");
		assert.strictEqual(JSON.parse(merged).scripts.test, "node --test");
		assert.throws(() => addSetupScripts('{"scripts":{"lint":"changed"}}', { lint: "eslint ." }), /changed during setup/);
		assert.throws(() => parseManifest('{"scripts":[]}'), /must be an object/);
	});

	// Exercise the actual command flow without downloading packages into the user's repo.
	for (const scenario of ["cancel", "success", "failed-install", "untrusted", "manifest-race"] as const) {
		test(`wizard: ${scenario}`, async () => {
			const root = await fs.mkdtemp(path.join(os.tmpdir(), "toybox-setup-test-"));
			const manifest = path.join(root, "package.json");
			const original = '{"private":true}\n';
			await fs.writeFile(manifest, original);
			const callbacks = new Map<string, () => Promise<void>>();
			let taskRuns = 0;
			let preview = "";
			const errors: string[] = [];
			let endProcess: (event: any) => void = () => {};
			const disposable = { dispose() {} };
			const uri = (value: string) => ({ fsPath: value, scheme: "file", toString: () => value });
			const folder = { uri: uri(root) };
			const vscode = {
				Uri: { file: uri, parse: uri }, TaskScope: { Workspace: 1 }, ShellQuoting: { Strong: 1 }, TaskRevealKind: { Always: 1 }, TaskPanelKind: { Dedicated: 1 },
				Task: class { constructor(public definition: unknown) {} }, ShellExecution: class {},
				workspace: {
					isTrusted: scenario !== "untrusted", workspaceFolders: [folder], textDocuments: [],
					getWorkspaceFolder: () => folder,
					getConfiguration: () => ({ get: (_: string, fallback: unknown) => fallback, inspect: () => ({}) }),
					registerTextDocumentContentProvider: (_: string, provider: any) => { vscode.workspace.openTextDocument = async (u: any) => { preview = provider.provideTextDocumentContent(u); return {}; }; return disposable; },
					openTextDocument: async (_: any) => ({}),
				},
				window: {
					showQuickPick: async (items: any[]) => items[0], showTextDocument: async () => {},
					showInformationMessage: async (_: string, options?: unknown) => {
						if (options && scenario === "manifest-race") { await fs.writeFile(manifest, '{"changed":true}'); }
						return scenario === "cancel" ? undefined : "Apply Setup";
					},
					showErrorMessage: (message: string) => errors.push(message),
				},
				commands: { registerCommand: (name: string, callback: () => Promise<void>) => { callbacks.set(name, callback); return disposable; } },
				tasks: {
					onDidEndTaskProcess: (fn: typeof endProcess) => { endProcess = fn; return disposable; }, onDidEndTask: () => disposable,
					executeTask: async (task: unknown) => {
						taskRuns++;
						await fs.writeFile(manifest, '{"private":true,"devDependencies":{"eslint":"^10.0.0"}}');
						const execution = { task };
						setTimeout(() => endProcess({ execution, exitCode: scenario === "failed-install" ? 1 : 0 }), 0);
						return execution;
					},
				},
			};
			try {
				const sourcePath = path.resolve(path.dirname(ts.sys.getExecutingFilePath()), "../../../src/projectSetup.ts");
				const require = createRequire(sourcePath);
				const source = await fs.readFile(sourcePath, "utf8");
				const compiled = ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 } }).outputText;
				const exports: any = {};
				vm.runInNewContext(compiled, { exports, require: (id: string) => id === "vscode" ? vscode : id === "./projectSetupPlan.js" ? { addSetupScripts, buildSetupPlan, detectManager, parseManifest } : require(id) });
				exports.registerProjectSetup({ subscriptions: [] });
				await callbacks.get("theToyBox.setupEslint")!();
				assert.strictEqual(taskRuns, ["success", "failed-install"].includes(scenario) ? 1 : 0);
				if (scenario === "success") {
					assert.match(await fs.readFile(path.join(root, "eslint.config.mjs"), "utf8"), /recommended/);
					assert.strictEqual(JSON.parse(await fs.readFile(manifest, "utf8")).scripts.lint, "eslint .");
					assert.deepStrictEqual(errors, []);
				} else {
					await assert.rejects(fs.stat(path.join(root, "eslint.config.mjs")));
					if (scenario === "cancel" || scenario === "untrusted") { assert.strictEqual(await fs.readFile(manifest, "utf8"), original); }
					if (scenario !== "cancel") { assert.strictEqual(errors.length, 1); }
				}
				if (scenario !== "untrusted") { assert.ok(preview.includes("npm install --save-dev")); }
			} finally { await fs.rm(root, { recursive: true, force: true }); }
		});
	}
});
