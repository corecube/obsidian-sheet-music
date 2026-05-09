import { StrokeToken } from "./stroke-token";

export class Audio {
	private audioContext: AudioContext | null = null;
	private noiseBuffer: AudioBuffer | null = null;

	private getAudioContext(): AudioContext | null {
		const AudioContextConstructor =
			window.AudioContext ??
			(
				window as typeof window & {
					webkitAudioContext?: typeof AudioContext;
				}
			).webkitAudioContext;

		if (!AudioContextConstructor) {
			return null;
		}

		if (this.audioContext === null) {
			this.audioContext = new AudioContextConstructor();
		}

		return this.audioContext;
	}

	private createNoiseBuffer(context: AudioContext): AudioBuffer {
		const sampleRate = context.sampleRate;
		const buffer = context.createBuffer(
			1,
			Math.max(1, sampleRate * 0.08),
			sampleRate,
		);
		const channelData = buffer.getChannelData(0);

		for (let index = 0; index < channelData.length; index += 1) {
			channelData[index] = Math.random() * 2 - 1;
		}

		return buffer;
	}

	private getNoiseBuffer(context: AudioContext): AudioBuffer {
		if (
			this.noiseBuffer === null ||
			this.noiseBuffer.sampleRate !== context.sampleRate
		) {
			this.noiseBuffer = this.createNoiseBuffer(context);
		}

		return this.noiseBuffer;
	}

	private resumeAudioContext(context: AudioContext): void {
		if (context.state === "suspended") {
			void context.resume();
		}
	}

	private playTonalStroke(
		context: AudioContext,
		kind: "down" | "up",
		isAccent: boolean,
	): void {
		const now = context.currentTime;
		const oscillator = context.createOscillator();
		const gainNode = context.createGain();
		const filter = context.createBiquadFilter();

		filter.type = "lowpass";
		filter.frequency.setValueAtTime(kind === "down" ? 1400 : 2200, now);

		oscillator.type = kind === "down" ? "triangle" : "square";

		const baseFrequency = kind === "down" ? 180 : 320;
		const targetFrequency = kind === "down" ? 120 : 440;
		const peakGain = isAccent ? 0.16 : 0.05;
		const durationSeconds = isAccent ? 0.18 : 0.11;

		oscillator.frequency.setValueAtTime(baseFrequency, now);
		oscillator.frequency.exponentialRampToValueAtTime(
			targetFrequency,
			now + durationSeconds,
		);

		gainNode.gain.setValueAtTime(0.0001, now);
		gainNode.gain.exponentialRampToValueAtTime(peakGain, now + 0.01);
		gainNode.gain.exponentialRampToValueAtTime(
			0.0001,
			now + durationSeconds,
		);

		oscillator.connect(filter);
		filter.connect(gainNode);
		gainNode.connect(context.destination);

		oscillator.start(now);
		oscillator.stop(now + durationSeconds);
	}

	private playBeatStroke(
		context: AudioContext,
		kind: "beat-down" | "beat-up",
	): void {
		const now = context.currentTime;
		const source = context.createBufferSource();
		const gainNode = context.createGain();
		const filter = context.createBiquadFilter();

		source.buffer = this.getNoiseBuffer(context);
		filter.type = "bandpass";
		filter.frequency.setValueAtTime(kind === "beat-down" ? 900 : 1800, now);
		filter.Q.setValueAtTime(kind === "beat-down" ? 0.8 : 1.0, now);

		const durationSeconds = 0.07;

		gainNode.gain.setValueAtTime(0.0001, now);
		gainNode.gain.exponentialRampToValueAtTime(0.07, now + 0.005);
		gainNode.gain.exponentialRampToValueAtTime(
			0.0001,
			now + durationSeconds,
		);

		source.connect(filter);
		filter.connect(gainNode);
		gainNode.connect(context.destination);

		source.start(now);
		source.stop(now + durationSeconds);
	}

	private playMutedStroke(context: AudioContext, isAccent: boolean): void {
		const now = context.currentTime;
		const source = context.createBufferSource();
		const gainNode = context.createGain();
		const filter = context.createBiquadFilter();

		source.buffer = this.getNoiseBuffer(context);
		filter.type = "bandpass";
		filter.frequency.setValueAtTime(isAccent ? 1400 : 1100, now);
		filter.Q.setValueAtTime(1.2, now);

		const peakGain = isAccent ? 0.09 : 0.06;
		const durationSeconds = isAccent ? 0.09 : 0.06;

		gainNode.gain.setValueAtTime(0.0001, now);
		gainNode.gain.exponentialRampToValueAtTime(peakGain, now + 0.004);
		gainNode.gain.exponentialRampToValueAtTime(
			0.0001,
			now + durationSeconds,
		);

		source.connect(filter);
		filter.connect(gainNode);
		gainNode.connect(context.destination);

		source.start(now);
		source.stop(now + durationSeconds);
	}

	play(strokeToken: number): void {
		if (
			strokeToken === StrokeToken.Rest ||
			strokeToken === StrokeToken.Sustain
		) {
			return;
		}

		const context = this.getAudioContext();
		if (context === null) {
			return;
		}

		this.resumeAudioContext(context);

		if (strokeToken === StrokeToken.Muted) {
			this.playMutedStroke(context, false);
			return;
		}

		if (strokeToken === StrokeToken.AccentDown) {
			this.playTonalStroke(context, "down", true);
			return;
		}

		if (strokeToken === StrokeToken.AccentUp) {
			this.playTonalStroke(context, "up", true);
			return;
		}

		if (strokeToken === StrokeToken.BeatDown) {
			this.playBeatStroke(context, "beat-down");
			return;
		}

		if (strokeToken === StrokeToken.BeatUp) {
			this.playBeatStroke(context, "beat-up");
			return;
		}

		if (strokeToken === StrokeToken.Down) {
			this.playTonalStroke(context, "down", false);
			return;
		}

		if (strokeToken === StrokeToken.Up) {
			this.playTonalStroke(context, "up", false);
		}
	}
}