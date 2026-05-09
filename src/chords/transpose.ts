import { Chord, Interval, Note } from "tonal";

const BRACKET_TOKEN = /\[([^\]\n]+)\]/g;

function transposeChordName(name: string, semitones: number): string {
	const interval = Interval.fromSemitones(semitones);
	const result = Chord.transpose(name, interval);
	if (result === "") return name;

	// Tonal's interval arithmetic can produce double-flats/sharps (e.g. Cbm, G##)
	// when transposing repeatedly. Simplify the tonic to its enharmonic equivalent.
	const chord = Chord.get(result);
	if (chord.tonic) {
		const simplified = Note.simplify(chord.tonic);
		if (simplified !== "" && simplified !== chord.tonic) {
			return simplified + result.slice(chord.tonic.length);
		}
	}
	return result;
}

export function transposeSource(source: string, semitones: number): string {
	if (semitones === 0) return source;
	return source.replace(BRACKET_TOKEN, (match, inner: string) => {
		// Only transpose recognized chord symbols — section headers and fret
		// definitions (e.g. [Verse 1], [x02210]) have a null tonic and are kept as-is
		if (!Chord.get(inner).tonic) return match;
		return `[${transposeChordName(inner, semitones)}]`;
	});
}
