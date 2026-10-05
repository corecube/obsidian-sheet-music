import { setIcon } from "obsidian";
import type { ChordChipsModel } from "./chord-chips-logic";
import {
	type FrettedInstrument,
	lookupFrettedChord,
	STRING_COUNT,
} from "./guitar-chord";
import { renderGuitarDiagram } from "./guitar-diagram";
import { lookupPianoChord } from "./piano-chord";
import { renderPianoDiagram } from "./piano-diagram";

export type ChordInstrument = FrettedInstrument | "piano";

const INSTRUMENTS: readonly ChordInstrument[] = ["guitar", "ukulele", "piano"];

export interface ChordChipsOptions {
	/** Instruments whose diagram panel should be open right away. */
	open: ReadonlySet<ChordInstrument>;
	/** Called whenever a panel is opened or closed. */
	onChange: (open: ReadonlySet<ChordInstrument>) => void;
	/** Called for the −/+ chips. */
	onTranspose: (semitones: number) => void;
}

/**
 * Two slim rows at the top of a chords block: −/+ transpose chips on the
 * first, one chip per instrument on the second. Tapping "Guitar", "Ukulele" or "Piano" shows the
 * diagrams of every chord in the block for that instrument right below the
 * row; tapping again hides them. Several panels can be open at once.
 *
 * Diagrams are drawn only on demand, i.e. while the block is visible, so
 * svguitar's text measurement never runs inside a hidden subtree.
 */
export function renderChordChips(
	container: HTMLElement,
	model: ChordChipsModel,
	options: ChordChipsOptions,
): void {
	if (model.names.length === 0) return;

	const transposeRow = container.createDiv({
		cls: "chords-chips chords-chips-transpose",
	});
	const row = container.createDiv({
		cls: "chords-chips chords-chips-instruments",
	});

	const addTransposeChip = (semitones: number, icon: string, label: string) => {
		const chip = transposeRow.createEl("button", {
			cls: "chords-chip chords-chip-transpose",
			attr: { "aria-label": label },
		});
		setIcon(chip.createSpan({ cls: "chords-chip-icon" }), icon);
		chip.addEventListener("click", () => options.onTranspose(semitones));
	};
	addTransposeChip(-1, "minus", "Transpose down a semitone");
	addTransposeChip(1, "plus", "Transpose up a semitone");

	const open = new Set<ChordInstrument>(options.open);
	const panels = new Map<ChordInstrument, HTMLElement>();
	const chips = new Map<ChordInstrument, HTMLElement>();

	const apply = (instrument: ChordInstrument): void => {
		const isOpen = open.has(instrument);
		const panel = panels.get(instrument);
		const chip = chips.get(instrument);
		if (!panel || !chip) return;
		chip.toggleClass("is-active", isOpen);
		chip.setAttribute("aria-expanded", String(isOpen));
		panel.empty();
		panel.toggleClass("is-hidden", !isOpen);
		if (isOpen) renderPanel(panel, model, instrument);
	};

	const addChip = (
		instrument: ChordInstrument,
		icon: string,
		label: string,
	): void => {
		const chip = row.createEl("button", {
			cls: "chords-chip chords-chip-instrument",
			attr: { "aria-label": `Show ${label.toLowerCase()} diagrams` },
		});
		const iconEl = chip.createSpan({ cls: "chords-chip-icon" });
		setIcon(iconEl, icon);
		chip.createSpan({ text: label });
		chip.addEventListener("click", () => {
			if (open.has(instrument)) open.delete(instrument);
			else open.add(instrument);
			apply(instrument);
			options.onChange(new Set(open));
		});
		chips.set(instrument, chip);
	};
	addChip("guitar", "guitar", "Guitar");
	// Lucide has no ukulele icon; the guitar silhouette is the closest match.
	addChip("ukulele", "guitar", "Ukulele");
	addChip("piano", "piano", "Piano");

	for (const instrument of INSTRUMENTS) {
		panels.set(
			instrument,
			container.createDiv({
				cls: `chords-chip-panel chords-chip-panel-${instrument} is-hidden`,
			}),
		);
		apply(instrument);
	}
}

function renderPanel(
	panel: HTMLElement,
	model: ChordChipsModel,
	instrument: ChordInstrument,
): void {
	for (const name of model.names) {
		const group = panel.createDiv({ cls: "chords-notation-diagram-group" });
		const numeral = model.numerals.get(name);

		if (instrument !== "piano") {
			if (numeral) {
				group.createSpan({ cls: "chords-diagram-numeral", text: numeral });
			}
			const chord =
				model.customDefs[instrument].get(name) ??
				lookupFrettedChord(name, instrument);
			// svguitar draws the chord name as the diagram title already.
			if (chord) {
				renderGuitarDiagram(group, chord, STRING_COUNT[instrument]);
			} else {
				group.createSpan({ cls: "chords-diagram-name", text: name });
			}
			continue;
		}

		const label = group.createDiv({ cls: "chords-diagram-label" });
		label.createSpan({ cls: "chords-diagram-name", text: name });
		if (numeral) {
			label.createSpan({ cls: "chords-diagram-numeral", text: numeral });
		}
		const chord = lookupPianoChord(name);
		if (chord) renderPianoDiagram(group, chord);
	}
}
