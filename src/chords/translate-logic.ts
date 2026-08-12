import {
	isSectionLine,
	splitChordsLines,
	tokenizeChordsLine,
} from "./renderer-logic";

export const TRANSLATION_PREFIX = "> ";

// Mirrors CUSTOM_DEF_PATTERN in guitar-chord.ts; duplicated here so this
// module stays free of the svguitar/chords-db imports.
const CUSTOM_DEF_LINE_RE = /^([A-G][#b]?[A-Za-z0-9#/]*)\[([xX0-9]{6})\]\s*$/;

export interface TranslatableLine {
	index: number;
	text: string;
}

export function isTranslationLine(line: string): boolean {
	return line.startsWith(TRANSLATION_PREFIX);
}

export function stripChordMarkers(line: string): string {
	return tokenizeChordsLine(line)
		.filter((token) => token.type === "text")
		.map((token) => token.value)
		.join("");
}

export function collectTranslatableLines(source: string): TranslatableLine[] {
	const entries: TranslatableLine[] = [];
	const lines = splitChordsLines(source);
	for (let i = 0; i < lines.length; i++) {
		const line = lines[i] ?? "";
		if (isTranslationLine(line)) continue;
		if (isSectionLine(line)) continue;
		if (CUSTOM_DEF_LINE_RE.test(line.trim())) continue;
		const text = stripChordMarkers(line);
		if (text.trim().length === 0) continue;
		entries.push({ index: i, text });
	}
	return entries;
}

export function insertTranslations(
	source: string,
	entries: TranslatableLine[],
	translations: string[],
): string {
	const lines = splitChordsLines(source);
	const byIndex = new Map<number, string>();
	for (let i = 0; i < entries.length; i++) {
		const entry = entries[i];
		const translation = translations[i];
		if (entry && translation !== undefined) {
			byIndex.set(entry.index, translation);
		}
	}

	const result: string[] = [];
	for (let i = 0; i < lines.length; i++) {
		result.push(lines[i] ?? "");
		const translation = byIndex.get(i);
		if (translation === undefined) continue;
		const next = lines[i + 1];
		if (next !== undefined && isTranslationLine(next)) {
			// Replace the existing translation line instead of duplicating it.
			result.push(TRANSLATION_PREFIX + translation);
			i++;
		} else {
			result.push(TRANSLATION_PREFIX + translation);
		}
	}
	return result.join("\n");
}

export function parseGtxResponse(json: unknown): string {
	if (!Array.isArray(json) || !Array.isArray(json[0])) {
		throw new Error("Unexpected translation response shape");
	}
	let text = "";
	for (const segment of json[0] as unknown[]) {
		if (!Array.isArray(segment)) continue;
		const value: unknown = segment[0];
		if (typeof value === "string") text += value;
	}
	return text;
}

export function chunkTexts(
	texts: string[],
	maxEncodedLength = 1500,
): string[][] {
	const chunks: string[][] = [];
	let current: string[] = [];
	for (const text of texts) {
		const candidate = [...current, text];
		if (
			current.length > 0 &&
			encodeURIComponent(candidate.join("\n")).length > maxEncodedLength
		) {
			chunks.push(current);
			current = [text];
		} else {
			current = candidate;
		}
	}
	if (current.length > 0) chunks.push(current);
	return chunks;
}
