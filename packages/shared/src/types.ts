/**
 * Core type definitions shared between API and web
 */

export type SupportedPlatform = "twitter" | "tiktok" | "youtube";

export interface VideoFormat {
	format_id: string;
	quality: string;
	url: string;
	ext: string;
	filesize?: number;
}

export interface ExtractResponse {
	success: boolean;
	platform: string;
	title: string;
	thumbnail?: string;
	formats: VideoFormat[];
	error?: string;
}

/**
 * One quality variant of a single video. A video usually has 2–3 of these
 * (e.g. 1080p / 720p / 540p) and the UI renders them as a quality picker
 * inside ONE result card — not as separate cards.
 */
export interface DownloadFormat {
	formatId: string;
	quality: string;
	qualityCategory: "hd" | "sd" | "audio";
	size?: string;
	downloadUrl: string;
}

export interface DownloadResult {
	id: string;
	type: "video" | "image";
	url: string;
	thumbnail?: string;
	title: string;
	platform: SupportedPlatform;
	formats: DownloadFormat[];
	isMock?: boolean;
	isFallback?: boolean;
	metadata?: DownloadMetadata;
}

export interface DownloadMetadata {
	author?: string;
	description?: string;
	duration?: number;
	playCount?: number;
	likeCount?: number;
	commentCount?: number;
	shareCount?: number;
	createdAt?: string;
	tags?: string[];
}

export interface DownloadResponse {
	success: boolean;
	results?: DownloadResult[];
	error?: string;
	platform?: SupportedPlatform;
	processingTime?: number;
}

export interface DownloadRequest {
	url: string;
	platform?: SupportedPlatform;
	quality?: "hd" | "sd" | "audio";
}

export interface PlatformConfig {
	name: string;
	domain: string;
	color: string;
	bgColor: string;
	description: string;
	supportedMedia: ("video" | "image")[];
}

export interface ValidationSchema {
	isValid: boolean;
	errors: string[];
	platform?: SupportedPlatform;
	contentId?: string;
}

export interface ExtractRequest {
	url: string;
}

export interface ErrorResponse {
	success: boolean;
	error: string;
}
