import * as vscode from "vscode";
import * as https from "https";
import * as fs from "fs";
import * as path from "path";
import * as os from "os";
import * as cp from "child_process";
import { createHash } from "crypto";

export const NERD_FONTS_VERSION = "v3.3.0";
const JETBRAINS_MONO_SHA256 = "2d83782a350b604bfa70fce880604a41a7f77c3eec8f922f9cdc3c20952ddbe4";
export const MAX_ARCHIVE_BYTES = 150 * 1024 * 1024;

/**
 * The four essential weights for editor use (includes ligatures, full Nerd glyph width).
 * The "Mono" variant uses single-width Nerd glyphs — better for terminals.
 */
const FONT_FILES: string[] = [
	"JetBrainsMonoNerdFont-Regular.ttf",
	"JetBrainsMonoNerdFont-Bold.ttf",
	"JetBrainsMonoNerdFont-Italic.ttf",
	"JetBrainsMonoNerdFont-BoldItalic.ttf",
	"JetBrainsMonoNerdFontMono-Regular.ttf",
	"JetBrainsMonoNerdFontMono-Bold.ttf",
];

/** Allowed redirect hosts — GitHub releases CDN only. */
const ALLOWED_HOSTS = [
	"github.com",
	"objects.githubusercontent.com",
	"release-assets.githubusercontent.com",
];

function getUserFontDir(): string | null {
	switch (process.platform) {
		case "win32":
			return path.join(
				os.homedir(),
				"AppData",
				"Local",
				"Microsoft",
				"Windows",
				"Fonts",
			);
		case "darwin":
			return path.join(os.homedir(), "Library", "Fonts");
		case "linux":
			return path.join(os.homedir(), ".local", "share", "fonts");
		default:
			return null;
	}
}

export function downloadFile(
	url: string,
	dest: string,
	token: vscode.CancellationToken,
	onProgress: (downloaded: number, total: number) => void,
	request: typeof https.get = https.get,
	maxBytes = MAX_ARCHIVE_BYTES,
): Promise<void> {
	return new Promise((resolve, reject) => {
		let redirectCount = 0;

		function doRequest(requestUrl: string) {
			let parsed: URL;
			try {
				parsed = new URL(requestUrl);
			} catch {
				return reject(new Error(`Invalid URL: ${requestUrl}`));
			}

			// Only follow redirects to allowed GitHub hosts
			if (!ALLOWED_HOSTS.includes(parsed.hostname)) {
				return reject(
					new Error(
						`Unexpected redirect to host: ${parsed.hostname}`,
					),
				);
			}

			const req = request(
					requestUrl,
					{ headers: { "User-Agent": "VSCode-TheToyBox" } },
					(res) => {
						if (
							(res.statusCode === 301 ||
								res.statusCode === 302 ||
								res.statusCode === 307 ||
								res.statusCode === 308) &&
							res.headers.location
						) {
							if (++redirectCount > 5) {
								return reject(new Error("Too many redirects"));
							}
							res.resume();
							doRequest(new URL(res.headers.location, requestUrl).toString());
							return;
						}

						if (res.statusCode !== 200) {
							res.resume();
							return reject(new Error(`HTTP ${res.statusCode}`));
						}

						const total = parseInt(
							res.headers["content-length"] ?? "0",
							10,
						);
						if (total > maxBytes) {
							res.resume();
							return reject(new Error("Font archive exceeds the 150 MB safety limit"));
						}
						let downloaded = 0;
						const file = fs.createWriteStream(dest);

						const cancelSub = token.onCancellationRequested(() => {
							res.destroy();
							file.destroy();
							reject(new Error("Cancelled"));
						});

						res.on("data", (chunk: Buffer) => {
							downloaded += chunk.length;
							if (downloaded > maxBytes) {
								res.destroy(new Error("Font archive exceeds the 150 MB safety limit"));
								file.destroy();
								return;
							}
							onProgress(downloaded, total);
						});

						res.pipe(file);
						file.on("finish", () => {
							cancelSub.dispose();
							file.close(() => resolve());
						});
						file.on("error", (err) => {
							cancelSub.dispose();
							reject(err);
						});
						res.on("error", (err) => {
							cancelSub.dispose();
							reject(err);
						});
					},
				)
				.on("error", reject);
			req.setTimeout(REQUEST_TIMEOUT_MS, () => {
				req.destroy();
				reject(new Error("Request timed out"));
			});
		}

		doRequest(url);
	});
}

const REQUEST_TIMEOUT_MS = 10_000;

export function verifyFileSha256(filePath: string, expected: string): void {
	const actual = createHash("sha256").update(fs.readFileSync(filePath)).digest("hex");
	if (actual !== expected.toLowerCase()) {
		throw new Error(`Checksum mismatch (expected ${expected}, received ${actual})`);
	}
}

export function parseReleaseTag(body: string): string | undefined {
	try {
		const tag = JSON.parse(body)?.tag_name;
		return typeof tag === "string" && /^v\d+\.\d+\.\d+$/.test(tag) ? tag : undefined;
	} catch {
		return undefined;
	}
}

export function isNewerRelease(candidate: string, current: string): boolean {
	const parts = (version: string) => version.slice(1).split(".").map(Number);
	const candidateParts = parts(candidate);
	const currentParts = parts(current);
	for (let index = 0; index < 3; index++) {
		if (candidateParts[index] !== currentParts[index]) {
			return candidateParts[index] > currentParts[index];
		}
	}
	return false;
}

async function getLatestNerdFontsVersion(): Promise<string | undefined> {
	return new Promise((resolve) => {
		const req = https.get(
			"https://api.github.com/repos/ryanoasis/nerd-fonts/releases/latest",
			{ headers: { "User-Agent": "VSCode-TheToyBox" } },
			(res) => {
				let body = "";
				res.on("data", (chunk) => {
					body += chunk;
					if (body.length > 1_000_000) {
						res.destroy();
						resolve(undefined);
					}
				});
				res.on("end", () => resolve(res.statusCode === 200 ? parseReleaseTag(body) : undefined));
				res.on("error", () => resolve(undefined));
			},
		).on("error", () => resolve(undefined));
		req.setTimeout(REQUEST_TIMEOUT_MS, () => {
			req.destroy();
			resolve(undefined);
		});
	});
}

export function assertRequiredFonts(destDir: string): void {
	const missing = FONT_FILES.filter((file) => !fs.existsSync(path.join(destDir, file)));
	if (missing.length > 0) {
		throw new Error(`Archive did not contain required fonts: ${missing.join(", ")}`);
	}
}

/**
 * Extracts only the specific font files listed in FONT_FILES from the zip.
 * Uses PowerShell on Windows, unzip on macOS/Linux.
 * Filenames are hardcoded — no user-controlled input enters the extraction path.
 */
export function extractFontsFromZip(zipPath: string, destDir: string): Promise<void> {
	return new Promise((resolve, reject) => {
		if (process.platform === "win32") {
			// Write a PowerShell script to a random temp file to avoid symlink attacks
			const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), "toybox-"));
			const scriptPath = path.join(tmpDir, "extract-fonts.ps1");
			const escapedZip = zipPath.replace(/\\/g, "\\\\");
			const escapedDest = destDir.replace(/\\/g, "\\\\");
			const fileList = FONT_FILES.map((f) => `'${f}'`).join(",");

			const script = [
				"$ErrorActionPreference = 'Stop'",
				"Add-Type -AssemblyName System.IO.Compression.FileSystem",
				`$zip = [System.IO.Compression.ZipFile]::OpenRead('${escapedZip}')`,
				`$wanted = @(${fileList})`,
				`foreach ($entry in $zip.Entries) {`,
				`  if ($wanted -contains $entry.Name) {`,
				`    $dest = Join-Path '${escapedDest}' $entry.Name`,
				`    [System.IO.Compression.ZipFileExtensions]::ExtractToFile($entry, $dest, $true)`,
				`  }`,
				`}`,
				`$zip.Dispose()`,
			].join("\r\n");

			fs.writeFileSync(scriptPath, script, "utf8");

			cp.execFile(
				"powershell.exe",
				["-NoProfile", "-ExecutionPolicy", "Bypass", "-File", scriptPath],
				(err) => {
					try {
						fs.rmSync(tmpDir, { recursive: true, force: true });
					} catch {}
					if (err) {
						reject(new Error(`Extraction failed: ${err.message}`));
					} else {
						resolve();
					}
				},
			);
		} else {
			// macOS / Linux: unzip is available on both
			const args = ["-o", zipPath, ...FONT_FILES, "-d", destDir];
			cp.execFile("unzip", args, (err) => {
				// Exit code 11 = "no files matched" — treat as non-fatal
				if (
					err &&
					(err as NodeJS.ErrnoException & { code?: number }).code !==
						11
				) {
					reject(new Error(`Extraction failed: ${err.message}`));
				} else {
					resolve();
				}
			});
		}
	});
}

/** Registers a per-user font in the Windows registry (graceful fallback on error). */
function registerFontWindows(fontPath: string, displayName: string): void {
	try {
		cp.execFileSync(
			"reg",
			["add", "HKCU\\Software\\Microsoft\\Windows NT\\CurrentVersion\\Fonts", "/v", `${displayName} (TrueType)`, "/t", "REG_SZ", "/d", fontPath, "/f"],
			{ stdio: "ignore" },
		);
	} catch {
		// Non-fatal: Windows 10 1903+ discovers user fonts without registry entries
	}
}

export async function installJetBrainsMonoNerdFont(): Promise<void> {
	const latestVersion = await getLatestNerdFontsVersion();
	if (latestVersion && isNewerRelease(latestVersion, NERD_FONTS_VERSION)) {
		vscode.window.showInformationMessage(
			`A newer Nerd Fonts release (${latestVersion}) is available. The Toy Box will continue using checksum-verified ${NERD_FONTS_VERSION} until the extension is updated.`,
		);
	}
	// Step 1: Confirm
	const confirm = await vscode.window.showInformationMessage(
		`This will download JetBrainsMono Nerd Font ${NERD_FONTS_VERSION} (~128 MB) from github.com/ryanoasis/nerd-fonts, verify its SHA-256 checksum, and install it to your user fonts folder. Continue?`,
		{ modal: true },
		"Download & Install",
	);
	if (confirm !== "Download & Install") {
		return;
	}

	const fontDir = getUserFontDir();
	if (!fontDir) {
		vscode.window.showErrorMessage(
			"The Toy Box: Unsupported OS — cannot determine user font directory.",
		);
		return;
	}

	fs.mkdirSync(fontDir, { recursive: true });

	await vscode.window.withProgress(
		{
			location: vscode.ProgressLocation.Notification,
			title: "The Toy Box: Installing JetBrainsMono Nerd Font",
			cancellable: true,
		},
		async (progress, token) => {
			const zipDest = path.join(os.tmpdir(), "JetBrainsMono-nerd.zip");

			try {
				const version = NERD_FONTS_VERSION;
				if (token.isCancellationRequested) {
					return;
				}

				// Step 3: Download
				const zipUrl = `https://github.com/ryanoasis/nerd-fonts/releases/download/${version}/JetBrainsMono.zip`;
				progress.report({
					message: `Downloading ${version}…`,
					increment: 3,
				});

				let lastPct = 0;
				await downloadFile(zipUrl, zipDest, token, (dl, total) => {
					if (total > 0) {
						const pct = Math.floor((dl / total) * 80);
						if (pct > lastPct) {
							progress.report({
								message: `Downloading ${version}… ${Math.round(dl / 1024 / 1024)} / ${Math.round(total / 1024 / 1024)} MB`,
								increment: pct - lastPct,
							});
							lastPct = pct;
						}
					}
				});
				verifyFileSha256(zipDest, JETBRAINS_MONO_SHA256);

				if (token.isCancellationRequested) {
					return;
				}

				// Step 4: Extract
				progress.report({
					message: "Extracting font files…",
					increment: 5,
				});
				await extractFontsFromZip(zipDest, fontDir);
				assertRequiredFonts(fontDir);

				// Step 5: Platform post-processing
				if (process.platform === "win32") {
					progress.report({
						message: "Registering fonts…",
						increment: 5,
					});
					for (const file of FONT_FILES) {
						const fontPath = path.join(fontDir, file);
						const displayName = file
							.replace(".ttf", "")
							.replace(/-/g, " ");
						registerFontWindows(fontPath, displayName);
					}
				} else if (process.platform === "linux") {
					progress.report({
						message: "Refreshing font cache…",
						increment: 5,
					});
					try {
						cp.execFileSync("fc-cache", ["-f"], { stdio: "ignore" });
					} catch {}
				}

				progress.report({ message: "Done!", increment: 5 });
			} catch (err: unknown) {
				const msg = err instanceof Error ? err.message : String(err);
				// Clean up partial download
				try {
					if (fs.existsSync(zipDest)) {
						fs.unlinkSync(zipDest);
					}
				} catch {}
				vscode.window.showErrorMessage(
					`The Toy Box: Font installation failed — ${msg}`,
				);
				return;
			} finally {
				// Always clean up zip
				try {
					if (fs.existsSync(zipDest)) {
						fs.unlinkSync(zipDest);
					}
				} catch {}
			}

			// Step 6: Update editor settings
			const updateEditor = await vscode.window.showInformationMessage(
				"JetBrainsMono Nerd Font installed! Update editor.fontFamily and enable font ligatures?",
				{ modal: true },
				"Yes",
				"No",
			);

			if (updateEditor === "Yes") {
				const editorCfg = vscode.workspace.getConfiguration("editor");
				await editorCfg.update(
					"fontFamily",
					'"JetBrainsMono Nerd Font", Consolas, monospace',
					vscode.ConfigurationTarget.Global,
				);
				await editorCfg.update(
					"fontLigatures",
					true,
					vscode.ConfigurationTarget.Global,
				);

				// Step 7: Offer terminal font separately
				const updateTerminal =
					await vscode.window.showInformationMessage(
						'Also set terminal.integrated.fontFamily to "JetBrainsMono Nerd Font Mono"? (Recommended if your terminal prompt uses Nerd Font glyphs.)',
						"Yes",
						"No",
					);

				if (updateTerminal === "Yes") {
					const termCfg = vscode.workspace.getConfiguration(
						"terminal.integrated",
					);
					await termCfg.update(
						"fontFamily",
						'"JetBrainsMono Nerd Font Mono"',
						vscode.ConfigurationTarget.Global,
					);
				}
			}

			// Step 8: Instruct a full close+reopen.
			// workbench.action.reloadWindow reloads the renderer but doesn't
			// always give the OS font subsystem time to register new user fonts
			// with the new process. A full File > Exit + reopen is required.
			vscode.window.showInformationMessage(
				"Font installed! Please fully close VS Code (File → Exit / Quit) and reopen it — a window reload is not enough for the OS to make new fonts available to VS Code.",
				{ modal: true },
				"OK",
			);
		},
	);
}
