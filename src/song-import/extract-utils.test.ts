import { describe, expect, it } from "@jest/globals";
import { decodeHtmlEntities } from "./extract-utils";

describe("decodeHtmlEntities", () => {
	it("decodes named and numeric entities in one pass", () => {
		expect(
			decodeHtmlEntities(
				"&quot;a&quot; &amp;amp; &lt;b&gt; &#39; &#x41; &#65;&nbsp;",
			),
		).toBe("\"a\" &amp; <b> ' A A ");
	});

	it("decodes accented letters and punctuation, case-sensitively", () => {
		expect(decodeHtmlEntities("emoci&oacute;n t&uacute; &Eacute; &ntilde; &hellip;")).toBe(
			"emoción tú É ñ …",
		);
	});

	it("leaves unknown entities alone", () => {
		expect(decodeHtmlEntities("&bogus; &#xZZ;")).toBe("&bogus; &#xZZ;");
	});
});
