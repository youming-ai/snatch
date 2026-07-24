/**
 * Core type definitions shared between API and web
 */

export interface ErrorResponse {
	success: boolean;
	error: string;
}

export const AUDIO_FORMATS = ["mp3", "ogg", "wav", "opus"] as const;
export const VIDEO_QUALITIES = [
	"max",
	"4320",
	"2160",
	"1440",
	"1080",
	"720",
	"480",
	"360",
	"240",
	"144",
] as const;
export const DOWNLOAD_MODES = ["auto", "audio"] as const;

/** Resolution options the yt-dlp engine actually honors (see buildChoices). */
export interface MediaOptions {
	audioFormat?: (typeof AUDIO_FORMATS)[number];
	videoQuality?: (typeof VIDEO_QUALITIES)[number];
	downloadMode?: (typeof DOWNLOAD_MODES)[number];
}

export interface MediaChoiceItem {
	id?: string;
	type: "video" | "audio";
	quality?: string;
	ext?: string;
	label?: string;
	url: string;
	thumb?: string;
}

export interface ResolveResponse {
	status: "picker" | "error";
	filename?: string;
	title?: string;
	thumbnail?: string;
	duration?: number;
	picker?: MediaChoiceItem[];
	error?: { code?: string; message?: string; context?: Record<string, unknown> };
}
