/** Shared data model of the song importer. Pure types only. */

/** A strumming pattern in the plugin's `strumming` block shape. */
export interface StrummingPattern {
	part?: string;
	bpm?: number;
	denominator: 8 | 16;
	isTriplet: boolean;
	measures: number[];
}

/** A song as delivered by a source or by pasted text. */
export interface ImportedSong {
	/** Empty when unknown (pasted text without a header). */
	title: string;
	artist: string;
	/** Chords-over-lyrics text; site markup such as [ch]/[tab] is tolerated. */
	sheet: string;
	key?: string;
	capo?: number;
	tuning?: string;
	/** Song tempo in bpm when the page states one. */
	tempo?: number;
	/** Strumming patterns listed on the page (link imports only). */
	strummings?: StrummingPattern[];
	/** Fret string per chord name (`x02210`), low string first; link imports only. */
	voicings?: Record<string, string>;
	/** Id of the source the page came from; absent for pasted text. */
	source?: string;
	url?: string;
}

export type ExtractResult =
	| { ok: true; song: ImportedSong }
	| {
			ok: false;
			/** Shown to the user in a notice. */
			message: string;
			/** Logged to the developer console when present. */
			debug?: unknown;
	  };

/** One supported site. Adding a site means one file implementing this. */
export interface SongSource {
	id: string;
	/** Display name, e.g. in error notices. */
	name: string;
	/** Frontmatter field that holds the page link. */
	frontmatterKey: string;
	matches(url: string): boolean;
	extract(html: string, url: string): ExtractResult;
}
