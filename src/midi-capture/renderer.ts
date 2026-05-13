import { Notice, Plugin, setIcon } from "obsidian";
import type SheetMusicPlugin from "../main";
import { CaptureSession } from "./capture-session";
import { MidiListener } from "./midi-listener";
import { buildAbcBlock } from "./note-to-abc";

interface MidiAccess {
	inputs: { forEach(cb: (input: unknown) => void): void };
	onstatechange: (() => void) | null;
}

function requestMidiAccess(): Promise<MidiAccess> {
	const nav = navigator as unknown as {
		requestMIDIAccess?: () => Promise<MidiAccess>;
	};
	if (!nav.requestMIDIAccess) {
		return Promise.reject(new Error("Web MIDI API is not available."));
	}
	return nav.requestMIDIAccess();
}

function countMidiInputs(access: MidiAccess): number {
	let n = 0;
	access.inputs.forEach(() => { n++; });
	return n;
}

export function registerMidiCapturePackage(plugin: Plugin): void {
	let session: CaptureSession | null = null;
	let listener: MidiListener | null = null;

	const btn = plugin.addRibbonIcon("music", "Start MIDI capture", () => {
		if (session) {
			stopCapture();
		} else {
			startCapture();
		}
	});
	btn.addClass("sheet-music-midi-hidden");

	function refreshButton(): void {
		setIcon(btn, session ? "square" : "music");
		btn.setAttribute(
			"aria-label",
			session ? "Stop MIDI capture" : "Start MIDI capture",
		);
		btn.toggleClass("is-active", session !== null);
	}

	function startCapture(): void {
		const newSession = new CaptureSession();
		const newListener = new MidiListener(
			(note, timeMs) => newSession.onNoteOn(note, timeMs),
			(note, timeMs) => newSession.onNoteOff(note, timeMs),
			(down, timeMs) => newSession.onSustainChange(down, timeMs),
		);

		newListener
			.start()
			.then(() => {
				session = newSession;
				listener = newListener;
				refreshButton();
			})
			.catch((err: unknown) => {
				new Notice(
					err instanceof Error ? err.message : "Failed to open MIDI device.",
				);
			});
	}

	function stopCapture(): void {
		if (!session || !listener) return;

		const editor = plugin.app.workspace.activeEditor?.editor;
		if (!editor) {
			new Notice("Open a note in edit mode to insert the captured notation.");
			return;
		}

		session.finalize(performance.now());
		listener.stop();

		const completed = session.getCompletedNotes();
		const noteCount = session.getNoteCount();
		session = null;
		listener = null;
		refreshButton();

		if (noteCount === 0) return;

		const sheetPlugin = plugin as SheetMusicPlugin;
		const bpm = sheetPlugin.settings.packages.midiCapture.bpm;
		const block = `\`\`\`abc\n${buildAbcBlock(completed, bpm)}\n\`\`\`\n`;
		editor.replaceRange(block, editor.getCursor());
	}

	requestMidiAccess()
		.then((access) => {
			btn.toggleClass("sheet-music-midi-hidden", countMidiInputs(access) === 0);
			access.onstatechange = () => {
				btn.toggleClass("sheet-music-midi-hidden", countMidiInputs(access) === 0);
			};
		})
		.catch(() => {
			// MIDI unavailable — button stays hidden
		});

	plugin.register(() => {
		if (session) session.finalize(performance.now());
		listener?.stop();
	});
}
