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
	urlPatterns: RegExp[];
	colors: {
		primary: string;
		secondary: string;
	};
	icon: string;
}

export interface DownloadProgress {
	id: string;
	url: string;
	platform: SupportedPlatform;
	status: "pending" | "downloading" | "completed" | "failed";
	progress: number; // 0-100
	error?: string;
	startTime: Date;
	estimatedTime?: number; // seconds
}

export interface DownloadHistory {
	id: string;
	url: string;
	platform: SupportedPlatform;
	title: string;
	thumbnail?: string;
	downloadUrl: string;
	size?: string;
	downloadedAt: Date;
	isSuccessful: boolean;
	error?: string;
}

export interface ValidationError {
	field: string;
	message: string;
	code: string;
}

export interface ValidationResult {
	isValid: boolean;
	errors: ValidationError[];
	platform?: SupportedPlatform;
	contentId?: string;
	sanitizedUrl?: string;
}

export interface SecurityConfig {
	rateLimitWindow: number; // milliseconds
	rateLimitMax: number; // requests per window
	maxUrlLength: number;
	allowedDomains: string[];
	blockedPatterns: RegExp[];
}

export interface RateLimitInfo {
	remaining: number;
	resetTime: Date;
	limit: number;
	windowMs: number;
}

export interface APIError {
	code: string;
	message: string;
	details?: any;
	timestamp: Date;
	requestId?: string;
}

export interface PaginationInfo {
	page: number;
	limit: number;
	total: number;
	totalPages: number;
	hasNext: boolean;
	hasPrev: boolean;
}

export interface SearchFilters {
	platform?: SupportedPlatform[];
	type?: "video" | "image" | "all";
	dateRange?: {
		start: Date;
		end: Date;
	};
	query?: string;
}

export interface UserPreferences {
	defaultQuality: "hd" | "sd" | "audio";
	autoDownload: boolean;
	showNotifications: boolean;
	theme: "light" | "dark" | "system";
	language: string;
}

// Error types
export class DownloadError extends Error {
	constructor(
		message: string,
		public platform: SupportedPlatform,
		public code: string,
		public originalError?: Error,
	) {
		super(message);
		this.name = "DownloadError";
	}
}

export class ValidationError extends Error {
	constructor(
		message: string,
		public field: string,
		public code: string,
	) {
		super(message);
		this.name = "ValidationError";
	}
}

export class NetworkError extends Error {
	constructor(
		message: string,
		public statusCode?: number,
		public originalError?: Error,
	) {
		super(message);
		this.name = "NetworkError";
	}
}

// Utility types
export type Optional<T, K extends keyof T> = Omit<T, K> & Partial<Pick<T, K>>;
export type RequiredFields<T, K extends keyof T> = T & Required<Pick<T, K>>;
