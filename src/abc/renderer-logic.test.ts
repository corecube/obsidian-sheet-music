import { describe, expect, it } from "@jest/globals";
import { buildAbcRenderOptions, parseAbcBlock } from "./renderer-logic";

describe("parseAbcBlock", () => {
	it("returns null for empty input", () => {
		expect(parseAbcBlock("   ")).toBeNull();
	});

	it("returns null when the ABC block does not declare a key", () => {
		expect(parseAbcBlock("T: Example\nC D E F")).toBeNull();
	});

	it("adds a default reference number when X: is missing", () => {
		const model = parseAbcBlock("T: Example\nM:4/4\nK:C\nC D E F|");

		expect(model).not.toBeNull();
		expect(model?.source.startsWith("X:1\n")).toBe(true);
		expect(model?.title).toBe("Example");
		expect(model?.ariaLabel).toBe("ABC notation for Example");
	});

	it("preserves an explicit reference number", () => {
		const model = parseAbcBlock("X:7\nT: Jig\nK:G\nGABc|");

		expect(model?.source.startsWith("X:7\n")).toBe(true);
	});

	it("parses custom render options JSON header", () => {
		const model = parseAbcBlock(
			'{"tablature":[{"instrument":"violin"}]}\n---\nX:1\nT: Jig\nK:G\nGABc|',
		);

		expect(model).not.toBeNull();
		expect(model?.source.startsWith("X:1\n")).toBe(true);
		expect(model?.customRenderOptions).toEqual({
			tablature: [{ instrument: "violin" }],
		});
		expect(model?.customRenderOptionsError).toBeNull();
	});

	it("keeps rendering abc body and exposes error for invalid JSON header", () => {
		const model = parseAbcBlock(
			'{"tablature":[}\n---\nX:1\nT: Jig\nK:G\nGABc|',
		);

		expect(model).not.toBeNull();
		expect(model?.source.startsWith("X:1\n")).toBe(true);
		expect(model?.customRenderOptions).toEqual({});
		expect(model?.customRenderOptionsError).toContain(
			"Invalid custom options JSON:",
		);
	});
});

describe("buildAbcRenderOptions", () => {
	it("returns clamped render settings", () => {
		const options = buildAbcRenderOptions(
			{
				enabled: true,
				staffWidth: 120,
				scale: 3,
				instrument: 0,
			},
			"ABC notation",
			27,
		);

		expect(options.add_classes).toBe(true);
		expect(options.ariaLabel).toBe("ABC notation");
		expect(options.responsive).toBe("resize");
		expect(options.staffwidth).toBe(240);
		expect(options.scale).toBe(2);
		expect(options.visualTranspose).toBe(24);
	});
});
