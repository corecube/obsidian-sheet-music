import { describe, expect, it } from "@jest/globals";
import { parseProgression } from "./renderer-logic";

describe("parseProgression", () => {
	it("parses key from first line", () => {
		const model = parseProgression("C\nI IIm V7 I");
		expect(model?.key).toBe("C");
		expect(model?.rows).toHaveLength(1);
		expect(model?.rows[0]).toEqual([
			{ numeral: "I", chord: "C" },
			{ numeral: "IIm", chord: "Dm" },
			{ numeral: "V7", chord: "G7" },
			{ numeral: "I", chord: "C" },
		]);
	});

	it("parses multiple rows", () => {
		const model = parseProgression("C\nI VIm\nIV V");
		expect(model?.rows).toHaveLength(2);
		expect(model?.rows[0]?.[0]?.chord).toBe("C");
		expect(model?.rows[1]?.[1]?.chord).toBe("G");
	});

	it("handles minor keys", () => {
		const model = parseProgression("Am\nIm IVm V");
		expect(model?.rows[0]).toEqual([
			{ numeral: "Im", chord: "Am" },
			{ numeral: "IVm", chord: "Dm" },
			{ numeral: "V", chord: "E" },
		]);
	});

	it("handles borrowed chords", () => {
		const model = parseProgression("C\nbVII IV I");
		expect(model?.rows[0]?.[0]?.chord).toBe("Bb");
	});

	it("returns null when no key line is present", () => {
		expect(parseProgression("I IIm V7 I")).toBeNull();
	});

	it("returns null for empty source", () => {
		expect(parseProgression("")).toBeNull();
		expect(parseProgression("C")).toBeNull();
	});

	it("marks unrecognised numerals with ?", () => {
		const model = parseProgression("C\nI xyz V");
		expect(model?.rows[0]?.[1]?.chord).toBe("?");
	});
});

describe("parseProgression — chord name input", () => {
	it("resolves chord names to Roman numerals", () => {
		const model = parseProgression("C\nC Dm G7 C");
		expect(model?.rows[0]).toEqual([
			{ numeral: "I", chord: "C" },
			{ numeral: "IIm", chord: "Dm" },
			{ numeral: "V7", chord: "G7" },
			{ numeral: "I", chord: "C" },
		]);
	});

	it("handles mixed rows — numerals and chords independently", () => {
		const model = parseProgression("C\nI VIm IV V\nC Am F G");
		expect(model?.rows[0]?.[0]).toEqual({ numeral: "I", chord: "C" });
		expect(model?.rows[1]?.[0]).toEqual({ numeral: "I", chord: "C" });
	});

	it("works with minor key chord input", () => {
		const model = parseProgression("Am\nAm Dm E");
		expect(model?.rows[0]).toEqual([
			{ numeral: "Im", chord: "Am" },
			{ numeral: "IVm", chord: "Dm" },
			{ numeral: "V", chord: "E" },
		]);
	});
});
