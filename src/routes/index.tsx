import { createFileRoute } from "@tanstack/react-router";
import {
	AlertCircle,
	CheckCircle,
	Instagram,
	Loader2,
	Music,
	Twitter,
	XCircle,
} from "lucide-react";
import { useEffect, useState } from "react";
import type { DownloadResult as DownloadResultType } from "@/types/download";
import { getEnvironmentConfig } from "@/utils/environment-detector";
import { DownloaderInput } from "../components/DownloaderInput";
import { DownloadResult } from "../components/DownloadResult";
import { clientDownloadService } from "../services/client-download.service";
import { downloadService } from "../services/unified-download.service";

export const Route = createFileRoute("/")({ component: App });

function App() {
	const [url, setUrl] = useState("");
	const [loading, setLoading] = useState(false);
	const [results, setResults] = useState<DownloadResultType[]>([]);
	const [error, setError] = useState<string | null>(null);
	const [environmentInfo, setEnvironmentInfo] = useState(
		getEnvironmentConfig(),
	);
	const [downloadMessage, setDownloadMessage] = useState<string | null>(null);

	useEffect(() => {
		setEnvironmentInfo(getEnvironmentConfig());
	}, []);

	const handleDownload = async () => {
		if (!url?.trim()) {
			setError("Please enter a valid URL");
			return;
		}

		const platform = downloadService.detectPlatform(url);
		if (!platform) {
			setError(
				"Unsupported platform. Please enter Instagram, X (Twitter), or TikTok URL",
			);
			return;
		}

		setLoading(true);
		setError(null);
		setResults([]);

		try {
			let downloadResponse: { success: boolean; results?: DownloadResult[]; message?: string };

			// Choose appropriate download service based on environment
			if (environmentInfo.useClientSide) {
				// Use client-side service for limited environments
				downloadResponse = await clientDownloadService.download(url);
				setDownloadMessage(downloadResponse.message || null);
			} else {
				// Use full server-side service for development and full production
				downloadResponse = await downloadService.download(url);
				setDownloadMessage(null);
			}

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

	const supportedPlatforms = [
		{
			name: "Instagram",
			icon: <Instagram className="w-8 h-8" />,
			description: "Download photos and videos from Instagram posts and reels",
			status: "Limited",
			statusColor: "text-yellow-400",
		},
		{
			name: "TikTok",
			icon: <Music className="w-8 h-8" />,
			description: "Download videos from TikTok posts",
			status: "Working",
			statusColor: "text-green-400",
		},
		{
			name: "X (Twitter)",
			icon: <Twitter className="w-8 h-8" />,
			description: "Download videos and images from X (Twitter)",
			status: "Demo Only",
			statusColor: "text-orange-400",
		},
	];

	return (
		<div className="min-h-screen bg-black text-white selection:bg-purple-500/30">
			{/* Background Effects */}
			<div className="fixed inset-0 z-0 overflow-hidden pointer-events-none">
				<div className="absolute top-[-10%] left-[-10%] w-[40%] h-[40%] rounded-full bg-purple-600/20 blur-[120px]" />
				<div className="absolute bottom-[-10%] right-[-10%] w-[40%] h-[40%] rounded-full bg-blue-600/20 blur-[120px]" />
				<div className="absolute top-[20%] right-[10%] w-[30%] h-[30%] rounded-full bg-pink-600/10 blur-[100px]" />
			</div>

			{/* Main Content */}
			<div className="relative z-10 container mx-auto px-4 py-20 md:py-32 space-y-24">
				{/* Hero Section */}
				<div className="text-center space-y-10 max-w-4xl mx-auto">
					<div className="space-y-6">
						<div className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-white/5 border border-white/10 backdrop-blur-sm animate-in fade-in slide-in-from-bottom-4 duration-700">
							<span className="relative flex h-2 w-2">
								<span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-green-400 opacity-75"></span>
								<span className="relative inline-flex rounded-full h-2 w-2 bg-green-500"></span>
							</span>
							<span className="text-sm font-medium text-gray-300">
								v1.0 Now Available
							</span>
						</div>

						<h1 className="text-5xl md:text-7xl font-bold tracking-tight animate-in fade-in slide-in-from-bottom-8 duration-700 delay-100">
							Social Media{" "}
							<span className="bg-gradient-to-r from-blue-400 via-purple-400 to-pink-400 bg-clip-text text-transparent">
								Downloader
							</span>
						</h1>

						<p className="text-xl text-gray-400 max-w-2xl mx-auto leading-relaxed animate-in fade-in slide-in-from-bottom-8 duration-700 delay-200">
							The most powerful tool to download high-quality videos and images
							from Instagram, TikTok, and X (Twitter). No watermarks, completely
							free.
						</p>
					</div>

					{/* Download Input */}
					<div className="max-w-3xl mx-auto animate-in fade-in slide-in-from-bottom-8 duration-700 delay-300">
						<DownloaderInput
							url={url}
							onUrlChange={setUrl}
							onDownload={handleDownload}
							loading={loading}
						/>
					</div>

					{error && (
						<div className="max-w-2xl mx-auto animate-in fade-in zoom-in duration-300">
							<div className="p-4 bg-red-500/10 border border-red-500/20 rounded-xl flex items-center gap-3 text-red-400">
								<XCircle className="w-5 h-5 shrink-0" />
								<p className="text-sm font-medium">{error}</p>
							</div>
						</div>
					)}

					{downloadMessage && !error && (
						<div className="max-w-2xl mx-auto animate-in fade-in zoom-in duration-300">
							<div className="p-4 bg-yellow-500/10 border border-yellow-500/20 rounded-xl flex items-center gap-3 text-yellow-400">
								<AlertCircle className="w-5 h-5 shrink-0" />
								<p className="text-sm font-medium">{downloadMessage}</p>
							</div>
						</div>
					)}
				</div>

				{/* Results Section */}
				{results.length > 0 && (
					<div className="space-y-10 animate-in fade-in slide-in-from-bottom-12 duration-700">
						<div className="flex items-center justify-between border-b border-white/10 pb-6">
							<h2 className="text-3xl font-bold text-white">
								Download Results
							</h2>
							<span className="text-sm text-gray-400">
								{results.length} items found
							</span>
						</div>
						<div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
							{results.map((result, index) => (
								<div
									key={result.id || `result-${index}`}
									className="animate-in slide-in-from-bottom-4 fade-in duration-500"
									style={{ animationDelay: `${index * 100}ms` }}
								>
									<DownloadResult result={result} />
								</div>
							))}
						</div>
					</div>
				)}

				{/* Loading State */}
				{loading && (
					<div className="flex flex-col items-center justify-center py-12 space-y-6 animate-in fade-in duration-300">
						<div className="relative">
							<div className="absolute inset-0 bg-purple-500/20 blur-xl rounded-full"></div>
							<Loader2 className="w-12 h-12 animate-spin text-purple-400 relative z-10" />
						</div>
						<div className="text-center space-y-2">
							<h3 className="text-xl font-semibold text-white">
								Extracting Content
							</h3>
							<p className="text-gray-400">
								Please wait while we fetch the highest quality media...
							</p>
						</div>
					</div>
				)}

				{/* Environment Warning */}
				{environmentInfo.showDemoModeWarning && (
					<div className="max-w-4xl mx-auto">
						<div className="bg-yellow-500/10 border border-yellow-500/30 rounded-2xl p-6 space-y-4">
							<div className="flex items-start gap-3">
								<AlertCircle className="w-6 h-6 text-yellow-400 flex-shrink-0 mt-0.5" />
								<div className="space-y-2">
									<h3 className="text-lg font-semibold text-yellow-400">
										Limited Functionality in Current Environment
									</h3>
									<p className="text-gray-300 text-sm leading-relaxed">
										Due to platform restrictions, some advanced features are
										limited in this environment. Full functionality is available
										in self-hosted environments with Node.js runtime.
									</p>
									<div className="grid grid-cols-1 md:grid-cols-3 gap-4 mt-4">
										<div className="bg-white/5 rounded-lg p-3 border border-white/10">
											<div className="text-green-400 text-xs font-medium mb-1">
												✅ Available
											</div>
											<div className="text-gray-400 text-xs">
												UI, URL validation, demo responses
											</div>
										</div>
										<div className="bg-white/5 rounded-lg p-3 border border-white/10">
											<div className="text-yellow-400 text-xs font-medium mb-1">
												⚠️ Limited
											</div>
											<div className="text-gray-400 text-xs">
												Client-side metadata extraction
											</div>
										</div>
										<div className="bg-white/5 rounded-lg p-3 border border-white/10">
											<div className="text-red-400 text-xs font-medium mb-1">
												❌ Unavailable
											</div>
											<div className="text-gray-400 text-xs">
												Server-side web scraping
											</div>
										</div>
									</div>
								</div>
							</div>
						</div>
					</div>
				)}

				{/* Supported Platforms */}
				<div className="space-y-12">
					<div className="text-center space-y-4">
						<h2 className="text-3xl md:text-4xl font-bold">
							Supported Platforms
						</h2>
						<p className="text-gray-400 max-w-2xl mx-auto">
							We support the most popular social media platforms with
							specialized extraction engines.
						</p>
					</div>

					<div className="grid grid-cols-1 md:grid-cols-3 gap-6 max-w-6xl mx-auto">
						{supportedPlatforms.map((platform) => (
							<div
								key={platform.name}
								className="group relative p-8 rounded-3xl bg-white/5 border border-white/10 hover:border-white/20 transition-all duration-300 hover:-translate-y-1 overflow-hidden"
							>
								<div className="absolute inset-0 bg-gradient-to-br from-white/5 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-500" />

								<div className="relative z-10 space-y-6">
									<div className="w-14 h-14 rounded-2xl bg-white/10 flex items-center justify-center group-hover:scale-110 transition-transform duration-300">
										{platform.icon}
									</div>

									<div>
										<div className="flex items-center justify-between mb-2">
											<h3 className="text-xl font-bold text-white">
												{platform.name}
											</h3>
											<span
												className={`text-xs font-medium px-2 py-1 rounded-full bg-white/5 ${platform.statusColor}`}
											>
												{platform.status}
											</span>
										</div>
										<p className="text-sm text-gray-400 leading-relaxed">
											{platform.description}
										</p>
									</div>

									<div className="pt-6 border-t border-white/5 space-y-2">
										{platform.name === "TikTok" && (
											<>
												<div className="flex items-center gap-2 text-xs text-gray-400">
													<CheckCircle className="w-3 h-3 text-green-400" />
													<span>No Watermark</span>
												</div>
												<div className="flex items-center gap-2 text-xs text-gray-400">
													<CheckCircle className="w-3 h-3 text-green-400" />
													<span>Full HD Quality</span>
												</div>
											</>
										)}
										{platform.name === "Instagram" && (
											<>
												<div className="flex items-center gap-2 text-xs text-gray-400">
													<CheckCircle className="w-3 h-3 text-yellow-400" />
													<span>Reels & Posts</span>
												</div>
												<div className="flex items-center gap-2 text-xs text-gray-400">
													<CheckCircle className="w-3 h-3 text-yellow-400" />
													<span>Stories (Coming Soon)</span>
												</div>
											</>
										)}
										{platform.name === "X (Twitter)" && (
											<>
												<div className="flex items-center gap-2 text-xs text-gray-400">
													<CheckCircle className="w-3 h-3 text-blue-400" />
													<span>Videos & GIFs</span>
												</div>
												<div className="flex items-center gap-2 text-xs text-gray-400">
													<CheckCircle className="w-3 h-3 text-blue-400" />
													<span>High Resolution</span>
												</div>
											</>
										)}
									</div>
								</div>
							</div>
						))}
					</div>
				</div>

				{/* Features Grid */}
				<div className="grid grid-cols-1 md:grid-cols-3 gap-8 max-w-5xl mx-auto pt-12 border-t border-white/5">
					{[
						{
							title: "Lightning Fast",
							description:
								"Optimized extraction engine ensures downloads start in seconds.",
							icon: "⚡",
						},
						{
							title: "Highest Quality",
							description:
								"We always fetch the maximum resolution available from the source.",
							icon: "💎",
						},
						{
							title: "100% Free",
							description:
								"No hidden fees, no registration, just unlimited downloads.",
							icon: "🎁",
						},
					].map((feature) => (
						<div key={feature.title} className="text-center p-6 space-y-4">
							<div className="text-4xl mb-4">{feature.icon}</div>
							<h3 className="text-lg font-bold text-white">{feature.title}</h3>
							<p className="text-sm text-gray-400 leading-relaxed">
								{feature.description}
							</p>
						</div>
					))}
				</div>
			</div>
		</div>
	);
}
