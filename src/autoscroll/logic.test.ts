import { describe, expect, it } from "@jest/globals";
import {
	calculateAutoscrollInterval,
	calculateCompensationFactor,
	DEFAULT_AUTOSCROLL_SPEED,
	MAX_COMPENSATION_FACTOR,
	parseAutoscrollSpeed,
	ScrollAccumulator,
} from "./logic";

describe("calculateCompensationFactor", () => {
	it("returns 1 when there are no translation lines", () => {
		expect(calculateCompensationFactor(1000, 0)).toBe(1);
	});

	it("scales by the visible translation share", () => {
		expect(calculateCompensationFactor(1000, 200)).toBeCloseTo(1.25);
		expect(calculateCompensationFactor(1000, 500)).toBeCloseTo(2);
	});

	it("clamps to the maximum factor", () => {
		expect(calculateCompensationFactor(1000, 900)).toBe(
			MAX_COMPENSATION_FACTOR,
		);
		expect(calculateCompensationFactor(1000, 1000)).toBe(
			MAX_COMPENSATION_FACTOR,
		);
		expect(calculateCompensationFactor(1000, 1500)).toBe(
			MAX_COMPENSATION_FACTOR,
		);
	});

	it("returns 1 for degenerate heights", () => {
		expect(calculateCompensationFactor(0, 100)).toBe(1);
		expect(calculateCompensationFactor(-5, 100)).toBe(1);
		expect(calculateCompensationFactor(1000, -1)).toBe(1);
	});
});

describe("ScrollAccumulator", () => {
	it("yields a constant 1px at factor 1", () => {
		const acc = new ScrollAccumulator(1);
		for (let i = 0; i < 10; i++) expect(acc.next()).toBe(1);
	});

	it("alternates 1 and 2 at factor 1.5", () => {
		const acc = new ScrollAccumulator(1.5);
		expect(acc.next()).toBe(1);
		expect(acc.next()).toBe(2);
		expect(acc.next()).toBe(1);
		expect(acc.next()).toBe(2);
	});

	it("does not drift over many ticks", () => {
		const acc = new ScrollAccumulator(2.34);
		let total = 0;
		for (let i = 0; i < 100; i++) total += acc.next();
		expect(Math.abs(total - 2.34 * 100)).toBeLessThanOrEqual(1);
	});

	it("applies a new step on the next tick", () => {
		const acc = new ScrollAccumulator(1);
		expect(acc.next()).toBe(1);
		acc.setStep(2);
		expect(acc.next()).toBe(2);
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
