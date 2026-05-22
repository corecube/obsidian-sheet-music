import { describe, expect, it } from "@jest/globals";
import { normalizeMusicXmlZoom, parseMusicXmlBlock } from "./renderer-logic";

describe("parseMusicXmlBlock", () => {
	it("returns null for empty input", () => {
		expect(parseMusicXmlBlock("  ")).toBeNull();
	});

	it("returns null for non-musicxml input", () => {
		expect(parseMusicXmlBlock("<xml><x>not score</x></xml>")).toBeNull();
	});

	it("accepts score-partwise documents", () => {
		const model = parseMusicXmlBlock(
			'<?xml version="1.0"?><score-partwise version="3.1"></score-partwise>',
		);

		expect(model).not.toBeNull();
		expect(model?.source.includes("<score-partwise")).toBe(true);
	});

	it("accepts score-timewise documents", () => {
		const model = parseMusicXmlBlock("<score-timewise></score-timewise>");

		expect(model).not.toBeNull();
		expect(model?.source.includes("<score-timewise")).toBe(true);
	});
});

describe("normalizeMusicXmlZoom", () => {
	it("clamps zoom within supported range", () => {
		expect(normalizeMusicXmlZoom({ enabled: true, zoom: 0.1 })).toBe(0.5);
		expect(normalizeMusicXmlZoom({ enabled: true, zoom: 1.2 })).toBe(1.2);
		expect(normalizeMusicXmlZoom({ enabled: true, zoom: 10 })).toBe(2);
	});

	it("falls back for invalid zoom", () => {
		expect(normalizeMusicXmlZoom({ enabled: true, zoom: Number.NaN })).toBe(
			1,
		);
	});
});
