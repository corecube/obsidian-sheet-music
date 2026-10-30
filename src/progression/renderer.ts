import { renderAbc } from "abcjs";
import type { TuneObject } from "abcjs";
import { MarkdownRenderChild, Plugin, TFile, setIcon, type MarkdownPostProcessorContext } from "obsidian";
import type SheetMusicPlugin from "../main";
import { AbcPlaybackController, renderPlaybackControls } from "../abc";
import { transposeBlockInNote } from "../chords/chord-chips-logic";
import { clampNumber } from "../utils/clamp";
import { progressionEditorHighlight } from "./editor-highlight";
import { DEFAULT_METER, beatGrid, beatSubdivision, parseProgression, type ProgressionModel } from "./renderer-logic";
import { buildProgressionAbc } from "./score-abc";
import { transposeProgressionSource } from "./transpose-logic";

/** Render "V65/V" as V<sup>65</sup>/V — digit runs become superscripts. */
function renderNumeral(el: HTMLElement, numeral: string): void {
	const parts = numeral.split(/(\d+)/);
	for (const part of parts) {
		if (part.length === 0) continue;
		if (/^\d+$/.test(part)) el.createEl("sup", { text: part });
		else el.appendText(part);
	}
}

function renderCell(tr: HTMLElement, item: ProgressionModel["rows"][number][number], span: number, beat: number, metered: boolean): void {
	const cell = tr.createEl("td", { cls: "progression-cell" });
	if (span > 1) cell.setAttr("colspan", String(span));
	if (item.fn) {
		cell.addClass(`progression-fn-${item.fn}`);
	}
	cell.setAttr(
		"title",
		[item.fn, item.pivot ? `pivot chord, ${item.pivot.fn ?? "same chord"} in ${item.pivot.key}` : null, metered ? `beat ${beat}` : null]
			.filter(Boolean)
			.join(", "),
	);
	const numeralEl = cell.createDiv({ cls: "progression-numeral" });
	if (item.keyChange) {
		numeralEl.createEl("span", { cls: "progression-key", text: item.keyChange + " " });
	}
	renderNumeral(numeralEl, item.numeral);
	if (item.pivot) {
		cell.addClass("progression-cell-pivot");
		numeralEl.createEl("span", { cls: "progression-pivot", text: " = " });
		numeralEl.createEl("span", { cls: "progression-key", text: item.pivot.key + " " });
		renderNumeral(numeralEl, item.pivot.numeral);
	}
	// A slash chord may break after the slash on narrow screens.
	const chordEl = cell.createDiv({ cls: "progression-chord" });
	const slash = item.chord.indexOf("/");
	if (slash > 0) {
		chordEl.appendText(item.chord.slice(0, slash + 1));
		chordEl.createEl("wbr");
		chordEl.appendText(item.chord.slice(slash + 1));
	} else {
		chordEl.setText(item.chord);
	}
}

function renderTable(el: HTMLElement, model: ProgressionModel): void {
	const sub = model.metered ? beatSubdivision(model) : 1;
	const grids = model.rows.map((row, i) => beatGrid(row, model.rowMeters[i] ?? DEFAULT_METER, sub));
	const columns = Math.max(
		0,
		...grids.map((cells, i) => {
			const used = cells.reduce((sum, c) => sum + c.span, 0);
			const beats = model.metered ? (model.rowMeters[i]?.beats ?? 0) * sub : 0;
			return Math.max(used, beats);
		}),
	);

	const table = el.createEl("table", { cls: "progression-table" });
	if (model.metered) {
		table.addClass("is-metered");
		const colgroup = table.createEl("colgroup");
		colgroup.createEl("col", { cls: "progression-col-measure" });
		for (let i = 0; i < columns; i++) colgroup.createEl("col", { cls: "progression-col-beat" });
	}
	const body = table.createEl("tbody");

	model.rows.forEach((row, index) => {
		const tr = body.createEl("tr");
		tr.createEl("th", {
			cls: "progression-measure",
			text: model.rowLabels[index] ?? String(index + 1),
			attr: { scope: "row" },
		});

		let used = 0;
		for (const cell of grids[index] ?? []) {
			used += cell.span;
			if (!cell.item) {
				const gap = tr.createEl("td", { cls: "progression-cell progression-cell-empty" });
				if (cell.span > 1) gap.setAttr("colspan", String(cell.span));
				continue;
			}
			renderCell(tr, cell.item, cell.span, cell.beat, model.metered);
		}
		if (used < columns) {
			const pad = tr.createEl("td", { cls: "progression-cell progression-cell-empty" });
			if (columns - used > 1) pad.setAttr("colspan", String(columns - used));
		}
	});
}

/** Owns the score DOM and its playback controller so toggling and unloading clean up together. */
class ProgressionScore extends MarkdownRenderChild {
	private playback: AbcPlaybackController | null = null;

	constructor(
		private readonly blockEl: HTMLElement,
		private readonly scoreEl: HTMLElement,
		private readonly controls: ReturnType<typeof renderPlaybackControls>,
		private readonly abc: string,
		private readonly plugin: SheetMusicPlugin,
	) {
		super(scoreEl);
	}

	show(): void {
		const abcSettings = this.plugin.settings.packages.abc;
		this.scoreEl.empty();
		this.scoreEl.removeAttribute("style");
		this.scoreEl.removeClass("progression-error");

		let tune: TuneObject | undefined;
		try {
			[tune] = renderAbc(this.scoreEl, this.abc, {
				add_classes: true,
				responsive: "resize",
				scale: clampNumber(abcSettings.scale, 1, 0.5, 2),
				staffwidth: clampNumber(abcSettings.staffWidth, 740, 240, 2400),
				paddingtop: 0,
				paddingbottom: 0,
			});
		} catch {
			tune = undefined;
		}

		if (!tune) {
			this.scoreEl.empty();
			this.scoreEl.createEl("p", { cls: "progression-error", text: "Could not render score" });
			this.controls.controlsRow.hide();
			return;
		}

		this.controls.controlsRow.show();
		this.playback = new AbcPlaybackController(
			this.blockEl,
			this.scoreEl,
			tune,
			this.controls.playButton,
			this.controls.tempoInput,
			this.controls.tempoValue,
			abcSettings.instrument,
		);
		this.addChild(this.playback);
	}

	hide(): void {
		if (this.playback) {
			this.removeChild(this.playback);
			this.playback = null;
		}
		this.scoreEl.empty();
		// abcjs's responsive mode leaves inline display/padding-bottom styles that keep the height
		this.scoreEl.removeAttribute("style");
		this.controls.controlsRow.hide();
	}
}

/** Rewrites the block's key and chord names in the note; works in reading view and on mobile. */
async function transposeBlock(
	plugin: SheetMusicPlugin,
	ctx: MarkdownPostProcessorContext,
	el: HTMLElement,
	semitones: number,
): Promise<void> {
	const info = ctx.getSectionInfo(el);
	const file = plugin.app.vault.getAbstractFileByPath(ctx.sourcePath);
	if (!info || !(file instanceof TFile)) return;
	await plugin.app.vault.process(file, (content) =>
		transposeBlockInNote(content, info.lineStart, info.lineEnd, semitones, transposeProgressionSource),
	);
}

function renderTransposeChips(
	row: HTMLElement,
	onTranspose: (semitones: number) => void,
): void {
	const add = (semitones: number, icon: string, label: string) => {
		const chip = row.createEl("button", {
			cls: "progression-chip progression-chip-transpose",
			attr: { type: "button", "aria-label": label },
		});
		setIcon(chip.createSpan({ cls: "progression-chip-icon" }), icon);
		chip.addEventListener("click", () => onTranspose(semitones));
	};
	add(-1, "minus", "Transpose down a semitone");
	add(1, "plus", "Transpose up a semitone");
}

export function registerProgressionPackage(plugin: Plugin): void {
	const sheetMusicPlugin = plugin as SheetMusicPlugin;
	plugin.registerEditorExtension(progressionEditorHighlight());

	plugin.registerMarkdownCodeBlockProcessor("progression", (source, el, ctx) => {
		const model = parseProgression(source);
		if (!model) {
			el.createEl("p", {
				cls: "progression-error",
				text: "Add a key as the first line or as an inline key token",
			});
			return;
		}

		el.addClass("progression-block");

		const controlsRow = el.createDiv({ cls: "progression-controls" });
		controlsRow.createEl("span", { cls: "progression-key-line", text: model.key, attr: { title: "Key" } });
		if (model.metered) {
			const meter = model.rowMeters[0];
			if (meter) {
				controlsRow.createEl("span", {
					cls: "progression-meter",
					text: `${meter.beats}/${meter.unit}`,
					attr: { title: "Time signature" },
				});
			}
		}
		renderTransposeChips(controlsRow, (semitones) => void transposeBlock(sheetMusicPlugin, ctx, el, semitones));
		const scoreChip = controlsRow.createEl("button", {
			cls: "progression-chip",
			text: "Score",
			attr: { type: "button", "aria-pressed": "false" },
		});
		const playbackControls = renderPlaybackControls(controlsRow);

		renderTable(el, model);

		const scoreEl = el.createDiv({ cls: "progression-score" });
		const score = new ProgressionScore(el, scoreEl, playbackControls, buildProgressionAbc(model), sheetMusicPlugin);
		ctx.addChild(score);

		let visible = false;
		const setVisible = (next: boolean) => {
			visible = next;
			scoreChip.toggleClass("is-active", next);
			scoreChip.setAttr("aria-pressed", String(next));
			if (next) score.show();
			else score.hide();
		};
		scoreChip.addEventListener("click", () => setVisible(!visible));

		setVisible(sheetMusicPlugin.settings.packages.progression.showScore);
	});
}
