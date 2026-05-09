import { CodeBlock, Stroke, parseCodeBlock, parseStrokes } from "./parser";
import { StrokeToken } from "./stroke-token";

export const DEFAULT_BPM = 90;

export interface StrokeRowItem {
	strokeToken: number;
	timing: string;
	icon: string | null;
}

const STROKE_ICON_MAP: Record<number, string> = {
	[StrokeToken.Down]: "arrow-down",
	[StrokeToken.BeatDown]: "arrow-down-to-line",
	[StrokeToken.AccentDown]: "arrow-big-down",
	[StrokeToken.Up]: "arrow-up",
	[StrokeToken.BeatUp]: "arrow-up-to-line",
	[StrokeToken.AccentUp]: "arrow-big-up",
	[StrokeToken.Muted]: "x",
	[StrokeToken.Rest]: " ",
	[StrokeToken.Sustain]: "equal",
};

export class StrummingBlockModel {
	constructor(
		readonly codeBlock: CodeBlock,
		readonly strokes: Stroke[],
	) {}

	get effectiveBpm(): number {
		return this.codeBlock.bpm && this.codeBlock.bpm > 0
			? this.codeBlock.bpm
			: DEFAULT_BPM;
	}

	get stepDurationMs(): number {
		const quarterNoteDurationMs = 60000 / this.effectiveBpm;
		const subdivisionsPerBeat = this.codeBlock.isTriplet
			? 6
			: this.codeBlock.denominator === 16
				? 4
				: 2;
		return quarterNoteDurationMs / subdivisionsPerBeat;
	}

	get metadataText(): string {
		const partPrefix = this.codeBlock.part
			? `${this.codeBlock.part} · `
			: "";
		return `${partPrefix}${this.effectiveBpm} BPM`;
	}

	getStrokeIcon(token: number): string | null {
		return STROKE_ICON_MAP[token] ?? null;
	}

	getStrokeRowItems(): StrokeRowItem[] {
		return this.strokes.map((stroke) => ({
			strokeToken: stroke.stroke,
			timing: stroke.timing,
			icon: this.getStrokeIcon(stroke.stroke),
		}));
	}

	getChordRows(): string[][] {
		return this.codeBlock.chords ?? [];
	}
}

export class StrummingParser {
	parse(source: string): StrummingBlockModel | null {
		let codeBlock: CodeBlock;
		try {
			codeBlock = parseCodeBlock(source);
		} catch {
			return null;
		}

		const strokes = parseStrokes(codeBlock);
		if (strokes.length === 0) {
			return null;
		}

		return new StrummingBlockModel(codeBlock, strokes);
	}
}