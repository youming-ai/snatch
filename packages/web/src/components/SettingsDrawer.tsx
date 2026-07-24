import type { MediaOptions } from "@snatch/shared";
import { Sliders, X } from "lucide-react";

export interface SettingsState extends MediaOptions {
	apiKey: string;
}

export const DEFAULT_SETTINGS: SettingsState = {
	downloadMode: "auto",
	videoQuality: "max",
	audioFormat: "mp3",
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
									updateSetting("downloadMode", e.target.value as SettingsState["downloadMode"])
								}
								className="w-full px-3 py-2 bg-zinc-900 border border-zinc-800 rounded-xl text-sm text-white focus:outline-none focus:ring-2 focus:ring-purple-500/50"
							>
								<option value="auto">Video + Audio (Auto)</option>
								<option value="audio">Audio Only</option>
							</select>
						</div>

						{/* Video Quality */}
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
								<option value="1080">1080p</option>
								<option value="720">720p</option>
								<option value="480">480p</option>
								<option value="360">360p</option>
							</select>
						</div>

						{/* Audio Format */}
						<div className="space-y-1.5">
							<label htmlFor="audioFormat" className="text-sm font-medium text-zinc-300">
								Audio Format
							</label>
							<select
								id="audioFormat"
								value={settings.audioFormat}
								onChange={(e) =>
									updateSetting("audioFormat", e.target.value as SettingsState["audioFormat"])
								}
								className="w-full px-3 py-2 bg-zinc-900 border border-zinc-800 rounded-xl text-sm text-white focus:outline-none focus:ring-2 focus:ring-purple-500/50"
							>
								<option value="mp3">MP3</option>
								<option value="ogg">OGG Vorbis</option>
								<option value="wav">WAV</option>
								<option value="opus">Opus</option>
							</select>
						</div>
					</div>

					{/* Group 2: Auth */}
					<div className="space-y-4">
						<h3 className="text-xs font-semibold uppercase tracking-wider text-purple-400">
							Authentication
						</h3>

						<div className="space-y-1.5">
							<label htmlFor="apiKey" className="text-sm font-medium text-zinc-300">
								API Authorization Key
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
								Optional API key for protected server instances.
							</p>
						</div>
					</div>
				</div>
			</div>
		</div>
	);
}
