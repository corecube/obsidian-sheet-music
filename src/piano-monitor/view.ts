import { renderAbc } from "abcjs";
import { ItemView, WorkspaceLeaf } from "obsidian";
import { Chord, Key, Note, Scale, ScaleType } from "tonal";
import { MidiListener } from "../midi-capture/midi-listener";
import { ABC_KEYS, KeyName, midiNoteToAbcPitch } from "../midi-capture/note-to-abc";

export const PIANO_MONITOR_VIEW_TYPE = "piano-monitor";

function buildLiveAbcSnapshot(heldNotes: Set<number>, key: KeyName): string {
	const treble = [...heldNotes].filter((n) => n >= 60).sort((a, b) => a - b);
	const bass = [...heldNotes].filter((n) => n < 60).sort((a, b) => a - b);
	const header = `X:1\nM:none\nL:1/4\nK:${key}`;

	const fmt = (notes: number[]): string => {
		if (notes.length === 0) return "z4";
		if (notes.length === 1) return midiNoteToAbcPitch(notes[0]!, key) + "4";
		return `[${notes.map((n) => midiNoteToAbcPitch(n, key)).join("")}]4`;
	};

	return `${header}\n%%staves {V1 V2}\nV:V1 clef=treble\n${fmt(treble)} |]\nV:V2 clef=bass\n${fmt(bass)} |]`;
}

export class PianoMonitorView extends ItemView {
	private heldNotes = new Set<number>();
	private midiListener: MidiListener | null = null;
	private staffEl!: HTMLElement;
	private chordNameEl!: HTMLElement;
	private statusEl!: HTMLElement;

	private selectedKey: KeyName = "C";
	private keyQuality: "major" | "minor" = "major";
	private scaleRoot: KeyName = "C";
	private scaleType = "major";

	constructor(leaf: WorkspaceLeaf) {
		super(leaf);
	}

	getViewType(): string {
		return PIANO_MONITOR_VIEW_TYPE;
	}

	getDisplayText(): string {
		return "Piano monitor";
	}

	getIcon(): string {
		return "music";
	}

	async onOpen(): Promise<void> {
		this.contentEl.addClass("piano-monitor-view");
		this.buildLiveSection();
		this.buildKeyReferenceSection();
		this.buildScaleBrowserSection();
		this.renderStaff();
		await this.connectMidi();
	}

	async onClose(): Promise<void> {
		this.midiListener?.stop();
		this.midiListener = null;
	}

	private buildLiveSection(): void {
		const s = this.contentEl.createDiv({ cls: "piano-monitor-section" });
		s.createEl("p", { cls: "piano-monitor-heading", text: "Live" });
		this.staffEl = s.createDiv({ cls: "piano-monitor-staff" });
		this.chordNameEl = s.createDiv({ cls: "piano-monitor-chord" });
		this.statusEl = s.createDiv({ cls: "piano-monitor-status" });
	}

	private renderStaff(): void {
		this.staffEl.empty();
		renderAbc(this.staffEl, buildLiveAbcSnapshot(this.heldNotes, this.selectedKey), {
			add_classes: true,
			responsive: "resize",
			scale: 0.9,
			staffwidth: 220,
		});
	}

	private updateDisplay(): void {
		this.renderStaff();

		if (this.heldNotes.size === 0) {
			this.chordNameEl.textContent = "";
			return;
		}
		const pitchClasses = [...this.heldNotes].map((n) =>
			Note.pitchClass(Note.fromMidi(n)),
		);
		const detected = Chord.detect(pitchClasses);
		this.chordNameEl.textContent = detected[0] ?? "";
	}

	private buildKeyReferenceSection(): void {
		const s = this.contentEl.createDiv({ cls: "piano-monitor-section" });
		s.createEl("p", { cls: "piano-monitor-heading", text: "Key reference" });

		const controls = s.createDiv({ cls: "piano-monitor-controls" });
		const rootSel = this.makeSelect(controls, [...ABC_KEYS]);
		const qualSel = this.makeSelect(controls, ["Major", "Minor"]);

		const table = s.createEl("table", { cls: "piano-monitor-key-table" });

		const render = (): void => {
			table.empty();
			const kd =
				this.keyQuality === "major"
					? Key.majorKey(this.selectedKey)
					: Key.minorKey(this.selectedKey).natural;
			(kd.grades as string[]).forEach((grade: string, i: number) => {
				const tr = table.createEl("tr");
				tr.createEl("td", { text: grade, cls: "piano-monitor-numeral" });
				tr.createEl("td", { text: (kd.chords as string[])[i] ?? "" });
			});
		};

		rootSel.addEventListener("change", () => {
			this.selectedKey = rootSel.value as KeyName;
			render();
			this.updateDisplay();
		});
		qualSel.addEventListener("change", () => {
			this.keyQuality = qualSel.value.toLowerCase() as "major" | "minor";
			render();
		});
		render();
	}

	private buildScaleBrowserSection(): void {
		const s = this.contentEl.createDiv({ cls: "piano-monitor-section" });
		s.createEl("p", { cls: "piano-monitor-heading", text: "Scale browser" });

		const controls = s.createDiv({ cls: "piano-monitor-controls" });
		const rootSel = this.makeSelect(controls, [...ABC_KEYS]);
		const scaleSel = this.makeSelect(
			controls,
			ScaleType.all()
				.map((t) => t.name)
				.sort(),
			"major",
		);

		const notesEl = s.createDiv({ cls: "piano-monitor-scale-notes" });

		const render = (): void => {
			const sc = Scale.get(`${this.scaleRoot} ${this.scaleType}`);
			notesEl.textContent = sc.notes.join("  ");
		};

		rootSel.addEventListener("change", () => {
			this.scaleRoot = rootSel.value as KeyName;
			render();
		});
		scaleSel.addEventListener("change", () => {
			this.scaleType = scaleSel.value;
			render();
		});
		render();
	}

	private makeSelect(
		parent: HTMLElement,
		options: string[],
		selected = options[0],
	): HTMLSelectElement {
		const sel = parent.createEl("select", { cls: "piano-monitor-select" });
		options.forEach((o) => {
			const opt = sel.createEl("option", { text: o, value: o });
			if (o === selected) opt.selected = true;
		});
		return sel;
	}

	private async connectMidi(): Promise<void> {
		const listener = new MidiListener(
			(midi) => {
				this.heldNotes.add(midi);
				this.updateDisplay();
			},
			(midi) => {
				this.heldNotes.delete(midi);
				this.updateDisplay();
			},
		);
		try {
			const device = await listener.start();
			this.midiListener = listener;
			this.statusEl.textContent = `Connected · ${device}`;
		} catch {
			this.statusEl.textContent = "No MIDI device connected";
		}
	}
}
