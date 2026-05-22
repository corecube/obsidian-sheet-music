import { Progression } from "tonal";

export interface ProgressionItem {
	numeral: string;
	chord: string;
}

export interface ProgressionModel {
	key: string;
	rows: ProgressionItem[][];
}

const KEY_RE = /^[A-G][#b]?m?$/;

export function parseProgression(source: string): ProgressionModel | null {
	const lines = source
		.replace(/\r\n?/g, "\n")
		.split("\n")
		.map((l) => l.trim())
		.filter((l) => l.length > 0);

	if (lines.length === 0) return null;

	if (!lines[0] || !KEY_RE.test(lines[0])) return null;

	const key = lines[0];
	const contentLines = lines.slice(1);

	if (contentLines.length === 0) return null;

	const root = key.endsWith("m") ? key.slice(0, -1) : key;

	const rows = contentLines.map((line) => {
		const tokens = line.split(/\s+/).filter((t) => t.length > 0);
		if (tokens.length === 0) return [];

		if (tokens.every((t) => /^[A-G]/.test(t))) {
			const numerals = Progression.toRomanNumerals(root, tokens);
			return tokens.map((chord, i): ProgressionItem => ({
				numeral: numerals[i] || "?",
				chord,
			}));
		}

		const chords = Progression.fromRomanNumerals(root, tokens);
		return tokens.map((numeral, i): ProgressionItem => ({
			numeral,
			chord: chords[i] || "?",
		}));
	});

	return { key, rows };
}
