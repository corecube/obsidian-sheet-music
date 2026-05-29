import type { Plugin } from "obsidian";
import { MidiPlayerEngine } from "./player-engine";

interface MidiEvent {
	d: number[];
	ms: number;
}

function parseMidiEvents(source: string): MidiEvent[] {
	return source
		.trim()
		.split("\n")
		.flatMap((line) => {
			const parts = line.trim().split(/\s+/).map(Number);
			if (parts.length < 2 || parts.some(isNaN)) return [];
			const [ms, ...d] = parts;
			return [{ ms: ms!, d }];
		});
}

function formatDuration(ms: number): string {
	const seconds = Math.floor(ms / 1000);
	const mins = Math.floor(seconds / 60);
	const secs = seconds % 60;
	return `${mins.toString()}:${secs.toString().padStart(2, "0")}`;
}

export function registerMidiPlayerRenderer(plugin: Plugin): void {
	plugin.registerMarkdownCodeBlockProcessor("midi", (source, el) => {
		const events = parseMidiEvents(source);

		if (events.length === 0) {
			el.createEl("p", {
				text: "No MIDI events recorded.",
				cls: "sheet-music-midi-empty",
			});
			return;
		}

		const totalMs = events.reduce((max, e) => Math.max(max, e.ms), 0);

		const container = el.createDiv({ cls: "sheet-music-midi-player" });
		const controls = container.createDiv({ cls: "sheet-music-midi-controls" });
		const playBtn = controls.createEl("button", { cls: "sheet-music-midi-btn" });
		playBtn.textContent = "▶ Play";

		const timeDisplay = controls.createSpan({ cls: "sheet-music-midi-time" });
		timeDisplay.textContent = `0:00 / ${formatDuration(totalMs)}`;

		const engine = new MidiPlayerEngine();
		let playing = false;
		let ticker: ReturnType<typeof setInterval> | null = null;
		let startWallMs = 0;

		function stopPlayback(): void {
			playing = false;
			if (ticker) {
				clearInterval(ticker);
				ticker = null;
			}
			playBtn.textContent = "▶ Play";
			timeDisplay.textContent = `0:00 / ${formatDuration(totalMs)}`;
			engine.stop();
		}

		playBtn.addEventListener("click", () => {
			if (playing) {
				stopPlayback();
				return;
			}

			playing = true;
			playBtn.textContent = "■ Stop";
			startWallMs = performance.now();

			ticker = setInterval(() => {
				const elapsed = performance.now() - startWallMs;
				timeDisplay.textContent = `${formatDuration(elapsed)} / ${formatDuration(totalMs)}`;
			}, 250);

			engine.play(events, () => {
				if (ticker) {
					clearInterval(ticker);
					ticker = null;
				}
				playing = false;
				playBtn.textContent = "▶ Play";
				timeDisplay.textContent = `${formatDuration(totalMs)} / ${formatDuration(totalMs)}`;
			});
		});
	});
}
