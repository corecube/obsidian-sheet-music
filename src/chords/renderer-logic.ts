export type ChordsLineToken =
	| {
			type: "text";
			value: string;
	  }
	| {
			type: "bracket";
			value: string;
	  };

const BRACKET_TOKEN_PATTERN = /\[[^\]\n]+\]/g;
const SECTION_LINE_PATTERN = /^\s*\[[^\]\n]+\]\s*$/;

export function splitChordsLines(source: string): string[] {
	return source.replace(/\r\n?/g, "\n").split("\n");
}

export function isSectionLine(line: string): boolean {
	return SECTION_LINE_PATTERN.test(line);
}

export function tokenizeChordsLine(line: string): ChordsLineToken[] {
	const tokens: ChordsLineToken[] = [];
	let cursor = 0;

	for (const match of line.matchAll(BRACKET_TOKEN_PATTERN)) {
		const start = match.index;
		if (start === undefined) {
			continue;
		}

		if (start > cursor) {
			tokens.push({
				type: "text",
				value: line.slice(cursor, start),
			});
		}

		tokens.push({
			type: "bracket",
			value: match[0],
		});

		cursor = start + match[0].length;
	}

	if (cursor < line.length) {
		tokens.push({
			type: "text",
			value: line.slice(cursor),
		});
	}

	if (tokens.length === 0) {
		return [{ type: "text", value: line }];
	}

	return tokens;
}
