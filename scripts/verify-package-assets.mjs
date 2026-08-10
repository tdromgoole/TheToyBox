import { createHash } from "node:crypto";
import { readFile } from "node:fs/promises";
import { createRequire } from "node:module";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const require = createRequire(import.meta.url);
const repositoryRoot = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const sourcePath = require.resolve("mermaid/dist/mermaid.min.js");
const packagedPath = resolve(repositoryRoot, "dist", "assets", "mermaid.min.js");

function sha256(contents) {
	return createHash("sha256").update(contents).digest("hex");
}

try {
	const [source, packaged] = await Promise.all([
		readFile(sourcePath),
		readFile(packagedPath),
	]);

	if (packaged.length === 0) {
		throw new Error("the packaged Mermaid browser bundle is empty");
	}

	if (sha256(source) !== sha256(packaged)) {
		throw new Error("the packaged Mermaid browser bundle does not match the installed dependency");
	}

	console.log(`Verified packaged Mermaid asset: ${packagedPath} (${packaged.length} bytes)`);
} catch (error) {
	console.error(`Package asset verification failed: ${error instanceof Error ? error.message : String(error)}`);
	process.exitCode = 1;
}
