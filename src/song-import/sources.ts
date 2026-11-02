/** Registry of supported sites. Order decides the frontmatter link fields. */

import type { SongSource } from "./song";
import { guitarTunaSource } from "./sources/guitartuna";
import { ultimateGuitarSource } from "./sources/ultimate-guitar";

export const SOURCES: readonly SongSource[] = [
	ultimateGuitarSource,
	guitarTunaSource,
];

export function findSource(url: string): SongSource | undefined {
	return SOURCES.find((source) => source.matches(url));
}
