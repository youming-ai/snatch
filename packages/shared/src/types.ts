/**
 * Core type definitions shared between API and web
 */

export type SupportedPlatform = "instagram" | "twitter" | "tiktok";

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

export interface DownloadResult {
	id: string;
	type: "video" | "image";
	url: string;
	thumbnail?: string;
	downloadUrl: string;
	title: string;
	size?: string;
	platform: SupportedPlatform;
	quality?: "hd" | "sd" | "audio";
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
