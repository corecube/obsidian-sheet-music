import type { Chord } from "svguitar";
import { Progression } from "tonal";
import { type FrettedInstrument, parseCustomChordDefs } from "./guitar-chord";
import {
	isSectionLine,
	splitChordsLines,
	tokenizeChordsLine,
} from "./renderer-logic";
import { isTranslationLine } from "./translate-logic";

const FRET_STRING_RE = /^[xX0-9]+$/;

export interface ChordChipsModel {
	/** Chord names in order of first appearance in the block. */
	names: string[];
	/**
	 * Custom voicings defined in the block, per fretted instrument: six-fret
	 * strings (`Am[x02210]`) are guitar, four-fret strings (`C[0003]`) ukulele.
	 */
	customDefs: Record<FrettedInstrument, Map<string, Chord>>;
	/** Roman numeral per chord name; empty without a note key. */
	numerals: Map<string, string>;
}

/**
 * Roman numeral of `chordName` relative to `key` (frontmatter value such as
 * `C`, `F#` or `Am`), or null when there is no key or the numeral would just
 * repeat the chord name.
 */
export function romanNumeralFor(key: string, chordName: string): string | null {
	const trimmed = key.trim();
	if (!trimmed) return null;
	const tonicRoot = trimmed.endsWith("m") ? trimmed.slice(0, -1) : trimmed;
	const numeral = Progression.toRomanNumerals(tonicRoot, [chordName])[0];
	if (!numeral || numeral === chordName) return null;
	return numeral;
}

/** Chord names used in one chords block, deduplicated, plus custom voicings. */
export function collectBlockChords(
	source: string,
): Pick<ChordChipsModel, "names" | "customDefs"> {
	const names: string[] = [];
	const seen = new Set<string>();
	const add = (name: string): void => {
		if (seen.has(name)) return;
		seen.add(name);
		names.push(name);
	};

	const customDefs = parseCustomChordDefs(source);
	for (const defs of Object.values(customDefs))
		for (const name of defs.keys()) add(name);

	for (const line of splitChordsLines(source)) {
		if (isSectionLine(line) || isTranslationLine(line)) continue;
		for (const token of tokenizeChordsLine(line)) {
			if (token.type !== "bracket") continue;
			const name = token.value.slice(1, -1);
			if (!FRET_STRING_RE.test(name)) add(name);
		}
	}
	return { names, customDefs };
}

/** Everything the chip strip of one block needs. */
export function buildChordChipsModel(
	source: string,
	key: string,
): ChordChipsModel {
	const { names, customDefs } = collectBlockChords(source);
	const numerals = new Map<string, string>();
	for (const name of names) {
		const numeral = romanNumeralFor(key, name);
		if (numeral) numerals.set(name, numeral);
	}
	return { names, customDefs, numerals };
}

/**
 * Replaces the body of the fenced block whose opening fence is at
 * `fenceStart` and closing fence at `fenceEnd` (0-based line numbers) with
 * its transposed version. Returns `content` unchanged for invalid ranges.
 */
export function transposeBlockInNote(
	content: string,
	fenceStart: number,
	fenceEnd: number,
	semitones: number,
	transpose: (source: string, semitones: number) => string,
): string {
	if (semitones === 0) return content;
	const lines = content.split("\n");
	const start = fenceStart + 1;
	if (start >= fenceEnd || fenceEnd > lines.length) return content;
	const body = lines.slice(start, fenceEnd).join("\n");
	lines.splice(start, fenceEnd - start, ...transpose(body, semitones).split("\n"));
	return lines.join("\n");
}
