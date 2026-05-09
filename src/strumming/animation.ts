import { MarkdownRenderChild, setIcon } from "obsidian";
import type { Stroke } from "./parser";
import { AnimationState } from "./animation-logic";
import { Audio } from "./audio";
import { StrokeToken } from "./stroke-token";

export class Animation extends MarkdownRenderChild {
	private animationFrameId: number | null = null;
	private readonly state: AnimationState;
	private readonly audioPlayer = new Audio();
	private activeStrokeCellIndex: number | null = null;

	constructor(
		containerEl: HTMLElement,
		private readonly toggleButton: HTMLButtonElement,
		private readonly strokeCells: HTMLElement[],
		private readonly strokes: Stroke[],
		baseStepDurationMs: number,
		speedPercentage: number,
	) {
		super(containerEl);
		this.state = new AnimationState(
			baseStepDurationMs,
			strokeCells.length,
			speedPercentage,
		);
		this.setActiveStrokeCell(this.state.activeIndex);
		this.toggleButton.addEventListener("click", this.onToggleClick);
	}

	private setActiveStrokeCell(index: number): void {
		if (this.activeStrokeCellIndex !== null) {
			this.strokeCells[this.activeStrokeCellIndex]?.toggleClass("strumming-cell-active", false);
		}
		this.strokeCells[index]?.toggleClass("strumming-cell-active", true);
		this.activeStrokeCellIndex = index;
	}

	setSpeedPercentage(value: number): void {
		this.state.setSpeedPercentage(value);
	}

	private readonly onToggleClick = (event: MouseEvent): void => {
		event.stopPropagation();
		this.toggle();
	};

	private readonly tick = (frameTimeMs: number): void => {
		if (!this.state.isAnimating) {
			return;
		}

		for (const index of this.state.tick(frameTimeMs)) {
			this.setActiveStrokeCell(index);
			this.audioPlayer.play(
				this.strokes[index]?.stroke ?? StrokeToken.Rest,
			);
		}

		this.animationFrameId = window.requestAnimationFrame(this.tick);
	};

	private start(): void {
		if (this.state.isAnimating) {
			return;
		}

		this.state.start();
		this.containerEl.addClass("strumming-playing");
		setIcon(this.toggleButton, "square");
		this.toggleButton.setAttribute(
			"aria-label",
			"Pause strumming animation",
		);
		this.audioPlayer.play(
			this.strokes[this.state.activeIndex]?.stroke ?? StrokeToken.Rest,
		);
		this.animationFrameId = window.requestAnimationFrame(this.tick);
	}

	private stop(): void {
		if (this.animationFrameId !== null) {
			window.cancelAnimationFrame(this.animationFrameId);
			this.animationFrameId = null;
		}

		this.state.stop();
		this.setActiveStrokeCell(this.state.activeIndex);
		this.containerEl.removeClass("strumming-playing");
		setIcon(this.toggleButton, "play");
		this.toggleButton.setAttribute(
			"aria-label",
			"Start strumming animation",
		);
	}

	private toggle(): void {
		if (this.state.isAnimating) {
			this.stop();
			return;
		}

		this.start();
	}

	onunload(): void {
		this.stop();
		this.toggleButton.removeEventListener("click", this.onToggleClick);
	}
}