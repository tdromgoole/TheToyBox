import { cpSync, mkdirSync, readFileSync, readdirSync, rmSync, writeFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { spawnSync } from "node:child_process";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const smokeRoot = join(root, ".vscode-test", "package-smoke");
const vsixPath = join(smokeRoot, "theToyBox-smoke.vsix");
const userDataDir = join(smokeRoot, "user-data");
const extensionsDir = join(smokeRoot, "extensions");
const stagingDir = join(smokeRoot, "staging");

function run(command, args, options = {}) {
	const result = spawnSync(command, args, {
		cwd: options.cwd ?? root,
		encoding: "utf8",
		stdio: options.capture ? "pipe" : "inherit",
		shell: false,
		env: options.env ? { ...process.env, ...options.env } : process.env,
	});
	if (result.error || result.status !== 0) {
		throw result.error ?? new Error(`${command} exited with ${result.status}: ${result.stderr ?? ""}`);
	}
	return result.stdout ?? "";
}

function findCodeCli() {
	const testRoot = join(root, ".vscode-test");
	const installations = readdirSync(testRoot, { withFileTypes: true })
		.filter((entry) => entry.isDirectory() && entry.name.startsWith("vscode-"))
		.map((entry) => join(testRoot, entry.name));
	for (const installation of installations) {
		if (process.platform === "win32") {
			const build = readdirSync(installation, { withFileTypes: true })
				.find((entry) => entry.isDirectory() && /^[a-f0-9]+$/.test(entry.name));
			if (build) {
				return {
					command: join(installation, "Code.exe"),
					prefix: [join(installation, build.name, "resources", "app", "out", "cli.js")],
					env: { ELECTRON_RUN_AS_NODE: "1" },
				};
			}
		} else {
			return { command: join(installation, "bin", "code"), prefix: [], env: {} };
		}
	}
	throw new Error("No cached VS Code test installation was found; run npm test first");
}

try {
	rmSync(smokeRoot, { recursive: true, force: true });
	mkdirSync(smokeRoot, { recursive: true });
	mkdirSync(stagingDir, { recursive: true });
	for (const relative of ["dist", "images/icon.png", "README.md", "CHANGELOG.md", "LICENSE", "markdown-alerts.css", ".vscodeignore"]) {
		const source = join(root, relative);
		const destination = join(stagingDir, relative);
		mkdirSync(dirname(destination), { recursive: true });
		cpSync(source, destination, { recursive: true });
	}
	const manifest = JSON.parse(readFileSync(join(root, "package.json"), "utf8"));
	delete manifest.scripts?.["vscode:prepublish"];
	writeFileSync(join(stagingDir, "package.json"), `${JSON.stringify(manifest, null, "\t")}\n`);
	if (process.platform === "win32") {
		const vsceScript = join(process.env.APPDATA ?? "", "npm", "node_modules", "vsce", "vsce");
		run(process.execPath, [vsceScript, "package", "--no-dependencies", "--out", vsixPath], { cwd: stagingDir });
	} else {
		run("vsce", ["package", "--no-dependencies", "--out", vsixPath], { cwd: stagingDir });
	}

	const listing = run("tar", ["-tf", vsixPath], { capture: true });
	for (const required of [
		"extension/package.json",
		"extension/dist/extension.js",
		"extension/dist/assets/mermaid.min.js",
	]) {
		if (!listing.split(/\r?\n/).includes(required)) {
			throw new Error(`VSIX is missing required runtime file: ${required}`);
		}
	}
	const shikiChunks = listing.match(/extension\/dist\/\d+\.extension\.js/g) ?? [];
	if (shikiChunks.length === 0) {
		throw new Error("VSIX contains no dynamic Shiki language/theme chunks");
	}

	mkdirSync(userDataDir, { recursive: true });
	mkdirSync(extensionsDir, { recursive: true });
	const codeCli = findCodeCli();
	const commonArgs = ["--user-data-dir", userDataDir, "--extensions-dir", extensionsDir];
	run(codeCli.command, [...codeCli.prefix, ...commonArgs, "--install-extension", vsixPath, "--force"], { env: codeCli.env });
	const installed = run(codeCli.command, [...codeCli.prefix, ...commonArgs, "--list-extensions", "--show-versions"], { capture: true, env: codeCli.env });
	if (!/^thomasdromgoole\.thetoybox@1\.2\.0$/im.test(installed)) {
		throw new Error(`Packaged extension was not installed in the clean profile: ${installed.trim()}`);
	}

	console.log(`Package smoke test passed: ${shikiChunks.length} dynamic chunks verified; clean-profile install succeeded.`);
} catch (error) {
	console.error(`Package smoke test failed: ${error instanceof Error ? error.message : String(error)}`);
	process.exitCode = 1;
}
