import type { MidiEvent } from "./capture-session";

interface MidiOutputPort {
	readonly name?: string | null;
	send(data: number[]): void;
}

interface MidiAccessWithOutputs {
	outputs: { forEach(cb: (output: MidiOutputPort) => void): void };
	onstatechange: (() => void) | null;
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
	private timers: number[] = [];
	private output: MidiOutputPort | null = null;
	private audioContext: AudioContext | null = null;

	async init(onOutputChange?: (name: string | null) => void): Promise<{ outputName: string | null }> {
		try {
			const access = await requestMidiAccessWithOutputs();

			const rescan = (): void => {
				const outputs: MidiOutputPort[] = [];
				access.outputs.forEach((out) => outputs.push(out));
				this.output = outputs[0] ?? null;
				onOutputChange?.(this.output?.name ?? null);
			};

			access.onstatechange = rescan;
			rescan();

			return { outputName: this.output?.name ?? null };
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
				window.setTimeout(() => {
					if (this.output) {
						this.output.send(evt.d);
					} else {
						this.playOscillator(evt.d);
					}
				}, evt.ms),
			);
		}

		this.timers.push(
			window.setTimeout(() => {
				this.timers = [];
				onEnd?.();
			}, lastMs + 100),
		);
	}

	stop(): void {
		for (const t of this.timers) window.clearTimeout(t);
		this.timers = [];
		try {
			this.output?.send([0xb0, 123, 0]); // all notes off
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
