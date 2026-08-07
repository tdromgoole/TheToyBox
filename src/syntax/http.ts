import type { TokenMatch } from "./types.js";

// Token types: httpMethod, httpPath, httpVersion, httpStatus2xx,
//              httpStatus4xx, httpHeaderName, httpHeaderValue, httpParamKey

const METHODS_RE =
	/^(GET|POST|PUT|DELETE|PATCH|HEAD|OPTIONS|CONNECT|TRACE)(\s+)(\S+)(\s+)(HTTP\/[\d.]+)/i;
const VERSION_RE = /^(HTTP\/[\d.]+)(\s+)(\d{3})/i;
const HEADER_NAME_RE = /^[\w-]+$/;
const QUERY_BODY_RE = /(?:^|&)([^&=\s]+)(?==)/g;

export function tokenizeHttp(text: string): TokenMatch[] {
	const tokens: TokenMatch[] = [];
	const lines = text.split("\n");
	let offset = 0;

	for (const line of lines) {
		let m: RegExpExecArray | null;

		// Request line: METHOD /path HTTP/x.x
		m = METHODS_RE.exec(line);
		if (m) {
			let p = offset;
			tokens.push({ start: p, end: p + m[1].length, type: "httpMethod" });
			p += m[1].length + m[2].length;
			tokens.push({ start: p, end: p + m[3].length, type: "httpPath" });
			p += m[3].length + m[4].length;
			tokens.push({
				start: p,
				end: p + m[5].length,
				type: "httpVersion",
			});
			offset += line.length + 1;
			continue;
		}

		// Response status line: HTTP/x.x 200 OK
		m = VERSION_RE.exec(line);
		if (m) {
			tokens.push({
				start: offset,
				end: offset + m[1].length,
				type: "httpVersion",
			});
			const codeStart = offset + m[1].length + m[2].length;
			const statusType =
				parseInt(m[3]) < 300 ? "httpStatus2xx" : "httpStatus4xx";
			tokens.push({
				start: codeStart,
				end: codeStart + m[3].length,
				type: statusType,
			});
			offset += line.length + 1;
			continue;
		}

		// Header field: Name: value
		const ci = line.indexOf(":");
		if (ci > 0 && HEADER_NAME_RE.test(line.slice(0, ci))) {
			tokens.push({
				start: offset,
				end: offset + ci,
				type: "httpHeaderName",
			});
			if (ci + 1 < line.length) {
				tokens.push({
					start: offset + ci + 1,
					end: offset + line.length,
					type: "httpHeaderValue",
				});
			}
			offset += line.length + 1;
			continue;
		}

		// URL-encoded body or query string: key=value&key=value
		if (/\w+=/.test(line)) {
			QUERY_BODY_RE.lastIndex = 0;
			let km: RegExpExecArray | null;
			while ((km = QUERY_BODY_RE.exec(line)) !== null) {
				// km[1] is the key; it may start after a leading `&`
				const keyStart = km.index + (km[0].startsWith("&") ? 1 : 0);
				tokens.push({
					start: offset + keyStart,
					end: offset + keyStart + km[1].length,
					type: "httpParamKey",
				});
			}
		}

		offset += line.length + 1;
	}

	return tokens;
}
