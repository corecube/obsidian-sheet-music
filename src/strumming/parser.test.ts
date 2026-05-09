import { describe, expect, it } from "@jest/globals";
import {
	InvalidBlockError,
	parseCodeBlock,
	parseStrokes,
	Stroke,
} from "./parser";

describe("parseCodeBlock", () => {
	it("should parse valid code block with all fields", () => {
		const source = JSON.stringify({
			part: "verse",
			bpm: 120,
			denominator: 8,
			isTriplet: false,
			measures: [1, 2, 3],
		});

		const result = parseCodeBlock(source);

		expect(result.part).toBe("verse");
		expect(result.bpm).toBe(120);
		expect(result.denominator).toBe(8);
		expect(result.isTriplet).toBe(false);
		expect(result.measures).toEqual([1, 2, 3]);
	});

	it("should parse valid code block without optional fields", () => {
		const source = JSON.stringify({
			denominator: 16,
			isTriplet: true,
			measures: [5, 10],
		});

		const result = parseCodeBlock(source);

		expect(result.part).toBeUndefined();
		expect(result.bpm).toBeUndefined();
		expect(result.denominator).toBe(16);
		expect(result.isTriplet).toBe(true);
		expect(result.measures).toEqual([5, 10]);
	});

	it("should parse valid chords matrix", () => {
		const source = JSON.stringify({
			denominator: 16,
			isTriplet: false,
			measures: [1, 202, 2, 102],
			chords: [
				["Am", "", "", ""],
				["", "", "F", ""],
			],
		});

		const result = parseCodeBlock(source);

		expect(result.chords).toEqual([
			["Am", "", "", ""],
			["", "", "F", ""],
		]);
	});

	it("should throw error when measures is not an array", () => {
		const source = JSON.stringify({
			denominator: 8,
			isTriplet: false,
			measures: "123",
		});

		expect(() => parseCodeBlock(source)).toThrow(InvalidBlockError);
	});

	it("should throw error when measures contains non-numbers", () => {
		const source = JSON.stringify({
			denominator: 8,
			isTriplet: false,
			measures: [1, "two", 3],
		});

		expect(() => parseCodeBlock(source)).toThrow(InvalidBlockError);
	});

	it("should throw error when chords is not a two-dimensional string array", () => {
		const source = JSON.stringify({
			denominator: 8,
			isTriplet: false,
			measures: [1, 2, 3, 4],
			chords: ["Am", "", "F", ""],
		});

		expect(() => parseCodeBlock(source)).toThrow(InvalidBlockError);
	});

	it("should throw error when a chord row length differs from measures length", () => {
		const source = JSON.stringify({
			denominator: 8,
			isTriplet: false,
			measures: [1, 2, 3, 4],
			chords: [["Am", "", "F"]],
		});

		expect(() => parseCodeBlock(source)).toThrow(InvalidBlockError);
	});
});

describe("parseStrokes", () => {
	it("dudududu", () => {
		const codeBlock = {
			denominator: 8,
			isTriplet: false,
			measures: [1, 101, 1, 101, 1, 101, 1, 101],
		};

		const actual = parseStrokes(codeBlock);

		const expected: Stroke[] = [
			{ stroke: 1, timing: "1" },
			{ stroke: 101, timing: "&" },
			{ stroke: 1, timing: "2" },
			{ stroke: 101, timing: "&" },
			{ stroke: 1, timing: "3" },
			{ stroke: 101, timing: "&" },
			{ stroke: 1, timing: "4" },
			{ stroke: 101, timing: "&" },
		];

		expect(actual).toEqual(expected);
	});

	it("dudududu", () => {
		const codeBlock = {
			denominator: 16,
			isTriplet: false,
			measures: [
				1, 202, 1, 101, 1, 202, 101, 202, 1, 202, 1, 101, 1, 202, 101,
				202,
			],
		};

		const actual = parseStrokes(codeBlock);

		const expected: Stroke[] = [
			{ stroke: 1, timing: "1" },
			{ stroke: 202, timing: "e" },
			{ stroke: 1, timing: "&" },
			{ stroke: 101, timing: "a" },
			{ stroke: 1, timing: "2" },
			{ stroke: 202, timing: "e" },
			{ stroke: 101, timing: "&" },
			{ stroke: 202, timing: "a" },
			{ stroke: 1, timing: "3" },
			{ stroke: 202, timing: "e" },
			{ stroke: 1, timing: "&" },
			{ stroke: 101, timing: "a" },
			{ stroke: 1, timing: "4" },
			{ stroke: 202, timing: "e" },
			{ stroke: 101, timing: "&" },
			{ stroke: 202, timing: "a" },
		];

		expect(actual).toEqual(expected);
	});

	describe("Im a mess: 1495063", () => {
		it("verse", () => {
			const codeBlock = {
				denominator: 16,
				isTriplet: false,
				measures: [
					1, 202, 2, 202, 2, 202, 1, 202, 2, 202, 2, 202, 1, 202, 2,
					102,
				],
			};

			const actual = parseStrokes(codeBlock);

			const expected: Stroke[] = [
				{ stroke: 1, timing: "1" },
				{ stroke: 202, timing: "e" },
				{ stroke: 2, timing: "&" },
				{ stroke: 202, timing: "a" },
				{ stroke: 2, timing: "2" },
				{ stroke: 202, timing: "e" },
				{ stroke: 1, timing: "&" },
				{ stroke: 202, timing: "a" },
				{ stroke: 2, timing: "3" },
				{ stroke: 202, timing: "e" },
				{ stroke: 2, timing: "&" },
				{ stroke: 202, timing: "a" },
				{ stroke: 1, timing: "4" },
				{ stroke: 202, timing: "e" },
				{ stroke: 2, timing: "&" },
				{ stroke: 102, timing: "a" },
			];

			expect(actual).toEqual(expected);
		});

		it("outro", () => {
			const codeBlock = {
				denominator: 8,
				isTriplet: false,
				measures: [
					1, 202, 202, 1, 202, 202, 1, 202, 202, 1, 202, 202, 1, 202,
					1, 202,
				],
			};

			const actual = parseStrokes(codeBlock);

			const expected: Stroke[] = [
				{ stroke: 1, timing: "1" },
				{ stroke: 202, timing: "&" },
				{ stroke: 202, timing: "2" },
				{ stroke: 1, timing: "&" },
				{ stroke: 202, timing: "3" },
				{ stroke: 202, timing: "&" },
				{ stroke: 1, timing: "4" },
				{ stroke: 202, timing: "&" },
				{ stroke: 202, timing: "5" },
				{ stroke: 1, timing: "&" },
				{ stroke: 202, timing: "6" },
				{ stroke: 202, timing: "&" },
				{ stroke: 1, timing: "7" },
				{ stroke: 202, timing: "&" },
				{ stroke: 1, timing: "8" },
				{ stroke: 202, timing: "&" },
			];

			expect(actual).toEqual(expected);
		});

		it("chorus", () => {
			const codeBlock = {
				denominator: 16,
				isTriplet: false,
				measures: [
					3, 202, 1, 202, 1, 202, 3, 202, 1, 202, 1, 202, 3, 202, 1,
					101,
				],
			};

			const actual = parseStrokes(codeBlock);

			const expected: Stroke[] = [
				{ stroke: 3, timing: "1" },
				{ stroke: 202, timing: "e" },
				{ stroke: 1, timing: "&" },
				{ stroke: 202, timing: "a" },
				{ stroke: 1, timing: "2" },
				{ stroke: 202, timing: "e" },
				{ stroke: 3, timing: "&" },
				{ stroke: 202, timing: "a" },
				{ stroke: 1, timing: "3" },
				{ stroke: 202, timing: "e" },
				{ stroke: 1, timing: "&" },
				{ stroke: 202, timing: "a" },
				{ stroke: 3, timing: "4" },
				{ stroke: 202, timing: "e" },
				{ stroke: 1, timing: "&" },
				{ stroke: 101, timing: "a" },
			];

			expect(actual).toEqual(expected);
		});
	});

	it("1731876", () => {
		const codeBlock = {
			denominator: 16,
			isTriplet: true,
			measures: [
				1, 202, 202, 1, 202, 202, 202, 202, 101, 1, 202, 101, 1, 202,
				202, 1, 202, 202, 202, 202, 101, 1, 202, 101,
			],
		};

		const actual = parseStrokes(codeBlock);

		const expected: Stroke[] = [
			{ stroke: 1, timing: "1" },
			{ stroke: 202, timing: " " },
			{ stroke: 202, timing: " " },
			{ stroke: 1, timing: "&" },
			{ stroke: 202, timing: " " },
			{ stroke: 202, timing: " " },
			{ stroke: 202, timing: "2" },
			{ stroke: 202, timing: " " },
			{ stroke: 101, timing: " " },
			{ stroke: 1, timing: "&" },
			{ stroke: 202, timing: " " },
			{ stroke: 101, timing: " " },
			{ stroke: 1, timing: "3" },
			{ stroke: 202, timing: " " },
			{ stroke: 202, timing: " " },
			{ stroke: 1, timing: "&" },
			{ stroke: 202, timing: " " },
			{ stroke: 202, timing: " " },
			{ stroke: 202, timing: "4" },
			{ stroke: 202, timing: " " },
			{ stroke: 101, timing: " " },
			{ stroke: 1, timing: "&" },
			{ stroke: 202, timing: " " },
			{ stroke: 101, timing: " " },
		];

		expect(actual).toEqual(expected);
	});
});