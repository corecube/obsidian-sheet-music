import { beforeEach, describe, expect, it } from "@jest/globals";
import { CodeBlock, Stroke } from "./parser";
import {
	DEFAULT_BPM,
	StrummingBlockModel,
	StrummingParser,
} from "./renderer-logic";
import { StrokeToken } from "./stroke-token";

function makeModel(
	overrides: Partial<CodeBlock> = {},
	strokes: Stroke[] = [],
): StrummingBlockModel {
	const codeBlock: CodeBlock = {
		denominator: 8,
		isTriplet: false,
		measures: [],
		...overrides,
	};

	return new StrummingBlockModel(codeBlock, strokes);
}

describe("StrummingBlockModel", () => {
	describe("effectiveBpm", () => {
		it("returns the codeBlock bpm when set and positive", () => {
			expect(makeModel({ bpm: 120 }).effectiveBpm).toBe(120);
		});

		it("falls back to DEFAULT_BPM when bpm is undefined", () => {
			expect(makeModel().effectiveBpm).toBe(DEFAULT_BPM);
		});

		it("falls back to DEFAULT_BPM when bpm is 0", () => {
			expect(makeModel({ bpm: 0 }).effectiveBpm).toBe(DEFAULT_BPM);
		});

		it("falls back to DEFAULT_BPM when bpm is negative", () => {
			expect(makeModel({ bpm: -10 }).effectiveBpm).toBe(DEFAULT_BPM);
		});
	});

	describe("stepDurationMs", () => {
		it("calculates eighth-note step duration for denominator 8", () => {
			expect(makeModel({ bpm: 60, denominator: 8 }).stepDurationMs).toBe(
				500,
			);
		});

		it("calculates sixteenth-note step duration for denominator 16", () => {
			expect(makeModel({ bpm: 60, denominator: 16 }).stepDurationMs).toBe(
				250,
			);
		});

		it("calculates triplet step duration", () => {
			expect(
				makeModel({ bpm: 60, isTriplet: true }).stepDurationMs,
			).toBeCloseTo(1000 / 6);
		});

		it("triplet takes priority over denominator 16", () => {
			expect(
				makeModel({ bpm: 60, denominator: 16, isTriplet: true })
					.stepDurationMs,
			).toBeCloseTo(1000 / 6);
		});

		it("uses DEFAULT_BPM when bpm is not set", () => {
			const expected = 60000 / DEFAULT_BPM / 2;
			expect(makeModel({ denominator: 8 }).stepDurationMs).toBeCloseTo(
				expected,
			);
		});
	});

	describe("metadataText", () => {
		it("shows part and bpm when part is set", () => {
			expect(makeModel({ part: "Verse", bpm: 120 }).metadataText).toBe(
				"Verse · 120 BPM",
			);
		});

		it("shows only bpm when part is not set", () => {
			expect(makeModel({ bpm: 100 }).metadataText).toBe("100 BPM");
		});

		it("uses DEFAULT_BPM when bpm is not set", () => {
			expect(makeModel().metadataText).toBe(`${DEFAULT_BPM} BPM`);
		});

		it("uses DEFAULT_BPM when bpm is 0", () => {
			expect(makeModel({ bpm: 0 }).metadataText).toBe(
				`${DEFAULT_BPM} BPM`,
			);
		});
	});

	describe("getStrokeIcon", () => {
		let model: StrummingBlockModel;

		beforeEach(() => {
			model = makeModel();
		});

		it("returns the icon name for every known token", () => {
			expect(model.getStrokeIcon(StrokeToken.Down)).toBe("arrow-down");
			expect(model.getStrokeIcon(StrokeToken.BeatDown)).toBe(
				"arrow-down-to-line",
			);
			expect(model.getStrokeIcon(StrokeToken.AccentDown)).toBe(
				"arrow-big-down",
			);
			expect(model.getStrokeIcon(StrokeToken.Up)).toBe("arrow-up");
			expect(model.getStrokeIcon(StrokeToken.BeatUp)).toBe(
				"arrow-up-to-line",
			);
			expect(model.getStrokeIcon(StrokeToken.AccentUp)).toBe(
				"arrow-big-up",
			);
			expect(model.getStrokeIcon(StrokeToken.Muted)).toBe("x");
			expect(model.getStrokeIcon(StrokeToken.Rest)).toBe(" ");
			expect(model.getStrokeIcon(StrokeToken.Sustain)).toBe("equal");
		});

		it("returns null for an unknown token", () => {
			expect(model.getStrokeIcon(9999)).toBeNull();
		});
	});

	describe("getStrokeRowItems", () => {
		it("maps strokes into pure row items with token, timing and icon", () => {
			const model = makeModel({}, [
				{ stroke: StrokeToken.Down, timing: "1" },
				{ stroke: StrokeToken.Up, timing: "&" },
			]);

			expect(model.getStrokeRowItems()).toEqual([
				{
					strokeToken: StrokeToken.Down,
					timing: "1",
					icon: "arrow-down",
				},
				{ strokeToken: StrokeToken.Up, timing: "&", icon: "arrow-up" },
			]);
		});

		it("sets icon to null when stroke token is unknown", () => {
			const model = makeModel({}, [{ stroke: 9999, timing: "1" }]);

			expect(model.getStrokeRowItems()).toEqual([
				{ strokeToken: 9999, timing: "1", icon: null },
			]);
		});
	});

	describe("getChordRows", () => {
		it("returns chord rows from codeBlock", () => {
			const chords = [
				["Am", "", "", ""],
				["", "", "F", ""],
			];

			const model = makeModel({ chords });

			expect(model.getChordRows()).toEqual(chords);
		});

		it("returns empty array when chords are not provided", () => {
			const model = makeModel();
			expect(model.getChordRows()).toEqual([]);
		});
	});
});

describe("StrummingParser", () => {
	let parser: StrummingParser;

	beforeEach(() => {
		parser = new StrummingParser();
	});

	it("returns a model for valid input", () => {
		const source = JSON.stringify({
			bpm: 120,
			denominator: 8,
			isTriplet: false,
			measures: [StrokeToken.Down, StrokeToken.Up],
		});

		const model = parser.parse(source);

		expect(model).not.toBeNull();
		expect(model?.effectiveBpm).toBe(120);
		expect(model?.strokes).toHaveLength(2);
	});

	it("exposes the parsed codeBlock on the model", () => {
		const source = JSON.stringify({
			part: "Chorus",
			bpm: 100,
			denominator: 8,
			isTriplet: false,
			measures: [StrokeToken.Down],
			chords: [["Am"]],
		});

		const model = parser.parse(source);

		expect(model?.codeBlock.part).toBe("Chorus");
		expect(model?.metadataText).toBe("Chorus · 100 BPM");
		expect(model?.getChordRows()).toEqual([["Am"]]);
	});

	it("returns null for invalid JSON", () => {
		expect(parser.parse("not json")).toBeNull();
	});

	it("returns null when required fields are missing", () => {
		expect(parser.parse(JSON.stringify({ bpm: 120 }))).toBeNull();
	});

	it("returns null when measures array is empty", () => {
		const source = JSON.stringify({
			denominator: 8,
			isTriplet: false,
			measures: [],
		});
		expect(parser.parse(source)).toBeNull();
	});
});