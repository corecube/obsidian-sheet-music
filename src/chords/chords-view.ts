import {
	FileView,
	ItemView,
	MarkdownView,
	Plugin,
	TFile,
	type WorkspaceLeaf,
} from "obsidian";
import { Progression } from "tonal";
import type { Chord } from "svguitar";
import { collectNoteChords, transposeNoteChords } from "./chords-view-logic";
import { lookupChord } from "./guitar-chord";
import { renderGuitarDiagram } from "./guitar-diagram";
import { lookupPianoChord } from "./piano-chord";
import { renderPianoDiagram } from "./piano-diagram";

export const CHORDS_VIEW_TYPE = "sheet-music-chords";

/**
 * Right-pane view listing the chords of the active note with guitar and
 * piano diagrams, plus transpose controls that rewrite every chords block
 * in that note.
 */
export class ChordsView extends ItemView {
	private file: TFile | null = null;
	private titleEl!: HTMLElement;
	private diagramsEl!: HTMLElement;
	private emptyEl!: HTMLElement;
	private controlsEl!: HTMLElement;
	private refreshToken = 0;
	/**
	 * True when the diagrams were last drawn while the pane was not shown
	 * (collapsed sidebar, closed mobile drawer, inactive tab). svguitar
	 * measures text with getBBox(), which yields 0 in a display:none
	 * subtree, so such a render has the chord name overlapping the frets
	 * and must be redone once the pane is visible.
	 */
	private renderedHidden = false;

	constructor(
		leaf: WorkspaceLeaf,
		private readonly plugin: Plugin,
	) {
		super(leaf);
	}

	getViewType(): string {
		return CHORDS_VIEW_TYPE;
	}

	getDisplayText(): string {
		return "Chords";
	}

	getIcon(): string {
		return "guitar";
	}

	async onOpen(): Promise<void> {
		// Only one chords pane is useful. If Obsidian restored several
		// (e.g. duplicates from earlier builds), keep the first and close
		// the rest once the layout has settled.
		const leaves = this.app.workspace.getLeavesOfType(CHORDS_VIEW_TYPE);
		if (leaves.length > 1 && leaves[0] !== this.leaf) {
			window.setTimeout(() => this.leaf.detach(), 0);
			return;
		}

		// `onOpen` may run again on the same instance; never stack DOM.
		this.contentEl.empty();
		this.contentEl.addClass("chords-view");

		this.titleEl = this.contentEl.createDiv({ cls: "chords-view-title" });

		this.controlsEl = this.contentEl.createDiv({
			cls: "chords-notation-controls chords-view-controls",
		});
		this.controlsEl.createSpan({
			cls: "chords-transpose-label",
			text: "Transpose",
		});
		const btnDown = this.controlsEl.createEl("button", {
			cls: "chords-transpose-btn",
			text: "−1",
			attr: { "aria-label": "Transpose all chords down a semitone" },
		});
		const btnUp = this.controlsEl.createEl("button", {
			cls: "chords-transpose-btn",
			text: "+1",
			attr: { "aria-label": "Transpose all chords up a semitone" },
		});
		btnDown.addEventListener("click", () => void this.transpose(-1));
		btnUp.addEventListener("click", () => void this.transpose(1));

		this.diagramsEl = this.contentEl.createDiv({
			cls: "chords-notation-diagrams chords-view-diagrams",
		});
		this.emptyEl = this.contentEl.createDiv({
			cls: "chords-view-empty",
			text: "No chords block in the active note.",
		});

		this.registerEvent(
			this.app.workspace.on("active-leaf-change", (leaf) => {
				if (leaf?.view instanceof MarkdownView && leaf.view.file) {
					this.setFile(leaf.view.file);
				} else if (leaf === this.leaf) {
					this.redrawIfShown();
				}
			}),
		);
		this.registerEvent(
			this.app.workspace.on("layout-change", () => this.redrawIfShown()),
		);
		this.registerEvent(
			this.app.workspace.on("file-open", (file) => {
				if (file) this.setFile(file);
			}),
		);
		this.registerEvent(
			this.app.metadataCache.on("changed", (file) => {
				if (this.file && file.path === this.file.path) {
					void this.refresh();
				}
			}),
		);
		this.registerEvent(
			this.app.vault.on("delete", (file) => {
				if (this.file && file.path === this.file.path) {
					this.setFile(null);
				}
			}),
		);

		// At startup the layout may still be loading; resolve once it is
		// ready (runs immediately if it already is).
		this.app.workspace.onLayoutReady(() => {
			this.setFile(this.resolveActiveFile());
		});
	}

	/**
	 * The note this pane should follow. When the pane is opened from the
	 * ribbon or loaded lazily from a sidebar tab, the pane's own leaf is
	 * the active one, so `getActiveFile()` returns null. Fall back to the
	 * most recently used leaf of the main area, then to the recent-files
	 * list.
	 */
	private resolveActiveFile(): TFile | null {
		const ws = this.app.workspace;
		const active = ws.getActiveViewOfType(MarkdownView);
		if (active?.file) return active.file;

		const recent = ws.getMostRecentLeaf();
		if (recent) {
			const view = recent.view;
			if (view instanceof FileView && view.file) return view.file;
			// Deferred leaf: the file is only known via its view state.
			const state = recent.getViewState();
			const path = state.state?.["file"];
			if (state.type === "markdown" && typeof path === "string") {
				const file = this.app.vault.getAbstractFileByPath(path);
				if (file instanceof TFile) return file;
			}
		}

		const current = ws.getActiveFile();
		if (current) return current;

		for (const path of ws.getLastOpenFiles()) {
			const file = this.app.vault.getAbstractFileByPath(path);
			if (file instanceof TFile) return file;
		}
		return null;
	}

	/** Obsidian calls this when the pane is resized or its tab is shown. */
	onResize(): void {
		this.redrawIfShown();
	}

	private redrawIfShown(): void {
		if (this.renderedHidden && this.containerEl.isShown()) {
			void this.refresh();
		}
	}

	private setFile(file: TFile | null): void {
		this.file = file;
		void this.refresh();
	}

	private async refresh(): Promise<void> {
		const token = ++this.refreshToken;
		const file = this.file;
		let markdown = "";
		if (file) {
			try {
				markdown = await this.app.vault.cachedRead(file);
			} catch {
				markdown = "";
			}
		}
		// A newer refresh started while reading; let it win.
		if (token !== this.refreshToken) return;

		const { names, customDefs } = collectNoteChords(markdown);
		const key = this.frontmatterKey(file);

		this.titleEl.setText(file ? file.basename : "");
		this.diagramsEl.empty();
		const hasChords = names.length > 0;
		this.controlsEl.toggleClass("is-hidden", !hasChords);
		this.diagramsEl.toggleClass("is-hidden", !hasChords);
		this.emptyEl.toggleClass("is-hidden", hasChords);
		if (!hasChords) {
			this.renderedHidden = false;
			return;
		}

		for (const name of names) {
			this.renderDiagram(this.diagramsEl, name, customDefs, key);
		}
		this.renderedHidden = !this.containerEl.isShown();
	}

	private frontmatterKey(file: TFile | null): string {
		if (!file) return "";
		const fm = this.app.metadataCache.getFileCache(file)?.frontmatter as
			| Record<string, unknown>
			| undefined;
		const key = fm?.["key"];
		return typeof key === "string" ? key : "";
	}

	private renderDiagram(
		container: HTMLElement,
		name: string,
		customDefs: Map<string, Chord>,
		key: string,
	): void {
		const group = container.createDiv({
			cls: "chords-notation-diagram-group",
		});

		if (key) {
			const tonicRoot = key.endsWith("m") ? key.slice(0, -1) : key;
			const numeral = Progression.toRomanNumerals(tonicRoot, [name])[0];
			if (numeral && numeral !== name) {
				group.createSpan({ cls: "chords-diagram-numeral", text: numeral });
			}
		}

		const guitar = customDefs.get(name) ?? lookupChord(name);
		if (guitar) renderGuitarDiagram(group, guitar);

		const piano = lookupPianoChord(name);
		if (piano) renderPianoDiagram(group, piano);
	}

	async onClose(): Promise<void> {
		this.refreshToken++;
		this.contentEl.empty();
	}

	private async transpose(semitones: number): Promise<void> {
		const file = this.file;
		if (!file) return;
		await this.app.vault.process(file, (current) =>
			transposeNoteChords(current, semitones),
		);
		await this.refresh();
	}
}

/** Reveal the chords pane, creating it in the right sidebar if needed. */
export async function openChordsView(plugin: Plugin): Promise<void> {
	await plugin.app.workspace.ensureSideLeaf(CHORDS_VIEW_TYPE, "right", {
		reveal: true,
		active: true,
	});
}

/**
 * Make sure a Chords tab exists in the right sidebar without revealing or
 * focusing it. Without this the pane only ever appears after the user finds
 * the ribbon icon or command, which on phones is hidden in the left drawer;
 * a saved layout from before the pane existed never contains it either.
 */
export function ensureChordsView(plugin: Plugin): void {
	plugin.app.workspace.onLayoutReady(() => {
		const ws = plugin.app.workspace;
		if (ws.getLeavesOfType(CHORDS_VIEW_TYPE).length > 0) return;
		void ws.ensureSideLeaf(CHORDS_VIEW_TYPE, "right", {
			reveal: false,
			active: false,
		});
	});
}
