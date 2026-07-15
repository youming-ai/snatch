import { detectPlatform, SERVICES } from "@snatch/shared";
import { CheckCircle, Loader2, X, XCircle } from "lucide-react";
import { useState } from "react";
import { DownloaderInput } from "./DownloaderInput";
import { ErrorBoundary } from "./ErrorBoundary";

export function DownloaderApp() {
	return (
		<ErrorBoundary>
			<DownloaderAppInner />
		</ErrorBoundary>
	);
}

function parseFilename(disposition: string | null): string | null {
	if (!disposition) return null;
	const match = disposition.match(/filename="?([^"]+)"?/i);
	return match ? match[1] : null;
}

function DownloaderAppInner() {
	const [url, setUrl] = useState("");
	const [loading, setLoading] = useState(false);
	const [error, setError] = useState<string | null>(null);
	const [savedName, setSavedName] = useState<string | null>(null);

	const handleUrlChange = (next: string) => {
		setUrl(next);
		// A fresh URL invalidates any previous outcome.
		if (error) setError(null);
		if (savedName) setSavedName(null);
	};

	const handleDownload = async () => {
		if (!url?.trim()) {
			setError("Please enter a valid URL");
			return;
		}

		if (!detectPlatform(url)) {
			setError("Unsupported link. Paste a URL from one of the services listed below.");
			return;
		}

		setLoading(true);
		setError(null);
		setSavedName(null);

		try {
			const response = await fetch(`/api/download?url=${encodeURIComponent(url.trim())}`);

			if (!response.ok) {
				const data = await response.json().catch(() => ({}));
				throw new Error(data.error || "Failed to download content");
			}

			const blob = await response.blob();
			const filename = parseFilename(response.headers.get("content-disposition")) || "video.mp4";
			const objectUrl = URL.createObjectURL(blob);
			const anchor = document.createElement("a");
			anchor.href = objectUrl;
			anchor.download = filename;
			document.body.appendChild(anchor);
			anchor.click();
			anchor.remove();
			URL.revokeObjectURL(objectUrl);
			setSavedName(filename);
		} catch (err) {
			console.error("Download error:", err);
			setError(
				err instanceof Error ? err.message : "Failed to download content. Please try again.",
			);
		} finally {
			setLoading(false);
		}
	};

	return (
		<div className="min-h-screen bg-black text-white selection:bg-purple-500/30">
			{/* Background Effects */}
			<div className="fixed inset-0 z-0 overflow-hidden pointer-events-none">
				<div className="absolute top-[-10%] left-[-10%] w-[40%] h-[40%] rounded-full bg-purple-600/20 blur-[120px]" />
				<div className="absolute bottom-[-10%] right-[-10%] w-[40%] h-[40%] rounded-full bg-blue-600/20 blur-[120px]" />
				<div className="absolute top-[20%] right-[10%] w-[30%] h-[30%] rounded-full bg-pink-600/10 blur-[100px]" />
			</div>

			{/* Main Content */}
			<div className="relative z-10 container mx-auto px-4 py-20 md:py-32 space-y-20">
				{/* Hero Section */}
				<div className="text-center space-y-10 max-w-4xl mx-auto">
					<div className="space-y-6">
						<div className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-white/5 border border-white/10 backdrop-blur-sm animate-in fade-in slide-in-from-bottom-4 duration-700">
							<span className="relative flex h-2 w-2">
								<span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-green-400 opacity-75"></span>
								<span className="relative inline-flex rounded-full h-2 w-2 bg-green-500"></span>
							</span>
							<span className="text-sm font-medium text-gray-300">
								{SERVICES.length}+ services supported
							</span>
						</div>

						<h1 className="text-5xl md:text-7xl font-bold tracking-tight animate-in fade-in slide-in-from-bottom-8 duration-700 delay-100">
							<span className="bg-gradient-to-r from-blue-400 via-purple-400 to-pink-400 bg-clip-text text-transparent">
								Snatch
							</span>
						</h1>

						<p className="text-xl text-gray-400 max-w-2xl mx-auto leading-relaxed animate-in fade-in slide-in-from-bottom-8 duration-700 delay-200">
							Paste a link, get the file. Videos, audio and images from your favorite platforms — no
							watermarks, no signup, completely free.
						</p>
					</div>

					{/* Download Input */}
					<div className="max-w-3xl mx-auto animate-in fade-in slide-in-from-bottom-8 duration-700 delay-300">
						<DownloaderInput
							url={url}
							onUrlChange={handleUrlChange}
							onDownload={handleDownload}
							loading={loading}
						/>
					</div>

					{error && (
						<div className="max-w-2xl mx-auto animate-in fade-in zoom-in duration-300">
							<div
								role="alert"
								aria-live="assertive"
								className="p-4 bg-red-500/10 border border-red-500/20 rounded-xl flex items-center gap-3 text-red-400"
							>
								<XCircle className="w-5 h-5 shrink-0" />
								<p className="text-sm font-medium">{error}</p>
							</div>
						</div>
					)}

					{savedName && (
						<div className="max-w-2xl mx-auto animate-in fade-in zoom-in duration-300">
							<div
								role="status"
								aria-live="polite"
								className="p-4 bg-green-500/10 border border-green-500/20 rounded-xl flex items-center gap-3 text-left"
							>
								<CheckCircle className="w-5 h-5 shrink-0 text-green-400" />
								<div className="min-w-0 flex-1">
									<p className="text-sm font-medium text-green-300">Download started</p>
									<p className="text-xs text-gray-400 truncate font-mono">{savedName}</p>
								</div>
								<button
									type="button"
									onClick={handleDownload}
									className="shrink-0 text-xs font-medium text-green-300 hover:text-green-200 underline underline-offset-2"
								>
									Again
								</button>
								<button
									type="button"
									aria-label="Dismiss"
									onClick={() => setSavedName(null)}
									className="shrink-0 text-gray-500 hover:text-white transition-colors"
								>
									<X className="w-4 h-4" />
								</button>
							</div>
						</div>
					)}
				</div>

				{/* Loading State */}
				{loading && (
					<div className="flex flex-col items-center justify-center py-12 space-y-6 animate-in fade-in duration-300">
						<div className="relative">
							<div className="absolute inset-0 bg-purple-500/20 blur-xl rounded-full"></div>
							<Loader2 className="w-12 h-12 animate-spin text-purple-400 relative z-10" />
						</div>
						<div className="text-center space-y-2">
							<h3 className="text-xl font-semibold text-white">Preparing your download</h3>
							<p className="text-gray-400">
								Fetching the highest quality media — long videos may take a moment...
							</p>
						</div>
					</div>
				)}

				{/* Supported Services */}
				<div className="space-y-8 max-w-4xl mx-auto">
					<div className="text-center space-y-3">
						<h2 className="text-2xl md:text-3xl font-bold">Supported services</h2>
						<p className="text-gray-400 max-w-2xl mx-auto text-sm">
							Paste a link from any of these and Snatch grabs the original file.
						</p>
					</div>

					<div className="flex flex-wrap justify-center gap-2.5">
						{SERVICES.map((service) => (
							<span
								key={service.id}
								className="px-3.5 py-1.5 rounded-lg bg-white/5 border border-white/10 text-sm text-gray-300 hover:border-white/25 hover:text-white transition-colors"
							>
								{service.label}
							</span>
						))}
					</div>

					<p className="text-center text-xs text-gray-600 max-w-2xl mx-auto leading-relaxed">
						Support for a service means technical compatibility only — it does not imply
						affiliation, endorsement, or any other relationship.
					</p>
				</div>

				{/* Features */}
				<div className="grid grid-cols-1 md:grid-cols-3 gap-8 max-w-5xl mx-auto pt-8 border-t border-white/5">
					{[
						{
							title: "Lightning Fast",
							description: "Optimized extraction ensures downloads start in seconds.",
							icon: "⚡",
						},
						{
							title: "Highest Quality",
							description: "We always fetch the maximum resolution available from the source.",
							icon: "💎",
						},
						{
							title: "100% Free",
							description: "No hidden fees, no registration, just unlimited downloads.",
							icon: "🎁",
						},
					].map((feature) => (
						<div key={feature.title} className="text-center p-6 space-y-4">
							<div className="text-4xl mb-4">{feature.icon}</div>
							<h3 className="text-lg font-bold text-white">{feature.title}</h3>
							<p className="text-sm text-gray-400 leading-relaxed">{feature.description}</p>
						</div>
					))}
				</div>
			</div>
		</div>
	);
}
