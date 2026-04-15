import * as vscode from "vscode";

// ─── Directive documentation ──────────────────────────────────────────────────
const DIRECTIVE_DOCS = new Map<string, string>([
	// ── Main context ──
	[
		"user",
		"Defines the user and group credentials used by worker processes.\n\n**Syntax:** `user user [group];`\n\n**Default:** `user nobody nobody;`",
	],
	[
		"worker_processes",
		"Defines the number of worker processes. Setting to `auto` will auto-detect the number of available CPU cores.\n\n**Syntax:** `worker_processes number | auto;`\n\n**Default:** `worker_processes 1;`",
	],
	[
		"worker_cpu_affinity",
		"Binds worker processes to CPU sets. Only available on FreeBSD and Linux.\n\n**Syntax:** `worker_cpu_affinity cpumask ...;`",
	],
	[
		"worker_rlimit_nofile",
		"Changes the limit on the maximum number of open files (`RLIMIT_NOFILE`) for worker processes.\n\n**Syntax:** `worker_rlimit_nofile number;`",
	],
	[
		"worker_rlimit_core",
		"Changes the limit on the largest size of a core file (`RLIMIT_CORE`) for worker processes.\n\n**Syntax:** `worker_rlimit_core size;`",
	],
	[
		"worker_priority",
		"Defines the scheduling priority for worker processes. Negative numbers mean higher priority.\n\n**Syntax:** `worker_priority number;`\n\n**Default:** `worker_priority 0;`",
	],
	[
		"worker_shutdown_timeout",
		"Configures a timeout for a graceful shutdown of worker processes. After the timeout expires the workers are forced to shut down.\n\n**Syntax:** `worker_shutdown_timeout time;`",
	],
	[
		"error_log",
		"Configures logging. The first parameter defines the file path, the second sets the minimum severity level: `debug`, `info`, `notice`, `warn`, `error`, `crit`, `alert`, `emerg`.\n\n**Syntax:** `error_log file [level];`\n\n**Default:** `error_log logs/error.log error;`",
	],
	[
		"pid",
		"Defines a file that will store the process ID of the main process.\n\n**Syntax:** `pid file;`\n\n**Default:** `pid logs/nginx.pid;`",
	],
	[
		"load_module",
		"Loads a dynamic module.\n\n**Syntax:** `load_module file;`",
	],
	[
		"daemon",
		"Determines whether nginx should become a daemon. Mainly used during development.\n\n**Syntax:** `daemon on | off;`\n\n**Default:** `daemon on;`",
	],
	[
		"master_process",
		"Determines whether worker processes are started. Intended for nginx developers.\n\n**Syntax:** `master_process on | off;`\n\n**Default:** `master_process on;`",
	],
	[
		"pcre_jit",
		"Enables or disables the use of JIT compilation for regular expressions known by the time of configuration parsing.\n\n**Syntax:** `pcre_jit on | off;`\n\n**Default:** `pcre_jit off;`",
	],
	[
		"thread_pool",
		"Defines named thread pools used for multi-threaded reading and sending of files.\n\n**Syntax:** `thread_pool name threads=number [max_queue=number];`",
	],
	[
		"timer_resolution",
		"Reduces timer resolution in worker processes, thus reducing the number of `gettimeofday()` system calls.\n\n**Syntax:** `timer_resolution interval;`",
	],

	// ── Events ──
	[
		"events",
		"Provides the configuration file context in which the directives that affect connection processing are specified.",
	],
	[
		"worker_connections",
		"Sets the maximum number of simultaneous connections that can be opened by a worker process. This includes all connections (e.g. with proxied servers), not only connections with clients.\n\n**Syntax:** `worker_connections number;`\n\n**Default:** `worker_connections 512;`",
	],
	[
		"multi_accept",
		"If disabled, a worker process will accept one new connection at a time. Otherwise, a worker process will accept all new connections at a time.\n\n**Syntax:** `multi_accept on | off;`\n\n**Default:** `multi_accept off;`",
	],
	[
		"use",
		"Specifies the connection processing method. Nginx will use the most efficient method available by default.\n\n**Syntax:** `use method;`\n\nPossible values: `select`, `poll`, `kqueue`, `epoll`, `eventport`, `/dev/poll`, `rtsig`",
	],
	[
		"accept_mutex",
		"If enabled, worker processes will accept new connections one by one. If disabled (default since 1.11.3), all worker processes will be notified about new connections and an unloaded worker will pick them up.\n\n**Syntax:** `accept_mutex on | off;`\n\n**Default:** `accept_mutex off;`",
	],
	[
		"accept_mutex_delay",
		"If `accept_mutex` is enabled, specifies the maximum time a worker process waits to re-accept new connections.\n\n**Syntax:** `accept_mutex_delay time;`\n\n**Default:** `accept_mutex_delay 500ms;`",
	],
	[
		"debug_connection",
		"Enables debugging log for selected client connections.\n\n**Syntax:** `debug_connection address | CIDR | unix:;`",
	],

	// ── HTTP ──
	[
		"http",
		"Provides the configuration file context in which the HTTP server directives are specified.",
	],
	[
		"include",
		"Includes another file or files matching a specified mask into the configuration. Included files should consist of syntactically correct directives and blocks.\n\n**Syntax:** `include file | mask;`",
	],
	[
		"default_type",
		"Defines the default MIME type of a response. Mapping of filename extensions to MIME types can be set with the `types` directive.\n\n**Syntax:** `default_type mime-type;`\n\n**Default:** `default_type text/plain;`",
	],
	[
		"log_format",
		"Specifies the log format.\n\n**Syntax:** `log_format name [escape=default|json|none] string ...;`\n\n**Example:** `log_format main '$remote_addr - $remote_user [$time_local] \"$request\" $status $body_bytes_sent';`",
	],
	[
		"access_log",
		"Sets the path, format, and configuration for a buffered log write.\n\n**Syntax:** `access_log path [format [buffer=size] [gzip[=level]] [flush=time] [if=condition]];`\n\n**Default:** `access_log logs/access.log combined;`",
	],
	[
		"sendfile",
		"Enables or disables the use of `sendfile()`.\n\n**Syntax:** `sendfile on | off;`\n\n**Default:** `sendfile off;`",
	],
	[
		"sendfile_max_chunk",
		"Limits the amount of data that can be transferred in a single `sendfile()` call. Without the limit, one fast connection may seize the worker process entirely.\n\n**Syntax:** `sendfile_max_chunk size;`\n\n**Default:** `sendfile_max_chunk 2m;`",
	],
	[
		"tcp_nopush",
		"Enables or disables the use of the `TCP_CORK` socket option on Linux or `TCP_NOPUSH` on FreeBSD. Only used when `sendfile` is enabled. Allows sending the response header and the beginning of a file in one packet, and sending a file in full packets.\n\n**Syntax:** `tcp_nopush on | off;`\n\n**Default:** `tcp_nopush off;`",
	],
	[
		"tcp_nodelay",
		"Enables or disables the use of the `TCP_NODELAY` option. The option is enabled when a connection is transitioned into the keep-alive state.\n\n**Syntax:** `tcp_nodelay on | off;`\n\n**Default:** `tcp_nodelay on;`",
	],
	[
		"keepalive_timeout",
		'The first parameter sets a timeout during which a keep-alive client connection will stay open on the server side. The zero value disables keep-alive client connections. The optional second parameter sets a value in the "Keep-Alive: timeout=time" response header field.\n\n**Syntax:** `keepalive_timeout timeout [header_timeout];`\n\n**Default:** `keepalive_timeout 75s;`',
	],
	[
		"keepalive_requests",
		"Sets the maximum number of requests that can be served through one keep-alive connection. After the maximum number of requests are made, the connection is closed.\n\n**Syntax:** `keepalive_requests number;`\n\n**Default:** `keepalive_requests 1000;`",
	],
	[
		"keepalive_disable",
		"Disables keep-alive connections with misbehaving browsers.\n\n**Syntax:** `keepalive_disable none | browser ...;`\n\n**Default:** `keepalive_disable msie6;`",
	],
	[
		"send_timeout",
		"Sets a timeout for transmitting a response to the client. The timeout is set only between two successive write operations, not for the transmission of the whole response.\n\n**Syntax:** `send_timeout time;`\n\n**Default:** `send_timeout 60s;`",
	],
	[
		"reset_timedout_connection",
		"Enables or disables resetting timed out connections and connections closed with the non-standard code 444.\n\n**Syntax:** `reset_timedout_connection on | off;`\n\n**Default:** `reset_timedout_connection off;`",
	],
	[
		"client_header_timeout",
		"Defines a timeout for reading client request header. If a client does not transmit the entire header within this time, the request is terminated with the 408 (Request Time-out) error.\n\n**Syntax:** `client_header_timeout time;`\n\n**Default:** `client_header_timeout 60s;`",
	],
	[
		"client_body_timeout",
		"Defines a timeout for reading client request body. The timeout is set only for a period between two successive read operations, not for the transmission of the whole request body.\n\n**Syntax:** `client_body_timeout time;`\n\n**Default:** `client_body_timeout 60s;`",
	],
	[
		"server_tokens",
		'Enables or disables emitting nginx version on error pages and in the "Server" response header field.\n\n**Syntax:** `server_tokens on | off | build | string;`\n\n**Default:** `server_tokens on;`',
	],
	[
		"client_max_body_size",
		"Sets the maximum allowed size of the client request body. If the size in a request exceeds the configured value, the 413 (Request Entity Too Large) error is returned to the client.\n\n**Syntax:** `client_max_body_size size;`\n\n**Default:** `client_max_body_size 1m;`",
	],
	[
		"client_body_buffer_size",
		"Sets buffer size for reading client request body. If the request body is larger than the buffer, the whole body or only its part is written to a temporary file.\n\n**Syntax:** `client_body_buffer_size size;`\n\n**Default:** `client_body_buffer_size 8k|16k;`",
	],
	[
		"client_header_buffer_size",
		"Sets buffer size for reading client request header. For most requests, a buffer of 1K is enough.\n\n**Syntax:** `client_header_buffer_size size;`\n\n**Default:** `client_header_buffer_size 1k;`",
	],
	[
		"large_client_header_buffers",
		"Sets the maximum number and size of buffers used for reading large client request header.\n\n**Syntax:** `large_client_header_buffers number size;`\n\n**Default:** `large_client_header_buffers 4 8k;`",
	],
	[
		"client_body_temp_path",
		"Defines a directory for storing temporary files holding client request bodies.\n\n**Syntax:** `client_body_temp_path path [level1 [level2 [level3]]];`\n\n**Default:** `client_body_temp_path client_body_temp;`",
	],
	[
		"output_buffers",
		"Sets the number and size of the buffers used for reading a response from a disk.\n\n**Syntax:** `output_buffers number size;`\n\n**Default:** `output_buffers 2 32k;`",
	],
	[
		"aio",
		"Enables or disables the use of asynchronous file I/O (AIO) on FreeBSD and Linux.\n\n**Syntax:** `aio on | off | threads[=pool];`\n\n**Default:** `aio off;`",
	],

	// ── Gzip ──
	[
		"gzip",
		"Enables or disables gzip compression of responses.\n\n**Syntax:** `gzip on | off;`\n\n**Default:** `gzip off;`",
	],
	[
		"gzip_disable",
		"Disables gzip compression of responses for requests matching the given regular expressions with the `User-Agent` header field.\n\n**Syntax:** `gzip_disable regex ...;`",
	],
	[
		"gzip_vary",
		'Enables or disables inserting the "Vary: Accept-Encoding" response header field.\n\n**Syntax:** `gzip_vary on | off;`\n\n**Default:** `gzip_vary off;`',
	],
	[
		"gzip_proxied",
		"Enables or disables gzip compression of responses for proxied requests depending on the request and response.\n\n**Syntax:** `gzip_proxied off | expired | no-cache | no-store | private | no_last_modified | no_etag | auth | any ...;`\n\n**Default:** `gzip_proxied off;`",
	],
	[
		"gzip_comp_level",
		"Sets the gzip compression level of a response. Acceptable values are in the range from 1 to 9.\n\n**Syntax:** `gzip_comp_level level;`\n\n**Default:** `gzip_comp_level 1;`",
	],
	[
		"gzip_types",
		"Enables gzip compression in addition to `text/html` for the specified MIME types.\n\n**Syntax:** `gzip_types mime-type ...;`\n\n**Default:** `gzip_types text/html;`",
	],
	[
		"gzip_min_length",
		"Sets the minimum length of a response that will be gzip compressed, determined from the `Content-Length` header.\n\n**Syntax:** `gzip_min_length length;`\n\n**Default:** `gzip_min_length 20;`",
	],
	[
		"gzip_static",
		"Allows sending precompressed files with the `.gz` filename extension instead of regular files.\n\n**Syntax:** `gzip_static on | off | always;`\n\n**Default:** `gzip_static off;`",
	],
	[
		"gzip_buffers",
		"Sets the number and size of buffers used to compress a response.\n\n**Syntax:** `gzip_buffers number size;`\n\n**Default:** `gzip_buffers 32 4k|16 8k;`",
	],
	[
		"gzip_http_version",
		"Sets the minimum HTTP version of a request required to compress a response.\n\n**Syntax:** `gzip_http_version 1.0 | 1.1;`\n\n**Default:** `gzip_http_version 1.1;`",
	],

	// ── Open file cache ──
	[
		"open_file_cache",
		"Configures a cache that can store: open file descriptors, their sizes and modification times; information on existence of directories; file lookup errors.\n\n**Syntax:** `open_file_cache off | max=N [inactive=time];`\n\n**Default:** `open_file_cache off;`",
	],
	[
		"open_file_cache_valid",
		"Sets a time after which open_file_cache elements should be validated.\n\n**Syntax:** `open_file_cache_valid time;`\n\n**Default:** `open_file_cache_valid 60s;`",
	],
	[
		"open_file_cache_min_uses",
		"Sets the minimum number of file accesses required to keep a file descriptor in the open_file_cache.\n\n**Syntax:** `open_file_cache_min_uses number;`\n\n**Default:** `open_file_cache_min_uses 1;`",
	],
	[
		"open_file_cache_errors",
		"Enables or disables caching of file lookup errors by open_file_cache.\n\n**Syntax:** `open_file_cache_errors on | off;`\n\n**Default:** `open_file_cache_errors off;`",
	],

	// ── Server ──
	[
		"server",
		"Sets configuration for a virtual server.\n\n**Context:** `http`, `upstream`",
	],
	[
		"listen",
		"Sets the address and port for IP, or the path for a UNIX-domain socket on which the server will accept requests.\n\n**Syntax:** `listen address[:port] [ssl] [http2] [proxy_protocol] [default_server] [backlog=N] [...];`\n\n**Default:** `listen *:80 | *:8000;`",
	],
	[
		"server_name",
		'Sets names of a virtual server. The first name becomes the primary server name.\n\n**Syntax:** `server_name name ...;`\n\n**Default:** `server_name "";`',
	],
	[
		"root",
		"Sets the root directory for requests. A path to the file is constructed by merely adding a URI to the value of the root directive.\n\n**Syntax:** `root path;`\n\n**Default:** `root html;`",
	],
	[
		"index",
		"Defines files that will be used as an index. Files are checked in the specified order.\n\n**Syntax:** `index file ...;`\n\n**Default:** `index index.html;`",
	],
	[
		"error_page",
		"Defines the URI that will be shown for the specified errors. May include a `=response` code change.\n\n**Syntax:** `error_page code ... [=[response]] uri;`\n\n**Example:** `error_page 404 /404.html;`",
	],
	[
		"charset",
		'Adds the specified charset to the "Content-Type" response header field. If the charset is different from the charset specified in the `source_charset` directive, a conversion is performed.\n\n**Syntax:** `charset charset | off;`\n\n**Default:** `charset off;`',
	],
	[
		"disable_symlinks",
		"Determines how symbolic links should be treated when opening files.\n\n**Syntax:** `disable_symlinks off | on | if_not_owner [from=part];`\n\n**Default:** `disable_symlinks off;`",
	],

	// ── Location ──
	[
		"location",
		"Sets configuration depending on a request URI.\n\n**Syntax:** `location [= | ~ | ~* | ^~] uri { ... }` or `location @name { ... }`\n\n**Modifier meanings:**\n- `=` — exact match\n- `~` — case-sensitive regex\n- `~*` — case-insensitive regex\n- `^~` — prefix match, stop regex if matched",
	],
	[
		"alias",
		"Defines a replacement for the specified location. Unlike `root`, the matched prefix is replaced instead of appended.\n\n**Syntax:** `alias path;`",
	],
	[
		"try_files",
		"Checks the existence of files in the specified order and uses the first found file for request processing; the processing is performed in the current context. Falls back to the last parameter (a named location or status code).\n\n**Syntax:** `try_files file ... uri` or `try_files file ... =code;`\n\n**Example:** `try_files $uri $uri/ /index.php?$query_string;`",
	],
	[
		"internal",
		"Specifies that a given location can only be used for internal requests. External requests return a 404 error.\n\n**Syntax:** `internal;`",
	],
	[
		"limit_except",
		"Restricts HTTP methods inside a location. All other methods not listed are restricted.\n\n**Syntax:** `limit_except method ... { ... }`",
	],
	[
		"limit_rate",
		"Limits the rate of response transmission to a client.\n\n**Syntax:** `limit_rate rate;`\n\n**Default:** `limit_rate 0;` (no limit)",
	],
	[
		"limit_rate_after",
		"Sets the initial amount after which the further transmission of a response to a client will be rate limited.\n\n**Syntax:** `limit_rate_after size;`\n\n**Default:** `limit_rate_after 0;`",
	],

	// ── Proxy ──
	[
		"proxy_pass",
		"Sets the protocol and address of a proxied server and an optional URI to which a location should be mapped.\n\n**Syntax:** `proxy_pass URL;`\n\n**Example:** `proxy_pass http://backend;`",
	],
	[
		"proxy_set_header",
		"Allows redefining or appending fields to the request header passed to the proxied server.\n\n**Syntax:** `proxy_set_header field value;`\n\n**Example:** `proxy_set_header Host $host;`",
	],
	[
		"proxy_hide_header",
		"Sets additional fields that will not be passed to the client from a proxied server response.\n\n**Syntax:** `proxy_hide_header field;`",
	],
	[
		"proxy_pass_header",
		"Permits passing otherwise disabled header fields from a proxied server to a client.\n\n**Syntax:** `proxy_pass_header field;`",
	],
	[
		"proxy_ignore_headers",
		"Disables processing of certain response header fields from the proxied server.\n\n**Syntax:** `proxy_ignore_headers field ...;`\n\nPossible values: `X-Accel-Redirect`, `X-Accel-Expires`, `X-Accel-Limit-Rate`, `X-Accel-Buffering`, `X-Accel-Charset`, `Expires`, `Cache-Control`, `Set-Cookie`, `Vary`",
	],
	[
		"proxy_redirect",
		'Sets the text that should be changed in the "Location" and "Refresh" header fields of a proxied server response.\n\n**Syntax:** `proxy_redirect default | off | redirect replacement;`\n\n**Default:** `proxy_redirect default;`',
	],
	[
		"proxy_intercept_errors",
		"Determines whether proxied responses with codes greater than or equal to 300 should be passed to a client or intercepted and redirected to nginx for processing with the `error_page` directive.\n\n**Syntax:** `proxy_intercept_errors on | off;`\n\n**Default:** `proxy_intercept_errors off;`",
	],
	[
		"proxy_http_version",
		"Sets the HTTP protocol version for proxying. Version 1.1 is recommended for use with keepalive connections and NTLM authentication.\n\n**Syntax:** `proxy_http_version 1.0 | 1.1;`\n\n**Default:** `proxy_http_version 1.0;`",
	],
	[
		"proxy_buffering",
		"Enables or disables buffering of responses from the proxied server.\n\n**Syntax:** `proxy_buffering on | off;`\n\n**Default:** `proxy_buffering on;`",
	],
	[
		"proxy_buffer_size",
		"Sets the size of the buffer used for reading the first part of the response received from the proxied server (usually the response headers).\n\n**Syntax:** `proxy_buffer_size size;`\n\n**Default:** `proxy_buffer_size 4k|8k;`",
	],
	[
		"proxy_buffers",
		"Sets the number and size of the buffers used for reading a response from the proxied server.\n\n**Syntax:** `proxy_buffers number size;`\n\n**Default:** `proxy_buffers 8 4k|8k;`",
	],
	[
		"proxy_read_timeout",
		"Defines a timeout for reading a response from the proxied server. The timeout is set only between two successive read operations, not for the transmission of the whole response.\n\n**Syntax:** `proxy_read_timeout time;`\n\n**Default:** `proxy_read_timeout 60s;`",
	],
	[
		"proxy_connect_timeout",
		"Defines a timeout for establishing a connection with a proxied server. This timeout cannot usually exceed 75 seconds.\n\n**Syntax:** `proxy_connect_timeout time;`\n\n**Default:** `proxy_connect_timeout 60s;`",
	],
	[
		"proxy_send_timeout",
		"Sets a timeout for transmitting a request to the proxied server. The timeout is set only between two successive write operations, not for the transmission of the whole request.\n\n**Syntax:** `proxy_send_timeout time;`\n\n**Default:** `proxy_send_timeout 60s;`",
	],
	[
		"proxy_next_upstream",
		"Specifies in which cases a request should be passed to the next server. The directive is only available when using the upstream module.\n\n**Syntax:** `proxy_next_upstream error | timeout | invalid_header | http_500 | ... | off ...;`\n\n**Default:** `proxy_next_upstream error timeout;`",
	],
	[
		"proxy_cache",
		"Defines a shared memory zone used for caching. The same zone can be used in several places.\n\n**Syntax:** `proxy_cache zone | off;`\n\n**Default:** `proxy_cache off;`",
	],
	[
		"proxy_cache_path",
		"Sets the path and other parameters of a cache. Cache data is stored in files. The file name in a cache is a result of applying the MD5 function to the cache key.\n\n**Syntax:** `proxy_cache_path path [levels=levels] [use_temp_path=on|off] keys_zone=name:size [inactive=time] [max_size=size] [min_free=size] [manager_files=number] [manager_sleep=time] [manager_threshold=time] [loader_files=number] [loader_sleep=time] [loader_threshold=time] [purger=on|off] [purger_files=number] [purger_sleep=time] [purger_threshold=time];`",
	],
	[
		"proxy_cache_key",
		"Defines a key for caching.\n\n**Syntax:** `proxy_cache_key string;`\n\n**Default:** `proxy_cache_key $scheme$proxy_host$request_uri;`",
	],
	[
		"proxy_cache_valid",
		"Sets caching time for different response codes.\n\n**Syntax:** `proxy_cache_valid [code ...] time;`\n\n**Example:** `proxy_cache_valid 200 302 10m;`",
	],
	[
		"proxy_cache_bypass",
		'Defines conditions under which the response will not be taken from a cache. If at least one value of the string parameters is not empty and is not equal to "0" then the response will not be taken from the cache.\n\n**Syntax:** `proxy_cache_bypass string ...;`',
	],
	[
		"proxy_no_cache",
		"Defines conditions under which the response will not be saved to a cache.\n\n**Syntax:** `proxy_no_cache string ...;`",
	],
	[
		"proxy_cache_use_stale",
		"Determines in which cases it is permitted to use a stale cached response.\n\n**Syntax:** `proxy_cache_use_stale error | timeout | invalid_header | updating | http_500 | ... | off ...;`\n\n**Default:** `proxy_cache_use_stale off;`",
	],

	// ── FastCGI ──
	[
		"fastcgi_pass",
		"Sets the address of a FastCGI server.\n\n**Syntax:** `fastcgi_pass address;`\n\n**Example:** `fastcgi_pass unix:/run/php/php8.1-fpm.sock;`",
	],
	[
		"fastcgi_index",
		"Sets a file name that will be appended after a URI that ends with a slash, in the value of the `$fastcgi_script_name` variable.\n\n**Syntax:** `fastcgi_index name;`\n\n**Example:** `fastcgi_index index.php;`",
	],
	[
		"fastcgi_param",
		"Sets a parameter that should be passed to the FastCGI server.\n\n**Syntax:** `fastcgi_param parameter value [if_not_empty];`\n\n**Example:** `fastcgi_param SCRIPT_FILENAME $document_root$fastcgi_script_name;`",
	],
	[
		"fastcgi_read_timeout",
		"Defines a timeout for reading a response from the FastCGI server.\n\n**Syntax:** `fastcgi_read_timeout time;`\n\n**Default:** `fastcgi_read_timeout 60s;`",
	],
	[
		"fastcgi_connect_timeout",
		"Defines a timeout for establishing a connection with a FastCGI server.\n\n**Syntax:** `fastcgi_connect_timeout time;`\n\n**Default:** `fastcgi_connect_timeout 60s;`",
	],
	[
		"fastcgi_send_timeout",
		"Sets a timeout for transmitting a request to the FastCGI server.\n\n**Syntax:** `fastcgi_send_timeout time;`\n\n**Default:** `fastcgi_send_timeout 60s;`",
	],
	[
		"fastcgi_buffers",
		"Sets the number and size of the buffers used for reading a response from the FastCGI server, for a single connection.\n\n**Syntax:** `fastcgi_buffers number size;`\n\n**Default:** `fastcgi_buffers 8 4k|8k;`",
	],
	[
		"fastcgi_buffer_size",
		"Sets the size of the buffer used for reading the first part of the response received from the FastCGI server (usually the response headers).\n\n**Syntax:** `fastcgi_buffer_size size;`\n\n**Default:** `fastcgi_buffer_size 4k|8k;`",
	],
	[
		"fastcgi_split_path_info",
		"Defines a regular expression that captures a value for the `$fastcgi_path_info` variable.\n\n**Syntax:** `fastcgi_split_path_info regex;`\n\n**Example:** `fastcgi_split_path_info ^(.+\\.php)(/.+)$;`",
	],
	[
		"fastcgi_intercept_errors",
		"Determines whether FastCGI server responses with codes greater than or equal to 300 should be passed to a client or redirected to nginx for processing with `error_page`.\n\n**Syntax:** `fastcgi_intercept_errors on | off;`\n\n**Default:** `fastcgi_intercept_errors off;`",
	],

	// ── uWSGI / SCGI ──
	[
		"uwsgi_pass",
		"Sets the address of a uWSGI server.\n\n**Syntax:** `uwsgi_pass address;`",
	],
	[
		"uwsgi_param",
		"Sets a parameter that should be passed to the uWSGI server.\n\n**Syntax:** `uwsgi_param parameter value [if_not_empty];`",
	],
	[
		"scgi_pass",
		"Sets the address of an SCGI server.\n\n**Syntax:** `scgi_pass address;`",
	],
	[
		"scgi_param",
		"Sets a parameter that should be passed to the SCGI server.\n\n**Syntax:** `scgi_param parameter value [if_not_empty];`",
	],

	// ── Rewrite / control flow ──
	[
		"return",
		"Stops processing and returns the specified code to a client.\n\n**Syntax:** `return code [text];` or `return code URL;` or `return URL;`\n\n**Example:** `return 301 https://$host$request_uri;`",
	],
	[
		"rewrite",
		"Rewrites the request URI using a regular expression. Processing stops at the first match unless `last` or `break` flags are used.\n\n**Syntax:** `rewrite regex replacement [flag];`\n\n**Flags:** `last`, `break`, `redirect` (302), `permanent` (301)",
	],
	[
		"rewrite_log",
		"Enables or disables logging of `ngx_http_rewrite_module` directives processing results at the `notice` level.\n\n**Syntax:** `rewrite_log on | off;`\n\n**Default:** `rewrite_log off;`",
	],
	[
		"if",
		"Evaluates a condition and executes a block if it is true. Used in the rewrite module context.\n\n**Syntax:** `if (condition) { ... }`\n\n**Conditions:** variable truthiness, `=`/`!=`, `~`/`~*`/`!~`/`!~*` regex, `-f`/`!-f` file test, `-d`/`!-d` directory test, `-e`/`!-e` existence, `-x`/`!-x` executable",
	],
	[
		"set",
		"Sets a value for the specified variable.\n\n**Syntax:** `set $variable value;`",
	],
	[
		"break",
		"Stops processing the current set of `ngx_http_rewrite_module` directives.\n\n**Syntax:** `break;`",
	],

	// ── Response headers ──
	[
		"add_header",
		"Adds the specified field to a response header provided that the response code equals 200, 201, 204, 206, 301, 302, 303, 304, 307, or 308. The value can contain variables.\n\n**Syntax:** `add_header name value [always];`\n\n**Example:** `add_header X-Frame-Options SAMEORIGIN;`",
	],
	[
		"add_trailer",
		"Adds the specified field to the end of a response.\n\n**Syntax:** `add_trailer name value [always];`",
	],
	[
		"expires",
		'Enables or disables adding or modifying the "Expires" and "Cache-Control" response header fields.\n\n**Syntax:** `expires [modified] time;` or `expires epoch | max | off;`\n\n**Default:** `expires off;`',
	],
	[
		"etag",
		'Enables or disables automatic generation of the "ETag" response header field for static resources.\n\n**Syntax:** `etag on | off;`\n\n**Default:** `etag on;`',
	],
	[
		"more_set_headers",
		"Sets/replaces response headers (requires the `headers-more` module).\n\n**Syntax:** `more_set_headers [-s status_code] [-t content_type] header ...;`",
	],

	// ── Access control ──
	[
		"allow",
		"Allows access from the specified network or address.\n\n**Syntax:** `allow address | CIDR | unix: | all;`",
	],
	[
		"deny",
		"Denies access from the specified network or address.\n\n**Syntax:** `deny address | CIDR | unix: | all;`",
	],
	[
		"satisfy",
		"Allows access if all (`all`) or at least one (`any`) of the `ngx_http_access_module` or `ngx_http_auth_basic_module` directives allow access.\n\n**Syntax:** `satisfy all | any;`\n\n**Default:** `satisfy all;`",
	],

	// ── Auth ──
	[
		"auth_basic",
		"Enables validation of user name and password using the HTTP Basic Authentication protocol.\n\n**Syntax:** `auth_basic string | off;`\n\n**Default:** `auth_basic off;`",
	],
	[
		"auth_basic_user_file",
		"Specifies a file that keeps user names and passwords. The file format is the Apache `.htpasswd` format.\n\n**Syntax:** `auth_basic_user_file file;`",
	],
	[
		"auth_request",
		"Enables authorization based on the result of a subrequest and sets the URI to which the subrequest will be sent.\n\n**Syntax:** `auth_request uri | off;`\n\n**Default:** `auth_request off;`",
	],
	[
		"auth_request_set",
		"Sets the variable to the given value after the authorization request completes.\n\n**Syntax:** `auth_request_set $variable value;`",
	],

	// ── Logging ──
	[
		"log_not_found",
		"Enables or disables logging of errors about not found files into `error_log`.\n\n**Syntax:** `log_not_found on | off;`\n\n**Default:** `log_not_found on;`",
	],
	[
		"log_subrequest",
		"Enables or disables logging of subrequests into `access_log`.\n\n**Syntax:** `log_subrequest on | off;`\n\n**Default:** `log_subrequest off;`",
	],
	[
		"open_log_file_cache",
		"Defines a cache that stores the file descriptors of frequently used logs whose names contain variables.\n\n**Syntax:** `open_log_file_cache max=N [inactive=time] [min_uses=N] [valid=time] | off;`\n\n**Default:** `open_log_file_cache off;`",
	],

	// ── Upstream ──
	[
		"upstream",
		"Defines a group of servers that can be referenced by the `proxy_pass`, `fastcgi_pass`, `uwsgi_pass`, `scgi_pass`, `memcached_pass`, and `grpc_pass` directives.\n\n**Syntax:** `upstream name { ... }`",
	],
	[
		"least_conn",
		"Specifies that a server group should use a load balancing method where a request is passed to the server with the least number of active connections.\n\n**Syntax:** `least_conn;`",
	],
	[
		"ip_hash",
		"Specifies that a group should use a load balancing method where requests are distributed between servers based on client IP addresses.\n\n**Syntax:** `ip_hash;`",
	],
	[
		"hash",
		"Specifies a load balancing method for a server group where the client-server mapping is based on the hashed key value.\n\n**Syntax:** `hash key [consistent];`",
	],
	[
		"random",
		"Specifies that a group should use a load balancing method where a request is passed to a randomly selected server.\n\n**Syntax:** `random [two [method]];`",
	],
	[
		"keepalive",
		"Activates the cache for connections to upstream servers. The `connections` parameter sets the maximum number of idle keepalive connections preserved in the cache.\n\n**Syntax:** `keepalive connections;`",
	],
	[
		"zone",
		"Defines the name and size of a shared memory zone that keeps the group's configuration and run-time state shared between worker processes.\n\n**Syntax:** `zone name [size];`",
	],
	[
		"weight",
		"Sets the weight of the server, used in load balancing.\n\n**Syntax:** `server address [weight=number];`\n\n**Default:** `weight=1`",
	],
	[
		"max_fails",
		"Sets the number of unsuccessful attempts to communicate with the server that should happen in the duration set by the `fail_timeout` parameter to consider the server unavailable.\n\n**Syntax:** `server address [max_fails=number];`\n\n**Default:** `max_fails=1`",
	],
	[
		"fail_timeout",
		"Sets the time during which the specified number of unsuccessful attempts to communicate with the server should happen to consider the server unavailable; and the period of time the server will be considered unavailable.\n\n**Syntax:** `server address [fail_timeout=time];`\n\n**Default:** `fail_timeout=10s`",
	],
	[
		"max_conns",
		"Limits the maximum number of simultaneous active connections to the proxied server.\n\n**Syntax:** `server address [max_conns=number];`\n\n**Default:** `0` (no limit)",
	],
	[
		"backup",
		"Marks the server as a backup server. Requests are passed to backup servers when the primary servers are unavailable.\n\n**Syntax:** `server address backup;`",
	],
	[
		"down",
		"Marks the server as permanently unavailable.\n\n**Syntax:** `server address down;`",
	],
	[
		"slow_start",
		"Sets the time during which the server will recover its weight after it becomes available or when it becomes available after it was considered unavailable.\n\n**Syntax:** `server address [slow_start=time];`\n\n**Default:** `slow_start=0` (disabled)",
	],
	[
		"resolver",
		"Configures name servers used to resolve names of upstream servers into addresses.\n\n**Syntax:** `resolver address ... [valid=time] [ipv4=on|off] [ipv6=on|off] [status_zone=zone];`",
	],
	[
		"resolver_timeout",
		"Sets a timeout for name resolution.\n\n**Syntax:** `resolver_timeout time;`\n\n**Default:** `resolver_timeout 30s;`",
	],

	// ── SSL / TLS ──
	[
		"ssl",
		"Enables the HTTPS protocol for the given virtual server. Prefer using `ssl` parameter of the `listen` directive instead.\n\n**Syntax:** `ssl on | off;`\n\n**Default:** `ssl off;`",
	],
	[
		"ssl_certificate",
		"Specifies a file with the certificate in the PEM format for the given virtual server.\n\n**Syntax:** `ssl_certificate file;`",
	],
	[
		"ssl_certificate_key",
		"Specifies a file with the secret key in the PEM format for the given virtual server.\n\n**Syntax:** `ssl_certificate_key file;`",
	],
	[
		"ssl_protocols",
		"Enables the specified TLS protocols.\n\n**Syntax:** `ssl_protocols [SSLv2] [SSLv3] [TLSv1] [TLSv1.1] [TLSv1.2] [TLSv1.3];`\n\n**Default:** `ssl_protocols TLSv1 TLSv1.1 TLSv1.2 TLSv1.3;`\n\n**Recommendation:** Use only `TLSv1.2 TLSv1.3`.",
	],
	[
		"ssl_ciphers",
		"Specifies the enabled ciphers in OpenSSL format.\n\n**Syntax:** `ssl_ciphers ciphers;`\n\n**Default:** `ssl_ciphers HIGH:!aNULL:!MD5;`",
	],
	[
		"ssl_prefer_server_ciphers",
		"Specifies that server ciphers should be preferred over client ciphers when using TLS protocols.\n\n**Syntax:** `ssl_prefer_server_ciphers on | off;`\n\n**Default:** `ssl_prefer_server_ciphers off;`",
	],
	[
		"ssl_session_cache",
		"Sets the types and sizes of caches that store session parameters.\n\n**Syntax:** `ssl_session_cache off | none | [builtin[:size]] [shared:name:size];`\n\n**Default:** `ssl_session_cache none;`",
	],
	[
		"ssl_session_timeout",
		"Specifies a time during which a client may reuse the session parameters.\n\n**Syntax:** `ssl_session_timeout time;`\n\n**Default:** `ssl_session_timeout 5m;`",
	],
	[
		"ssl_session_tickets",
		"Enables or disables session resumption through TLS session tickets.\n\n**Syntax:** `ssl_session_tickets on | off;`\n\n**Default:** `ssl_session_tickets on;`",
	],
	[
		"ssl_dhparam",
		"Specifies a file with DH parameters for DHE ciphers.\n\n**Syntax:** `ssl_dhparam file;`",
	],
	[
		"ssl_ecdh_curve",
		"Specifies a curve for ECDHE ciphers.\n\n**Syntax:** `ssl_ecdh_curve curve;`\n\n**Default:** `ssl_ecdh_curve auto;`",
	],
	[
		"ssl_trusted_certificate",
		"Specifies a file with trusted CA certificates in PEM format used to verify client certificates and OCSP responses.\n\n**Syntax:** `ssl_trusted_certificate file;`",
	],
	[
		"ssl_client_certificate",
		"Specifies a file with trusted CA certificates in PEM format used to verify client certificates.\n\n**Syntax:** `ssl_client_certificate file;`",
	],
	[
		"ssl_verify_client",
		"Enables verification of client certificates. The result of verification is stored in the `$ssl_client_verify` variable.\n\n**Syntax:** `ssl_verify_client on | off | optional | optional_no_ca;`\n\n**Default:** `ssl_verify_client off;`",
	],
	[
		"ssl_verify_depth",
		"Sets the verification depth in the client certificates chain.\n\n**Syntax:** `ssl_verify_depth number;`\n\n**Default:** `ssl_verify_depth 1;`",
	],
	[
		"ssl_stapling",
		"Enables or disables stapling of OCSP responses by the server.\n\n**Syntax:** `ssl_stapling on | off;`\n\n**Default:** `ssl_stapling off;`",
	],
	[
		"ssl_stapling_verify",
		"Enables or disables verification of OCSP responses by the server.\n\n**Syntax:** `ssl_stapling_verify on | off;`\n\n**Default:** `ssl_stapling_verify off;`",
	],
	[
		"ssl_buffer_size",
		"Sets the size of the buffer used for sending data. To minimize TTFB, smaller values reduce SSL record size.\n\n**Syntax:** `ssl_buffer_size size;`\n\n**Default:** `ssl_buffer_size 16k;`",
	],

	// ── Map / Geo ──
	[
		"map",
		"Creates a new variable whose value depends on values of one or more of the source variables.\n\n**Syntax:** `map string $variable { ... }`",
	],
	[
		"geo",
		"Creates a new variable whose value depends on the client IP address.\n\n**Syntax:** `geo [$address] $variable { ... }`",
	],
	[
		"split_clients",
		"Creates a variable for A/B testing. Values are assigned based on input string hashing.\n\n**Syntax:** `split_clients string $variable { ... }`",
	],

	// ── Misc ──
	[
		"types",
		"Maps file name extensions to MIME types of responses.\n\n**Syntax:** `types { ... }`",
	],
	[
		"recursive_error_pages",
		"Enables or disables doing several redirects using the `error_page` directive.\n\n**Syntax:** `recursive_error_pages on | off;`\n\n**Default:** `recursive_error_pages off;`",
	],
	[
		"absolute_redirect",
		"If disabled, redirects issued by nginx will be relative.\n\n**Syntax:** `absolute_redirect on | off;`\n\n**Default:** `absolute_redirect on;`",
	],
	[
		"server_name_in_redirect",
		"Enables or disables the use of the primary server name, specified by `server_name`, in absolute redirects issued by nginx.\n\n**Syntax:** `server_name_in_redirect on | off;`\n\n**Default:** `server_name_in_redirect off;`",
	],
	[
		"port_in_redirect",
		"Enables or disables specifying the port in absolute redirects issued by nginx.\n\n**Syntax:** `port_in_redirect on | off;`\n\n**Default:** `port_in_redirect on;`",
	],
	[
		"directio",
		"Enables the use of the `O_DIRECT` flag. Useful for serving large files.\n\n**Syntax:** `directio size | off;`\n\n**Default:** `directio off;`",
	],
]);

// ─── Built-in variable documentation ─────────────────────────────────────────
const VARIABLE_DOCS = new Map<string, string>([
	// Request
	["request", "Full original request line, e.g. `GET /path?query HTTP/1.1`."],
	["request_method", "HTTP method of the request: `GET`, `POST`, etc."],
	[
		"request_uri",
		"Full original request URI including arguments (cannot be modified).",
	],
	[
		"request_filename",
		"File path for the current request, based on root or alias and URI.",
	],
	[
		"request_body",
		"Request body, available in locations where `proxy_pass` or `fastcgi_pass` are used.",
	],
	[
		"request_length",
		"Request length (including request line, header, and request body).",
	],
	[
		"request_time",
		"Request processing time in seconds with milliseconds resolution; time elapsed since reading the first bytes from the client.",
	],
	[
		"request_completion",
		"`OK` if the request has been fully received, empty string otherwise.",
	],

	// URI / Query
	[
		"uri",
		"Current URI in the request, normalized and possibly changed by rewrites (without arguments).",
	],
	["document_uri", "Alias of `$uri`."],
	["args", "Arguments in the request line (query string without `?`)."],
	["query_string", "Same as `$args`."],
	["is_args", "`?` if a request line has arguments, empty string otherwise."],
	[
		"arg_name",
		"Argument `name` in the request line. E.g. `$arg_id` contains the value of `?id=...`.",
	],

	// Host
	[
		"host",
		"In order of precedence: host name from the request line, `Host` header field, or server name matching a request.",
	],
	["http_host", "The `Host` request header field."],
	["hostname", "Host name of the server machine running nginx."],
	["server_name", "Name of the virtual server that received the request."],
	["server_addr", "Address of the server that accepted the request."],
	["server_port", "Port of the server that accepted the request."],
	[
		"server_protocol",
		"Protocol of a request, usually `HTTP/1.0`, `HTTP/1.1`, or `HTTP/2.0`.",
	],

	// Client
	["remote_addr", "Client IP address."],
	["remote_port", "Client port."],
	["remote_user", "User name supplied with Basic authentication."],
	[
		"realip_remote_addr",
		"Stores the original client address before `ngx_http_realip_module` replaces it.",
	],
	["realip_remote_port", "Stores the original client port."],

	// Response
	["status", "Response status code."],
	["bytes_sent", "Number of bytes sent to a client."],
	[
		"body_bytes_sent",
		"Number of bytes sent to a client, not counting the response header.",
	],
	["content_length", '"Content-Length" request header field.'],
	["content_type", '"Content-Type" request header field.'],
	[
		"sent_http_name",
		"Arbitrary response header field; the last part of the variable name is the header name, e.g. `$sent_http_content_type`.",
	],
	["sent_http_content_type", "The `Content-Type` response header field."],
	["sent_http_content_length", "The `Content-Length` response header field."],
	["sent_http_location", "The `Location` response header field."],
	["sent_http_cache_control", "The `Cache-Control` response header field."],
	[
		"sent_trailer_name",
		"Arbitrary trailer field sent at the end of the response.",
	],

	// HTTP request headers
	[
		"http_name",
		"Arbitrary request header field; the last part of the variable name is the header name converted to lower case, with dashes replaced by underscores. E.g. `$http_user_agent`.",
	],
	["http_referer", '"Referer" request header field.'],
	["http_user_agent", '"User-Agent" request header field.'],
	["http_x_forwarded_for", '"X-Forwarded-For" request header field.'],
	["http_cookie", '"Cookie" request header field.'],
	["http_authorization", '"Authorization" request header field.'],
	["http_accept", '"Accept" request header field.'],
	["http_accept_encoding", '"Accept-Encoding" request header field.'],
	["http_accept_language", '"Accept-Language" request header field.'],

	// Cookie
	[
		"cookie_name",
		"Value of cookie `name`. E.g. `$cookie_session` returns the value of the `session` cookie.",
	],

	// Connection
	["connection", "Connection serial number."],
	[
		"connection_requests",
		"Current number of requests made through a connection.",
	],
	[
		"connection_time",
		"Connection time in seconds with milliseconds resolution.",
	],
	["pipe", "`p` if the request was pipelined, `.` otherwise."],
	["msec", "Current time in seconds with milliseconds resolution."],
	[
		"time_iso8601",
		"Local time in the ISO 8601 standard format, e.g. `2025-04-14T10:30:00+01:00`.",
	],
	[
		"time_local",
		"Local time in the Common Log Format, e.g. `14/Apr/2025:10:30:00 +0100`.",
	],
	["nginx_version", "Nginx version."],
	["pid", "PID of the worker process."],

	// Scheme
	["scheme", "Request scheme: `http` or `https`."],

	// File system
	["document_root", "Root or alias directive value for the current request."],
	[
		"realpath_root",
		"Absolute pathname corresponding to `$document_root`, with all symlinks resolved.",
	],

	// FastCGI
	[
		"fastcgi_script_name",
		"Request URI or, if a URI ends with a slash, the request URI with an index file name configured by the `fastcgi_index` directive.",
	],
	[
		"fastcgi_path_info",
		"Tail of the URI after the script name, captured by a `fastcgi_split_path_info` regex.",
	],

	// Proxy / upstream
	[
		"proxy_host",
		"Name and port of the proxied server as specified in `proxy_pass`.",
	],
	["proxy_port", "Port of the proxied server as specified in `proxy_pass`."],
	[
		"upstream_addr",
		"Keeps the IP address and port, or the path to the UNIX-domain socket of the upstream server.",
	],
	[
		"upstream_cache_status",
		"Cache result: `MISS`, `BYPASS`, `EXPIRED`, `STALE`, `UPDATING`, `REVALIDATED`, `HIT`.",
	],
	[
		"upstream_connect_time",
		"Time spent on establishing a connection with the upstream server (seconds, milliseconds resolution).",
	],
	[
		"upstream_header_time",
		"Time between establishing a connection and receiving the first byte of the header from the upstream server.",
	],
	[
		"upstream_response_time",
		"Time between establishing a connection and receiving the last byte of the response body from the upstream server.",
	],
	[
		"upstream_response_length",
		"Length of the response obtained from the upstream server.",
	],
	[
		"upstream_status",
		"Status code of the response obtained from the upstream server.",
	],
	[
		"upstream_http_name",
		"Arbitrary header field from the upstream server response.",
	],
	[
		"upstream_trailer_name",
		"Arbitrary trailer field from the end of an upstream server response.",
	],
	[
		"upstream_bytes_received",
		"Number of bytes received from an upstream server.",
	],
	["upstream_bytes_sent", "Number of bytes sent to an upstream server."],

	// SSL
	[
		"ssl_protocol",
		"Protocol of an established SSL connection, e.g. `TLSv1.3`.",
	],
	["ssl_cipher", "Cipher suite used for an established TLS connection."],
	["ssl_ciphers", "List of ciphers supported by the client."],
	["ssl_curves", "List of curves supported by the client."],
	["ssl_session_id", "Session identifier of an established TLS connection."],
	["ssl_session_reused", "`r` if session was reused, `.` otherwise."],
	[
		"ssl_client_cert",
		"Client certificate in PEM format for an established TLS connection (each line except the first prefixed with a tab).",
	],
	["ssl_client_raw_cert", "Client certificate in PEM format."],
	["ssl_client_fingerprint", "SHA1 fingerprint of the client certificate."],
	["ssl_client_dn", "Distinguished Name (DN) of the client certificate."],
	[
		"ssl_client_escaped_cert",
		"Client certificate in PEM format, URL-encoded.",
	],
	["ssl_client_s_dn", "Subject DN of the client certificate."],
	["ssl_client_i_dn", "Issuer DN of the client certificate."],
	["ssl_client_serial", "Serial number of the client certificate."],
	["ssl_client_v_start", "Start date of the client certificate."],
	["ssl_client_v_end", "End date of the client certificate."],
	[
		"ssl_client_v_remain",
		"Number of days until expiry of the client certificate.",
	],
	[
		"ssl_client_verify",
		"Result of client certificate verification: `SUCCESS`, `FAILED:reason`, `NONE`.",
	],
	["ssl_server_name", "Server name requested through SNI."],
	[
		"ssl_early_data",
		"`1` if TLS 1.3 early data was used, empty string otherwise.",
	],

	// Rate limiting / other
	[
		"limit_rate",
		"Setting this variable enables response rate limiting, equivalent to setting the `limit_rate` directive.",
	],
	[
		"tcpinfo_rtt",
		"Information about the client TCP connection RTT (microseconds).",
	],
	[
		"tcpinfo_rttvar",
		"Information about the client TCP connection RTT variance.",
	],
	["tcpinfo_snd_cwnd", "TCP congestion window size."],
	["tcpinfo_rcv_space", "Client TCP receive buffer size."],
]);

// ─── Hover provider ───────────────────────────────────────────────────────────
export function registerNginxHoverProvider(
	context: vscode.ExtensionContext,
): void {
	context.subscriptions.push(
		vscode.languages.registerHoverProvider(
			{ pattern: "**/*.conf" },
			{
				provideHover(
					document: vscode.TextDocument,
					position: vscode.Position,
					token: vscode.CancellationToken,
				): Promise<vscode.Hover | undefined> {
					return new Promise((resolve) => {
						// Wait 400ms before computing — VS Code cancels the token if the
						// user moves away, so the popup only appears when they actually pause.
						const timer = setTimeout(() => {
							const config = vscode.workspace.getConfiguration(
								"theToyBox.syntaxHighlighting",
							);
							if (
								!config.get<boolean>("enabled", true) ||
								!config.get<boolean>("nginx", true)
							) {
								return resolve(undefined);
							}

							// Match $variable or plain identifier (including hyphens/dots for directive names)
							const range = document.getWordRangeAtPosition(
								position,
								/\$[a-zA-Z0-9_]+|[a-zA-Z_][a-zA-Z0-9_\-.]*/,
							);
							if (!range) {
								return resolve(undefined);
							}

							const word = document.getText(range);

							if (word.startsWith("$")) {
								const varName = word.slice(1);
								const doc = VARIABLE_DOCS.get(varName);
								if (!doc) {
									return resolve(undefined);
								}
								const md = new vscode.MarkdownString(
									`**nginx variable** \`${word}\`\n\n${doc}`,
								);
								md.isTrusted = true;
								return resolve(new vscode.Hover(md, range));
							}

							const lower = word.toLowerCase();
							const doc = DIRECTIVE_DOCS.get(lower);
							if (!doc) {
								return resolve(undefined);
							}
							const md = new vscode.MarkdownString(
								`**nginx directive** \`${lower}\`\n\n${doc}`,
							);
							md.isTrusted = true;
							return resolve(new vscode.Hover(md, range));
						}, 400);

						token.onCancellationRequested(() => {
							clearTimeout(timer);
							resolve(undefined);
						});
					});
				},
			},
		),
	);
}
