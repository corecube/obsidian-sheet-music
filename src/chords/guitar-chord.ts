import { Chord, OPEN, SILENT } from "svguitar";
// Namespace imports: esbuild and Jest agree on those, whereas Jest's ESM
// mode gives the JSON no default export.
import * as guitarData from "@tombatossals/chords-db/lib/guitar.json";
import * as ukuleleData from "@tombatossals/chords-db/lib/ukulele.json";
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

type ChordsDb = { chords: Record<string, ChordsDbEntry[]> };

/** Fretted instruments with a chords-db dataset. */
export type FrettedInstrument = "guitar" | "ukulele";

export const STRING_COUNT: Record<FrettedInstrument, number> = {
	guitar: 6,
	ukulele: 4,
};

const DATABASES: Record<FrettedInstrument, ChordsDb> = {
	guitar: guitarData as unknown as ChordsDb,
	ukulele: ukuleleData as unknown as ChordsDb,
};

function positionToChord(
	pos: ChordsDbPosition,
	title: string,
	strings: number,
): Chord {
	const fingers: Chord["fingers"] = pos.frets.map((fret, i) => {
		const string = strings - i;
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
		const stringNumbers = indices.map((i) => strings - i);
		const barreFinger = indices
			.map((i) => pos.fingers[i])
			.find((f): f is number => typeof f === "number" && f > 0);
		return {
			fromString: Math.max(...stringNumbers),
			toString: Math.min(...stringNumbers),
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

// Matches e.g. "Bm[x24432]", "C[x32011]" or "Dadd9/F#[200230]" (guitar,
// six characters) and "C[0003]" or "Am[2000]" (ukulele, four characters).
const CUSTOM_DEF_PATTERN =
	/^([A-G][#b]?[A-Za-z0-9#/]*)\[([xX0-9]{4}|[xX0-9]{6})\]\s*$/;

function fretStringToChord(name: string, fretStr: string): Chord {
	const strings = fretStr.length;
	const fingers: Chord["fingers"] = [...fretStr].map((c, i) => {
		const string = strings - i;
		return c === "x" || c === "X"
			? [string, SILENT]
			: [string, c === "0" ? OPEN : Number.parseInt(c, 10)];
	});
	return { title: name, fingers, barres: [] };
}

/**
 * Custom voicings defined in the block, one map per fretted instrument. The
 * string count of the fret string decides the instrument: six for guitar,
 * four for ukulele.
 */
export function parseCustomChordDefs(
	source: string,
): Record<FrettedInstrument, Map<string, Chord>> {
	const defs: Record<FrettedInstrument, Map<string, Chord>> = {
		guitar: new Map(),
		ukulele: new Map(),
	};
	for (const line of source.replace(/\r\n?/g, "\n").split("\n")) {
		const match = CUSTOM_DEF_PATTERN.exec(line.trim());
		if (!match) continue;
		const [, name, fretStr] = match;
		if (!name || !fretStr) continue;
		const instrument: FrettedInstrument =
			fretStr.length === STRING_COUNT.ukulele ? "ukulele" : "guitar";
		defs[instrument].set(name, fretStringToChord(name, fretStr));
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

/** First chords-db voicing of `name` for `instrument`, or null if unknown. */
export function lookupFrettedChord(
	name: string,
	instrument: FrettedInstrument,
): Chord | null {
	const parsed = parseChordName(name);
	if (!parsed) return null;
	const entries = DATABASES[instrument].chords[parsed.key];
	if (!entries) return null;
	const entry = findEntry(entries, parsed.suffix, parsed.bass);
	const pos = entry?.positions[0];
	if (!pos) return null;
	return positionToChord(pos, name, STRING_COUNT[instrument]);
}

export function lookupChord(name: string): Chord | null {
	return lookupFrettedChord(name, "guitar");
}

export function lookupUkuleleChord(name: string): Chord | null {
	return lookupFrettedChord(name, "ukulele");
}
