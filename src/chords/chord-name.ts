const KEY_MAP: Record<string, string> = {
	C: "C", "C#": "Csharp", Db: "Db", D: "D",
	"D#": "Eb", Eb: "Eb", E: "E", F: "F",
	"F#": "Fsharp", Gb: "Fsharp", G: "G",
	"G#": "Ab", Ab: "Ab", A: "A",
	"A#": "Bb", Bb: "Bb", B: "B",
};

export interface ParsedChordName {
	key: string;
	suffix: string;
	bass: string | null;
}

export function parseChordName(name: string): ParsedChordName | null {
	const match = name.match(/^([A-G][#b]?)([^/]*)(?:\/([A-G][#b]?))?$/);
	if (!match) return null;
	const root = match[1];
	if (!root) return null;
	const dbKey = KEY_MAP[root];
	if (!dbKey) return null;
	const raw = match[2] ?? "";
	const suffix = raw === "" ? "major" : raw === "m" ? "minor" : raw;
	const bass = match[3] ?? null;
	return { key: dbKey, suffix, bass };
}
