export interface TokenMatch {
	type: string;
	start: number;
	end: number;
}

export interface LanguageProfile {
	extensions: string[];
	tokenize: (text: string) => TokenMatch[];
	/** Per-language toggle key under theToyBox.syntaxHighlighting.* (defaults to enabled if absent) */
	settingKey?: string;
}
