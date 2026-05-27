// MIDI note number → ABC notation conversion and ABC block assembly.
// No DOM or Obsidian imports — fully unit-testable.

export interface CompletedNote {
	midiNote: number;
	startMs: number;
	durationMs: number;
}

interface AbcToken {
	midiNotes: number[]; // empty = rest, 1 = single note, >1 = chord
	durationUnits: number; // multiples of L:1/8
}

// Keys in preference order (fewer accidentals first) for tie-breaking detection.
export const ABC_KEYS = ["C", "G", "F", "D", "Bb", "A", "Eb", "E", "Ab"] as const;
export type KeyName = (typeof ABC_KEYS)[number];
const KEYS = ABC_KEYS;

// Diatonic semitone sets per major key, used for key scoring.
const KEY_DIATONIC: Record<KeyName, ReadonlySet<number>> = {
	C:  new Set([0, 2, 4, 5, 7, 9, 11]),
	G:  new Set([0, 2, 4, 6, 7, 9, 11]),
	D:  new Set([1, 2, 4, 6, 7, 9, 11]),
	A:  new Set([1, 2, 4, 6, 8, 9, 11]),
	E:  new Set([1, 3, 4, 6, 8, 9, 11]),
	F:  new Set([0, 2, 4, 5, 7, 9, 10]),
	Bb: new Set([0, 2, 3, 5, 7, 9, 10]),
	Eb: new Set([0, 2, 3, 5, 7, 8, 10]),
	Ab: new Set([0, 1, 3, 5, 7, 8, 10]),
};

// Per-key ABC pitch names indexed by semitone (0–11).
// Diatonic notes use the plain letter (K: header provides the accidental).
// Chromatic notes carry an explicit accidental mark (^, _, or =).
const KEY_TABLES: Record<KeyName, readonly string[]> = {
	C:  ["C", "^C", "D", "^D", "E", "F",  "^F", "G", "^G", "A", "^A", "B"],
	G:  ["C", "^C", "D", "^D", "E", "=F", "F",  "G", "^G", "A", "^A", "B"],
	D:  ["=C","C",  "D", "^D", "E", "=F", "F",  "G", "^G", "A", "^A", "B"],
	A:  ["=C","C",  "D", "^D", "E", "=F", "F",  "=G","G",  "A", "^A", "B"],
	E:  ["=C","C",  "=D","D",  "E", "=F", "F",  "=G","G",  "A", "^A", "B"],
	F:  ["C", "^C", "D", "_E", "E", "F",  "^F", "G", "_A", "A", "B",  "=B"],
	Bb: ["C", "^C", "D", "E",  "=E","F",  "^F", "G", "_A", "A", "B",  "=B"],
	Eb: ["C", "^C", "D", "E",  "=E","F",  "^F", "G", "A",  "=A","B",  "=B"],
	Ab: ["C", "D",  "=D","E",  "=E","F",  "^F", "G", "A",  "=A","B",  "=B"],
};

function detectKey(notes: CompletedNote[]): KeyName {
	if (notes.length === 0) return "C";
	let bestKey: KeyName = "C";
	let bestScore = -1;
	for (const key of KEYS) {
		const diatonic = KEY_DIATONIC[key];
		let score = 0;
		for (const note of notes) {
			if (diatonic.has(note.midiNote % 12)) score++;
		}
		// Strict > preserves KEYS order as tie-breaker (simpler keys win).
		if (score > bestScore) {
			bestScore = score;
			bestKey = key;
		}
	}
	return bestKey;
}

export function midiNoteToAbcPitch(midiNote: number, key: KeyName = "C"): string {
	const semitone = midiNote % 12;
	const octave = Math.floor(midiNote / 12) - 1; // C4 = MIDI 60 = octave 4

	const raw = KEY_TABLES[key][semitone] ?? "C";
	const accidental = raw.length > 1 ? raw[0]! : "";
	const letter = raw[raw.length - 1] ?? "C";

	if (octave === 4) return accidental + letter;
	if (octave === 5) return accidental + letter.toLowerCase();
	if (octave > 5) return accidental + letter.toLowerCase() + "'".repeat(octave - 5);
	if (octave === 3) return accidental + letter + ",";
	return accidental + letter + ",".repeat(4 - octave);
}

// Returns duration in L:1/8 units, quantized to nearest sixteenth note (0.5 units).
export function quantizeToEighths(durationMs: number, bpm: number): number {
	const unitMs = 60000 / (bpm * 2);
	const raw = durationMs / unitMs;
	return Math.max(Math.round(raw * 2) / 2, 0.5);
}

export function durationToAbcMultiplier(units: number): string {
	if (units === 1) return "";
	if (units === 0.5) return "/2";
	if (Number.isInteger(units)) return String(units);
	return `${Math.round(units * 2)}/2`;
}

const CHORD_THRESHOLD_MS = 50;
const REST_THRESHOLD_MS = 50;
const UNITS_PER_BAR = 8; // L:1/8, M:4/4 → 8 eighth notes per bar

function clusterByTime(notes: CompletedNote[]): CompletedNote[][] {
	const sorted = [...notes].sort((a, b) => a.startMs - b.startMs);
	const first = sorted[0];
	if (!first) return [];

	const clusters: CompletedNote[][] = [];
	let current: CompletedNote[] = [first];

	for (let i = 1; i < sorted.length; i++) {
		const note = sorted[i];
		if (!note) continue;
		if (note.startMs - (current[0]?.startMs ?? 0) <= CHORD_THRESHOLD_MS) {
			current.push(note);
		} else {
			clusters.push(current);
			current = [note];
		}
	}
	clusters.push(current);
	return clusters;
}

function restBetween(
	prev: CompletedNote[],
	nextStartMs: number,
	bpm: number,
): AbcToken | null {
	const prevEnd = Math.max(...prev.map((n) => n.startMs + n.durationMs));
	const gap = nextStartMs - prevEnd;
	if (gap <= REST_THRESHOLD_MS) return null;
	return { midiNotes: [], durationUnits: quantizeToEighths(gap, bpm) };
}

function clusterToToken(cluster: CompletedNote[], bpm: number): AbcToken {
	const minDuration = Math.min(...cluster.map((n) => n.durationMs));
	return {
		midiNotes: cluster.map((n) => n.midiNote).sort((a, b) => a - b),
		durationUnits: quantizeToEighths(minDuration, bpm),
	};
}

function buildAbcTokens(
	notes: CompletedNote[],
	bpm: number,
	globalStartMs: number,
): AbcToken[] {
	if (notes.length === 0) return [];

	const clusters = clusterByTime(notes);
	const tokens: AbcToken[] = [];

	for (let i = 0; i < clusters.length; i++) {
		const cluster = clusters[i];
		if (!cluster) continue;
		const first = cluster[0];
		if (!first) continue;

		if (i === 0) {
			// Leading rest so this voice aligns with the global start.
			const leadGap = first.startMs - globalStartMs;
			if (leadGap > REST_THRESHOLD_MS) {
				tokens.push({
					midiNotes: [],
					durationUnits: quantizeToEighths(leadGap, bpm),
				});
			}
		} else {
			const prev = clusters[i - 1];
			if (prev) {
				const rest = restBetween(prev, first.startMs, bpm);
				if (rest) tokens.push(rest);
			}
		}

		tokens.push(clusterToToken(cluster, bpm));
	}

	return tokens;
}

function tokenToAbcString(token: AbcToken, key: KeyName): string {
	const dur = durationToAbcMultiplier(token.durationUnits);
	if (token.midiNotes.length === 0) {
		return `z${dur}`;
	}
	if (token.midiNotes.length === 1) {
		return midiNoteToAbcPitch(token.midiNotes[0]!, key) + dur;
	}
	const pitches = token.midiNotes.map((n) => midiNoteToAbcPitch(n, key)).join("");
	return `[${pitches}]${dur}`;
}

function tokensToAbcString(tokens: AbcToken[], key: KeyName): string {
	let result = "";
	let beatPos = 0;

	for (const token of tokens) {
		let remaining = token.durationUnits;

		while (remaining > 0) {
			const posInBar = beatPos % UNITS_PER_BAR;
			const spaceInBar = UNITS_PER_BAR - posInBar;
			const chunk = Math.min(remaining, spaceInBar);
			const isNote = token.midiNotes.length > 0;
			const continues = remaining > chunk;

			if (beatPos > 0 && posInBar === 0) {
				result += "| ";
			}

			const partial: AbcToken = { midiNotes: token.midiNotes, durationUnits: chunk };
			result += tokenToAbcString(partial, key) + (continues && isNote ? "- " : " ");

			beatPos += chunk;
			remaining -= chunk;
		}
	}

	return result.trimEnd();
}

// Middle C (MIDI 60) is the split: >= treble clef, < bass clef.
const TREBLE_SPLIT = 60;

export function buildAbcBlock(notes: CompletedNote[], bpm: number): string {
	const key = detectKey(notes);
	const treble = notes.filter((n) => n.midiNote >= TREBLE_SPLIT);
	const bass = notes.filter((n) => n.midiNote < TREBLE_SPLIT);

	const globalStart = Math.min(...notes.map((n) => n.startMs));
	const header = ["X:1", "T:MIDI Capture", "M:4/4", `Q:${bpm}`, "L:1/8"];
	const keyLine = key === "C" ? "K:C" : `K:${key}`;

	if (treble.length === 0 || bass.length === 0) {
		const clef = bass.length > 0 ? `K:${key} clef=bass` : keyLine;
		const body = tokensToAbcString(buildAbcTokens(notes, bpm, globalStart), key);
		return [...header, clef, body || "z4"].join("\n");
	}

	const trebleTokens = buildAbcTokens(treble, bpm, globalStart);
	const bassTokens = buildAbcTokens(bass, bpm, globalStart);

	// Pad both voices to the same number of complete bars so abcjs aligns measures.
	const trebleDur = trebleTokens.reduce((s, t) => s + t.durationUnits, 0);
	const bassDur = bassTokens.reduce((s, t) => s + t.durationUnits, 0);
	const target = Math.ceil(Math.max(trebleDur, bassDur) / UNITS_PER_BAR) * UNITS_PER_BAR;
	if (trebleDur < target)
		trebleTokens.push({ midiNotes: [], durationUnits: target - trebleDur });
	if (bassDur < target)
		bassTokens.push({ midiNotes: [], durationUnits: target - bassDur });

	const trebleBody = tokensToAbcString(trebleTokens, key);
	const bassBody = tokensToAbcString(bassTokens, key);

	return [
		...header,
		"%%staves {V1 V2}",
		keyLine,
		"V:V1 clef=treble",
		trebleBody || "z4",
		"V:V2 clef=bass",
		bassBody || "z4",
	].join("\n");
}
