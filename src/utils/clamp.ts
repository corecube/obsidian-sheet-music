export function clampNumber(
	value: number,
	fallback: number,
	minimum: number,
	maximum: number,
): number {
	if (!Number.isFinite(value)) {
		return fallback;
	}

	return Math.min(Math.max(value, minimum), maximum);
}

export function clampTransposeSemitones(value: number): number {
	if (!Number.isFinite(value)) {
		return 0;
	}

	return Math.min(Math.max(Math.round(value), -24), 24);
}

export function clampInstrumentProgram(value: number): number {
	if (!Number.isFinite(value)) {
		return 0;
	}

	return Math.min(Math.max(Math.round(value), 0), 127);
}

export function clampTempoPercentage(value: number): number {
	if (!Number.isFinite(value)) {
		return 100;
	}

	return Math.min(Math.max(value, 10), 100);
}
