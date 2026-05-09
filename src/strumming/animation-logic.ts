export function computeStepDuration(
	baseStepDurationMs: number,
	speedPercentage: number,
): number {
	const percentage = Number.isFinite(speedPercentage) ? speedPercentage : 0;
	return percentage <= 0
		? Number.POSITIVE_INFINITY
		: baseStepDurationMs * (100 / percentage);
}

export function nextStrokeIndex(
	currentIndex: number,
	strokeCount: number,
): number {
	return (currentIndex + 1) % strokeCount;
}

export interface TickResult {
	lastFrameTimeMs: number;
	elapsedSinceStepMs: number;
	stepsForward: number;
}

export function processTick(
	frameTimeMs: number,
	lastFrameTimeMs: number | null,
	elapsedSinceStepMs: number,
	stepDurationMs: number,
): TickResult {
	if (!Number.isFinite(stepDurationMs) || stepDurationMs <= 0) {
		return {
			lastFrameTimeMs: frameTimeMs,
			elapsedSinceStepMs,
			stepsForward: 0,
		};
	}

	if (lastFrameTimeMs === null) {
		return {
			lastFrameTimeMs: frameTimeMs,
			elapsedSinceStepMs,
			stepsForward: 0,
		};
	}

	let elapsed = elapsedSinceStepMs + (frameTimeMs - lastFrameTimeMs);
	let stepsForward = 0;

	while (elapsed >= stepDurationMs) {
		elapsed -= stepDurationMs;
		stepsForward += 1;
	}

	return {
		lastFrameTimeMs: frameTimeMs,
		elapsedSinceStepMs: elapsed,
		stepsForward,
	};
}

export class AnimationState {
	activeIndex = 0;
	isAnimating = false;
	private elapsedSinceStepMs = 0;
	private lastFrameTimeMs: number | null = null;
	private stepDurationMs = Number.POSITIVE_INFINITY;

	constructor(
		private readonly baseStepDurationMs: number,
		private readonly strokeCount: number,
		speedPercentage: number,
	) {
		this.setSpeedPercentage(speedPercentage);
	}

	setSpeedPercentage(value: number): void {
		this.stepDurationMs = computeStepDuration(
			this.baseStepDurationMs,
			value,
		);
	}

	tick(frameTimeMs: number): number[] {
		const result = processTick(
			frameTimeMs,
			this.lastFrameTimeMs,
			this.elapsedSinceStepMs,
			this.stepDurationMs,
		);
		this.lastFrameTimeMs = result.lastFrameTimeMs;
		this.elapsedSinceStepMs = result.elapsedSinceStepMs;

		const steppedIndices: number[] = [];
		for (let index = 0; index < result.stepsForward; index += 1) {
			this.activeIndex = nextStrokeIndex(
				this.activeIndex,
				this.strokeCount,
			);
			steppedIndices.push(this.activeIndex);
		}

		return steppedIndices;
	}

	start(): void {
		if (this.isAnimating) {
			return;
		}

		this.isAnimating = true;
		this.elapsedSinceStepMs = 0;
		this.lastFrameTimeMs = null;
	}

	stop(): void {
		this.isAnimating = false;
		this.elapsedSinceStepMs = 0;
		this.activeIndex = 0;
		this.lastFrameTimeMs = null;
	}
}