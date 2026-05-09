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
