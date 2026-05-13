import type { CompletedNote } from "./note-to-abc";

interface ActiveNote {
	startMs: number;
}

export class CaptureSession {
	private readonly active = new Map<number, ActiveNote>();
	private readonly sustainHeld = new Map<number, ActiveNote>();
	private readonly completed: CompletedNote[] = [];
	private sustainDown = false;

	onNoteOn(midiNote: number, timeMs: number): void {
		// If the note re-triggers while sustained, finalize the held instance first.
		const held = this.sustainHeld.get(midiNote);
		if (held) {
			const durationMs = timeMs - held.startMs;
			if (durationMs > 0)
				this.completed.push({ midiNote, startMs: held.startMs, durationMs });
			this.sustainHeld.delete(midiNote);
		}
		this.active.set(midiNote, { startMs: timeMs });
	}

	onNoteOff(midiNote: number, timeMs: number): void {
		const entry = this.active.get(midiNote);
		if (!entry) return;
		this.active.delete(midiNote);

		if (this.sustainDown) {
			// Pedal holds the note — defer finalization until pedal release.
			this.sustainHeld.set(midiNote, entry);
		} else {
			const durationMs = timeMs - entry.startMs;
			if (durationMs > 0)
				this.completed.push({ midiNote, startMs: entry.startMs, durationMs });
		}
	}

	onSustainChange(down: boolean, timeMs: number): void {
		this.sustainDown = down;
		if (!down) {
			for (const [midiNote, entry] of this.sustainHeld) {
				const durationMs = timeMs - entry.startMs;
				if (durationMs > 0)
					this.completed.push({ midiNote, startMs: entry.startMs, durationMs });
			}
			this.sustainHeld.clear();
		}
	}

	// Call when stopping — finalizes any notes still active or sustained.
	finalize(stopTimeMs: number): void {
		for (const [midiNote, entry] of this.active) {
			const durationMs = stopTimeMs - entry.startMs;
			if (durationMs > 0)
				this.completed.push({ midiNote, startMs: entry.startMs, durationMs });
		}
		this.active.clear();
		for (const [midiNote, entry] of this.sustainHeld) {
			const durationMs = stopTimeMs - entry.startMs;
			if (durationMs > 0)
				this.completed.push({ midiNote, startMs: entry.startMs, durationMs });
		}
		this.sustainHeld.clear();
	}

	getCompletedNotes(): CompletedNote[] {
		return [...this.completed];
	}

	getNoteCount(): number {
		return this.completed.length;
	}
}
