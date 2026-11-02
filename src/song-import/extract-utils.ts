/** Helpers for reading data out of fetched pages. No Obsidian or DOM imports. */

export type Rec = Record<string, unknown>;

/** HTML 4 named entities (Latin-1 plus common punctuation), as code points. */
const NAMED_ENTITIES: Record<string, number> = {
	quot: 34, amp: 38, lt: 60, gt: 62, apos: 39, OElig: 338, oelig: 339,
	Scaron: 352, scaron: 353, Yuml: 376, ndash: 8211, mdash: 8212, lsquo: 8216,
	rsquo: 8217, ldquo: 8220, rdquo: 8221, bull: 8226, hellip: 8230, euro:
	8364, trade: 8482, nbsp: 160, iexcl: 161, cent: 162, pound: 163, curren:
	164, yen: 165, brvbar: 166, sect: 167, uml: 168, copy: 169, ordf: 170,
	laquo: 171, not: 172, shy: 173, reg: 174, macr: 175, deg: 176, plusmn: 177,
	sup2: 178, sup3: 179, acute: 180, micro: 181, para: 182, middot: 183,
	cedil: 184, sup1: 185, ordm: 186, raquo: 187, frac14: 188, frac12: 189,
	frac34: 190, iquest: 191, Agrave: 192, Aacute: 193, Acirc: 194, Atilde:
	195, Auml: 196, Aring: 197, AElig: 198, Ccedil: 199, Egrave: 200, Eacute:
	201, Ecirc: 202, Euml: 203, Igrave: 204, Iacute: 205, Icirc: 206, Iuml:
	207, ETH: 208, Ntilde: 209, Ograve: 210, Oacute: 211, Ocirc: 212, Otilde:
	213, Ouml: 214, times: 215, Oslash: 216, Ugrave: 217, Uacute: 218, Ucirc:
	219, Uuml: 220, Yacute: 221, THORN: 222, szlig: 223, agrave: 224, aacute:
	225, acirc: 226, atilde: 227, auml: 228, aring: 229, aelig: 230, ccedil:
	231, egrave: 232, eacute: 233, ecirc: 234, euml: 235, igrave: 236, iacute:
	237, icirc: 238, iuml: 239, eth: 240, ntilde: 241, ograve: 242, oacute:
	243, ocirc: 244, otilde: 245, ouml: 246, divide: 247, oslash: 248, ugrave:
	249, uacute: 250, ucirc: 251, uuml: 252, yacute: 253, thorn: 254, yuml: 255,
};

function codePointOr(n: number, fallback: string): string {
	if (!Number.isFinite(n) || n < 0 || n > 0x10ffff) return fallback;
	try {
		return String.fromCodePoint(n);
	} catch {
		return fallback;
	}
}

/** Single-pass entity decoder, so `&amp;quot;` becomes `&quot;` and not `"`. */
export function decodeHtmlEntities(text: string): string {
	return text.replace(
		/&(#[xX][0-9a-fA-F]+|#[0-9]+|[A-Za-z][A-Za-z0-9]*);/g,
		(match, body: string) => {
			if (body.startsWith("#x") || body.startsWith("#X")) {
				return codePointOr(parseInt(body.slice(2), 16), match);
			}
			if (body.startsWith("#")) {
				return codePointOr(parseInt(body.slice(1), 10), match);
			}
			if (body === "nbsp") return " "; // plain space keeps chord columns
			const named = NAMED_ENTITIES[body];
			return named === undefined ? match : codePointOr(named, match);
		},
	);
}

export function isRecord(value: unknown): value is Rec {
	return typeof value === "object" && value !== null && !Array.isArray(value);
}

export function pathGet(node: unknown, path: string[]): unknown {
	let cur = node;
	for (const key of path) {
		if (!isRecord(cur)) return undefined;
		cur = cur[key];
	}
	return cur;
}

const MAX_WALK_DEPTH = 12;

export function findDeep(
	node: unknown,
	pred: (o: Rec) => boolean,
	depth = 0,
): Rec | undefined {
	if (depth > MAX_WALK_DEPTH) return undefined;
	if (Array.isArray(node)) {
		for (const item of node) {
			const found = findDeep(item, pred, depth + 1);
			if (found) return found;
		}
		return undefined;
	}
	if (!isRecord(node)) return undefined;
	if (pred(node)) return node;
	for (const value of Object.values(node)) {
		const found = findDeep(value, pred, depth + 1);
		if (found) return found;
	}
	return undefined;
}

export function stringField(rec: Rec | undefined, key: string): string | undefined {
	const value = rec?.[key];
	return typeof value === "string" && value.trim() !== "" ? value : undefined;
}
