/**
 * Transpose a progression block's source by semitones. Only absolute
 * material moves: the key line, inline key tokens (G:, a:) and chord names.
 * Roman numerals, RomanText markers, metadata and comments stay as written,
 * so whitespace and layout are preserved exactly.
 */
import { Chord, Interval, Key, Note } from "tonal";
import { BEAT_TOKEN_RE, MEASURE_TOKEN_RE, commentStart, firstKeyLineIndex, isSkippableLine, stripComment } from "./lines";
import { isRomanToken, parseKey, type KeyContext } from "./roman";

/** Number of sharps or flats in the key signature; Infinity when tonal has no such key. */
function signatureSize(tonic: string, minor: boolean): number {
	const alteration = minor ? Key.minorKey(tonic).alteration : Key.majorKey(tonic).alteration;
	return typeof alteration === "number" && Number.isFinite(alteration) ? Math.abs(alteration) : Infinity;
}

/**
 * Transpose a key tonic and spell it so the key signature stays readable:
 * B down a semitone is Bb (2 flats), not A# (10 sharps).
 */
export function transposeTonic(tonic: string, semitones: number, minor: boolean): string {
	const moved = Note.transpose(tonic, Interval.fromSemitones(semitones));
	const simple = Note.simplify(moved) || moved || tonic;
	const enharmonic = Note.enharmonic(simple);
	if (!enharmonic || enharmonic === simple) return simple;
	return signatureSize(enharmonic, minor) < signatureSize(simple, minor) ? enharmonic : simple;
}

/** "G" → "A", "Am" → "Bm", "g:" → "a:", "B-:" → "C#:" (flats normalised to b). */
export function transposeKeyToken(token: string, semitones: number): string {
	const key = parseKey(token);
	if (!key) return token;
	const tonic = transposeTonic(key.tonic, semitones, key.minor);
	const colon = token.endsWith(":");
	const lowercaseStyle = token[0] === token[0]?.toLowerCase() && token[0] !== token[0]?.toUpperCase();
	if (key.minor && (lowercaseStyle || colon) && !token.endsWith("m") && !token.endsWith("m:")) {
		return tonic.toLowerCase() + (colon ? ":" : "");
	}
	return tonic + (key.minor ? "m" : "") + (colon ? ":" : "");
}

/** Pitch classes of the key's scale (natural and harmonic minor for minor keys). */
function keyScale(key: KeyContext): Set<string> {
	if (!key.minor) return new Set(Key.majorKey(key.tonic).scale);
	const minor = Key.minorKey(key.tonic);
	return new Set([...minor.natural.scale, ...minor.harmonic.scale]);
}

/**
 * Spell a pitch class for a key: a diatonic spelling wins, otherwise sharps
 * in sharp keys and flats elsewhere; double accidentals are avoided.
 */
export function spellForKey(pitch: string, key: KeyContext | null): string {
	const simple = Note.simplify(pitch) || pitch;
	const enharmonic = Note.enharmonic(simple);
	if (!enharmonic || enharmonic === simple) return simple;
	if (!key) return simple;

	const scale = keyScale(key);
	if (scale.has(simple)) return simple;
	if (scale.has(enharmonic)) return enharmonic;

	const alteration = key.minor ? Key.minorKey(key.tonic).alteration : Key.majorKey(key.tonic).alteration;
	const wantSharps = typeof alteration === "number" && alteration > 0;
	const isSharp = (n: string) => n.includes("#");
	if (wantSharps) return isSharp(simple) ? simple : enharmonic;
	return isSharp(simple) ? enharmonic : simple;
}

/** Transpose a chord name and respell its root and bass for `key` (the key after transposition). */
export function transposeChordToken(token: string, semitones: number, key: KeyContext | null = null): string {
	const chord = Chord.get(token);
	if (!chord.tonic) return token;
	const moved = Chord.transpose(token, Interval.fromSemitones(semitones));
	if (!moved) return token;
	const result = Chord.get(moved);
	if (!result.tonic) return moved;
	const tonic = spellForKey(result.tonic, key);
	let name = tonic + moved.slice(result.tonic.length);
	if (result.bass) {
		const bass = spellForKey(result.bass, key);
		name = name.slice(0, name.lastIndexOf("/")) + `/${bass}`;
	}
	return name;
}

function transposedKey(key: KeyContext | null, semitones: number): KeyContext | null {
	if (!key) return null;
	return { tonic: transposeTonic(key.tonic, semitones, key.minor), minor: key.minor };
}

function transposeToken(token: string, semitones: number, key: KeyContext | null): string {
	if (token.endsWith(":") && parseKey(token)) return transposeKeyToken(token, semitones);
	if (MEASURE_TOKEN_RE.test(token) || BEAT_TOKEN_RE.test(token) || token === "||" || token === "NC") return token;
	if (key && isRomanToken(token, key)) return token;
	if (!key && /^[b#]*[IiVv]/.test(token)) return token;
	if (Chord.get(token).tonic) return transposeChordToken(token, semitones, transposedKey(key, semitones));
	return token;
}

export function transposeProgressionSource(source: string, semitones: number): string {
	if (semitones === 0) return source;
	const lines = source.split("\n");
	const keyLine = firstKeyLineIndex(lines);
	let key: KeyContext | null = null;

	return lines
		.map((line, index) => {
			const at = commentStart(line);
			const code = at >= 0 ? line.slice(0, at) : line;
			const comment = at >= 0 ? line.slice(at) : "";
			const trimmed = stripComment(line);
			if (isSkippableLine(trimmed)) return line;

			if (index === keyLine) {
				key = parseKey(trimmed);
				return code.replace(trimmed, transposeKeyToken(trimmed, semitones)) + comment;
			}

			const moved = code.replace(/\S+/g, (token) => {
				if (token.endsWith(":")) {
					const next = parseKey(token);
					if (next) key = next;
				}
				return transposeToken(token, semitones, key);
			});
			return moved + comment;
		})
		.join("\n");
}
