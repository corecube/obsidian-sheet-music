export interface MidiEvent {
	d: number[]; // raw MIDI bytes
	ms: number;  // milliseconds from recording start
}

export class CaptureSession {
	private readonly events: MidiEvent[] = [];
	private readonly t0 = performance.now();

	push(data: number[]): void {
		this.events.push({ d: data, ms: performance.now() - this.t0 });
	}

	getEvents(): MidiEvent[] {
		return this.events;
	}
}
