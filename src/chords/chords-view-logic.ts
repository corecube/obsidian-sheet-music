import type { Chord } from "svguitar";
import { parseCustomChordDefs } from "./guitar-chord";
import {
	isSectionLine,
	splitChordsLines,
	tokenizeChordsLine,
} from "./renderer-logic";
import { isTranslationLine } from "./translate-logic";
import { findChordsBlocks } from "./translate-logic";
import { transposeSource } from "./transpose";

const FRET_STRING_RE = /^[xX0-9]+$/;

export interface NoteChords {
	/** Chord names in order of first appearance across all chords blocks. */
	names: string[];
	/** Custom voicings (`Am[x02210]`) from all blocks; later blocks win. */
	customDefs: Map<string, Chord>;
}

/** Source text of every chords code block in a markdown note. */
export function chordsBlockSources(markdown: string): string[] {
	const lines = markdown.split("\n");
	return findChordsBlocks(lines).map((block) =>
		lines.slice(block.start + 1, block.end).join("\n"),
	);
}

/** Collects the chords used by every chords block in a note. */
export function collectNoteChords(markdown: string): NoteChords {
	const names: string[] = [];
	const seen = new Set<string>();
	const customDefs = new Map<string, Chord>();
	const add = (name: string): void => {
		if (seen.has(name)) return;
		seen.add(name);
		names.push(name);
	};

	for (const source of chordsBlockSources(markdown)) {
		const defs = parseCustomChordDefs(source);
		for (const [name, chord] of defs) {
			customDefs.set(name, chord);
			add(name);
		}
		for (const line of splitChordsLines(source)) {
			if (isSectionLine(line) || isTranslationLine(line)) continue;
			for (const token of tokenizeChordsLine(line)) {
				if (token.type !== "bracket") continue;
				const name = token.value.slice(1, -1);
				if (!FRET_STRING_RE.test(name)) add(name);
			}
		}
	}
	return { names, customDefs };
}

/** Transposes the content of every chords block in a note; the rest is untouched. */
export function transposeNoteChords(markdown: string, semitones: number): string {
	if (semitones === 0) return markdown;
	const lines = markdown.split("\n");
	for (const block of findChordsBlocks(lines)) {
		const source = lines.slice(block.start + 1, block.end).join("\n");
		const transposed = transposeSource(source, semitones).split("\n");
		lines.splice(block.start + 1, block.end - block.start - 1, ...transposed);
	}
	return lines.join("\n");
}
