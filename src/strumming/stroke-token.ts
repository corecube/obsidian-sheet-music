export const StrokeToken = {
	Down: 1,
	BeatDown: 2,
	AccentDown: 3,
	Up: 101,
	BeatUp: 102,
	AccentUp: 103,
	Muted: 201,
	Rest: 202,
	Sustain: 203,
} as const;

export type StrokeTokenValue = (typeof StrokeToken)[keyof typeof StrokeToken];