import { Notice, Plugin, setIcon } from "obsidian";
import { CaptureSession } from "./capture-session";
import { MidiListener } from "./midi-listener";
import { registerMidiPlayerRenderer } from "./player-renderer";

export function registerMidiCapturePackage(plugin: Plugin): void {
	registerMidiPlayerRenderer(plugin);

	let session: CaptureSession | null = null;
	let listener: MidiListener | null = null;

	const btn = plugin.addRibbonIcon("music", "Start MIDI capture", () => {
		if (session) {
			stopCapture();
		} else {
			startCapture();
		}
	});

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
		const newListener = new MidiListener((data) => newSession.push(data));

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
			new Notice("Open a note in edit mode to insert the captured recording.");
			return;
		}

		listener.stop();
		const events = session.getEvents();
		session = null;
		listener = null;
		refreshButton();

		if (events.length === 0) return;

		const json = JSON.stringify({ v: 1, events });
		const block = `\`\`\`midi\n${json}\n\`\`\`\n`;
		editor.replaceRange(block, editor.getCursor());
	}

	plugin.register(() => {
		listener?.stop();
	});
}
