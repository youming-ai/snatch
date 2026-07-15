import { detectPlatform, SERVICES } from "@snatch/shared";
import { CheckCircle, Download, Loader2, Settings, X, XCircle } from "lucide-react";
import { useCallback, useEffect, useState } from "react";
import { DownloaderInput } from "./DownloaderInput";
import { ErrorBoundary } from "./ErrorBoundary";
import { DEFAULT_SETTINGS, SettingsDrawer, type SettingsState } from "./SettingsDrawer";
import { Turnstile } from "./Turnstile";

export function DownloaderApp() {
	return (
		<ErrorBoundary>
			<DownloaderAppInner />
		</ErrorBoundary>
	);
}

interface PickerItem {
	type: "photo" | "video" | "gif";
	url: string;
	thumb?: string;
}

interface PickerResponse {
	status: "picker";
	picker?: PickerItem[];
	audio?: string;
	audioFilename?: string;
	filename?: string;
}

function DownloaderAppInner() {
	// Settings & Drawer
	const [settings, setSettings] = useState<SettingsState>(() => {
		try {
			const saved = localStorage.getItem("snatch_settings");
			return saved ? { ...DEFAULT_SETTINGS, ...JSON.parse(saved) } : DEFAULT_SETTINGS;
		} catch {
			return DEFAULT_SETTINGS;
		}
	});
	const [isSettingsOpen, setIsSettingsOpen] = useState(false);

	// Core State
	const [url, setUrl] = useState("");
	const [loading, setLoading] = useState(false);
	const [error, setError] = useState<string | null>(null);
	const [savedName, setSavedName] = useState<string | null>(null);

	// Multi-Media Picker State
	const [pickerResponse, setPickerResponse] = useState<PickerResponse | null>(null);

	// Turnstile State
	const [backendSitekey, setBackendSitekey] = useState<string | null>(null);
	const [showTurnstile, setShowTurnstile] = useState(false);
	const [turnstileToken, setTurnstileToken] = useState<string | null>(null);

	// Dynamic Cobalt Backend Service Capabilities
	const [allowedServiceIds, setAllowedServiceIds] = useState<string[] | null>(null);

	// Sync settings to localStorage
	const handleSettingsChange = (nextSettings: SettingsState) => {
		setSettings(nextSettings);
		try {
			localStorage.setItem("snatch_settings", JSON.stringify(nextSettings));
		} catch (err) {
			console.error("Failed to save settings:", err);
		}
	};

	// Query backend status / turnstile on mount
	useEffect(() => {
		fetch("/api/info")
			.then((res) => res.json())
			.then((data) => {
				const details = data as {
					cobalt?: { services?: string[]; turnstileSitekey?: string };
				};
				if (details.cobalt) {
					if (details.cobalt.services && Array.isArray(details.cobalt.services)) {
						setAllowedServiceIds(details.cobalt.services);
					}
					if (details.cobalt.turnstileSitekey) {
						setBackendSitekey(details.cobalt.turnstileSitekey);
					}
				}
			})
			.catch((err) => console.error("Failed to query backend capabilities:", err));
	}, []);

	const handleUrlChange = (next: string) => {
		setUrl(next);
		if (error) setError(null);
		if (savedName) setSavedName(null);
		if (pickerResponse) setPickerResponse(null);
	};

	const triggerDownload = useCallback((downloadUrl: string) => {
		const anchor = document.createElement("a");
		anchor.href = downloadUrl;
		anchor.download = ""; // Filename is governed by Content-Disposition header
		document.body.appendChild(anchor);
		anchor.click();
		anchor.remove();
	}, []);

	const handleDownload = async (forcedToken?: string) => {
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
		setPickerResponse(null);

		const { apiKey, ...cobaltOptions } = settings;

		const headers: Record<string, string> = {
			"Content-Type": "application/json",
		};
		if (apiKey) {
			headers.Authorization = `Api-Key ${apiKey}`;
		}
		const token = forcedToken || turnstileToken;
		if (token) {
			headers["cf-turnstile-response"] = token;
		}

		try {
			const response = await fetch("/api/resolve", {
				method: "POST",
				headers,
				body: JSON.stringify({
					url: url.trim(),
					...cobaltOptions,
				}),
			});

			if (!response.ok) {
				const errData = (await response.json().catch(() => ({}))) as { error?: string };
				throw new Error(errData.error || "Failed to resolve media");
			}

			interface ResolveJson {
				status: "tunnel" | "redirect" | "picker" | "error";
				url?: string;
				filename?: string;
				picker?: PickerItem[];
				audio?: string;
				audioFilename?: string;
				error?: { code?: string };
			}

			const data = (await response.json()) as ResolveJson;

			if (data.status === "error") {
				const errorCode = data.error?.code || "";
				if (errorCode.includes("turnstile.missing") && backendSitekey) {
					setShowTurnstile(true);
					setError("Verification required. Please solve the security widget below.");
				} else {
					throw new Error(errorCode || "Cobalt resolved with an error");
				}
				return;
			}

			if (data.status === "tunnel" || data.status === "redirect") {
				if (!data.url) throw new Error("No download URL returned");
				triggerDownload(data.url);
				setSavedName(data.filename || "file");
				// Hide Turnstile once successfully solved and cleared
				setShowTurnstile(false);
			} else if (data.status === "picker") {
				setPickerResponse(data as PickerResponse);
				setShowTurnstile(false);
			}
		} catch (err) {
			console.error("Resolution error:", err);
			setError(err instanceof Error ? err.message : "Failed to resolve content. Please try again.");
		} finally {
			setLoading(false);
		}
	};

	const handleTurnstileVerify = (token: string) => {
		setTurnstileToken(token);
		// Retrigger download immediately upon verification
		handleDownload(token);
	};

	const activeServices = SERVICES.filter(
		(s) => !allowedServiceIds || allowedServiceIds.includes(s.id),
	);

	return (
		<div className="min-h-screen bg-black text-white selection:bg-purple-500/30">
			{/* Background Effects */}
			<div className="fixed inset-0 z-0 overflow-hidden pointer-events-none">
				<div className="absolute top-[-10%] left-[-10%] w-[40%] h-[40%] rounded-full bg-purple-600/20 blur-[120px]" />
				<div className="absolute bottom-[-10%] right-[-10%] w-[40%] h-[40%] rounded-full bg-blue-600/20 blur-[120px]" />
				<div className="absolute top-[20%] right-[10%] w-[30%] h-[30%] rounded-full bg-pink-600/10 blur-[100px]" />
			</div>

			{/* Settings Toggle and Main Page Header Overlay */}
			<div className="absolute top-6 right-6 z-20">
				<button
					type="button"
					onClick={() => setIsSettingsOpen(true)}
					aria-label="Settings"
					className="p-3 bg-white/5 border border-white/10 rounded-2xl hover:bg-white/10 hover:border-white/20 transition-all text-zinc-300 hover:text-white flex items-center justify-center"
				>
					<Settings className="w-5 h-5" />
				</button>
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
								{activeServices.length}+ services supported
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
							onDownload={() => handleDownload()}
							loading={loading}
						/>
					</div>

					{/* Turnstile Widget */}
					{showTurnstile && backendSitekey && (
						<div className="max-w-md mx-auto p-4 bg-zinc-900 border border-zinc-800 rounded-2xl animate-in fade-in duration-300">
							<Turnstile
								sitekey={backendSitekey}
								onVerify={handleTurnstileVerify}
								onExpire={() => setTurnstileToken(null)}
								onError={() => {
									setTurnstileToken(null);
									setError("Security verification failed. Please try again.");
								}}
							/>
						</div>
					)}

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
									onClick={() => handleDownload()}
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

					{/* Multi-Media Picker Panel */}
					{pickerResponse?.picker && (
						<div className="max-w-4xl mx-auto space-y-6 text-left animate-in fade-in zoom-in duration-300 p-6 bg-zinc-900/40 border border-zinc-800 rounded-2xl">
							<div className="flex items-center justify-between">
								<div>
									<h3 className="text-lg font-bold text-white">Choose media to download</h3>
									<p className="text-xs text-zinc-500 mt-1">
										This post contains multiple assets. Select items to download them.
									</p>
								</div>
								<button
									type="button"
									onClick={() => setPickerResponse(null)}
									className="p-1 px-3 bg-white/5 hover:bg-white/10 text-zinc-300 hover:text-white text-xs font-semibold rounded-lg transition-colors border border-white/5"
								>
									Clear selection
								</button>
							</div>

							<div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-4">
								{pickerResponse.picker.map((item) => (
									<div
										key={item.url}
										className="bg-zinc-900 border border-zinc-800 rounded-xl overflow-hidden flex flex-col group"
									>
										<div className="aspect-square bg-zinc-950 relative overflow-hidden flex items-center justify-center">
											{item.thumb ? (
												<img
													src={item.thumb}
													alt={item.type}
													className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
												/>
											) : (
												<span className="text-zinc-500 capitalize text-xs">{item.type}</span>
											)}
											<span className="absolute top-2 left-2 px-2 py-0.5 rounded bg-black/60 backdrop-blur-sm text-[9px] uppercase font-bold text-zinc-300 tracking-wider">
												{item.type}
											</span>
										</div>
										<div className="p-3">
											<button
												type="button"
												onClick={() => triggerDownload(item.url)}
												className="w-full py-2 bg-purple-600 hover:bg-purple-500 text-white font-semibold rounded-lg text-xs transition-colors flex items-center justify-center gap-1.5"
											>
												<Download className="w-3.5 h-3.5" />
												Download
											</button>
										</div>
									</div>
								))}
							</div>

							{pickerResponse.audio && (
								<div className="p-4 bg-zinc-900 border border-zinc-800 rounded-xl flex items-center justify-between gap-4">
									<div className="min-w-0 flex-1">
										<p className="text-sm font-semibold text-zinc-200">Background Audio</p>
										<p className="text-xs text-zinc-500 truncate font-mono mt-0.5">
											{pickerResponse.audioFilename || "audio.mp3"}
										</p>
									</div>
									<button
										type="button"
										onClick={() => triggerDownload(pickerResponse.audio || "")}
										className="px-4 py-2 bg-purple-600 hover:bg-purple-500 text-white font-semibold rounded-lg text-xs transition-colors flex items-center gap-1.5"
									>
										<Download className="w-3.5 h-3.5" />
										Download Audio
									</button>
								</div>
							)}
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
						{activeServices.map((service) => (
							<span
								key={service.id}
								className="px-3.5 py-1.5 rounded-lg bg-white/5 border border-white/10 text-sm text-gray-300 hover:border-white/25 hover:text-white transition-colors animate-in fade-in duration-300"
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

			{/* Settings Drawer Slider */}
			<SettingsDrawer
				isOpen={isSettingsOpen}
				onClose={() => setIsSettingsOpen(false)}
				settings={settings}
				onSettingsChange={handleSettingsChange}
			/>
		</div>
	);
}
