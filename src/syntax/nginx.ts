import { TokenMatch } from "./types";

// ─── Nginx configuration tokenizer ───────────────────────────────────────────
// Token types emitted: comment, string, number, keyword, nginxVariable, nginxBlock

const NGINX_DIRECTIVES = new Set([
	// Main context
	"user",
	"worker_processes",
	"worker_cpu_affinity",
	"worker_rlimit_nofile",
	"worker_rlimit_core",
	"worker_priority",
	"worker_shutdown_timeout",
	"error_log",
	"pid",
	"load_module",
	"daemon",
	"master_process",
	"lock_file",
	"pcre_jit",
	"thread_pool",
	"timer_resolution",
	// Events block
	"events",
	"worker_connections",
	"multi_accept",
	"use",
	"accept_mutex",
	"accept_mutex_delay",
	"debug_connection",
	// HTTP block
	"http",
	"include",
	"default_type",
	"log_format",
	"access_log",
	"sendfile",
	"sendfile_max_chunk",
	"tcp_nopush",
	"tcp_nodelay",
	"keepalive_timeout",
	"keepalive_requests",
	"keepalive_disable",
	"send_timeout",
	"reset_timedout_connection",
	"client_header_timeout",
	"client_body_timeout",
	"server_tokens",
	"more_set_headers",
	"gzip",
	"gzip_disable",
	"gzip_vary",
	"gzip_proxied",
	"gzip_comp_level",
	"gzip_buffers",
	"gzip_http_version",
	"gzip_types",
	"gzip_min_length",
	"gzip_static",
	"open_file_cache",
	"open_file_cache_valid",
	"open_file_cache_min_uses",
	"open_file_cache_errors",
	"client_max_body_size",
	"client_body_buffer_size",
	"client_header_buffer_size",
	"large_client_header_buffers",
	"client_body_temp_path",
	"client_body_in_file_only",
	"output_buffers",
	"postpone_output",
	"read_ahead",
	"directio",
	"directio_alignment",
	"aio",
	"aio_write",
	// Server block
	"server",
	"listen",
	"server_name",
	"root",
	"index",
	"error_page",
	"charset",
	"charset_types",
	"override_charset",
	"source_charset",
	"disable_symlinks",
	// Location block
	"location",
	"alias",
	"try_files",
	"internal",
	"limit_except",
	"limit_rate",
	"limit_rate_after",
	// Proxy
	"proxy_pass",
	"proxy_set_header",
	"proxy_hide_header",
	"proxy_pass_header",
	"proxy_ignore_headers",
	"proxy_redirect",
	"proxy_intercept_errors",
	"proxy_http_version",
	"proxy_buffering",
	"proxy_buffer_size",
	"proxy_buffers",
	"proxy_busy_buffers_size",
	"proxy_temp_file_write_size",
	"proxy_temp_path",
	"proxy_read_timeout",
	"proxy_connect_timeout",
	"proxy_send_timeout",
	"proxy_next_upstream",
	"proxy_next_upstream_tries",
	"proxy_next_upstream_timeout",
	"proxy_pass_request_body",
	"proxy_pass_request_headers",
	"proxy_store",
	"proxy_store_access",
	"proxy_cache",
	"proxy_cache_path",
	"proxy_cache_key",
	"proxy_cache_valid",
	"proxy_cache_methods",
	"proxy_cache_bypass",
	"proxy_no_cache",
	"proxy_cache_use_stale",
	"proxy_cache_lock",
	"proxy_cache_min_uses",
	"proxy_cache_revalidate",
	// FastCGI
	"fastcgi_pass",
	"fastcgi_index",
	"fastcgi_param",
	"fastcgi_split_path_info",
	"fastcgi_read_timeout",
	"fastcgi_connect_timeout",
	"fastcgi_send_timeout",
	"fastcgi_buffers",
	"fastcgi_buffer_size",
	"fastcgi_busy_buffers_size",
	"fastcgi_temp_file_write_size",
	"fastcgi_temp_path",
	"fastcgi_intercept_errors",
	"fastcgi_cache",
	"fastcgi_cache_path",
	"fastcgi_cache_key",
	"fastcgi_cache_valid",
	"fastcgi_cache_bypass",
	"fastcgi_no_cache",
	"fastcgi_cache_use_stale",
	// uWSGI / SCGI
	"uwsgi_pass",
	"uwsgi_param",
	"uwsgi_read_timeout",
	"uwsgi_cache_bypass",
	"scgi_pass",
	"scgi_param",
	// Rewrites / control flow
	"return",
	"rewrite",
	"rewrite_log",
	"if",
	"set",
	"break",
	"uninitialized_variable_warn",
	// Response headers
	"add_header",
	"add_trailer",
	"expires",
	"etag",
	// Access control
	"deny",
	"allow",
	"satisfy",
	// Auth
	"auth_basic",
	"auth_basic_user_file",
	"auth_request",
	"auth_request_set",
	// Logging
	"log_not_found",
	"log_subrequest",
	"open_log_file_cache",
	// Upstream
	"upstream",
	"least_conn",
	"ip_hash",
	"hash",
	"random",
	"keepalive",
	"keepalive_requests",
	"keepalive_timeout",
	"zone",
	"state",
	"server",
	"backup",
	"down",
	"weight",
	"max_fails",
	"fail_timeout",
	"max_conns",
	"slow_start",
	"resolver",
	"resolver_timeout",
	// SSL / TLS
	"ssl",
	"ssl_certificate",
	"ssl_certificate_key",
	"ssl_protocols",
	"ssl_ciphers",
	"ssl_prefer_server_ciphers",
	"ssl_session_cache",
	"ssl_session_timeout",
	"ssl_session_tickets",
	"ssl_session_ticket_key",
	"ssl_dhparam",
	"ssl_ecdh_curve",
	"ssl_buffer_size",
	"ssl_trusted_certificate",
	"ssl_client_certificate",
	"ssl_verify_client",
	"ssl_verify_depth",
	"ssl_crl",
	"ssl_ocsp",
	"ssl_ocsp_cache",
	"ssl_ocsp_responder",
	"ssl_stapling",
	"ssl_stapling_verify",
	"ssl_stapling_file",
	"ssl_stapling_responder",
	"ssl_ct",
	"ssl_ct_static_scts",
	// Map / Geo / Split Clients
	"map",
	"geo",
	"split_clients",
	"map_hash_bucket_size",
	"map_hash_max_size",
	"geo_hash_bucket_size",
	// Misc / catch-all
	"types",
	"types_hash_bucket_size",
	"types_hash_max_size",
	"variables_hash_bucket_size",
	"variables_hash_max_size",
	"server_names_hash_bucket_size",
	"server_names_hash_max_size",
	"post_action",
	"recursive_error_pages",
	"msie_padding",
	"msie_refresh",
	"absolute_redirect",
	"server_name_in_redirect",
	"port_in_redirect",
]);

const IDENT_CONTINUE = /[a-zA-Z0-9_\-.]/;
const WS = /[ \t]/;

export function tokenizeNginx(text: string): TokenMatch[] {
	const tokens: TokenMatch[] = [];
	let i = 0;

	while (i < text.length) {
		const ch = text[i];

		// ── Whitespace / newlines ──
		if (ch === " " || ch === "\t" || ch === "\n" || ch === "\r") {
			i++;
			continue;
		}

		// ── Comment: # to end of line ──
		if (ch === "#") {
			const start = i++;
			while (i < text.length && text[i] !== "\n" && text[i] !== "\r") {
				i++;
			}
			tokens.push({ type: "comment", start, end: i });
			continue;
		}

		// ── Double-quoted string ──
		if (ch === '"') {
			const start = i++;
			while (i < text.length && text[i] !== '"') {
				if (text[i] === "\\") {
					i++;
				}
				i++;
			}
			if (i < text.length) {
				i++; // closing "
			}
			tokens.push({ type: "string", start, end: i });
			continue;
		}

		// ── Single-quoted string ──
		if (ch === "'") {
			const start = i++;
			while (i < text.length && text[i] !== "'") {
				if (text[i] === "\\") {
					i++;
				}
				i++;
			}
			if (i < text.length) {
				i++; // closing '
			}
			tokens.push({ type: "string", start, end: i });
			continue;
		}

		// ── Nginx variable: $identifier ──
		if (ch === "$") {
			const start = i++;
			while (i < text.length && /[a-zA-Z0-9_]/.test(text[i])) {
				i++;
			}
			tokens.push({ type: "nginxVariable", start, end: i });
			continue;
		}

		// ── Number literal (digits, optional unit suffix k/m/g) ──
		if (ch >= "0" && ch <= "9") {
			const start = i;
			while (i < text.length && text[i] >= "0" && text[i] <= "9") {
				i++;
			}
			// Optional size unit
			if (i < text.length && /[kmgKMG]/.test(text[i])) {
				i++;
			}
			tokens.push({ type: "number", start, end: i });
			continue;
		}

		// ── Identifier: directive keyword, block context, or value ──
		// Also handle location-prefix chars ~, ^, =, @ at identifier start
		if (/[a-zA-Z_~^=@]/.test(ch)) {
			const start = i;
			// Consume the first char (may be a prefix symbol)
			i++;
			// Consume the rest of the identifier
			while (i < text.length && IDENT_CONTINUE.test(text[i])) {
				i++;
			}
			const word = text.slice(start, i);

			// Peek ahead (skip whitespace) to see if a `{` follows — context block name
			let j = i;
			while (j < text.length && WS.test(text[j])) {
				j++;
			}

			if (text[j] === "{") {
				tokens.push({ type: "nginxBlock", start, end: i });
			} else if (NGINX_DIRECTIVES.has(word.toLowerCase())) {
				tokens.push({ type: "keyword", start, end: i });
			}
			// Plain values (paths, on/off, IP addresses, etc.) — no highlighting
			continue;
		}

		i++;
	}

	return tokens;
}
