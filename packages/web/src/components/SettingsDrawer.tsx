import type { CobaltOptions } from "@snatch/shared";
import { Sliders, X } from "lucide-react";

export interface SettingsState extends CobaltOptions {
	apiKey: string;
}

export const DEFAULT_SETTINGS: SettingsState = {
	downloadMode: "auto",
	videoQuality: "max",
	audioFormat: "mp3",
	audioBitrate: "128",
	filenameStyle: "basic",
	disableMetadata: false,
	alwaysProxy: false,
	subtitleLang: "",
	youtubeVideoCodec: "h264",
	youtubeVideoContainer: "auto",
	youtubeDubLang: "",
	youtubeBetterAudio: false,
	youtubeHLS: false,
	convertGif: true,
	allowH265: false,
	tiktokFullAudio: false,
	apiKey: "",
};

interface SettingsDrawerProps {
	isOpen: boolean;
	onClose: () => void;
	settings: SettingsState;
	onSettingsChange: (settings: SettingsState) => void;
}

export function SettingsDrawer({
	isOpen,
	onClose,
	settings,
	onSettingsChange,
}: SettingsDrawerProps) {
	const updateSetting = <K extends keyof SettingsState>(key: K, value: SettingsState[K]) => {
		onSettingsChange({
			...settings,
			[key]: value,
		});
	};

	if (!isOpen) return null;

	return (
		<div className="fixed inset-0 z-50 overflow-hidden flex justify-end">
			{/* Backdrop */}
			<button
				type="button"
				onClick={onClose}
				aria-label="Close settings drawer"
				className="absolute inset-0 bg-black/60 backdrop-blur-sm cursor-default"
			/>

			{/* Sliding Content */}
			<div className="relative w-full max-w-md h-full bg-zinc-950 border-l border-zinc-800 p-6 flex flex-col gap-6 shadow-2xl text-left overflow-y-auto z-10 animate-in slide-in-from-right duration-300">
				{/* Header */}
				<div className="flex items-center justify-between pb-4 border-b border-zinc-800">
					<div className="flex items-center gap-2">
						<Sliders className="w-5 h-5 text-purple-400" />
						<h2 className="text-xl font-bold text-white">Download Settings</h2>
					</div>
					<button
						type="button"
						onClick={onClose}
						aria-label="Close"
						className="p-1 rounded-lg text-zinc-400 hover:text-white hover:bg-zinc-900 transition-colors"
					>
						<X className="w-5 h-5" />
					</button>
				</div>

				{/* Form Fields */}
				<div className="flex-1 flex flex-col gap-8 pb-10">
					{/* Group 1: General */}
					<div className="space-y-4">
						<h3 className="text-xs font-semibold uppercase tracking-wider text-purple-400">
							General Options
						</h3>

						{/* Mode */}
						<div className="space-y-1.5">
							<label htmlFor="downloadMode" className="text-sm font-medium text-zinc-300">
								Download Mode
							</label>
							<select
								id="downloadMode"
								value={settings.downloadMode}
								onChange={(e) =>
									updateSetting("downloadMode", e.target.value as "auto" | "audio" | "mute")
								}
								className="w-full px-3 py-2 bg-zinc-900 border border-zinc-800 rounded-xl text-sm text-white focus:outline-none focus:ring-2 focus:ring-purple-500/50"
							>
								<option value="auto">Video + Audio (Auto)</option>
								<option value="audio">Audio Only</option>
								<option value="mute">Video Only (Mute)</option>
							</select>
						</div>

						{/* Video Quality */}
						{settings.downloadMode !== "audio" && (
							<div className="space-y-1.5">
								<label htmlFor="videoQuality" className="text-sm font-medium text-zinc-300">
									Video Quality
								</label>
								<select
									id="videoQuality"
									value={settings.videoQuality}
									onChange={(e) =>
										updateSetting("videoQuality", e.target.value as SettingsState["videoQuality"])
									}
									className="w-full px-3 py-2 bg-zinc-900 border border-zinc-800 rounded-xl text-sm text-white focus:outline-none focus:ring-2 focus:ring-purple-500/50"
								>
									<option value="max">Max Quality</option>
									<option value="4320">8K (4320p)</option>
									<option value="2160">4K (2160p)</option>
									<option value="1440">2K (1440p)</option>
									<option value="1080">1080p</option>
									<option value="720">720p</option>
									<option value="480">480p</option>
									<option value="360">360p</option>
									<option value="240">240p</option>
									<option value="144">144p</option>
								</select>
							</div>
						)}

						{/* Audio Format (audio only) */}
						{settings.downloadMode === "audio" && (
							<div className="space-y-1.5">
								<label htmlFor="audioFormat" className="text-sm font-medium text-zinc-300">
									Audio Format
								</label>
								<select
									id="audioFormat"
									value={settings.audioFormat}
									onChange={(e) =>
										updateSetting(
											"audioFormat",
											e.target.value as "best" | "mp3" | "ogg" | "wav" | "opus",
										)
									}
									className="w-full px-3 py-2 bg-zinc-900 border border-zinc-800 rounded-xl text-sm text-white focus:outline-none focus:ring-2 focus:ring-purple-500/50"
								>
									<option value="best">Best Quality</option>
									<option value="mp3">MP3</option>
									<option value="ogg">OGG Vorbis</option>
									<option value="wav">WAV</option>
									<option value="opus">Opus</option>
								</select>
							</div>
						)}

						{/* Audio Bitrate (audio only) */}
						{settings.downloadMode === "audio" && (
							<div className="space-y-1.5">
								<label htmlFor="audioBitrate" className="text-sm font-medium text-zinc-300">
									Audio Bitrate
								</label>
								<select
									id="audioBitrate"
									value={settings.audioBitrate}
									onChange={(e) =>
										updateSetting(
											"audioBitrate",
											e.target.value as "320" | "256" | "128" | "96" | "64" | "8",
										)
									}
									className="w-full px-3 py-2 bg-zinc-900 border border-zinc-800 rounded-xl text-sm text-white focus:outline-none focus:ring-2 focus:ring-purple-500/50"
								>
									<option value="320">320 kbps</option>
									<option value="256">256 kbps</option>
									<option value="128">128 kbps (Default)</option>
									<option value="96">96 kbps</option>
									<option value="64">64 kbps</option>
									<option value="8">8 kbps (Very Low)</option>
								</select>
							</div>
						)}

						{/* Filename Style */}
						<div className="space-y-1.5">
							<label htmlFor="filenameStyle" className="text-sm font-medium text-zinc-300">
								Filename Style
							</label>
							<select
								id="filenameStyle"
								value={settings.filenameStyle}
								onChange={(e) =>
									updateSetting(
										"filenameStyle",
										e.target.value as "classic" | "pretty" | "basic" | "nerdy",
									)
								}
								className="w-full px-3 py-2 bg-zinc-900 border border-zinc-800 rounded-xl text-sm text-white focus:outline-none focus:ring-2 focus:ring-purple-500/50"
							>
								<option value="basic">Basic (Title only)</option>
								<option value="pretty">Pretty (Clean formatting)</option>
								<option value="classic">Classic (ID and platform)</option>
								<option value="nerdy">Nerdy (Codec and exact details)</option>
							</select>
						</div>

						{/* Subtitle Language */}
						<div className="space-y-1.5">
							<label htmlFor="subtitleLang" className="text-sm font-medium text-zinc-300">
								Subtitle Language (ISO 639-1)
							</label>
							<input
								id="subtitleLang"
								type="text"
								placeholder="e.g. en, ja (leave empty for none)"
								value={settings.subtitleLang || ""}
								onChange={(e) => updateSetting("subtitleLang", e.target.value)}
								className="w-full px-3 py-2 bg-zinc-900 border border-zinc-800 rounded-xl text-sm text-white placeholder-zinc-600 focus:outline-none focus:ring-2 focus:ring-purple-500/50"
							/>
						</div>

						{/* Switches */}
						<div className="space-y-3 pt-2">
							<label className="flex items-center gap-3 cursor-pointer">
								<input
									type="checkbox"
									checked={settings.disableMetadata || false}
									onChange={(e) => updateSetting("disableMetadata", e.target.checked)}
									className="rounded bg-zinc-900 border-zinc-800 text-purple-600 focus:ring-0 focus:ring-offset-0"
								/>
								<span className="text-sm text-zinc-300 select-none">Disable file metadata</span>
							</label>

							<label className="flex items-center gap-3 cursor-pointer">
								<input
									type="checkbox"
									checked={settings.alwaysProxy || false}
									onChange={(e) => updateSetting("alwaysProxy", e.target.checked)}
									className="rounded bg-zinc-900 border-zinc-800 text-purple-600 focus:ring-0 focus:ring-offset-0"
								/>
								<span className="text-sm text-zinc-300 select-none">Always tunnel/proxy data</span>
							</label>
						</div>
					</div>

					{/* Group 2: YouTube Specifics */}
					<div className="space-y-4">
						<h3 className="text-xs font-semibold uppercase tracking-wider text-purple-400">
							YouTube Specifics
						</h3>

						{/* Codec */}
						<div className="space-y-1.5">
							<label htmlFor="youtubeVideoCodec" className="text-sm font-medium text-zinc-300">
								Preferred Video Codec
							</label>
							<select
								id="youtubeVideoCodec"
								value={settings.youtubeVideoCodec}
								onChange={(e) =>
									updateSetting("youtubeVideoCodec", e.target.value as "h264" | "av1" | "vp9")
								}
								className="w-full px-3 py-2 bg-zinc-900 border border-zinc-800 rounded-xl text-sm text-white focus:outline-none focus:ring-2 focus:ring-purple-500/50"
							>
								<option value="h264">H264 (Maximum compatibility)</option>
								<option value="av1">AV1 (Efficient, newer)</option>
								<option value="vp9">VP9 (High quality)</option>
							</select>
						</div>

						{/* Container */}
						<div className="space-y-1.5">
							<label htmlFor="youtubeVideoContainer" className="text-sm font-medium text-zinc-300">
								Video Container
							</label>
							<select
								id="youtubeVideoContainer"
								value={settings.youtubeVideoContainer}
								onChange={(e) =>
									updateSetting(
										"youtubeVideoContainer",
										e.target.value as "auto" | "mp4" | "webm" | "mkv",
									)
								}
								className="w-full px-3 py-2 bg-zinc-900 border border-zinc-800 rounded-xl text-sm text-white focus:outline-none focus:ring-2 focus:ring-purple-500/50"
							>
								<option value="auto">Auto (Default)</option>
								<option value="mp4">MP4</option>
								<option value="webm">WebM</option>
								<option value="mkv">MKV</option>
							</select>
						</div>

						{/* Audio Dub */}
						<div className="space-y-1.5">
							<label htmlFor="youtubeDubLang" className="text-sm font-medium text-zinc-300">
								Audio Dubbing Language (ISO 639-1)
							</label>
							<input
								id="youtubeDubLang"
								type="text"
								placeholder="e.g. en, es (defaults to video original)"
								value={settings.youtubeDubLang || ""}
								onChange={(e) => updateSetting("youtubeDubLang", e.target.value)}
								className="w-full px-3 py-2 bg-zinc-900 border border-zinc-800 rounded-xl text-sm text-white placeholder-zinc-600 focus:outline-none focus:ring-2 focus:ring-purple-500/50"
							/>
						</div>

						{/* YouTube switches */}
						<div className="space-y-3 pt-2">
							<label className="flex items-center gap-3 cursor-pointer">
								<input
									type="checkbox"
									checked={settings.youtubeBetterAudio || false}
									onChange={(e) => updateSetting("youtubeBetterAudio", e.target.checked)}
									className="rounded bg-zinc-900 border-zinc-800 text-purple-600 focus:ring-0 focus:ring-offset-0"
								/>
								<span className="text-sm text-zinc-300 select-none">
									Prefer highest audio track quality
								</span>
							</label>

							<label className="flex items-center gap-3 cursor-pointer">
								<input
									type="checkbox"
									checked={settings.youtubeHLS || false}
									onChange={(e) => updateSetting("youtubeHLS", e.target.checked)}
									className="rounded bg-zinc-900 border-zinc-800 text-purple-600 focus:ring-0 focus:ring-offset-0"
								/>
								<span className="text-sm text-zinc-300 select-none">
									Use HLS formats (experimental)
								</span>
							</label>
						</div>
					</div>

					{/* Group 3: Other Services */}
					<div className="space-y-4">
						<h3 className="text-xs font-semibold uppercase tracking-wider text-purple-400">
							Other Services
						</h3>

						<div className="space-y-3">
							<label className="flex items-center gap-3 cursor-pointer">
								<input
									type="checkbox"
									checked={settings.convertGif ?? true}
									onChange={(e) => updateSetting("convertGif", e.target.checked)}
									className="rounded bg-zinc-900 border-zinc-800 text-purple-600 focus:ring-0 focus:ring-offset-0"
								/>
								<span className="text-sm text-zinc-300 select-none">
									Convert Twitter GIFs to real .gif files
								</span>
							</label>

							<label className="flex items-center gap-3 cursor-pointer">
								<input
									type="checkbox"
									checked={settings.allowH265 || false}
									onChange={(e) => updateSetting("allowH265", e.target.checked)}
									className="rounded bg-zinc-900 border-zinc-800 text-purple-600 focus:ring-0 focus:ring-offset-0"
								/>
								<span className="text-sm text-zinc-300 select-none">
									Allow TikTok HEVC/H265 videos
								</span>
							</label>

							<label className="flex items-center gap-3 cursor-pointer">
								<input
									type="checkbox"
									checked={settings.tiktokFullAudio || false}
									onChange={(e) => updateSetting("tiktokFullAudio", e.target.checked)}
									className="rounded bg-zinc-900 border-zinc-800 text-purple-600 focus:ring-0 focus:ring-offset-0"
								/>
								<span className="text-sm text-zinc-300 select-none">
									Download original complete TikTok audio
								</span>
							</label>
						</div>
					</div>

					{/* Group 4: Auth */}
					<div className="space-y-4">
						<h3 className="text-xs font-semibold uppercase tracking-wider text-purple-400">
							Authentication
						</h3>

						<div className="space-y-1.5">
							<label htmlFor="apiKey" className="text-sm font-medium text-zinc-300">
								Custom Cobalt API Key
							</label>
							<input
								id="apiKey"
								type="password"
								placeholder="Enter backend authorization API key"
								value={settings.apiKey || ""}
								onChange={(e) => updateSetting("apiKey", e.target.value)}
								className="w-full px-3 py-2 bg-zinc-900 border border-zinc-800 rounded-xl text-sm text-white placeholder-zinc-600 focus:outline-none focus:ring-2 focus:ring-purple-500/50"
							/>
							<p className="text-xs text-zinc-500 leading-normal">
								Required only if the self-hosted cobalt instance has key-based authorization
								enabled.
							</p>
						</div>
					</div>
				</div>
			</div>
		</div>
	);
}
