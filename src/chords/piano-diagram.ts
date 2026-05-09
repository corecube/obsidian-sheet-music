import { PianoChord } from "./piano-chord";

const SVG_NS = "http://www.w3.org/2000/svg";

const WHITE_KEYS = ["C", "D", "E", "F", "G", "A", "B"];
const BLACK_KEYS: Array<{ note: string; afterWhite: number }> = [
	{ note: "C#", afterWhite: 0 },
	{ note: "D#", afterWhite: 1 },
	{ note: "F#", afterWhite: 3 },
	{ note: "G#", afterWhite: 4 },
	{ note: "A#", afterWhite: 5 },
];

const WHITE_W = 14;
const WHITE_H = 60;
const BLACK_W = 9;
const BLACK_H = 38;

function keyClass(
	color: "white" | "black",
	pitch: string,
	root: string,
	notes: Set<string>,
): string {
	const base = `piano-key piano-key-${color}`;
	if (pitch === root) return `${base} piano-key-root`;
	if (notes.has(pitch)) return `${base} piano-key-active`;
	return base;
}

export function renderPianoDiagram(
	container: HTMLElement,
	chord: PianoChord,
): void {
	const diagramEl = container.createDiv({ cls: "chords-notation-piano" });
	const svg = document.createElementNS(SVG_NS, "svg");
	svg.setAttribute(
		"viewBox",
		`0 0 ${WHITE_W * WHITE_KEYS.length} ${WHITE_H}`,
	);
	svg.setAttribute("xmlns", SVG_NS);
	diagramEl.appendChild(svg);

	const notes = new Set(chord.notes);

	WHITE_KEYS.forEach((pitch, i) => {
		const rect = document.createElementNS(SVG_NS, "rect");
		rect.setAttribute("x", String(i * WHITE_W));
		rect.setAttribute("y", "0");
		rect.setAttribute("width", String(WHITE_W));
		rect.setAttribute("height", String(WHITE_H));
		rect.setAttribute("class", keyClass("white", pitch, chord.root, notes));
		svg.appendChild(rect);
	});

	BLACK_KEYS.forEach(({ note, afterWhite }) => {
		const rect = document.createElementNS(SVG_NS, "rect");
		rect.setAttribute(
			"x",
			String((afterWhite + 1) * WHITE_W - BLACK_W / 2),
		);
		rect.setAttribute("y", "0");
		rect.setAttribute("width", String(BLACK_W));
		rect.setAttribute("height", String(BLACK_H));
		rect.setAttribute("class", keyClass("black", note, chord.root, notes));
		svg.appendChild(rect);
	});
}
