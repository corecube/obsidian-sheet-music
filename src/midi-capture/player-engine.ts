import type { MidiEvent } from "./capture-session";

interface MidiOutputPort {
	readonly name?: string | null;
	send(data: number[]): void;
}

interface MidiAccessWithOutputs {
	outputs: { forEach(cb: (output: MidiOutputPort) => void): void };
}

function requestMidiAccessWithOutputs(): Promise<MidiAccessWithOutputs> {
	const nav = navigator as unknown as {
		requestMIDIAccess?: () => Promise<MidiAccessWithOutputs>;
	};
	if (!nav.requestMIDIAccess) {
		return Promise.reject(new Error("Web MIDI API not available."));
	}
	return nav.requestMIDIAccess();
}

export class MidiPlayerEngine {
	private timers: ReturnType<typeof setTimeout>[] = [];
	private output: MidiOutputPort | null = null;
	private audioContext: AudioContext | null = null;

	async init(): Promise<{ outputName: string | null }> {
		try {
			const access = await requestMidiAccessWithOutputs();
			const outputs: MidiOutputPort[] = [];
			access.outputs.forEach((out) => outputs.push(out));
			if (outputs[0]) {
				this.output = outputs[0];
				return { outputName: outputs[0].name ?? "MIDI device" };
			}
		} catch {
			// No MIDI output available — fall through to oscillator.
		}
		return { outputName: null };
	}

	play(events: MidiEvent[], onEnd?: () => void): void {
		this.stop();

		const lastMs = events.reduce((max, e) => Math.max(max, e.ms), 0);

		for (const evt of events) {
			this.timers.push(
				setTimeout(() => {
					if (this.output) {
						this.output.send(evt.d);
					} else {
						this.playOscillator(evt.d);
					}
				}, evt.ms),
			);
		}

		// Fire onEnd slightly after the last event.
		this.timers.push(
			setTimeout(() => {
				this.timers = [];
				onEnd?.();
			}, lastMs + 100),
		);
	}

	stop(): void {
		for (const t of this.timers) clearTimeout(t);
		this.timers = [];
		// Send all-notes-off so no MIDI notes get stuck.
		try {
			this.output?.send([0xb0, 123, 0]);
		} catch {
			// Ignore send errors on stop.
		}
	}

	private getAudioContext(): AudioContext {
		if (!this.audioContext) {
			const Win = window as unknown as {
				webkitAudioContext?: typeof AudioContext;
			};
			const Ctor = window.AudioContext ?? Win.webkitAudioContext;
			this.audioContext = new Ctor();
		}
		if (this.audioContext.state === "suspended") {
			void this.audioContext.resume();
		}
		return this.audioContext;
	}

	private playOscillator(data: number[]): void {
		const status = data[0] ?? 0;
		const note = data[1] ?? 60;
		const velocity = data[2] ?? 0;
		const channel = status & 0xf0;

		// Only synthesize note-on events with positive velocity.
		if (channel !== 0x90 || velocity === 0) return;

		const ctx = this.getAudioContext();
		const now = ctx.currentTime;
		const freq = 440 * Math.pow(2, (note - 69) / 12);
		const peak = (velocity / 127) * 0.25;

		const osc = ctx.createOscillator();
		const gain = ctx.createGain();

		osc.type = "triangle";
		osc.frequency.setValueAtTime(freq, now);
		gain.gain.setValueAtTime(0.0001, now);
		gain.gain.exponentialRampToValueAtTime(peak, now + 0.005);
		gain.gain.exponentialRampToValueAtTime(peak * 0.6, now + 0.08);
		gain.gain.exponentialRampToValueAtTime(0.0001, now + 1.2);

		osc.connect(gain);
		gain.connect(ctx.destination);
		osc.start(now);
		osc.stop(now + 1.2);
	}
}
