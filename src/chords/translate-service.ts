import { requestUrl } from "obsidian";
import { chunkTexts, parseGtxResponse } from "./translate-logic";

const REQUEST_TIMEOUT_MS = 20000;

function withTimeout<T>(promise: Promise<T>, ms: number): Promise<T> {
	return new Promise<T>((resolve, reject) => {
		const timer = setTimeout(
			() => reject(new Error("Translation request timed out")),
			ms,
		);
		promise.then(
			(value) => {
				clearTimeout(timer);
				resolve(value);
			},
			(error: unknown) => {
				clearTimeout(timer);
				reject(error instanceof Error ? error : new Error(String(error)));
			},
		);
	});
}

function buildUrl(text: string, targetLang: string): string {
	return (
		"https://translate.googleapis.com/translate_a/single" +
		"?client=gtx&sl=auto&dt=t" +
		`&tl=${encodeURIComponent(targetLang)}` +
		`&q=${encodeURIComponent(text)}`
	);
}

async function translateText(
	text: string,
	targetLang: string,
): Promise<string> {
	const res = await withTimeout(
		requestUrl({ url: buildUrl(text, targetLang) }),
		REQUEST_TIMEOUT_MS,
	);
	return parseGtxResponse(res.json);
}

export async function translateLines(
	texts: string[],
	targetLang: string,
): Promise<string[]> {
	const results: string[] = [];
	for (const chunk of chunkTexts(texts)) {
		const translated = await translateText(chunk.join("\n"), targetLang);
		const lines = translated.split("\n");
		if (lines.length === chunk.length) {
			results.push(...lines);
			continue;
		}
		// Segment boundaries drifted; retry this chunk line by line.
		for (const line of chunk) {
			results.push(
				(await translateText(line, targetLang)).replace(/\n/g, " "),
			);
		}
	}
	if (results.length !== texts.length) {
		throw new Error(
			`Translation returned ${results.length} lines for ${texts.length} inputs`,
		);
	}
	return results;
}
