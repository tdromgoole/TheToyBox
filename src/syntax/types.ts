export interface TokenMatch {
	type: string;
	start: number;
	end: number;
}

export interface LanguageProfile {
	extensions: string[];
	tokenize: (text: string) => TokenMatch[];
}
