/**
 * RomanText chord grammar (Tymoczko, Gotham, Cuthbert, Ariza — ISMIR 2019).
 *
 * Pure module: resolves a Roman numeral symbol to a spelled chord in a key,
 * and the reverse. No DOM or Obsidian imports.
 *
 * Supported symbol forms:
 *   - case = triad quality (I major, i minor), suffixes o/° dim, ø or /o half-dim, + aug
 *   - root accidentals: b, bb, #, ##, - (bVII, #iv)
 *   - figures: 6 64 (triads), 7 65 43 42 2 (sevenths), 9 11 13; "6/4" style slashes accepted
 *   - applied chords: V/V, V7/IV, V7/V/V
 *   - abbreviations: N N6 (Neapolitan), It6 Ger65 Fr43 Sw43, Cad64
 *   - bracketed alterations: [no5] [add9] [b3] [#6]
 *   - minor mode: degrees 6/7 are raised for minor and diminished chords, natural otherwise
 */
import { Chord, Interval, Note, Progression } from "tonal";

export interface KeyContext {
	tonic: string;
	minor: boolean;
}

export interface ResolvedChord {
	/** Chord symbol such as "G7/B". Pitch list for non-tertian chords. */
	name: string;
	/** Spelled pitch classes, bass first. */
	pitches: string[];
	key: KeyContext;
}

const MAJOR = ["1P", "2M", "3M", "4P", "5P", "6M", "7M"];
const MINOR = ["1P", "2M", "3m", "4P", "5P", "6m", "7m"];
const ROMANS = ["I", "II", "III", "IV", "V", "VI", "VII"];

type Quality = "major" | "minor" | "dim" | "halfdim" | "aug";

interface RomanSpec {
	acc: number;
	step: number;
	quality: Quality;
	figures: string;
	alterations: string[];
	applied?: RomanSpec;
	abbreviation?: "It" | "Ger" | "Fr" | "Sw";
	/** Explicit seventh quality from the legacy spellings maj7 / m7; otherwise the seventh is diatonic. */
	seventh?: "M" | "m";
	display: string;
}

// ---------------------------------------------------------------------------
// Keys
// ---------------------------------------------------------------------------

const KEY_RE = /^([A-Ga-g])(##|#|bb|b|-)?(m)?:?$/;

/** Accepts "C", "Am", "c", "C:", "f#:", "Bb", "B-:" */
export function parseKey(token: string): KeyContext | null {
	const m = KEY_RE.exec(token);
	if (!m) return null;
	const [, letter = "", acc = "", minorSuffix] = m;
	const tonic = letter.toUpperCase() + acc.replace("-", "b");
	const minor = letter === letter.toLowerCase() || minorSuffix === "m";
	return { tonic, minor };
}

export function formatKey(key: KeyContext): string {
	return key.minor ? key.tonic.toLowerCase() + ":" : key.tonic + ":";
}

// ---------------------------------------------------------------------------
// Pitch helpers
// ---------------------------------------------------------------------------

function alterPitch(pitch: string, delta: number): string {
	const n = Note.get(pitch);
	if (n.empty) return pitch;
	return Note.get({ step: n.step, alt: n.alt + delta }).name;
}

function accToAlt(acc: string): number {
	let alt = 0;
	for (const c of acc) alt += c === "#" ? 1 : -1;
	return alt;
}

function altToAcc(alt: number): string {
	return alt > 0 ? "#".repeat(alt) : "b".repeat(-alt);
}

/** Interval from the tonic to a scale degree (0-based), honouring the minor 6/7 rule. */
function degreeInterval(key: KeyContext, step: number, raise: boolean): string {
	if (!key.minor) return MAJOR[step] ?? "1P";
	if ((step === 5 || step === 6) && raise) return MAJOR[step] ?? "1P";
	return MINOR[step] ?? "1P";
}

function degreePitch(key: KeyContext, step: number, raise = false): string {
	return Note.transpose(key.tonic, degreeInterval(key, step % 7, raise));
}

function isRaisedQuality(q: Quality): boolean {
	return q === "minor" || q === "dim" || q === "halfdim";
}

// ---------------------------------------------------------------------------
// Parsing
// ---------------------------------------------------------------------------

const LEGACY_RE = /^([b#]*)(VII|VI|IV|V|III|II|I)(m7b5|maj7|dim7|dim|aug|m7|m)$/;

/** Translate tonal-style symbols (IIm, IVmaj7, VIIdim) into RomanText form, keeping an explicit seventh quality. */
function normalizeLegacy(token: string): { token: string; seventh?: "M" | "m" } {
	const m = LEGACY_RE.exec(token);
	if (!m) return { token };
	const [, acc = "", roman = "", suffix] = m;
	switch (suffix) {
		case "m":
			return { token: acc + roman.toLowerCase() };
		case "m7":
			return { token: acc + roman.toLowerCase() + "7", seventh: "m" };
		case "maj7":
			return { token: acc + roman + "7", seventh: "M" };
		case "dim":
			return { token: acc + roman.toLowerCase() + "o" };
		case "dim7":
			return { token: acc + roman.toLowerCase() + "o7" };
		case "aug":
			return { token: acc + roman + "+" };
		case "m7b5":
			return { token: acc + roman.toLowerCase() + "ø7" };
	}
	return { token };
}

const ROMAN_RE =
	/^(bb|b|##|#|-)?(VII|VI|IV|V|III|II|I|vii|vi|iv|v|iii|ii|i)(o|°|ø|\/o|\+)?((?:\d+\/?)*)((?:\[[^\]]*\])*)$/;

const AUG6_RE = /^(It|Ger|Fr|Sw)(\d+\/?)*((?:\[[^\]]*\])*)$/;
const NEAPOLITAN_RE = /^N((?:\d+\/?)*)((?:\[[^\]]*\])*)$/;
const CADENTIAL_RE = /^Cad(64|6\/4)$/;

/** Position of the "/" that introduces an applied (secondary) chord, or -1. */
function appliedSlashIndex(token: string): number {
	return token.search(/\/(?=(?:bb|b|##|#|-)?[IiVv])/);
}

function parseRoman(token: string, minorKey: boolean): RomanSpec | null {
	const slash = appliedSlashIndex(token);
	if (slash > 0) {
		const base = parseRoman(token.slice(0, slash), minorKey);
		const applied = parseRoman(token.slice(slash + 1), minorKey);
		if (!base || !applied) return null;
		return { ...base, applied, display: `${base.display}/${applied.display}` };
	}

	const legacy = normalizeLegacy(token);
	token = legacy.token;

	const cad = CADENTIAL_RE.exec(token);
	if (cad) {
		const spec = parseRoman(minorKey ? "i64" : "I64", minorKey);
		return spec ? { ...spec, display: "Cad64" } : null;
	}

	const nea = NEAPOLITAN_RE.exec(token);
	if (nea) {
		const spec = parseRoman(`bII${nea[1] ?? ""}${nea[2] ?? ""}`, minorKey);
		return spec ? { ...spec, display: token } : null;
	}

	const aug6 = AUG6_RE.exec(token);
	if (aug6) {
		return {
			acc: 0,
			step: 5,
			quality: "major",
			figures: "",
			alterations: [],
			abbreviation: aug6[1] as RomanSpec["abbreviation"],
			display: token,
		};
	}

	const m = ROMAN_RE.exec(token);
	if (!m) return null;
	const [, acc = "", roman = "", suffix = "", rawFigures = "", rawBrackets = ""] = m;
	const upper = roman === roman.toUpperCase();
	const step = ROMANS.indexOf(roman.toUpperCase());
	if (step < 0) return null;

	let quality: Quality;
	if (suffix === "o" || suffix === "°") quality = "dim";
	else if (suffix === "ø" || suffix === "/o") quality = "halfdim";
	else if (suffix === "+") quality = "aug";
	else quality = upper ? "major" : "minor";

	const figures = rawFigures.replace(/\//g, "");
	const alterations = [...rawBrackets.matchAll(/\[([^\]]*)\]/g)].map((x) => x[1] ?? "");

	const suffixDisplay = suffix === "o" ? "°" : suffix === "/o" ? "ø" : suffix;
	const display = acc.replace("-", "b") + roman + suffixDisplay + figures + rawBrackets;

	return {
		acc: accToAlt(acc.replace("-", "b")),
		step,
		quality,
		figures,
		alterations,
		display,
		...(legacy.seventh ? { seventh: legacy.seventh } : {}),
	};
}

// ---------------------------------------------------------------------------
// Resolution
// ---------------------------------------------------------------------------

const TRIAD_INVERSIONS: Record<string, number> = { "": 0, "53": 0, "6": 1, "63": 1, "64": 2 };
const SEVENTH_INVERSIONS: Record<string, number> = { "7": 0, "65": 1, "43": 2, "42": 3, "2": 3 };
const EXTENSIONS: Record<string, number> = { "9": 9, "11": 11, "13": 13 };

function resolveAugmentedSixth(spec: RomanSpec, key: KeyContext): ResolvedChord {
	const t = key.tonic;
	const b6 = Note.transpose(t, "6m");
	const s4 = Note.transpose(t, "4A");
	let pitches: string[];
	switch (spec.abbreviation) {
		case "It":
			pitches = [b6, t, s4];
			break;
		case "Fr":
			pitches = [b6, t, Note.transpose(t, "2M"), s4];
			break;
		case "Sw":
			pitches = [b6, t, Note.transpose(t, "2A"), s4];
			break;
		default:
			pitches = [b6, t, Note.transpose(t, "3m"), s4];
	}
	return { name: pitches.join(" "), pitches, key };
}

function resolveSpec(spec: RomanSpec, key: KeyContext): ResolvedChord | null {
	if (spec.applied) {
		const target = resolveSpec(spec.applied, key);
		if (!target) return null;
		const appliedKey: KeyContext = {
			tonic: chordRoot(target),
			minor: isRaisedQuality(spec.applied.quality),
		};
		const resolved = resolveSpec({ ...spec, applied: undefined }, appliedKey);
		return resolved ? { ...resolved, key } : null;
	}

	if (spec.abbreviation) return resolveAugmentedSixth(spec, key);

	const root = alterPitch(degreePitch(key, spec.step, isRaisedQuality(spec.quality)), spec.acc);

	// Chord tones keyed by interval number above the root.
	const tones = new Map<number, string>();
	tones.set(1, root);
	tones.set(3, Note.transpose(root, spec.quality === "major" || spec.quality === "aug" ? "3M" : "3m"));
	tones.set(5, Note.transpose(root, spec.quality === "dim" || spec.quality === "halfdim" ? "5d" : spec.quality === "aug" ? "5A" : "5P"));

	let inversion: number;
	const extension = EXTENSIONS[spec.figures];
	const hasSeventh = spec.figures in SEVENTH_INVERSIONS || extension !== undefined;

	if (spec.figures in TRIAD_INVERSIONS) {
		inversion = TRIAD_INVERSIONS[spec.figures] ?? 0;
	} else if (hasSeventh) {
		inversion = SEVENTH_INVERSIONS[spec.figures] ?? 0;
	} else {
		return null;
	}

	// Diatonic pitch for a chord member, measured in scale steps above the root degree.
	const diatonic = (member: number): string => degreePitch(key, (spec.step + member - 1) % 7);

	if (hasSeventh) {
		if (spec.seventh) tones.set(7, Note.transpose(root, spec.seventh === "M" ? "7M" : "7m"));
		else if (spec.quality === "dim") tones.set(7, Note.transpose(root, "7d"));
		else if (spec.quality === "halfdim") tones.set(7, Note.transpose(root, "7m"));
		else tones.set(7, diatonic(7));
	}
	if (extension !== undefined) {
		for (let n = 9; n <= extension; n += 2) tones.set(n, diatonic(n));
	}

	for (const alt of spec.alterations) {
		const m = /^(no|add)?([#b]*)(\d+)$/.exec(alt.trim());
		if (!m) continue;
		const [, op, acc = "", numStr = "0"] = m;
		const n = Number(numStr);
		if (op === "no") {
			tones.delete(n);
		} else if (op === "add") {
			tones.set(n, alterPitch(diatonic(n), accToAlt(acc)));
		} else {
			const existing = tones.get(n);
			tones.set(n, existing ? alterPitch(existing, accToAlt(acc)) : alterPitch(diatonic(n), accToAlt(acc)));
		}
	}

	const order = [...tones.keys()].sort((a, b) => a - b);
	const bassMember = [1, 3, 5, 7][inversion] ?? 1;
	const bassIndex = Math.max(0, order.indexOf(tones.has(bassMember) ? bassMember : 1));
	const rotated = [...order.slice(bassIndex), ...order.slice(0, bassIndex)];
	const pitches = rotated.map((n) => tones.get(n) ?? "");

	return { name: nameChord(root, tones, pitches[0] ?? root), pitches, key };
}

function chordRoot(chord: ResolvedChord): string {
	return chord.name.split("/")[0]?.match(/^[A-G](?:##|#|bb|b)?/)?.[0] ?? chord.pitches[0] ?? "C";
}

// ---------------------------------------------------------------------------
// Chord naming
// ---------------------------------------------------------------------------

function intervalQuality(root: string, pitch: string | undefined): string | undefined {
	if (!pitch) return undefined;
	return Interval.get(Interval.distance(root, pitch)).q;
}

function nameChord(root: string, tones: Map<number, string>, bass: string): string {
	const third = intervalQuality(root, tones.get(3));
	const fifth = intervalQuality(root, tones.get(5));
	const seventh = intervalQuality(root, tones.get(7));

	let core: string | null = null;
	let missing = "";
	if (third === "M" && fifth === "P") core = "";
	else if (third === "m" && fifth === "P") core = "m";
	else if (third === "m" && fifth === "d") core = "dim";
	else if (third === "M" && fifth === "A") core = "+";
	else if (third === "M" && fifth === "d") core = "b5";
	else if (third === "m" && fifth === "A") core = "m#5";
	else if (third === undefined && fifth === "P") {
		if (!seventh) return root + "5" + (bass !== root ? `/${bass}` : "");
		core = "";
		missing = "(no3)";
	} else if (fifth === undefined && (third === "M" || third === "m")) {
		core = third === "M" ? "" : "m";
		missing = "(no5)";
	}

	if (core === null) return [...tones.values()].join(" ");

	let name: string;
	if (!seventh) name = core;
	else if (core === "dim" && seventh === "d") name = "dim7";
	else if (core === "dim" && seventh === "m") name = "m7b5";
	else if (core === "dim" && seventh === "M") name = "dim(maj7)";
	else if (core === "m" && seventh === "m") name = "m7";
	else if (core === "m" && seventh === "M") name = "mMaj7";
	else if (core === "" && seventh === "m") name = "7";
	else if (core === "" && seventh === "M") name = "maj7";
	else if (core === "+" && seventh === "m") name = "+7";
	else if (core === "+" && seventh === "M") name = "+maj7";
	else if (core === "b5" && seventh === "m") name = "7b5";
	else name = core + "(" + (seventh === "M" ? "maj7" : seventh === "d" ? "bb7" : "7") + ")";

	// Extensions: natural ones replace the 7, altered ones are appended
	const natural: Record<number, string> = { 9: "M", 11: "P", 13: "M" };
	const altered: string[] = [];
	let highest = 0;
	for (const n of [9, 11, 13]) {
		const q = intervalQuality(root, tones.get(n));
		if (!q) continue;
		if (q === natural[n]) highest = n;
		else altered.push((q === "m" || q === "d" ? "b" : "#") + n);
	}
	if (highest) name = seventh ? name.replace("7", String(highest)) : name + `add${highest}`;
	for (const a of altered) name += `(${a})`;

	// Added tones
	for (const n of [2, 4, 6]) {
		const q = intervalQuality(root, tones.get(n));
		if (q) name += `add${q === "m" || q === "d" ? "b" : q === "A" ? "#" : ""}${n}`;
	}
	name += missing;

	const bassSuffix = bass !== root ? `/${bass}` : "";
	return root + name + bassSuffix;
}

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

export interface RomanResult {
	/** Normalised display form of the symbol, e.g. "vii°7", "V65/V". */
	numeral: string;
	chord: ResolvedChord | null;
}

/** True when the token looks like a Roman numeral symbol (not a chord name). */
export function isRomanToken(token: string, key: KeyContext): boolean {
	return parseRoman(token, key.minor) !== null;
}

/**
 * Resolve a RomanText symbol in a key. Falls back to tonal's own numeral
 * parser for shapes this grammar does not cover (e.g. "IVsus4").
 */
export function romanToChord(token: string, key: KeyContext): RomanResult {
	const spec = parseRoman(token, key.minor);
	if (spec) {
		const chord = resolveSpec(spec, key);
		if (chord) return { numeral: spec.display + legacySeventhMark(spec, key), chord };
	}
	const fallback = Progression.fromRomanNumerals(key.tonic, [token])[0];
	if (fallback) {
		const notes = Chord.get(fallback).notes;
		return { numeral: token, chord: { name: fallback, pitches: notes, key } };
	}
	return { numeral: token, chord: null };
}

/**
 * Describe a chord symbol as a RomanText numeral in a key. Returns null when the
 * chord cannot be named (not a chord symbol at all).
 */
export function chordToRoman(chordName: string, key: KeyContext): string | null {
	const chord = Chord.get(chordName);
	if (!chord.tonic) return null;
	const root = chord.tonic;
	const bass = chord.bass || root;

	const tones = new Map<number, string>();
	for (const note of chord.notes) {
		const iv = Interval.get(Interval.distance(root, note));
		tones.set(iv.num === 8 ? 1 : iv.num, iv.q);
	}
	const third = tones.get(3);
	const fifth = tones.get(5);
	const seventh = tones.get(7);
	const extras = [...tones.keys()].filter((n) => ![1, 3, 5, 7].includes(n));

	let quality: Quality | null = null;
	if (third === "M" && fifth === "P") quality = "major";
	else if (third === "m" && fifth === "P") quality = "minor";
	else if (third === "m" && fifth === "d") quality = seventh === "m" ? "halfdim" : "dim";
	else if (third === "M" && fifth === "A") quality = "aug";

	if (!quality || extras.length > 0 || (seventh && !"mMd".includes(seventh))) {
		return Progression.toRomanNumerals(key.tonic, [chordName])[0] || null;
	}

	// Scale degree + accidental relative to the key
	const rootIv = Interval.get(Interval.distance(key.tonic, root));
	const step = (rootIv.num - 1) % 7; // "8d" (Eb against E) is a lowered first degree
	if (step < 0 || step > 6) return null;
	const expected = Interval.get(degreeInterval(key, step, isRaisedQuality(quality)));
	const acc = altToAcc(rootIv.alt - expected.alt);

	const roman = ROMANS[step] ?? "I";
	let symbol = acc + (quality === "major" || quality === "aug" ? roman : roman.toLowerCase());
	if (quality === "dim") symbol += "o";
	else if (quality === "halfdim") symbol += "ø";
	else if (quality === "aug") symbol += "+";

	const bassIv = Interval.get(Interval.distance(root, bass));
	const bassMember = bassIv.num === 8 ? 1 : bassIv.num;
	if (seventh) {
		symbol += { 1: "7", 3: "65", 5: "43", 7: "42" }[bassMember] ?? "7";
		if (quality === "major" || quality === "minor" || quality === "aug") {
			const diatonicSeventh = degreePitch(key, (step + 6) % 7);
			const actualSeventh = chord.notes.find((n) => Interval.get(Interval.distance(root, n)).num === 7);
			if (actualSeventh) {
				const diff = Note.get(actualSeventh).alt - Note.get(diatonicSeventh).alt;
				const sameLetter = Note.get(actualSeventh).step === Note.get(diatonicSeventh).step;
				if (sameLetter && diff !== 0) symbol += `[${altToAcc(diff)}7]`;
				else if (!sameLetter) {
					const q = Interval.get(Interval.distance(root, actualSeventh)).q;
					symbol += q === "m" ? "[b7]" : q === "M" ? "[#7]" : "";
				}
			}
		}
	} else {
		symbol += { 1: "", 3: "6", 5: "64" }[bassMember] ?? "";
	}
	return symbol;
}

export type HarmonicFunction = "tonic" | "predominant" | "dominant" | "applied" | "chromatic";

/**
 * Classify a numeral by harmonic function. Applied chords (V/V) come first,
 * then chromatic roots other than the Neapolitan and augmented sixths, then
 * the diatonic degree: I iii vi tonic, ii IV predominant, V vii° dominant.
 */
export function harmonicFunction(token: string, key: KeyContext): HarmonicFunction | null {
	const spec = parseRoman(token, key.minor);
	if (!spec) return null;
	if (spec.applied) return "applied";
	if (spec.abbreviation) return "predominant";
	if (spec.display === "Cad64") return "dominant";
	if (spec.display.startsWith("N")) return "predominant";
	if (spec.acc !== 0) return "chromatic";
	switch (spec.step) {
		case 0:
		case 2:
		case 5:
			return "tonic";
		case 1:
		case 3:
			return "predominant";
		default:
			return "dominant";
	}
}

/** "[#7]" or "[b7]" when a legacy maj7/m7 spelling differs from the diatonic seventh, else "". */
function legacySeventhMark(spec: RomanSpec, key: KeyContext): string {
	if (!spec.seventh || spec.applied || spec.abbreviation) return "";
	const root = alterPitch(degreePitch(key, spec.step, isRaisedQuality(spec.quality)), spec.acc);
	const diatonicSeventh = Interval.get(Interval.distance(root, degreePitch(key, (spec.step + 6) % 7))).q;
	if (diatonicSeventh === spec.seventh) return "";
	return spec.seventh === "M" ? "[#7]" : "[b7]";
}

/** Render a numeral for display: "o" → "°", "/o" → "ø". */
export function displayNumeral(symbol: string): string {
	return symbol.replace(/\/o/g, "ø").replace(/([IiVv])o/g, "$1°");
}
