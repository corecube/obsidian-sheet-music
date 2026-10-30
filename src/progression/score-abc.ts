/**
 * Realise a progression as an ABC grand staff: block chords in close position
 * on the treble staff, the bass note on the bass staff, and the Roman numeral
 * under each chord as a lyric. Pure module — no DOM or Obsidian imports.
 */
import { Key, Note } from "tonal";
import { DEFAULT_METER, chordDurations, type Meter, type ProgressionItem, type ProgressionModel } from "./renderer-logic";
import { parseKey, type KeyContext } from "./roman";

const SHARP_ORDER = ["F", "C", "G", "D", "A", "E", "B"];
const FLAT_ORDER = ["B", "E", "A", "D", "G", "C", "F"];

/** Lowest acceptable bass note (E2) and the treble starting octave. */
const BASS_MIN_MIDI = 40;
const TREBLE_OCTAVE = 4;

interface Voiced {
	bass: { pitch: string; octave: number };
	treble: { pitch: string; octave: number }[];
}

/** Accidentals in force: the key signature per letter, and per-measure overrides per letter+octave. */
class AccidentalState {
	private signature = new Map<string, number>();
	private measure = new Map<string, number>();

	constructor(key: KeyContext) {
		this.setKey(key);
	}

	setKey(key: KeyContext): void {
		this.signature.clear();
		this.measure.clear();
		const sig = keySignature(key);
		const order = sig.startsWith("#") ? SHARP_ORDER : FLAT_ORDER;
		const alt = sig.startsWith("#") ? 1 : -1;
		for (let i = 0; i < sig.length; i++) {
			const letter = order[i];
			if (letter) this.signature.set(letter, alt);
		}
	}

	newMeasure(): void {
		this.measure.clear();
	}

	/** Returns the accidental text needed for this pitch and records it. */
	accidental(letter: string, alt: number, octave: number): string {
		const slot = `${letter}${octave}`;
		const current = this.measure.get(slot) ?? this.signature.get(letter) ?? 0;
		if (alt === current) return "";
		this.measure.set(slot, alt);
		if (alt === 0) return "=";
		return alt > 0 ? "^".repeat(alt) : "_".repeat(-alt);
	}
}

function keySignature(key: KeyContext): string {
	const sig = key.minor ? Key.minorKey(key.tonic).keySignature : Key.majorKey(key.tonic).keySignature;
	return typeof sig === "string" ? sig : "";
}

/** ABC K: field value, e.g. "G", "Bb", "Am", "F#m". */
export function abcKeyField(key: KeyContext): string {
	return key.minor ? `${key.tonic}m` : key.tonic;
}

function midiOf(pitch: string, octave: number): number {
	return Note.midi(`${pitch}${octave}`) ?? 60;
}

/** Bass between E2 and E3; treble in close position from octave 4 upwards. */
export function voiceChord(pitches: string[]): Voiced | null {
	const bassPitch = pitches[0];
	if (!bassPitch) return null;
	const bassOctave = midiOf(bassPitch, 2) < BASS_MIN_MIDI ? 3 : 2;

	const upper = pitches.slice(1);
	if (pitches.length <= 3) upper.push(bassPitch);

	const treble: Voiced["treble"] = [];
	let prevMidi = -1;
	for (const pitch of upper) {
		let octave = treble.length === 0 ? TREBLE_OCTAVE : (treble[treble.length - 1]?.octave ?? TREBLE_OCTAVE);
		while (midiOf(pitch, octave) <= prevMidi) octave++;
		prevMidi = midiOf(pitch, octave);
		treble.push({ pitch, octave });
	}

	return { bass: { pitch: bassPitch, octave: bassOctave }, treble };
}

function abcNote(pitch: string, octave: number, accidentals: AccidentalState): string {
	const note = Note.get(pitch);
	const letter = note.letter || "C";
	const acc = accidentals.accidental(letter, note.alt, octave);
	const body =
		octave >= 5 ? letter.toLowerCase() + "'".repeat(octave - 5) : letter + ",".repeat(Math.max(0, 4 - octave));
	return acc + body;
}

/** Escape characters that ABC lyrics treat specially. */
export function escapeLyric(text: string): string {
	return text.replace(/([-_*~|\\])/g, "\\$1").replace(/ /g, "~");
}

/** "vi = C: ii" for a pivot chord, otherwise the numeral. */
export function pivotLabel(item: ProgressionItem): string {
	return item.pivot ? `${item.numeral} = ${item.pivot.key} ${item.pivot.numeral}` : item.numeral;
}

function restLabel(item: ProgressionItem): string {
	return item.numeral === "NC" ? "NC" : "?";
}

/** Sixteenth notes per beat for a meter: a quarter-note beat is 4 sixteenths. */
function sixteenthsPerBeat(meter: Meter): number {
	return 16 / meter.unit;
}

function durationText(beats: number, meter: Meter): string {
	const n = Math.max(1, Math.round(beats * sixteenthsPerBeat(meter)));
	return String(n);
}

function meterField(meter: Meter): string {
	return `${meter.beats}/${meter.unit}`;
}

/** Measures per staff system; abcjs only breaks lines where the ABC does. */
export const MEASURES_PER_LINE = 4;

export function buildProgressionAbc(model: ProgressionModel): string {
	const trebleAcc = new AccidentalState(model.initialKey);
	const bassAcc = new AccidentalState(model.initialKey);
	const metered = model.metered;

	const trebleBars: string[] = [];
	const bassBars: string[] = [];
	const syllablesPerBar: string[][] = [];
	let currentMeter: Meter | null = null;

	model.rows.forEach((row, rowIndex) => {
		if (row.length === 0) return;
		trebleAcc.newMeasure();
		bassAcc.newMeasure();
		const treble: string[] = [];
		const bass: string[] = [];
		const syllables: string[] = [];
		const meter = model.rowMeters[rowIndex] ?? DEFAULT_METER;

		if (metered && currentMeter && meterField(meter) !== meterField(currentMeter)) {
			treble.push(`[M:${meterField(meter)}]`);
			bass.push(`[M:${meterField(meter)}]`);
		}
		currentMeter = meter;

		// In metered blocks each chord lasts until the next one; otherwise every chord is a plain quarter.
		const durations = metered ? chordDurations(row, meter).map((d) => durationText(d, meter)) : row.map(() => "");
		const firstBeat = row[0]?.beat;
		if (metered && firstBeat !== undefined && firstBeat > 1) {
			const rest = `z${durationText(firstBeat - 1, meter)}`;
			treble.push(rest);
			bass.push(rest);
		}

		row.forEach((item, i) => {
			const dur = durations[i] ?? "";
			if (item.keyChange) {
				const next = parseKey(item.keyChange);
				if (next) {
					const field = `[K:${abcKeyField(next)}]`;
					treble.push(field);
					bass.push(field);
					trebleAcc.setKey(next);
					bassAcc.setKey(next);
				}
			}

			const voiced = item.pitches ? voiceChord(item.pitches) : null;
			if (!voiced) {
				treble.push(`"^${restLabel(item)}"z${dur}`);
				bass.push(`z${dur}`);
				return;
			}

			const notes = voiced.treble.map((n) => abcNote(n.pitch, n.octave, trebleAcc));
			treble.push((notes.length === 1 ? (notes[0] ?? "z") : `[${notes.join("")}]`) + dur);
			bass.push(abcNote(voiced.bass.pitch, voiced.bass.octave, bassAcc) + dur);
			syllables.push(escapeLyric(pivotLabel(item)));

			if (item.pivot) {
				const next = parseKey(item.pivot.key);
				if (next) {
					const field = `[K:${abcKeyField(next)}]`;
					treble.push(field);
					bass.push(field);
					trebleAcc.setKey(next);
					bassAcc.setKey(next);
				}
			}
		});

		trebleBars.push(treble.join(" "));
		bassBars.push(bass.join(" "));
		syllablesPerBar.push(syllables);
	});

	const firstMeter = model.rowMeters[0] ?? DEFAULT_METER;
	const header = [
		"X:1",
		metered ? `M:${meterField(firstMeter)}` : "M:none",
		metered ? "L:1/16" : "L:1/4",
		"Q:1/4=72",
		`K:${abcKeyField(model.initialKey)}`,
		"%%staves {1 2}",
	];

	if (trebleBars.length === 0) {
		return [...header, "V:1 clef=treble", "z |]", "V:2 clef=bass", "z |]", ""].join("\n");
	}

	// One system per MEASURES_PER_LINE measures; each system repeats both voices.
	const body: string[] = [];
	for (let start = 0; start < trebleBars.length; start += MEASURES_PER_LINE) {
		const end = Math.min(start + MEASURES_PER_LINE, trebleBars.length);
		const last = end === trebleBars.length;
		const close = last ? " |]" : " |";
		const syllables = syllablesPerBar.slice(start, end).flat();
		body.push(start === 0 ? "V:1 clef=treble" : "V:1");
		body.push(trebleBars.slice(start, end).join(" | ") + close);
		if (syllables.length) body.push(`w: ${syllables.join(" ")}`);
		body.push(start === 0 ? "V:2 clef=bass" : "V:2");
		body.push(bassBars.slice(start, end).join(" | ") + close);
	}

	return [...header, ...body, ""].join("\n");
}
