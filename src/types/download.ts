/**
 * Core type definitions for the social media downloader system
 */

export type SupportedPlatform = "instagram" | "twitter" | "tiktok";

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
	isFallback?: boolean; // Indicates if result came from fallback (Crawlee) downloader
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

/**
 * Validation result type - used by validation.ts
 * Simple string-based error messages for consistency
 */
export interface ValidationSchema {
	isValid: boolean;
	errors: string[];
	platform?: SupportedPlatform;
	contentId?: string;
}
