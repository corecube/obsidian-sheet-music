export const DEFAULT_AUTOSCROLL_SPEED = 5;
export const AUTOSCROLL_STEPS = 20;
const MIN_AUTOSCROLL_SPEED = 1;
const MAX_AUTOSCROLL_SPEED = AUTOSCROLL_STEPS;

const HIGHEST_INTERVAL_MS = 200;
const LOWEST_INTERVAL_MS = 13;
const SPEED_CURVE_EXPONENT = 2.3;

export function parseAutoscrollSpeed(value: unknown): number {
	if (typeof value === "number" && Number.isFinite(value)) {
		return clampSpeed(value);
	}

	if (typeof value === "string") {
		const parsed = Number(value.trim());
		if (Number.isFinite(parsed)) {
			return clampSpeed(parsed);
		}
	}

	return DEFAULT_AUTOSCROLL_SPEED;
}

function clampSpeed(value: number): number {
	if (value < MIN_AUTOSCROLL_SPEED) {
		return DEFAULT_AUTOSCROLL_SPEED;
	}

	return Math.min(value, MAX_AUTOSCROLL_SPEED);
}

export const MAX_COMPENSATION_FACTOR = 6;

export interface MeasuredLine {
	top: number;
	height: number;
	isTranslation: boolean;
}

export function calculateViewportCompensationFactor(
	lines: MeasuredLine[],
	viewportTop: number,
	viewportHeight: number,
	lineHeight: number,
): number {
	if (viewportHeight <= 0 || lineHeight <= 0) {
		return 1;
	}

	const viewportBottom = viewportTop + viewportHeight;
	let totalExcess = 0;
	for (const line of lines) {
		if (line.height <= 0) {
			continue;
		}
		const overlap =
			Math.min(line.top + line.height, viewportBottom) -
			Math.max(line.top, viewportTop);
		if (overlap <= 0) {
			continue;
		}
		const excess = line.isTranslation
			? line.height
			: Math.max(0, line.height - lineHeight);
		totalExcess += excess * (overlap / line.height);
	}

	if (totalExcess >= viewportHeight) {
		return MAX_COMPENSATION_FACTOR;
	}
	return Math.min(
		viewportHeight / (viewportHeight - totalExcess),
		MAX_COMPENSATION_FACTOR,
	);
}

// Longest frame gap that still advances the scroll position — anything
// larger (backgrounded tab, device sleep) must not cause a sudden jump.
export const MAX_FRAME_ELAPSED_MS = 250;

export class FrameAccumulator {
	private remainder = 0;

	advance(elapsedMs: number, velocityPxPerSec: number): number {
		const clamped = Math.min(Math.max(elapsedMs, 0), MAX_FRAME_ELAPSED_MS);
		this.remainder += (clamped / 1000) * velocityPxPerSec;
		const whole = Math.floor(this.remainder);
		this.remainder -= whole;
		return whole;
	}
}

export function calculateAutoscrollVelocity(speedValue: number): number {
	return 1000 / calculateAutoscrollInterval(speedValue);
}

export function calculateAutoscrollInterval(speedValue: number): number {
	const speed = clampSpeed(speedValue);
	const normalizedSpeed = (speed - 1) / (AUTOSCROLL_STEPS - 1);
	const adjustedSpeed = Math.pow(normalizedSpeed, SPEED_CURVE_EXPONENT);

	const intervalRangeFactor =
		(HIGHEST_INTERVAL_MS - LOWEST_INTERVAL_MS) / (1 - 1 / AUTOSCROLL_STEPS);
	const intervalRangeConstant =
		LOWEST_INTERVAL_MS - intervalRangeFactor / AUTOSCROLL_STEPS;

	return (
		intervalRangeFactor / (1 + adjustedSpeed * (AUTOSCROLL_STEPS - 1)) +
		intervalRangeConstant
	);
}
