import { describe, expect, it } from "@jest/globals";
import {
	AnimationState,
	computeStepDuration,
	nextStrokeIndex,
	processTick,
} from "./animation-logic";

describe("computeStepDuration", () => {
	it("returns the base duration unchanged at 100 %", () => {
		expect(computeStepDuration(250, 100)).toBe(250);
	});

	it("halves step duration at 200 % speed", () => {
		expect(computeStepDuration(200, 200)).toBe(100);
	});

	it("doubles step duration at 50 % speed", () => {
		expect(computeStepDuration(200, 50)).toBe(400);
	});

	it("returns Infinity at 0 % (paused)", () => {
		expect(computeStepDuration(200, 0)).toBe(Number.POSITIVE_INFINITY);
	});

	it("returns Infinity for negative speed", () => {
		expect(computeStepDuration(200, -10)).toBe(Number.POSITIVE_INFINITY);
	});

	it("returns Infinity for NaN speed", () => {
		expect(computeStepDuration(200, Number.NaN)).toBe(
			Number.POSITIVE_INFINITY,
		);
	});

	it("returns Infinity for Infinity speed", () => {
		expect(computeStepDuration(200, Infinity)).toBe(
			Number.POSITIVE_INFINITY,
		);
	});
});

describe("nextStrokeIndex", () => {
	it("advances by one within bounds", () => {
		expect(nextStrokeIndex(0, 4)).toBe(1);
		expect(nextStrokeIndex(2, 4)).toBe(3);
	});

	it("wraps around at the last index", () => {
		expect(nextStrokeIndex(3, 4)).toBe(0);
	});

	it("wraps on a single-element list", () => {
		expect(nextStrokeIndex(0, 1)).toBe(0);
	});
});

describe("processTick", () => {
	describe("paused / invalid step duration", () => {
		it("does not advance when step duration is Infinity", () => {
			const result = processTick(1000, 900, 0, Infinity);
			expect(result.stepsForward).toBe(0);
			expect(result.lastFrameTimeMs).toBe(1000);
			expect(result.elapsedSinceStepMs).toBe(0);
		});

		it("does not advance when step duration is zero", () => {
			const result = processTick(1000, 900, 0, 0);
			expect(result.stepsForward).toBe(0);
		});

		it("does not advance when step duration is negative", () => {
			const result = processTick(1000, 900, 0, -50);
			expect(result.stepsForward).toBe(0);
		});

		it("preserves existing elapsedSinceStepMs when paused", () => {
			const result = processTick(1000, 900, 42, Infinity);
			expect(result.elapsedSinceStepMs).toBe(42);
		});
	});

	describe("first tick (lastFrameTimeMs is null)", () => {
		it("does not advance on the very first frame", () => {
			const result = processTick(1000, null, 0, 200);
			expect(result.stepsForward).toBe(0);
		});

		it("records the frame time as the new baseline", () => {
			const result = processTick(1000, null, 0, 200);
			expect(result.lastFrameTimeMs).toBe(1000);
		});

		it("preserves accumulated elapsed time", () => {
			const result = processTick(1000, null, 50, 200);
			expect(result.elapsedSinceStepMs).toBe(50);
		});
	});

	describe("normal advancement", () => {
		it("does not advance when elapsed < step duration", () => {
			const result = processTick(1100, 1000, 0, 200);
			expect(result.stepsForward).toBe(0);
			expect(result.elapsedSinceStepMs).toBe(100);
		});

		it("advances exactly one step when elapsed === step duration", () => {
			const result = processTick(1200, 1000, 0, 200);
			expect(result.stepsForward).toBe(1);
			expect(result.elapsedSinceStepMs).toBe(0);
		});

		it("advances one step and carries leftover time", () => {
			const result = processTick(1250, 1000, 0, 200);
			expect(result.stepsForward).toBe(1);
			expect(result.elapsedSinceStepMs).toBeCloseTo(50);
		});

		it("advances multiple steps in a slow frame", () => {
			const result = processTick(1500, 1000, 0, 200);
			expect(result.stepsForward).toBe(2);
			expect(result.elapsedSinceStepMs).toBeCloseTo(100);
		});

		it("includes pre-existing accumulated time", () => {
			const result = processTick(1100, 1000, 150, 200);
			expect(result.stepsForward).toBe(1);
			expect(result.elapsedSinceStepMs).toBeCloseTo(50);
		});

		it("updates lastFrameTimeMs to the current frame", () => {
			const result = processTick(1500, 1000, 0, 200);
			expect(result.lastFrameTimeMs).toBe(1500);
		});

		it("carries over sub-step remainder across multiple calls", () => {
			const firstResult = processTick(150, 0, 0, 200);
			expect(firstResult.stepsForward).toBe(0);
			expect(firstResult.elapsedSinceStepMs).toBeCloseTo(150);

			const secondResult = processTick(
				300,
				firstResult.lastFrameTimeMs,
				firstResult.elapsedSinceStepMs,
				200,
			);
			expect(secondResult.stepsForward).toBe(1);
			expect(secondResult.elapsedSinceStepMs).toBeCloseTo(100);

			const thirdResult = processTick(
				450,
				secondResult.lastFrameTimeMs,
				secondResult.elapsedSinceStepMs,
				200,
			);
			expect(thirdResult.stepsForward).toBe(1);
			expect(thirdResult.elapsedSinceStepMs).toBeCloseTo(50);
		});
	});
});

describe("AnimationState", () => {
	const make = (speedPercentage = 100) =>
		new AnimationState(200, 4, speedPercentage);

	describe("initial state", () => {
		it("starts at index 0 and not animating", () => {
			const state = make();
			expect(state.activeIndex).toBe(0);
			expect(state.isAnimating).toBe(false);
		});
	});

	describe("start()", () => {
		it("sets isAnimating to true", () => {
			const state = make();
			state.start();
			expect(state.isAnimating).toBe(true);
		});

		it("is idempotent when called twice", () => {
			const state = make();
			state.start();
			state.start();
			expect(state.isAnimating).toBe(true);
		});

		it("does not advance activeIndex", () => {
			const state = make();
			state.start();
			expect(state.activeIndex).toBe(0);
		});
	});

	describe("stop()", () => {
		it("sets isAnimating to false", () => {
			const state = make();
			state.start();
			state.stop();
			expect(state.isAnimating).toBe(false);
		});

		it("resets activeIndex to 0", () => {
			const state = make();
			state.start();
			state.tick(0);
			state.tick(400);
			expect(state.activeIndex).toBe(2);
			state.stop();
			expect(state.activeIndex).toBe(0);
		});

		it("is safe to call when already stopped", () => {
			const state = make();
			state.stop();
			expect(state.isAnimating).toBe(false);
			expect(state.activeIndex).toBe(0);
		});
	});

	describe("tick()", () => {
		it("returns empty array on first tick (no baseline yet)", () => {
			const state = make();
			state.start();
			expect(state.tick(0)).toEqual([]);
		});

		it("returns empty array when elapsed < step duration", () => {
			const state = make();
			state.start();
			state.tick(0);
			expect(state.tick(100)).toEqual([]);
		});

		it("returns [1] after exactly one step duration", () => {
			const state = make();
			state.start();
			state.tick(0);
			expect(state.tick(200)).toEqual([1]);
			expect(state.activeIndex).toBe(1);
		});

		it("returns [1, 2] when two steps complete in one frame", () => {
			const state = make();
			state.start();
			state.tick(0);
			expect(state.tick(400)).toEqual([1, 2]);
			expect(state.activeIndex).toBe(2);
		});

		it("wraps activeIndex around the stroke count", () => {
			const state = make();
			state.start();
			state.tick(0);
			state.tick(200);
			state.tick(400);
			state.tick(600);
			state.tick(800);
			expect(state.activeIndex).toBe(0);
		});

		it("accumulates sub-step remainder across frames", () => {
			const state = make();
			state.start();
			state.tick(0);
			expect(state.tick(150)).toEqual([]);
			expect(state.tick(300)).toEqual([1]);
		});

		it("returns empty array when paused (Infinity step duration)", () => {
			const state = make(0);
			state.start();
			state.tick(0);
			expect(state.tick(10000)).toEqual([]);
		});
	});

	describe("setSpeedPercentage()", () => {
		it("halves the step count per frame at 50 % speed", () => {
			const state = make(50);
			state.start();
			state.tick(0);
			expect(state.tick(200)).toEqual([]);
			expect(state.tick(400)).toEqual([1]);
		});

		it("can be updated mid-session", () => {
			const state = make(100);
			state.start();
			state.tick(0);
			state.tick(200);
			state.setSpeedPercentage(50);
			expect(state.tick(400)).toEqual([]);
		});

		it("pausing at 0 % stops advancement", () => {
			const state = make(100);
			state.start();
			state.tick(0);
			state.setSpeedPercentage(0);
			expect(state.tick(10000)).toEqual([]);
		});
	});
});