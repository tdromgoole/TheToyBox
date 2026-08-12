type Message = Record<string, unknown>;

function message(value: unknown): Message | undefined {
	return value !== null && typeof value === "object" && !Array.isArray(value)
		? value as Message
		: undefined;
}

function line(value: unknown, minimum: number): value is number {
	return Number.isSafeInteger(value) && (value as number) >= minimum;
}

function uri(value: unknown): value is string {
	if (typeof value !== "string" || value.length === 0 || value.length > 16_384) {
		return false;
	}
	try {
		const parsed = new URL(value);
		return parsed.protocol === "file:" || parsed.protocol === "untitled:";
	} catch {
		return false;
	}
}

export type WordFrequencyMessage = { command: "goTo"; line: number };
export function wordFrequencyMessage(value: unknown): WordFrequencyMessage | undefined {
	const msg = message(value);
	return msg?.command === "goTo" && line(msg.line, 1)
		? { command: "goTo", line: msg.line }
		: undefined;
}

export type OutlineMessage = { command: "jumpTo"; line: number };
export function outlineMessage(value: unknown): OutlineMessage | undefined {
	const msg = message(value);
	return msg?.command === "jumpTo" && line(msg.line, 0)
		? { command: "jumpTo", line: msg.line }
		: undefined;
}

export type BookmarkMessage =
	| { command: "clearAll" }
	| { command: "goTo" | "remove"; uri: string; line: number };
export function bookmarkMessage(value: unknown): BookmarkMessage | undefined {
	const msg = message(value);
	if (msg?.command === "clearAll") {
		return { command: "clearAll" };
	}
	return (msg?.command === "goTo" || msg?.command === "remove") &&
		uri(msg.uri) && line(msg.line, 0)
		? { command: msg.command, uri: msg.uri, line: msg.line }
		: undefined;
}

export type TodoMessage =
	| { command: "refresh" }
	| { command: "goTo"; uri: string; line: number };
export function todoMessage(value: unknown): TodoMessage | undefined {
	const msg = message(value);
	if (msg?.command === "refresh") {
		return { command: "refresh" };
	}
	return msg?.command === "goTo" && uri(msg.uri) && line(msg.line, 0)
		? { command: "goTo", uri: msg.uri, line: msg.line }
		: undefined;
}

export function printMessage(value: unknown): value is { command: "print" } {
	return message(value)?.command === "print";
}

export type SerializerMessage =
	| { type: "serialized"; html: string }
	| { type: "error"; message?: string };
export function serializerMessage(value: unknown): SerializerMessage | undefined {
	const msg = message(value);
	if (msg?.type === "serialized" && typeof msg.html === "string") {
		return { type: "serialized", html: msg.html };
	}
	if (msg?.type === "error" && (msg.message === undefined || typeof msg.message === "string")) {
		return { type: "error", message: msg.message };
	}
	return undefined;
}
