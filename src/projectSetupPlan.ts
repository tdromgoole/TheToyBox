export type SetupTool = "eslint" | "phpstan";
export type PackageManager = "npm" | "pnpm" | "yarn" | "bun";
export interface SetupOptions {
	tool: SetupTool;
	manager: PackageManager;
	typescript: boolean;
	runtime: "node" | "browser" | "both";
	level: number;
	paths: string[];
	framework: "none" | "laravel" | "symfony";
}
export interface SetupPlan {
	manifestName: string;
	configName: string;
	config?: string;
	packages: string[];
	command: string;
	args: string[];
	scripts: Record<string, string>;
	notes: string[];
}

export function detectManager(manifest: Record<string, unknown>, files: string[]): PackageManager | undefined {
	const declared = String(manifest.packageManager ?? "").split("@")[0];
	if (["npm", "pnpm", "yarn", "bun"].includes(declared)) { return declared as PackageManager; }
	const found = (Object.entries({ npm: ["package-lock.json", "npm-shrinkwrap.json"], pnpm: ["pnpm-lock.yaml"], yarn: ["yarn.lock"], bun: ["bun.lock", "bun.lockb"] }) as [PackageManager, string[]][])
		.filter(([, locks]) => locks.some(lock => files.includes(lock))).map(([manager]) => manager);
	return found.length === 1 ? found[0] : undefined;
}

export function parseManifest(text: string): Record<string, any> {
	const value = JSON.parse(text);
	if (!value || typeof value !== "object" || Array.isArray(value)) { throw new Error("The project manifest must be a JSON object."); }
	for (const key of ["scripts", "dependencies", "devDependencies", "require", "require-dev"]) {
		if (value[key] !== undefined && (!value[key] || typeof value[key] !== "object" || Array.isArray(value[key]))) {
			throw new Error(`The manifest's ${key} field must be an object.`);
		}
	}
	return value;
}

export function buildSetupPlan(options: SetupOptions, manifest: Record<string, any>, files: string[]): SetupPlan {
	const php = options.tool === "phpstan";
	const configNames = php ? ["phpstan.neon", "phpstan.neon.dist", "phpstan.dist.neon"]
		: ["eslint.config.js", "eslint.config.mjs", "eslint.config.cjs", "eslint.config.ts", "eslint.config.mts", "eslint.config.cts", ".eslintrc", ".eslintrc.json", ".eslintrc.js", ".eslintrc.cjs", ".eslintrc.yml", ".eslintrc.yaml"];
	const existing = configNames.find(name => files.includes(name)) ?? (!php && manifest.eslintConfig ? "package.json#eslintConfig" : undefined);
	const notes: string[] = existing ? [`Existing configuration preserved: ${existing}. Existing rules and tool versions are not migrated.`] : [];
	const desiredScripts = php ? { "analyse": "phpstan analyse" } : { "lint": "eslint .", "lint:fix": "eslint . --fix" };
	const scripts: Record<string, string> = {};
	for (const [key, value] of Object.entries(desiredScripts)) {
		if (manifest.scripts?.[key] === undefined) { scripts[key] = value!; }
		else { notes.push(`Existing script preserved: ${key}`); }
	}
	let config: string | undefined;
	let dependencies: string[];
	if (php) {
		if (!Number.isInteger(options.level) || options.level < 0 || options.level > 10) { throw new Error("Choose a PHPStan level from 0 to 10."); }
		if (!options.paths.length || options.paths.some(p => !p || /[\r\n\0]/.test(p) || p.startsWith("/") || p.includes("\\") || p.split("/").includes(".."))) {
			throw new Error("Analysis paths must be relative paths inside the selected project.");
		}
		dependencies = ["phpstan/phpstan"];
		let include = "";
		if (!existing && options.framework !== "none") {
			const extension = options.framework === "laravel" ? "larastan/larastan" : "phpstan/phpstan-symfony";
			dependencies.push(extension);
			include = `includes:\n    - vendor/${extension}/extension.neon\n\n`;
		}
		config = `${include}parameters:\n    level: ${options.level}\n    paths:\n${options.paths.map(p => `        - '${p.replace(/'/g, "''")}'`).join("\n")}\n`;
	} else {
		const declaredEslint = manifest.devDependencies?.eslint ?? manifest.dependencies?.eslint;
		const major = typeof declaredEslint === "string" ? Number(declaredEslint.match(/^[~^]?(\d+)/)?.[1]) : 10;
		if (!existing && ![9, 10].includes(major)) {
			throw new Error("The existing ESLint version needs its own configuration or migration. Setup will not replace its version automatically.");
		}
		const legacy = existing && (existing.startsWith(".eslintrc") || existing.includes("#eslintConfig"));
		dependencies = existing ? [legacy ? "eslint@^8.57.1" : "eslint@^10"] : [`eslint@^${major}`, `@eslint/js@^${major}`, "globals"];
		if (!existing && options.typescript) { dependencies.push("typescript-eslint@^8", "typescript@^5"); }
		const globals = options.runtime === "both" ? "{ ...globals.node, ...globals.browser }" : `globals.${options.runtime}`;
		config = [
			'import js from "@eslint/js";',
			'import globals from "globals";',
			options.typescript ? 'import tseslint from "typescript-eslint";' : "",
			"", "export default [",
			'    { ignores: ["**/node_modules/**", "**/dist/**", "**/build/**", "**/coverage/**", "**/vendor/**"] },',
			`    { ...js.configs.recommended, files: ["**/*.{js,mjs,cjs,jsx}"] },`,
			options.typescript ? '    ...tseslint.configs.recommended.map(config => ({ ...config, files: ["**/*.{ts,tsx,mts,cts}"] })),' : "",
			`    { files: ["**/*.{js,mjs,cjs,jsx${options.typescript ? ",ts,tsx,mts,cts" : ""}}"], languageOptions: { globals: ${globals}, parserOptions: { ecmaFeatures: { jsx: true } } } },`,
			"];", "",
		].join("\n");
		if (!existing && major === 10) { notes.push("New ESLint 10 configuration requires Node.js 20.19+, 22.13+, or 24+."); }
	}
	const installed = { ...manifest.dependencies, ...manifest.devDependencies, ...manifest.require, ...manifest["require-dev"] };
	const packages = dependencies.filter(dep => {
		const name = dep.replace(/@[^@/]+$/, "");
		if (installed[name]) { notes.push(`Keep declared dependency: ${name} (${installed[name]})`); return false; }
		return true;
	});
	return {
		manifestName: php ? "composer.json" : "package.json", configName: php ? "phpstan.neon" : "eslint.config.mjs",
		config: existing ? undefined : config, packages, scripts, notes,
		command: php ? "composer" : options.manager,
		args: !packages.length ? ["install", ...(php ? ["--no-interaction"] : [])]
			: php ? ["require", "--dev", "--no-interaction", ...packages] : options.manager === "npm" ? ["install", "--save-dev", ...packages] : ["add", "--dev", ...packages],
	};
}

/** Re-read after installation so dependency/lock changes made by the manager survive. */
export function addSetupScripts(text: string, scripts: Record<string, string>): string {
	const manifest = parseManifest(text);
	manifest.scripts ??= {};
	for (const [name, value] of Object.entries(scripts)) {
		if (manifest.scripts[name] !== undefined && manifest.scripts[name] !== value) { throw new Error(`Script ${name} changed during setup. Re-run setup to review it.`); }
		manifest.scripts[name] = value;
	}
	const indent = text.match(/\n([ \t]+)"/)?.[1] ?? "  ";
	return JSON.stringify(manifest, null, indent).replace(/\n/g, text.includes("\r\n") ? "\r\n" : "\n") + (text.includes("\r\n") ? "\r\n" : "\n");
}
