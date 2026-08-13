import { describe, expect, it } from "@jest/globals";
import {
	calculateAutoscrollInterval,
	calculateAutoscrollVelocity,
	calculateViewportCompensationFactor,
	DEFAULT_AUTOSCROLL_SPEED,
	FrameAccumulator,
	MAX_COMPENSATION_FACTOR,
	MAX_FRAME_ELAPSED_MS,
	type MeasuredLine,
	parseAutoscrollSpeed,
} from "./logic";

const LINE_HEIGHT = 20;
const VIEWPORT_HEIGHT = 400;

function fillViewport(pairHeights: {
	lyric: number;
	translation: number;
}): MeasuredLine[] {
	const lines: MeasuredLine[] = [];
	let top = 0;
	while (top < VIEWPORT_HEIGHT) {
		lines.push({ top, height: pairHeights.lyric, isTranslation: false });
		top += pairHeights.lyric;
		lines.push({
			top,
			height: pairHeights.translation,
			isTranslation: true,
		});
		top += pairHeights.translation;
	}
	return lines;
}

describe("calculateViewportCompensationFactor", () => {
	it("returns 1 when no lines exist", () => {
		expect(
			calculateViewportCompensationFactor(
				[],
				0,
				VIEWPORT_HEIGHT,
				LINE_HEIGHT,
			),
		).toBe(1);
	});

	it("returns 1 when lines are outside the viewport", () => {
		const lines: MeasuredLine[] = [
			{ top: -100, height: 40, isTranslation: true },
			{ top: VIEWPORT_HEIGHT + 50, height: 40, isTranslation: true },
		];
		expect(
			calculateViewportCompensationFactor(
				lines,
				0,
				VIEWPORT_HEIGHT,
				LINE_HEIGHT,
			),
		).toBe(1);
	});

	it("doubles for unwrapped lyric+translation pairs", () => {
		const lines = fillViewport({
			lyric: LINE_HEIGHT,
			translation: LINE_HEIGHT,
		});
		expect(
			calculateViewportCompensationFactor(
				lines,
				0,
				VIEWPORT_HEIGHT,
				LINE_HEIGHT,
			),
		).toBeCloseTo(2);
	});

	it("quadruples when lyric and translation each wrap to two lines", () => {
		const lines = fillViewport({
			lyric: 2 * LINE_HEIGHT,
			translation: 2 * LINE_HEIGHT,
		});
		expect(
			calculateViewportCompensationFactor(
				lines,
				0,
				VIEWPORT_HEIGHT,
				LINE_HEIGHT,
			),
		).toBeCloseTo(4);
	});

	it("counts partially visible lines proportionally", () => {
		// Half of a 40px translation line sticks into the viewport.
		const lines: MeasuredLine[] = [
			{ top: -20, height: 40, isTranslation: true },
		];
		expect(
			calculateViewportCompensationFactor(
				lines,
				0,
				VIEWPORT_HEIGHT,
				LINE_HEIGHT,
			),
		).toBeCloseTo(VIEWPORT_HEIGHT / (VIEWPORT_HEIGHT - 20));
	});

	it("dilutes the factor when non-chords content fills part of the viewport", () => {
		// One unwrapped pair at the top, rest of the viewport is prose.
		const lines: MeasuredLine[] = [
			{ top: 0, height: LINE_HEIGHT, isTranslation: false },
			{ top: LINE_HEIGHT, height: LINE_HEIGHT, isTranslation: true },
		];
		const factor = calculateViewportCompensationFactor(
			lines,
			0,
			VIEWPORT_HEIGHT,
			LINE_HEIGHT,
		);
		expect(factor).toBeGreaterThan(1);
		expect(factor).toBeLessThan(2);
		expect(factor).toBeCloseTo(
			VIEWPORT_HEIGHT / (VIEWPORT_HEIGHT - LINE_HEIGHT),
		);
	});

	it("clamps to the maximum factor", () => {
		// Everything in view is translation → excess equals the viewport.
		const lines: MeasuredLine[] = [
			{ top: 0, height: VIEWPORT_HEIGHT, isTranslation: true },
		];
		expect(
			calculateViewportCompensationFactor(
				lines,
				0,
				VIEWPORT_HEIGHT,
				LINE_HEIGHT,
			),
		).toBe(MAX_COMPENSATION_FACTOR);
	});

	it("returns 1 for degenerate viewport or line height", () => {
		const lines = fillViewport({
			lyric: LINE_HEIGHT,
			translation: LINE_HEIGHT,
		});
		expect(
			calculateViewportCompensationFactor(lines, 0, 0, LINE_HEIGHT),
		).toBe(1);
		expect(
			calculateViewportCompensationFactor(lines, 0, -100, LINE_HEIGHT),
		).toBe(1);
		expect(
			calculateViewportCompensationFactor(lines, 0, VIEWPORT_HEIGHT, 0),
		).toBe(1);
	});
});

describe("FrameAccumulator", () => {
	it("yields 1px per frame at 60px/s and 60fps", () => {
		const acc = new FrameAccumulator();
		for (let i = 0; i < 10; i++) {
			expect(acc.advance(1000 / 60, 60)).toBe(1);
		}
	});

	it("emits whole pixels and carries the fraction", () => {
		const acc = new FrameAccumulator();
		// 0.5px per frame → every second frame scrolls 1px.
		expect(acc.advance(10, 50)).toBe(0);
		expect(acc.advance(10, 50)).toBe(1);
		expect(acc.advance(10, 50)).toBe(0);
		expect(acc.advance(10, 50)).toBe(1);
	});

	it("does not drift over many frames", () => {
		const acc = new FrameAccumulator();
		let total = 0;
		for (let i = 0; i < 100; i++) total += acc.advance(16, 77);
		expect(Math.abs(total - (16 / 1000) * 77 * 100)).toBeLessThanOrEqual(1);
	});

	it("clamps long frame gaps to avoid jumps", () => {
		const acc = new FrameAccumulator();
		const px = acc.advance(60_000, 100);
		expect(px).toBeLessThanOrEqual((MAX_FRAME_ELAPSED_MS / 1000) * 100);
	});

	it("ignores negative elapsed time", () => {
		const acc = new FrameAccumulator();
		expect(acc.advance(-50, 100)).toBe(0);
	});
});

describe("calculateAutoscrollVelocity", () => {
	it("matches the interval-based rate of 1px per tick", () => {
		expect(calculateAutoscrollVelocity(1)).toBeCloseTo(
			1000 / calculateAutoscrollInterval(1),
		);
		expect(calculateAutoscrollVelocity(20)).toBeCloseTo(
			1000 / calculateAutoscrollInterval(20),
		);
	});

	it("increases with speed", () => {
		expect(calculateAutoscrollVelocity(15)).toBeGreaterThan(
			calculateAutoscrollVelocity(3),
		);
	});
});

describe("parseAutoscrollSpeed", () => {
	it("returns default speed when metadata value is missing", () => {
		expect(parseAutoscrollSpeed(undefined)).toBe(DEFAULT_AUTOSCROLL_SPEED);
	});

	it("parses numeric metadata values", () => {
		expect(parseAutoscrollSpeed(12)).toBe(12);
		expect(parseAutoscrollSpeed("7.5")).toBe(7.5);
	});

	it("returns default speed when value is invalid", () => {
		expect(parseAutoscrollSpeed("abc")).toBe(DEFAULT_AUTOSCROLL_SPEED);
		expect(parseAutoscrollSpeed(0)).toBe(DEFAULT_AUTOSCROLL_SPEED);
		expect(parseAutoscrollSpeed(0.5)).toBe(DEFAULT_AUTOSCROLL_SPEED);
		expect(parseAutoscrollSpeed(-2)).toBe(DEFAULT_AUTOSCROLL_SPEED);
	});

	it("caps extreme values to a safe maximum", () => {
		expect(parseAutoscrollSpeed(999)).toBe(20);
	});
});

describe("calculateAutoscrollInterval", () => {
	it("maps speed 1 close to highest interval", () => {
		expect(calculateAutoscrollInterval(1)).toBeCloseTo(200, 0);
	});

	it("maps speed 20 close to lowest interval", () => {
		expect(calculateAutoscrollInterval(20)).toBeCloseTo(13, 0);
	});

	it("decreases interval as speed increases", () => {
		const slow = calculateAutoscrollInterval(3);
		const fast = calculateAutoscrollInterval(15);
		expect(fast).toBeLessThan(slow);
	});
});
