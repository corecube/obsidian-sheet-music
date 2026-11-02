/** Fret-string helpers shared by sources: validation against the chord's pitch classes. */

import { Chord, Note } from "tonal";

const TUNINGS: Record<number, string[]> = {
	6: ["E", "A", "D", "G", "B", "E"],
	4: ["G", "C", "E", "A"],
};
const MAX_FRET_CHAR = 9;

function chroma(note: string): number | null {
	const value = Note.chroma(note);
	return typeof value === "number" ? value : null;
}

/**
 * True when the sounded strings of `frets` (low string first, -1 = muted)
 * spell `name`: every pitch class belongs to the chord, the root is present
 * and at most one chord tone is missing.
 */
export function voicingSpellsChord(frets: number[], name: string): boolean {
	const tuning = TUNINGS[frets.length];
	const chord = Chord.get(name);
	if (!tuning || chord.empty || !chord.tonic) return false;
	const root = chroma(chord.tonic);
	const chordPcs = new Set(
		chord.notes.map(chroma).filter((c): c is number => c !== null),
	);
	if (root === null || chordPcs.size === 0) return false;

	const sounded = new Set<number>();
	for (let i = 0; i < frets.length; i++) {
		const fret = frets[i] ?? -1;
		const open = chroma(tuning[i] ?? "");
		if (fret < 0 || open === null) continue;
		sounded.add((open + fret) % 12);
	}
	if (!sounded.has(root)) return false;
	for (const pc of sounded) if (!chordPcs.has(pc)) return false;
	return sounded.size >= Math.max(2, chordPcs.size - 1);
}

/** Six (or four) integers in -1..24. */
export function isFretArray(value: unknown, length: number): value is number[] {
	return (
		Array.isArray(value) &&
		value.length === length &&
		value.every(
			(v) => typeof v === "number" && Number.isInteger(v) && v >= -1 && v <= 24,
		)
	);
}

/** `x32010`, or null when a fret needs two characters. */
function fretString(frets: number[]): string | null {
	if (frets.some((f) => f > MAX_FRET_CHAR)) return null;
	return frets.map((f) => (f < 0 ? "x" : String(f))).join("");
}

/**
 * Fret string of the first reading of `frets` that spells `name`, or null.
 * Page data does not state its string order or fret-offset convention, so
 * as-is and reversed readings are tried, and with a `base` fret above 1
 * also readings shifted by `base - 1` and `base`.
 */
export function spelledFretString(
	name: string,
	frets: number[],
	base = 0,
): string | null {
	const readings = [frets, [...frets].reverse()];
	if (base > 1) {
		for (const r of [...readings]) {
			for (const offset of [base - 1, base]) {
				readings.push(r.map((f) => (f > 0 ? f + offset : f)));
			}
		}
	}
	for (const reading of readings) {
		if (!voicingSpellsChord(reading, name)) continue;
		const text = fretString(reading);
		if (text) return text;
	}
	return null;
}
