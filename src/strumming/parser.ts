export interface Stroke {
	timing: string;
	stroke: number;
}

export interface CodeBlock {
	part?: string;
	bpm?: number;
	denominator: number;
	isTriplet: boolean;
	measures: number[];
	chords?: string[][];
}

export const InvalidBlockError = new Error("Invalid code block structure");

export function parseCodeBlock(source: string): CodeBlock {
	const parsed = JSON.parse(source) as unknown;
	if (typeof parsed !== "object" || parsed === null) {
		throw InvalidBlockError;
	}

	const { part, bpm, denominator, isTriplet, measures, chords } =
		parsed as Record<string, unknown>;

	if (
		(part !== undefined && typeof part !== "string") ||
		(bpm !== undefined && typeof bpm !== "number") ||
		denominator === undefined ||
		typeof denominator !== "number" ||
		isTriplet === undefined ||
		typeof isTriplet !== "boolean" ||
		!Array.isArray(measures) ||
		!measures.every((measure) => typeof measure === "number") ||
		(chords !== undefined &&
			(!Array.isArray(chords) ||
				!chords.every(
					(row) =>
						Array.isArray(row) &&
						row.every((chord) => typeof chord === "string"),
				)))
	) {
		throw InvalidBlockError;
	}

	if (
		chords !== undefined &&
		chords.some((row) => row.length !== measures.length)
	) {
		throw InvalidBlockError;
	}

	return {
		part,
		bpm,
		denominator,
		isTriplet,
		measures,
		chords,
	};
}

export function parseStrokes(codeBlock: CodeBlock): Stroke[] {
	const { denominator, isTriplet, measures } = codeBlock;

	if (measures.length === 0) {
		return [];
	}

	if (isTriplet) {
		return measures.map((stroke, index) => ({
			stroke,
			timing: tripletTiming(index),
		}));
	}

	if (denominator === 16) {
		return measures.map((stroke, index) => ({
			stroke,
			timing: sixteenthTiming(index),
		}));
	}

	return measures.map((stroke, index) => ({
		stroke,
		timing: eighthTiming(index),
	}));
}

function eighthTiming(index: number): string {
	if (index % 2 === 1) {
		return "&";
	}

	return String(Math.floor(index / 2) + 1);
}

function sixteenthTiming(index: number): string {
	const beat = Math.floor(index / 4) + 1;
	const sixteenth = index % 4;

	if (sixteenth === 0) {
		return String(beat);
	}

	if (sixteenth === 1) {
		return "e";
	}

	if (sixteenth === 2) {
		return "&";
	}

	return "a";
}

function tripletTiming(index: number): string {
	const beat = Math.floor(index / 6) + 1;
	const subdivision = index % 6;

	if (subdivision === 0) {
		return String(beat);
	}

	if (subdivision === 3) {
		return "&";
	}

	return " ";
}