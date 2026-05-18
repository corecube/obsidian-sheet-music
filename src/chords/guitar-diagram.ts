import { Chord, SVGuitarChord } from "svguitar";

const SVG_NS = "http://www.w3.org/2000/svg";

export function renderGuitarDiagram(
	container: HTMLElement,
	chord: Chord,
): void {
	const diagramEl = container.createDiv({ cls: "chords-notation-diagram" });
	// Electron exposes process.versions.node so svguitar's isNode() returns true,
	// taking a code path that requires an actual SVG element as the container.
	const svgEl = window.activeDocument.createElementNS(SVG_NS, "svg");
	diagramEl.appendChild(svgEl);
	new SVGuitarChord(svgEl as unknown as HTMLElement)
		.configure({
			strokeWidth: 10,
			frets: 4,
			titleFontSize: 72,
			fingerSize: 1,
			fingerTextSize: 36,
		})
		.chord(chord)
		.draw();
}
