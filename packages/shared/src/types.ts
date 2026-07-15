/**
 * Core type definitions shared between API and web
 */

export interface ErrorResponse {
	success: boolean;
	error: string;
}

export interface CobaltOptions {
	audioBitrate?: "320" | "256" | "128" | "96" | "64" | "8";
	audioFormat?: "best" | "mp3" | "ogg" | "wav" | "opus";
	downloadMode?: "auto" | "audio" | "mute";
	filenameStyle?: "classic" | "pretty" | "basic" | "nerdy";
	videoQuality?: "max" | "4320" | "2160" | "1440" | "1080" | "720" | "480" | "360" | "240" | "144";
	disableMetadata?: boolean;
	alwaysProxy?: boolean;
	localProcessing?: "disabled" | "preferred" | "forced";
	subtitleLang?: string;
	youtubeVideoCodec?: "h264" | "av1" | "vp9";
	youtubeVideoContainer?: "auto" | "mp4" | "webm" | "mkv";
	youtubeDubLang?: string;
	convertGif?: boolean;
	allowH265?: boolean;
	tiktokFullAudio?: boolean;
	youtubeBetterAudio?: boolean;
	youtubeHLS?: boolean;
}

export interface CobaltResponse {
	status: "tunnel" | "redirect" | "picker" | "local-processing" | "error";
	url?: string;
	filename?: string;
	picker?: { type: "photo" | "video" | "gif"; url: string; thumb?: string }[];
	audio?: string;
	audioFilename?: string;
	tunnels?: string[];
	type?: string;
	service?: string;
	error?: { code?: string; context?: { service?: string; limit?: number } };
}
