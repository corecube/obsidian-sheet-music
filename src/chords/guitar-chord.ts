import { Chord, OPEN, SILENT } from "svguitar";
import guitarData from "@tombatossals/chords-db/lib/guitar.json";
import { parseChordName } from "./chord-name";

interface ChordsDbPosition {
	frets: number[];
	fingers: number[];
	baseFret: number;
	barres: number[];
}

interface ChordsDbEntry {
	key: string;
	suffix: string;
	positions: ChordsDbPosition[];
}

type GuitarDb = { chords: Record<string, ChordsDbEntry[]> };

function positionToChord(pos: ChordsDbPosition, title: string): Chord {
	const fingers: Chord["fingers"] = pos.frets.map((fret, i) => {
		const string = 6 - i;
		if (fret === -1) return [string, SILENT];
		if (fret === 0) return [string, OPEN];
		const finger = pos.fingers[i];
		return finger && finger > 0
			? [string, fret, String(finger)]
			: [string, fret];
	});

	const barres: Chord["barres"] = pos.barres.map((barreFret) => {
		const indices = pos.frets
			.map((f, i) => (f === barreFret ? i : null))
			.filter((i): i is number => i !== null);
		const strings = indices.map((i) => 6 - i);
		const barreFinger = indices
			.map((i) => pos.fingers[i])
			.find((f): f is number => typeof f === "number" && f > 0);
		return {
			fromString: Math.max(...strings),
			toString: Math.min(...strings),
			fret: barreFret,
			...(barreFinger ? { text: String(barreFinger) } : {}),
		};
	});

	return {
		title,
		fingers,
		barres,
		position: pos.baseFret > 1 ? pos.baseFret : undefined,
	};
}

// Matches e.g. "Bm[x24432]", "C[x32011]", or "Dadd9/F#[200230]"
const CUSTOM_DEF_PATTERN =
	/^([A-G][#b]?[A-Za-z0-9#/]*)\[([xX0-9]{6})\]\s*$/;

function fretStringToChord(name: string, fretStr: string): Chord {
	const fingers: Chord["fingers"] = [...fretStr].map((c, i) => {
		const string = 6 - i;
		return c === "x" || c === "X"
			? [string, SILENT]
			: [string, c === "0" ? OPEN : Number.parseInt(c, 10)];
	});
	return { title: name, fingers, barres: [] };
}

export function parseCustomChordDefs(source: string): Map<string, Chord> {
	const defs = new Map<string, Chord>();
	for (const line of source.replace(/\r\n?/g, "\n").split("\n")) {
		const match = CUSTOM_DEF_PATTERN.exec(line.trim());
		if (!match) continue;
		const [, name, fretStr] = match;
		if (name && fretStr) defs.set(name, fretStringToChord(name, fretStr));
	}
	return defs;
}

const BASS_ENHARMONIC: Record<string, string> = {
	"C#": "Db", Db: "C#",
	"D#": "Eb", Eb: "D#",
	"F#": "Gb", Gb: "F#",
	"G#": "Ab", Ab: "G#",
	"A#": "Bb", Bb: "A#",
};

function findEntry(
	entries: ChordsDbEntry[],
	suffix: string,
	bass: string | null,
): ChordsDbEntry | undefined {
	const baseSuffix = suffix === "major" ? "" : suffix;
	if (bass) {
		const candidates = [bass, BASS_ENHARMONIC[bass]].filter(
			(b): b is string => Boolean(b),
		);
		for (const b of candidates) {
			const found = entries.find((e) => e.suffix === `${baseSuffix}/${b}`);
			if (found) return found;
		}
	}
	return entries.find((e) => e.suffix === suffix);
}

export function lookupChord(name: string): Chord | null {
	const parsed = parseChordName(name);
	if (!parsed) return null;
	const db = guitarData as unknown as GuitarDb;
	const entries = db.chords[parsed.key];
	if (!entries) return null;
	const entry = findEntry(entries, parsed.suffix, parsed.bass);
	const pos = entry?.positions[0];
	if (!pos) return null;
	return positionToChord(pos, name);
}
