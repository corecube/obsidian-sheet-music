// Minimal Web MIDI API surface we actually use — avoids lib version sensitivity.
interface MidiMessageData {
	readonly data: Uint8Array;
	readonly timeStamp: number;
}

interface MidiInputPort {
	readonly name?: string | null;
	addEventListener(type: "midimessage", listener: (event: MidiMessageData) => void): void;
	removeEventListener(type: "midimessage", listener: (event: MidiMessageData) => void): void;
}

interface MidiAccessResult {
	inputs: { forEach(cb: (input: MidiInputPort) => void): void };
}

type NoteOnCallback = (midiNote: number, timeMs: number) => void;
type NoteOffCallback = (midiNote: number, timeMs: number) => void;
type SustainCallback = (down: boolean, timeMs: number) => void;

function requestMidiAccess(): Promise<MidiAccessResult> {
	const nav = navigator as unknown as {
		requestMIDIAccess?: () => Promise<MidiAccessResult>;
	};
	if (!nav.requestMIDIAccess) {
		return Promise.reject(
			new Error("Web MIDI API is not available in this environment."),
		);
	}
	return nav.requestMIDIAccess();
}

const SUSTAIN_CC = 64;

export class MidiListener {
	private input: MidiInputPort | null = null;

	constructor(
		private readonly onNoteOn: NoteOnCallback,
		private readonly onNoteOff: NoteOffCallback,
		private readonly onSustainChange?: SustainCallback,
	) {}

	async start(): Promise<string> {
		const access = await requestMidiAccess();

		const inputs: MidiInputPort[] = [];
		access.inputs.forEach((inp) => inputs.push(inp));

		const target = inputs[0];
		if (!target) {
			throw new Error(
				"No MIDI input devices found. Connect a MIDI device and try again.",
			);
		}

		this.input = target;
		target.addEventListener("midimessage", this.handleMessage);
		return target.name ?? "Unknown device";
	}

	stop(): void {
		if (this.input) {
			this.input.removeEventListener("midimessage", this.handleMessage);
			this.input = null;
		}
	}

	private readonly handleMessage = (event: MidiMessageData): void => {
		const { data, timeStamp } = event;
		if (!data || data.length < 2) return;

		const status = data[0];
		const note = data[1];
		const velocity = data[2] ?? 0;

		if (status === undefined || note === undefined) return;

		const channel = status & 0xf0;

		if (channel === 0x90 && velocity > 0) {
			this.onNoteOn(note, timeStamp);
		} else if (channel === 0x80 || (channel === 0x90 && velocity === 0)) {
			this.onNoteOff(note, timeStamp);
		} else if (channel === 0xb0 && note === SUSTAIN_CC && this.onSustainChange) {
			this.onSustainChange(velocity >= 64, timeStamp);
		}
	};
}
