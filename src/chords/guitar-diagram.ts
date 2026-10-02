import { Chord, SVGuitarChord } from "svguitar";

const SVG_NS = "http://www.w3.org/2000/svg";

/** Mirrors svguitar's internal isNode() check. */
function hasNodeProcess(): boolean {
	const proc = (globalThis as { process?: { versions?: { node?: unknown } } })
		.process;
	return proc?.versions?.node != null;
}

export function renderGuitarDiagram(
	container: HTMLElement,
	chord: Chord,
): void {
	const diagramEl = container.createDiv({ cls: "chords-notation-diagram" });
	// svguitar picks its container handling via isNode(): in Electron
	// (desktop and the mobile emulator) process.versions.node exists, so it
	// adopts the given element and that element must already be an <svg>.
	// On real mobile (WebView) it instead creates its own <svg> inside the
	// container, so there it gets the plain div; passing an <svg> would nest
	// one svg inside another and break the sizing CSS.
	let target: HTMLElement = diagramEl;
	if (hasNodeProcess()) {
		const svgEl = window.activeDocument.createElementNS(SVG_NS, "svg");
		diagramEl.appendChild(svgEl);
		target = svgEl as unknown as HTMLElement;
	}
	new SVGuitarChord(target)
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
