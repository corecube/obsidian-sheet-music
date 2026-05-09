import { renderAbc } from "abcjs";
import type { TuneObject } from "abcjs";
import { MarkdownRenderChild, Plugin } from "obsidian";
import type SheetMusicPlugin from "../main";
import { clampTransposeSemitones } from "../utils/clamp";
import { AbcPlaybackController } from "./playback";
import { buildAbcRenderOptions, parseAbcBlock } from "./renderer-logic";

function renderInvalidAbcBlock(el: HTMLElement): void {
	el.createEl("p", {
		text: "Invalid notation block. Add a valid abc block with a key line.",
		cls: "abc-notation-error",
	});
}

function renderCustomOptionsError(el: HTMLElement, errorMessage: string): void {
	el.createEl("div", {
		cls: "abc-notation-options-error",
		text: `Custom ABC options error: ${errorMessage}`,
	});
}

function renderAbcControls(el: HTMLElement): {
	controlsRow: HTMLElement;
	playButton: HTMLButtonElement;
	tempoInput: HTMLInputElement;
	tempoValue: HTMLElement;
	transposeDownButton: HTMLButtonElement;
	transposeUpButton: HTMLButtonElement;
	transposeResetButton: HTMLButtonElement;
	transposeValue: HTMLElement;
} {
	const controlsRow = el.createDiv({ cls: "abc-notation-controls" });
	const playButton = controlsRow.createEl("button", {
		cls: "abc-notation-play-button",
		attr: { type: "button" },
	});

	const tempoWrap = controlsRow.createDiv({ cls: "abc-notation-tempo" });
	tempoWrap.createSpan();
	const tempoInput = tempoWrap.createEl("input", {
		cls: "abc-notation-tempo-input",
		attr: {
			type: "range",
			min: "10",
			max: "100",
			step: "1",
			value: "100",
		},
	});
	const tempoValue = tempoWrap.createSpan({
		cls: "abc-notation-tempo-value",
		text: "100%",
	});

	const transposeWrap = controlsRow.createDiv({
		cls: "abc-notation-transpose",
	});
	transposeWrap.createSpan();
	const transposeDownButton = transposeWrap.createEl("button", {
		cls: "abc-notation-transpose-stepper",
		text: "-",
		attr: {
			type: "button",
			"aria-label": "Transpose down",
		},
	});
	const transposeValue = transposeWrap.createSpan({
		cls: "abc-notation-transpose-value",
		text: "+0",
	});
	const transposeUpButton = transposeWrap.createEl("button", {
		cls: "abc-notation-transpose-stepper",
		text: "+",
		attr: {
			type: "button",
			"aria-label": "Transpose up",
		},
	});
	const transposeResetButton = transposeWrap.createEl("button", {
		cls: "abc-notation-transpose-reset",
		text: "R",
		attr: {
			type: "button",
			"aria-label": "Reset transpose",
		},
	});

	return {
		controlsRow,
		playButton,
		tempoInput,
		tempoValue,
		transposeDownButton,
		transposeUpButton,
		transposeResetButton,
		transposeValue,
	};
}

function formatTransposeValue(steps: number): string {
	return `${steps >= 0 ? "+" : ""}${steps}`;
}


class ClickListenerCleanupChild extends MarkdownRenderChild {
	constructor(
		containerEl: HTMLElement,
		private readonly button: HTMLButtonElement,
		private readonly callback: () => void,
	) {
		super(containerEl);
	}

	onunload(): void {
		this.button.removeEventListener("click", this.callback);
	}
}

export function registerAbcPackage(plugin: Plugin): void {
	plugin.registerMarkdownCodeBlockProcessor("abc", (source, el, ctx) => {
		const model = parseAbcBlock(source);
		if (!model) {
			renderInvalidAbcBlock(el);
			return;
		}

		const abcPlugin = plugin as SheetMusicPlugin;
		if (model.customRenderOptionsError) {
			renderCustomOptionsError(el, model.customRenderOptionsError);
		}
		const {
			controlsRow,
			playButton,
			tempoInput,
			tempoValue,
			transposeDownButton,
			transposeUpButton,
			transposeResetButton,
			transposeValue,
		} = renderAbcControls(el);
		const notationEl = el.createDiv({ cls: "abc-notation-sheet" });
		el.addClass("abc-notation-block");
		let playback: AbcPlaybackController | null = null;
		let transposeSteps = 0;
		let selectedStartChar: number | null = null;

		const syncSelectedStartWithPlayback = (): void => {
			if (!playback) {
				return;
			}

			playback.setStartChar(selectedStartChar);
		};

		const onSelectNoteStart = (startChar: number | null): void => {
			selectedStartChar = startChar;
			syncSelectedStartWithPlayback();
		};

		const onAbcClick = (abcElem: { startChar?: number }): void => {
			onSelectNoteStart(
				typeof abcElem.startChar === "number"
					? abcElem.startChar
					: null,
			);
		};

		const renderTune = (): TuneObject => {
			notationEl.empty();
			const [tune] = renderAbc(
				notationEl,
				model.source,
				buildAbcRenderOptions(
					abcPlugin.settings.packages.abc,
					model.ariaLabel,
					transposeSteps,
					onAbcClick,
					model.customRenderOptions,
				),
			);

			return tune;
		};

		const applyTranspose = (nextSteps: number): void => {
			transposeSteps = clampTransposeSemitones(nextSteps);
			transposeValue.setText(formatTransposeValue(transposeSteps));

			try {
				const tune = renderTune();
				playback?.setTune(tune, transposeSteps);
			} catch {
				controlsRow.remove();
				notationEl.remove();
				renderInvalidAbcBlock(el);
			}
		};

		const onTransposeDown = (): void => {
			applyTranspose(transposeSteps - 1);
		};

		const onTransposeUp = (): void => {
			applyTranspose(transposeSteps + 1);
		};

		const onTransposeReset = (): void => {
			applyTranspose(0);
		};

		transposeDownButton.addEventListener("click", onTransposeDown);
		transposeUpButton.addEventListener("click", onTransposeUp);
		transposeResetButton.addEventListener("click", onTransposeReset);
		ctx.addChild(
			new ClickListenerCleanupChild(
				el,
				transposeDownButton,
				onTransposeDown,
			),
		);
		ctx.addChild(
			new ClickListenerCleanupChild(el, transposeUpButton, onTransposeUp),
		);
		ctx.addChild(
			new ClickListenerCleanupChild(
				el,
				transposeResetButton,
				onTransposeReset,
			),
		);

		try {
			const tune = renderTune();

			playback = new AbcPlaybackController(
				el,
				notationEl,
				tune,
				playButton,
				tempoInput,
				tempoValue,
				abcPlugin.settings.packages.abc.instrument,
			);
			playback.setTune(tune, transposeSteps);
			syncSelectedStartWithPlayback();
			ctx.addChild(playback);
			transposeValue.setText(formatTransposeValue(transposeSteps));
		} catch {
			controlsRow.remove();
			notationEl.remove();
			renderInvalidAbcBlock(el);
		}
	});
}
