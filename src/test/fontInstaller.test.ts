import * as assert from "node:assert";
import * as fs from "node:fs";
import * as os from "node:os";
import * as path from "node:path";
import { EventEmitter } from "node:events";
import { PassThrough } from "node:stream";
import type * as https from "node:https";
import {
	assertRequiredFonts,
	downloadFile,
	extractFontsFromZip,
	isNewerRelease,
	parseReleaseTag,
	verifyFileSha256,
} from "../fontInstaller.js";

const token = {
	isCancellationRequested: false,
	onCancellationRequested: () => ({ dispose() {} }),
} as any;

function fakeGet(responses: Array<{ status: number; headers?: Record<string, string>; body?: Buffer }>): typeof https.get {
	return ((...args: any[]) => {
		const callback = args.find((arg) => typeof arg === "function");
		const response = responses.shift();
		if (!response) {
			throw new Error("Unexpected request");
		}
		const request = new EventEmitter() as any;
		request.setTimeout = () => request;
		request.destroy = () => request;
		queueMicrotask(() => {
			const stream = new PassThrough() as any;
			stream.statusCode = response.status;
			stream.headers = response.headers ?? {};
			callback(stream);
			stream.end(response.body ?? Buffer.alloc(0));
		});
		return request;
	}) as typeof https.get;
}

suite("Font installer integrity", () => {
	test("refuses to overwrite an existing download target", async () => {
		const directory = fs.mkdtempSync(path.join(os.tmpdir(), "toybox-font-exclusive-"));
		const target = path.join(directory, "existing.zip");
		try {
			fs.writeFileSync(target, "keep me");
			await assert.rejects(downloadFile("https://github.com/font.zip", target, token, () => {}, fakeGet([
				{ status: 200, body: Buffer.from("replacement") },
			])), /EEXIST/);
			assert.strictEqual(fs.readFileSync(target, "utf8"), "keep me");
		} finally { fs.rmSync(directory, { recursive: true, force: true }); }
	});

	test("extracts safely through paths containing apostrophes and shell characters", async () => {
		const directory = fs.mkdtempSync(path.join(os.tmpdir(), "toybox-O'Brien-$value-"));
		const archive = path.join(directory, "font's archive.zip");
		const output = path.join(directory, "output's folder");
		try {
			fs.mkdirSync(output);
			fs.writeFileSync(archive, Buffer.from("UEsDBBQAAAAAAFx9LV1stREHDwAAAA8AAAAhAAAASmV0QnJhaW5zTW9ub05lcmRGb250LVJlZ3VsYXIudHRmdGVzdCBmb250IGJ5dGVzUEsBAhQAFAAAAAAAXH0tXWy1EQcPAAAADwAAACEAAAAAAAAAAAAAAIABAAAAAEpldEJyYWluc01vbm9OZXJkRm9udC1SZWd1bGFyLnR0ZlBLBQYAAAAAAQABAE8AAABOAAAAAAA=", "base64"));
			await extractFontsFromZip(archive, output);
			assert.strictEqual(fs.readFileSync(path.join(output, "JetBrainsMonoNerdFont-Regular.ttf"), "utf8"), "test font bytes");
		} finally { fs.rmSync(directory, { recursive: true, force: true }); }
	});
	test("accepts the expected SHA-256 and rejects a mismatch", () => {
		const directory = fs.mkdtempSync(path.join(os.tmpdir(), "toybox-font-test-"));
		const archive = path.join(directory, "font.zip");
		try {
			fs.writeFileSync(archive, "known archive contents");
			verifyFileSha256(archive, "117cc4b4f7076454215819e366be39d01d2ab3549073a9aa1d12eef3101a1300");
			assert.throws(
				() => verifyFileSha256(archive, "0".repeat(64)),
				/Checksum mismatch/,
			);
		} finally {
			fs.rmSync(directory, { recursive: true, force: true });
		}
	});

	test("downloads a valid response and reports progress", async () => {
		const directory = fs.mkdtempSync(path.join(os.tmpdir(), "toybox-font-test-"));
		const destination = path.join(directory, "font.zip");
		const progress: number[] = [];
		try {
			await downloadFile("https://github.com/font.zip", destination, token, (bytes) => progress.push(bytes), fakeGet([
				{ status: 200, headers: { "content-length": "5" }, body: Buffer.from("valid") },
			]));
			assert.strictEqual(fs.readFileSync(destination, "utf8"), "valid");
			assert.deepStrictEqual(progress, [5]);
		} finally {
			fs.rmSync(directory, { recursive: true, force: true });
		}
	});

	test("follows an allowed relative redirect", async () => {
		const directory = fs.mkdtempSync(path.join(os.tmpdir(), "toybox-font-test-"));
		const destination = path.join(directory, "font.zip");
		try {
			await downloadFile("https://github.com/start", destination, token, () => {}, fakeGet([
				{ status: 302, headers: { location: "/final" } },
				{ status: 200, body: Buffer.from("redirected") },
			]));
			assert.strictEqual(fs.readFileSync(destination, "utf8"), "redirected");
		} finally {
			fs.rmSync(directory, { recursive: true, force: true });
		}
	});

	test("rejects disallowed redirects and oversized responses", async () => {
		const destination = path.join(os.tmpdir(), `toybox-font-${Date.now()}.zip`);
		await assert.rejects(
			downloadFile("https://github.com/start", destination, token, () => {}, fakeGet([
				{ status: 302, headers: { location: "https://example.com/font.zip" } },
			])),
			/Unexpected redirect/,
		);
		await assert.rejects(
			downloadFile("https://github.com/font.zip", destination, token, () => {}, fakeGet([
				{ status: 200, headers: { "content-length": "11" }, body: Buffer.from("oversized!!") },
			]), 10),
			/safety limit/,
		);
		fs.rmSync(destination, { force: true });
	});

	test("rejects invalid and incomplete archives", async () => {
		const directory = fs.mkdtempSync(path.join(os.tmpdir(), "toybox-font-test-"));
		const archive = path.join(directory, "invalid.zip");
		const output = path.join(directory, "output");
		fs.mkdirSync(output);
		fs.writeFileSync(archive, "not a zip");
		try {
			await assert.rejects(extractFontsFromZip(archive, output), /Extraction failed/);
			assert.throws(() => assertRequiredFonts(output), /did not contain required fonts/);
		} finally {
			fs.rmSync(directory, { recursive: true, force: true });
		}
	});

	test("parses only strict release tags for update notifications", () => {
		assert.strictEqual(parseReleaseTag('{"tag_name":"v3.4.0"}'), "v3.4.0");
		assert.strictEqual(parseReleaseTag('{"tag_name":"latest"}'), undefined);
		assert.strictEqual(parseReleaseTag("invalid"), undefined);
		assert.strictEqual(isNewerRelease("v3.4.0", "v3.3.0"), true);
		assert.strictEqual(isNewerRelease("v3.3.0", "v3.3.0"), false);
		assert.strictEqual(isNewerRelease("v3.2.1", "v3.3.0"), false);
	});
});
