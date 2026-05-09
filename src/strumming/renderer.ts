import { Plugin, setIcon } from "obsidian";
import { Animation } from "./animation";
import { StrummingBlockModel, StrummingParser } from "./renderer-logic";

const parser = new StrummingParser();

function renderInvalidStrummingBlock(el: HTMLElement): void {
	el.createEl("p", {
		text: "Invalid strumming block",
		cls: "strumming-error",
	});
}

function renderStrokeRows(
	el: HTMLElement,
	model: StrummingBlockModel,
): HTMLElement[] {
	const rows = el.createDiv({ cls: "strumming-rows" });
	const strokeRow = rows.createDiv({ cls: "strumming-row" });
	const timingRow = rows.createDiv({ cls: "strumming-row" });
	const strokeCells: HTMLElement[] = [];
	const rowItems = model.getStrokeRowItems();
	rows.style.setProperty("--strumming-column-count", String(rowItems.length));

	rowItems.forEach((item) => {
		const strokeCell = strokeRow.createSpan({ cls: "strumming-cell" });
		if (item.icon === null) {
			strokeCell.setText("?");
		} else {
			setIcon(strokeCell, item.icon);
		}
		strokeCells.push(strokeCell);

		timingRow.createSpan({
			cls: "strumming-cell",
			text: item.timing,
		});
	});

	const chordRows = model.getChordRows();
	chordRows.forEach((chordRow) => {
		const chordLine = rows.createDiv({
			cls: "strumming-row strumming-chord-row",
		});

		chordRow.forEach((chord) => {
			chordLine.createSpan({
				cls: "strumming-cell",
				text: chord,
			});
		});
	});

	return strokeCells;
}

function renderControlsRow(
	el: HTMLElement,
	model: StrummingBlockModel,
): {
	playButton: HTMLButtonElement;
	speedInput: HTMLInputElement;
} {
	const controlsRow = el.createDiv({ cls: "strumming-controls" });
	const playButton = controlsRow.createEl("button", {
		cls: "strumming-play-button",
		attr: { type: "button" },
	});
	setIcon(playButton, "play");

	const metadata = controlsRow.createSpan();
	metadata.setText(model.metadataText);

	const speedControl = controlsRow.createDiv({ cls: "strumming-speed" });

	const speedInput = speedControl.createEl("input", {
		cls: "strumming-speed-input",
		attr: {
			type: "range",
			min: "0",
			max: "100",
			step: "1",
			value: "100",
		},
	});

	const speedValue = speedControl.createSpan({
		cls: "strumming-speed-value",
		text: "100%",
	});

	speedInput.addEventListener("input", () => {
		speedValue.setText(`${speedInput.value}%`);
	});

	return { playButton, speedInput };
}

export function registerStrummingPackage(plugin: Plugin): void {
	plugin.registerMarkdownCodeBlockProcessor(
		"strumming",
		(source, el, ctx) => {
			const model = parser.parse(source);
			if (!model) {
				renderInvalidStrummingBlock(el);
				return;
			}

			el.addClass("strumming-block");

			const { playButton, speedInput } = renderControlsRow(el, model);
			const strokeCells = renderStrokeRows(el, model);
			const animation = new Animation(
				el,
				playButton,
				strokeCells,
				model.strokes,
				model.stepDurationMs,
				100,
			);

			speedInput.addEventListener("input", () => {
				animation.setSpeedPercentage(Number(speedInput.value));
			});

			ctx.addChild(animation);
		},
	);
}