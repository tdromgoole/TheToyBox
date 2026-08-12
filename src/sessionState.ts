export interface Session {
	name: string;
	files: string[];
	active?: string;
	createdAt: string;
}

export function normalizeSessions(value: unknown): Session[] {
	if (!Array.isArray(value)) {
		return [];
	}

	return value.flatMap((candidate) => {
		if (!candidate || typeof candidate !== "object") {
			return [];
		}
		const raw = candidate as Record<string, unknown>;
		if (
			typeof raw.name !== "string" ||
			raw.name.trim() === "" ||
			!Array.isArray(raw.files) ||
			!raw.files.every((file) => typeof file === "string") ||
			typeof raw.createdAt !== "string" ||
			Number.isNaN(Date.parse(raw.createdAt)) ||
			(raw.active !== undefined && typeof raw.active !== "string")
		) {
			return [];
		}

		return [{
			name: raw.name.trim(),
			files: [...new Set(raw.files)],
			active: raw.active,
			createdAt: raw.createdAt,
		}];
	});
}

export function storeSession(sessions: Session[], session: Session): Session[] {
	const existingIndex = sessions.findIndex(
		(saved) => saved.name.toLowerCase() === session.name.toLowerCase(),
	);
	if (existingIndex < 0) {
		return [...sessions, session];
	}
	const updated = [...sessions];
	updated[existingIndex] = session;
	return updated;
}

export function removeSessions(
	sessions: Session[],
	names: ReadonlySet<string>,
): Session[] {
	return sessions.filter((session) => !names.has(session.name));
}
