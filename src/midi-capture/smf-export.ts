// Writes a Type-0 Standard MIDI File (single track, 120 BPM, 480 ticks/quarter).
// No library needed — the format is straightforward for a flat event list.

interface MidiEvent {
	d: number[];
	ms: number;
}

const TICKS_PER_QUARTER = 480;
const MICROS_PER_QUARTER = 500000; // 120 BPM
const MS_PER_TICK = MICROS_PER_QUARTER / 1000 / TICKS_PER_QUARTER;

function encodeVarLen(value: number): number[] {
	if (value < 0x80) return [value];
	const bytes: number[] = [];
	let v = value;
	bytes.unshift(v & 0x7f);
	v >>>= 7;
	while (v > 0) {
		bytes.unshift((v & 0x7f) | 0x80);
		v >>>= 7;
	}
	return bytes;
}

function buildTrack(events: MidiEvent[]): number[] {
	const bytes: number[] = [];

	// Tempo meta event at tick 0
	bytes.push(0x00, 0xff, 0x51, 0x03);
	bytes.push(
		(MICROS_PER_QUARTER >> 16) & 0xff,
		(MICROS_PER_QUARTER >> 8) & 0xff,
		MICROS_PER_QUARTER & 0xff,
	);

	const sorted = [...events].sort((a, b) => a.ms - b.ms);
	let prevTick = 0;

	for (const evt of sorted) {
		const tick = Math.round(evt.ms / MS_PER_TICK);
		const delta = Math.max(0, tick - prevTick);
		prevTick = tick;
		bytes.push(...encodeVarLen(delta), ...evt.d);
	}

	// End of track
	bytes.push(0x00, 0xff, 0x2f, 0x00);
	return bytes;
}

export function exportToMidiFile(events: MidiEvent[], filename = "recording.mid"): void {
	const track = buildTrack(events);

	const header = [
		0x4d, 0x54, 0x68, 0x64, // MThd
		0x00, 0x00, 0x00, 0x06, // chunk length = 6
		0x00, 0x00,             // format 0
		0x00, 0x01,             // 1 track
		(TICKS_PER_QUARTER >> 8) & 0xff, TICKS_PER_QUARTER & 0xff,
	];

	const trackHeader = [
		0x4d, 0x54, 0x72, 0x6b, // MTrk
		(track.length >> 24) & 0xff,
		(track.length >> 16) & 0xff,
		(track.length >> 8) & 0xff,
		track.length & 0xff,
	];

	const file = new Uint8Array([...header, ...trackHeader, ...track]);
	const url = URL.createObjectURL(new Blob([file], { type: "audio/midi" }));
	const a = document.createElement("a");
	a.href = url;
	a.download = filename;
	a.click();
	URL.revokeObjectURL(url);
}
