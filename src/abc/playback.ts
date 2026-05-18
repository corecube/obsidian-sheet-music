import { synth, TimingCallbacks } from "abcjs";
import type { NoteTimingEvent, TuneObject } from "abcjs";
import { MarkdownRenderChild, setIcon } from "obsidian";
import {
	clampInstrumentProgram,
	clampTempoPercentage,
	clampTransposeSemitones,
} from "../utils/clamp";

function eventMatchesSelectedStartChar(
	event: NoteTimingEvent,
	selectedStartChar: number,
): boolean {
	if (
		typeof event.startChar === "number" &&
		event.startChar === selectedStartChar
	) {
		return true;
	}

	if (
		typeof event.startChar === "number" &&
		typeof event.endChar === "number"
	) {
		if (
			selectedStartChar >= event.startChar &&
			selectedStartChar <= event.endChar
		) {
			return true;
		}
	}

	if (event.startCharArray?.includes(selectedStartChar)) {
		return true;
	}

	if (event.endCharArray?.includes(selectedStartChar)) {
		return true;
	}

	return false;
}

export class AbcPlaybackController extends MarkdownRenderChild {
	private readonly midiBuffer = new synth.CreateSynth();
	private timingCallbacks: TimingCallbacks | null = null;
	private cursorLine: SVGLineElement | null = null;
	private isPrepared = false;
	private isPlaying = false;
	private isBusy = false;
	private tempoPercentage = 100;
	private transposeSemitones = 0;
	private startChar: number | null = null;
	private readonly instrumentProgram: number;

	constructor(
		containerEl: HTMLElement,
		private readonly notationEl: HTMLElement,
		private tune: TuneObject,
		private readonly playButton: HTMLButtonElement,
		private readonly tempoInput: HTMLInputElement,
		private readonly tempoValue: HTMLElement,
		instrumentProgram: number,
	) {
		super(containerEl);
		this.instrumentProgram = clampInstrumentProgram(instrumentProgram);
		this.playButton.addEventListener("click", this.onToggleClick);
		this.tempoInput.addEventListener("input", this.onTempoInput);
		this.updateTempoLabel();
		this.updatePlayButton(false);
	}

	private updateTempoLabel(): void {
		this.tempoValue.setText(`${this.tempoPercentage}%`);
	}

	private updatePlayButton(isPlaying: boolean): void {
		setIcon(this.playButton, isPlaying ? "square" : "play");
		this.playButton.setAttribute(
			"aria-label",
			isPlaying ? "Stop ABC playback" : "Start ABC playback",
		);
	}

	private getEffectiveBpm(): number {
		const tuneBpm = this.tune.getBpm();
		const baseBpm = Number.isFinite(tuneBpm) && tuneBpm > 0 ? tuneBpm : 90;
		return Math.round(baseBpm * (this.tempoPercentage / 100));
	}

	private getMillisecondsPerMeasure(): number {
		return this.tune.millisecondsPerMeasure(this.getEffectiveBpm());
	}

	private async prepareBuffer(): Promise<void> {
		if (this.isPrepared) {
			return;
		}

		await this.midiBuffer.init({
			visualObj: this.tune,
			millisecondsPerMeasure: this.getMillisecondsPerMeasure(),
			options: {
				chordsOff: true, // disable chord symbol playback to avoid confusion with actual notes e.g. "Cadd9"
				qpm: this.getEffectiveBpm(),
				program: this.instrumentProgram,
				midiTranspose: this.transposeSemitones,
				visualTranspose: this.transposeSemitones,
				onEnded: () => {
					this.onPlaybackEnded();
				},
			},
		});

		await this.midiBuffer.prime();
		this.isPrepared = true;
	}

	private onPlaybackEnded(): void {
		this.stopCursorTracking();
		this.isPlaying = false;
		this.updatePlayButton(false);
	}

	private stopPlayback(): void {
		if (this.midiBuffer.getIsRunning()) {
			this.midiBuffer.stop();
		}

		this.stopCursorTracking();

		this.isPlaying = false;
		this.updatePlayButton(false);
	}

	private async startPlayback(): Promise<void> {
		await this.prepareBuffer();
		const startSeconds = this.resolveStartSecondsFromSelection();
		if (startSeconds > 0) {
			(
				this.midiBuffer as unknown as {
					seek: (position: number, units?: "seconds") => void;
				}
			).seek(startSeconds, "seconds");
		}
		this.midiBuffer.start();
		this.startCursorTracking(startSeconds);
		this.isPlaying = true;
		this.updatePlayButton(true);
	}

	private resolveStartSecondsFromSelection(): number {
		if (this.startChar == null) {
			return 0;
		}

		const selectedStartChar = this.startChar;
		const effectiveBpm = this.getEffectiveBpm();

		const timings = new TimingCallbacks(this.tune, {
			qpm: effectiveBpm,
		}).noteTimings;
		const exactMatch = timings.find((event) =>
			eventMatchesSelectedStartChar(event, selectedStartChar),
		);
		if (exactMatch && typeof exactMatch.milliseconds === "number") {
			return Math.max(exactMatch.milliseconds, 0) / 1000;
		}

		const fallback = timings.find(
			(event) =>
				typeof event.startChar === "number" &&
				event.startChar >= selectedStartChar,
		);

		if (!fallback || typeof fallback.milliseconds !== "number") {
			return 0;
		}

		return Math.max(fallback.milliseconds, 0) / 1000;
	}

	private removeSelection(): void {
		const highlighted = Array.from(
			this.notationEl.querySelectorAll(".abcjs-highlight"),
		);
		for (const el of highlighted) {
			el.classList.remove("abcjs-highlight");
		}
	}

	private updateCursorPosition(event: NoteTimingEvent): void {
		if (
			!this.cursorLine ||
			typeof event.left !== "number" ||
			typeof event.top !== "number" ||
			typeof event.height !== "number"
		) {
			return;
		}

		const x = String(event.left - 2);
		this.cursorLine.setAttribute("x1", x);
		this.cursorLine.setAttribute("x2", x);
		this.cursorLine.setAttribute("y1", String(event.top));
		this.cursorLine.setAttribute("y2", String(event.top + event.height));
	}

	private ensureCursorLine(): void {
		const svg = this.notationEl.querySelector("svg");
		if (!(svg instanceof SVGSVGElement)) {
			this.cursorLine = null;
			return;
		}

		this.cursorLine?.remove();
		this.cursorLine = window.activeDocument.createElementNS(
			"http://www.w3.org/2000/svg",
			"line",
		);
		this.cursorLine.setAttribute("class", "abcjs-cursor");
		this.cursorLine.setAttribute("x1", "0");
		this.cursorLine.setAttribute("y1", "0");
		this.cursorLine.setAttribute("x2", "0");
		this.cursorLine.setAttribute("y2", "0");
		svg.appendChild(this.cursorLine);
	}

	private handleTimingEvent(event: NoteTimingEvent | null): void {
		if (!event) {
			this.stopCursorTracking();
			return;
		}

		if (event.measureStart && event.left == null) {
			return;
		}

		this.removeSelection();
		for (const group of event.elements ?? []) {
			for (const el of group) {
				el.classList.add("abcjs-highlight");
			}
		}

		this.updateCursorPosition(event);
	}

	private readonly onTimingEvent = (
		event: NoteTimingEvent | null,
	): "continue" => {
		this.handleTimingEvent(event);
		return "continue";
	};

	private startCursorTracking(startSeconds = 0): void {
		this.stopCursorTracking();
		this.ensureCursorLine();
		const effectiveBpm = this.getEffectiveBpm();
		this.timingCallbacks = new TimingCallbacks(this.tune, {
			qpm: effectiveBpm,
			eventCallback: this.onTimingEvent,
		});
		this.timingCallbacks.start(startSeconds, "seconds");
	}

	private stopCursorTracking(): void {
		this.timingCallbacks?.stop();
		this.timingCallbacks = null;
		this.removeSelection();
		if (this.cursorLine) {
			this.cursorLine.setAttribute("x1", "0");
			this.cursorLine.setAttribute("x2", "0");
			this.cursorLine.setAttribute("y1", "0");
			this.cursorLine.setAttribute("y2", "0");
		}
	}

	private readonly onToggleClick = (event: MouseEvent): void => {
		event.stopPropagation();
		void this.togglePlayback();
	};

	private async togglePlayback(): Promise<void> {
		if (this.isBusy) {
			return;
		}

		this.isBusy = true;
		this.playButton.disabled = true;

		try {
			if (this.isPlaying) {
				this.stopPlayback();
			} else {
				await this.startPlayback();
			}
		} catch {
			this.stopPlayback();
		} finally {
			this.playButton.disabled = false;
			this.isBusy = false;
		}
	}

	private readonly onTempoInput = (): void => {
		this.tempoPercentage = clampTempoPercentage(
			Number(this.tempoInput.value),
		);
		this.updateTempoLabel();

		if (this.isPlaying) {
			this.stopPlayback();
		}

		this.isPrepared = false;
	};

	setTune(
		tune: TuneObject,
		transposeSemitones = this.transposeSemitones,
	): void {
		if (this.isPlaying) {
			this.stopPlayback();
		}

		this.tune = tune;
		this.transposeSemitones = clampTransposeSemitones(transposeSemitones);
		this.isPrepared = false;
	}

	setStartChar(startChar: number | null): void {
		this.startChar = startChar;
	}

	onunload(): void {
		this.stopPlayback();
		this.playButton.removeEventListener("click", this.onToggleClick);
		this.tempoInput.removeEventListener("input", this.onTempoInput);
	}
}
