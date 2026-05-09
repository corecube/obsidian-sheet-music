import { describe, expect, it } from "@jest/globals";
import {
	calculateAutoscrollInterval,
	DEFAULT_AUTOSCROLL_SPEED,
	parseAutoscrollSpeed,
} from "./logic";

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
