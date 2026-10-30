/**
 * Line and token classification shared by every reader of a progression
 * block: the parser, the transposer, the editor highlighter and the vault
 * statistics. One place for the RomanText conventions so they cannot drift.
 */
import { parseKey } from "./roman";

export interface Meter {
	beats: number;
	unit: number;
}

export const DEFAULT_METER: Meter = { beats: 4, unit: 4 };

/** RomanText header lines that carry no harmony (Time Signature is read separately). */
const METADATA_RE =
	/^(Composer|Piece|Analyst|Proofreader|Movement|Time Signature|Key Signature|Minor Sixth|Minor Seventh|Sixth Minor|Seventh Minor|Form|Note|Pedal)\s*:/i;
/** Measure labels: m1, m11var1, m216a. */
export const MEASURE_TOKEN_RE = /^m\d+[a-z0-9]*$/;
/** Beat markers: b2, b2.5. */
export const BEAT_TOKEN_RE = /^b\d+(\.\d+)?$/;
/** "m9-10 = m1-2" or "m5 = m1": copy earlier measures. */
const REPEAT_LINE_RE = /^m(\d+)(?:-(\d+))?\s*=\s*m(\d+)(?:-(\d+))?$/;
const TIME_SIGNATURE_RE = /^Time Signature\s*:\s*(\d+)\s*\/\s*(\d+)/i;
/** A "#" that starts a comment: at the line start or after whitespace, followed by whitespace or the end. "#iv" is a chord. */
const COMMENT_RE = /(^|\s)#(\s|$)/;

/** Column of the "#" that starts a trailing comment, or -1. */
export function commentStart(line: string): number {
	const m = COMMENT_RE.exec(line);
	return m ? m.index + (m[1]?.length ?? 0) : -1;
}

/** The line without its comment, trimmed. */
export function stripComment(line: string): string {
	const at = commentStart(line);
	return (at >= 0 ? line.slice(0, at) : line).trim();
}

export function isMetadataLine(trimmed: string): boolean {
	return METADATA_RE.test(trimmed);
}

export interface RepeatSpec {
	/** First target measure number. */
	to: number;
	/** First source measure number. */
	from: number;
	/** Number of measures to copy. */
	count: number;
}

export function parseRepeat(trimmed: string): RepeatSpec | null {
	const m = REPEAT_LINE_RE.exec(trimmed);
	if (!m) return null;
	const [, toStart = "0", toEnd, fromStart = "0", fromEnd] = m;
	const to = Number(toStart);
	const from = Number(fromStart);
	const count = Math.max(1, Number(toEnd ?? toStart) - to + 1, Number(fromEnd ?? fromStart) - from + 1);
	return { to, from, count };
}

export function parseMeter(trimmed: string): Meter | null {
	const m = TIME_SIGNATURE_RE.exec(trimmed);
	if (!m) return null;
	const beats = Number(m[1]);
	const unit = Number(m[2]);
	if (!(beats > 0) || !(unit > 0)) return null;
	return { beats, unit };
}

/** A line that is not harmony: empty after comment stripping, metadata, or a repeat. */
export function isSkippableLine(trimmed: string): boolean {
	return trimmed.length === 0 || isMetadataLine(trimmed) || parseRepeat(trimmed) !== null;
}

/**
 * Index of the bare key line ("G", "Am", "c:"), or -1. It is the first line
 * that is not a comment, metadata or repeat, and only if that line parses as a
 * key on its own.
 */
export function firstKeyLineIndex(lines: string[]): number {
	for (let i = 0; i < lines.length; i++) {
		const trimmed = stripComment(lines[i] ?? "");
		if (isSkippableLine(trimmed)) continue;
		return parseKey(trimmed) ? i : -1;
	}
	return -1;
}
