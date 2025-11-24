import { useState } from "react";
import type { DownloadResult as DownloadResultType } from "@/services/unified-download.service";
import { downloadService } from "@/services/unified-download.service";

export interface PlatformInfo {
	name: string;
	icon: React.ReactNode;
	description: string;
	url: string;
}

export function useDownloader() {
	const [url, setUrl] = useState("");
	const [loading, setLoading] = useState(false);
	const [results, setResults] = useState<DownloadResultType[]>([]);
	const [error, setError] = useState<string | null>(null);

	const detectPlatform = (
		url: string,
	): "instagram" | "twitter" | "tiktok" | null => {
		if (url.includes("instagram.com")) return "instagram";
		if (url.includes("x.com") || url.includes("twitter.com")) return "twitter";
		if (url.includes("tiktok.com")) return "tiktok";
		return null;
	};

	const validateUrl = (url: string): { isValid: boolean; message?: string } => {
		if (!url.trim()) {
			return { isValid: false, message: "Please enter a valid URL" };
		}

		const platform = detectPlatform(url);
		if (!platform) {
			return {
				isValid: false,
				message:
					"Unsupported platform. Please enter Instagram, X (Twitter), or TikTok URL",
			};
		}

		return { isValid: true };
	};

	const handleDownload = async () => {
		const validation = validateUrl(url);
		if (!validation.isValid) {
			setError(validation.message);
			return;
		}

		setLoading(true);
		setError(null);
		setResults([]);

		try {
			// Use the real download service
			const downloadResponse = await downloadService.download(url);
			const downloadResults = downloadResponse.success
				? downloadResponse.results || []
				: [];
			setResults(downloadResults);
		} catch (err) {
			console.error("Download error:", err);
			setError(
				err instanceof Error
					? err.message
					: "Failed to download content. Please try again.",
			);
		} finally {
			setLoading(false);
		}
	};

	const clearResults = () => {
		setResults([]);
		setError(null);
	};

	const supportedPlatforms: PlatformInfo[] = [
		{
			name: "Instagram",
			icon: null, // Will be set in component
			description: "Download photos and videos from Instagram posts and reels",
			url: "https://www.instagram.com",
		},
		{
			name: "TikTok",
			icon: null, // Will be set in component
			description: "Download videos from TikTok posts",
			url: "https://www.tiktok.com",
		},
		{
			name: "X (Twitter)",
			icon: null, // Will be set in component
			description: "Download videos and images from X (Twitter)",
			url: "https://x.com",
		},
	];

	return {
		// State
		url,
		loading,
		results,
		error,
		supportedPlatforms,

		// Actions
		setUrl,
		handleDownload,
		clearResults,
		detectPlatform,
		validateUrl,
	};
}
