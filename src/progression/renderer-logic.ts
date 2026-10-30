import { Chord, Note } from "tonal";
import {
	BEAT_TOKEN_RE,
	DEFAULT_METER,
	MEASURE_TOKEN_RE,
	firstKeyLineIndex,
	isMetadataLine,
	parseMeter,
	parseRepeat,
	stripComment,
	type Meter,
} from "./lines";
import {
	chordToRoman,
	displayNumeral,
	formatKey,
	harmonicFunction,
	isRomanToken,
	parseKey,
	romanToChord,
	type HarmonicFunction,
	type KeyContext,
} from "./roman";

export { DEFAULT_METER, parseMeter, type Meter } from "./lines";

export interface ProgressionItem {
	numeral: string;
	chord: string;
	/** Spelled pitch classes, bass first. Missing for NC and unresolved tokens. */
	pitches?: string[];
	/** Harmonic function of the numeral; missing for NC and unresolved tokens. */
	fn?: HarmonicFunction;
	/** Set on the first item after an inline key change, e.g. "G:" or "g:". */
	keyChange?: string;
	/** 1-based beat within the measure. Set on every item of a metered block, never otherwise. */
	beat?: number;
	/**
	 * Pivot chord: the same chord read again in a new key (`vi C: ii`). The key
	 * change takes effect after this chord.
	 */
	pivot?: { numeral: string; key: string; fn?: HarmonicFunction };
}

export interface ProgressionModel {
	/** The key line as written. */
	key: string;
	initialKey: KeyContext;
	rows: ProgressionItem[][];
	/** Measure label per row, e.g. "3" or "11var1" from RomanText `m3` / `m11var1`; null when the line has none. */
	rowLabels: (string | null)[];
	/** Time signature in force for each row. */
	rowMeters: Meter[];
	/** True when the block uses beat markers or a time signature, i.e. positions and durations are meaningful. */
	metered: boolean;
}

interface RowRecord {
	items: ProgressionItem[];
	label: string | null;
	meter: Meter;
	/** Beat markers as written, one entry per item (null = unmarked). */
	markers: (number | null)[];
	/** Key in force at the start and end of the row. */
	startKey: KeyContext;
	endKey: KeyContext;
}

export function parseProgression(source: string): ProgressionModel | null {
	const lines = source
		.replace(/\r\n?/g, "\n")
		.split("\n")
		.map(stripComment)
		.filter((l) => l.length > 0);
	if (lines.length === 0) return null;

	let key: KeyContext | null = null;
	let keyLabel: string | null = null;
	const keyLine = firstKeyLineIndex(lines);
	if (keyLine >= 0) {
		keyLabel = lines[keyLine] ?? null;
		key = parseKey(keyLabel ?? "");
	}

	const records: RowRecord[] = [];
	const byMeasure = new Map<string, RowRecord>();
	let meter: Meter = DEFAULT_METER;
	let metered = false;
	let invalid = false;
	let pendingKeyChange: string | undefined;

	const addRecord = (record: RowRecord) => {
		records.push(record);
		if (record.label && /^\d+$/.test(record.label)) byMeasure.set(record.label, record);
	};

	lines.forEach((line, index) => {
		if (index === keyLine) return;
		const nextMeter = parseMeter(line);
		if (nextMeter) {
			meter = nextMeter;
			metered = true;
			return;
		}
		if (isMetadataLine(line)) return;

		const repeat = parseRepeat(line);
		if (repeat) {
			for (let i = 0; i < repeat.count; i++) {
				const source = byMeasure.get(String(repeat.from + i));
				if (!source || !key) continue;
				const items: ProgressionItem[] = source.items.map((item) => ({ ...item, keyChange: undefined }));
				// A copied measure that started in another key is marked, so the reader sees why it resolves differently.
				if (items[0] && formatKey(source.startKey) !== formatKey(key)) items[0].keyChange = formatKey(source.startKey);
				addRecord({ ...source, items, label: String(repeat.to + i), meter, startKey: source.startKey, endKey: source.endKey });
				key = source.endKey;
			}
			return;
		}

		const row = parseRow(line, key, pendingKeyChange);
		if (!row) {
			invalid = true;
			return;
		}
		pendingKeyChange = row.pendingKeyChange;
		if (row.markers.some((b) => b !== null)) metered = true;
		if (!key && row.key) key = row.key;
		if (keyLabel === null && row.key) keyLabel = formatKey(row.key);
		if (row.items.length > 0) {
			addRecord({
				items: row.items,
				label: row.label,
				meter,
				markers: row.markers,
				startKey: row.startKey ?? row.key ?? key ?? { tonic: "C", minor: false },
				endKey: row.key ?? key ?? { tonic: "C", minor: false },
			});
		}
		key = row.key ?? key;
	});

	if (invalid || records.length === 0 || !key || keyLabel === null) return null;
	const initialKey = parseKey(keyLabel) ?? key;

	// A key token that merely repeats the block's key (RomanText "m0 b3 G: I") is not a change.
	const first = records[0]?.items[0];
	if (first?.keyChange === formatKey(initialKey)) delete first.keyChange;

	if (metered) {
		for (const record of records) {
			assignBeats(record.items, record.markers, record.meter);
			clampBeats(record.items, record.meter);
		}
	}

	return {
		key: keyLabel,
		initialKey,
		rows: records.map((r) => r.items),
		rowLabels: records.map((r) => r.label),
		rowMeters: records.map((r) => r.meter),
		metered,
	};
}

interface ParsedRow {
	items: ProgressionItem[];
	markers: (number | null)[];
	label: string | null;
	/** Key in force when the first chord of the row was read. */
	startKey: KeyContext | null;
	/** Key in force after the row. */
	key: KeyContext | null;
	/** A key token at the end of the line applies to the next chord, wherever it is. */
	pendingKeyChange: string | undefined;
}

function parseRow(line: string, startKey: KeyContext | null, carriedKeyChange: string | undefined): ParsedRow | null {
	let key = startKey;
	let pendingKeyChange = carriedKeyChange;
	let pendingBeat: number | null = null;
	let label: string | null = null;
	let firstKey: KeyContext | null = null;
	const items: ProgressionItem[] = [];
	const markers: (number | null)[] = [];

	for (const token of line.split(/\s+/)) {
		if (token.length === 0 || token === "||") continue;
		if (MEASURE_TOKEN_RE.test(token)) {
			if (label === null) label = token.slice(1);
			continue;
		}
		if (BEAT_TOKEN_RE.test(token)) {
			pendingBeat = Number(token.slice(1));
			continue;
		}
		if (token.endsWith(":")) {
			const next = parseKey(token);
			if (next) {
				key = next;
				pendingKeyChange = formatKey(next);
			}
			continue;
		}

		if (!key) return null;
		if (!firstKey) firstKey = pendingKeyChange ? (parseKey(pendingKeyChange) ?? key) : key;
		const item = parseToken(token, key);
		const previous = items[items.length - 1];
		if (pendingKeyChange && previous && pendingBeat === null && samePitchSet(previous.pitches, item.pitches)) {
			// Pivot: the chord before the key token, named again in the new key.
			previous.pivot = { numeral: item.numeral, key: pendingKeyChange, fn: item.fn };
			pendingKeyChange = undefined;
			continue;
		}
		if (pendingKeyChange) {
			item.keyChange = pendingKeyChange;
			pendingKeyChange = undefined;
		}
		items.push(item);
		markers.push(pendingBeat);
		pendingBeat = null;
	}

	return { items, markers, label, startKey: firstKey, key, pendingKeyChange };
}

/**
 * Beats for one row of a metered block. With markers: an unmarked first chord
 * is on beat 1 and later unmarked chords follow one beat on (RomanText).
 * Without markers: one chord per beat, the last filling the bar; more chords
 * than beats are spread evenly.
 */
export function assignBeats(items: ProgressionItem[], markers: (number | null)[], meter: Meter): void {
	if (items.length === 0) return;
	if (markers.some((b) => b !== null)) {
		let last = 0;
		items.forEach((item, i) => {
			const beat = markers[i] ?? last + 1;
			item.beat = beat;
			last = beat;
		});
		return;
	}
	const n = items.length;
	if (n <= meter.beats) {
		items.forEach((item, i) => (item.beat = i + 1));
	} else {
		items.forEach((item, i) => (item.beat = 1 + (i * meter.beats) / n));
	}
}

/** Same sounding chord, regardless of spelling: compares pitch-class sets. */
function samePitchSet(a: string[] | undefined, b: string[] | undefined): boolean {
	if (!a || !b || a.length !== b.length) return false;
	const chromas = (pitches: string[]) =>
		[...new Set(pitches.map((p) => Note.chroma(p)))].sort((x, y) => x - y).join(",");
	return chromas(a) === chromas(b);
}

/** Smallest gap between two chords; quarter beats and triplet thirds both fit. */
const MIN_GAP = 0.25;
/** A chord pulled back from beyond the bar lands this far before the end. */
const PULLBACK = 0.5;
const EPSILON = 1e-6;

/** Round to 1/60 of a beat so halves, thirds, quarters and fifths survive. */
function roundBeat(beat: number): number {
	return Math.round(beat * 60) / 60;
}

/**
 * Keep every beat inside the bar. A chord placed past the end (b4 in 3/4) is
 * pulled back to the last half beat, earlier chords are squeezed only as far
 * as needed so each keeps at least MIN_GAP, and beats below 1 become 1.
 */
export function clampBeats(items: ProgressionItem[], meter: Meter): void {
	const timed = items.filter((item) => item.beat !== undefined);
	if (timed.length === 0) return;
	const barEnd = meter.beats + 1;
	let previous = -Infinity;
	timed.forEach((item, i) => {
		const latest = barEnd - PULLBACK * (timed.length - i);
		let beat = Math.min(Math.max(item.beat ?? 1, 1), latest);
		if (beat < previous + MIN_GAP - EPSILON) beat = previous + MIN_GAP;
		item.beat = roundBeat(beat);
		previous = item.beat;
	});
}

/** One cell of the beat grid: a chord (or an empty gap) spanning `span` grid columns. */
export interface BeatCell {
	item: ProgressionItem | null;
	span: number;
	/** Beat the cell starts on, 1-based. */
	beat: number;
}

const MAX_SUBDIVISION = 12;

/** Grid columns per beat: the smallest count that puts every beat in the block on a column boundary. */
export function beatSubdivision(model: ProgressionModel): number {
	const beats = model.rows.flatMap((row) => row.map((item) => item.beat ?? 1));
	for (let sub = 1; sub <= MAX_SUBDIVISION; sub++) {
		if (beats.every((b) => Math.abs((b - 1) * sub - Math.round((b - 1) * sub)) < 0.02)) return sub;
	}
	return MAX_SUBDIVISION;
}

/** Duration of each chord in beats: until the next chord, the last one to the end of the measure. */
export function chordDurations(row: ProgressionItem[], meter: Meter): number[] {
	return row.map((item, i) => {
		const start = item.beat ?? i + 1;
		const next = row[i + 1];
		const end = next?.beat ?? (item.beat === undefined ? start + 1 : meter.beats + 1);
		return Math.max(end - start, MIN_GAP);
	});
}

/**
 * Lay a row out on a beat grid with `sub` columns per beat. A chord starting
 * after beat 1 is preceded by an empty gap cell.
 */
export function beatGrid(row: ProgressionItem[], meter: Meter, sub: number): BeatCell[] {
	const cells: BeatCell[] = [];
	const durations = chordDurations(row, meter);
	const first = row[0];
	if (first?.beat !== undefined && first.beat > 1) {
		cells.push({ item: null, span: Math.max(1, Math.round((first.beat - 1) * sub)), beat: 1 });
	}
	row.forEach((item, i) => {
		cells.push({
			item,
			span: Math.max(1, Math.round((durations[i] ?? 1) * sub)),
			beat: item.beat ?? i + 1,
		});
	});
	return cells;
}

function parseToken(token: string, key: KeyContext): ProgressionItem {
	const item = resolveToken(token, key);
	const fn = item.pitches ? harmonicFunction(item.numeral, key) : null;
	return fn ? { ...item, fn } : item;
}

function resolveToken(token: string, key: KeyContext): ProgressionItem {
	if (token === "NC") return { numeral: "NC", chord: "N.C." };

	const parsed = Chord.get(token);
	if (!isRomanToken(token, key) && parsed.tonic) {
		const numeral = chordToRoman(token, key);
		return {
			numeral: numeral ? displayNumeral(numeral) : "?",
			chord: token,
			pitches: parsed.notes,
		};
	}

	// Roman numeral, or last resort: tonal's own numeral parser (e.g. "IVsus4")
	const result = romanToChord(token, key);
	if (!result.chord) return { numeral: result.numeral, chord: "?" };
	return { numeral: result.numeral, chord: result.chord.name, pitches: result.chord.pitches };
}
