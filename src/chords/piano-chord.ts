import pianoData from "@tombatossals/chords-db/lib/piano.json";
import { parseChordName } from "./chord-name";

interface PianoPosition {
	frets: string[];
	fingers: string[];
	midi: number[];
}

interface PianoEntry {
	key: string;
	suffix: string;
	positions: PianoPosition[];
}

type PianoDb = { chords: Record<string, PianoEntry[]> };

export interface PianoChord {
	root: string; // sharp pitch class, e.g. "C", "C#"
	notes: string[]; // sharp-normalized pitch classes, e.g. ["C", "D#", "G"]
}

const FLAT_TO_SHARP: Record<string, string> = {
	Db: "C#", Eb: "D#", Gb: "F#", Ab: "G#", Bb: "A#",
};

const DB_KEY_TO_PITCH: Record<string, string> = {
	C: "C", Csharp: "C#", D: "D", Eb: "D#", E: "E", F: "F",
	Fsharp: "F#", G: "G", Ab: "G#", A: "A", Bb: "A#", B: "B",
};

function normalizeToSharp(note: string): string {
	return FLAT_TO_SHARP[note] ?? note;
}

// Guitar uses "major"/"minor"; piano uses "major"/"m". Also "#" → "sharp".
function pianoSuffix(userSuffix: string): string {
	if (userSuffix === "major" || userSuffix === "") return "major";
	if (userSuffix === "minor" || userSuffix === "m") return "m";
	return userSuffix.replace(/#/g, "sharp");
}

export function lookupPianoChord(name: string): PianoChord | null {
	const parsed = parseChordName(name);
	if (!parsed) return null;
	const root = DB_KEY_TO_PITCH[parsed.key];
	if (!root) return null;
	const db = pianoData as unknown as PianoDb;
	const entries = db.chords[parsed.key];
	if (!entries) return null;
	const suffix = pianoSuffix(parsed.suffix);
	const entry = entries.find((e) => e.suffix === suffix);
	const pos = entry?.positions[0];
	if (!pos) return null;
	const notes = [...new Set(pos.frets.map(normalizeToSharp))];
	return { root, notes };
}
