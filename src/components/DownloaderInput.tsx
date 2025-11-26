import { Link2, Loader2 } from "lucide-react";

interface DownloaderInputProps {
	url: string;
	onUrlChange: (url: string) => void;
	onDownload: () => void;
	loading: boolean;
}

export function DownloaderInput({
	url,
	onUrlChange,
	onDownload,
	loading,
}: DownloaderInputProps) {
	const handleKeyDown = (e: React.KeyboardEvent) => {
		if (e.key === "Enter" && !loading) {
			onDownload();
		}
	};

	return (
		<div className="relative group">
			<div className="absolute -inset-1 bg-gradient-to-r from-blue-600 via-purple-600 to-pink-600 rounded-2xl blur opacity-25 group-hover:opacity-75 transition duration-1000 group-hover:duration-200" />
			<div className="relative flex items-center bg-gray-900/90 backdrop-blur-xl rounded-2xl p-2 border border-white/10 shadow-2xl">
				<div className="flex-1 relative flex items-center">
					<div className="absolute left-4 text-gray-400">
						<Link2 className="w-5 h-5" />
					</div>
					<input
						type="text"
						value={url || ""}
						onChange={(e) => onUrlChange(e.target.value)}
						onKeyDown={handleKeyDown}
						placeholder="Paste Instagram, TikTok, or X link here..."
						className="w-full pl-12 pr-4 py-4 bg-transparent text-lg text-white placeholder-gray-500 focus:outline-none font-medium"
						disabled={loading}
					/>
				</div>
				<button
					onClick={onDownload}
					disabled={loading || !url?.trim()}
					className="px-8 py-4 bg-white text-black font-bold rounded-xl hover:bg-gray-100 transition-all disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2 shadow-lg shadow-white/10 hover:shadow-white/20 hover:scale-[1.02] active:scale-[0.98]"
				>
					{loading ? (
						<>
							<Loader2 className="w-5 h-5 animate-spin" />
							<span>Processing</span>
						</>
					) : (
						<span>Download</span>
					)}
				</button>
			</div>
		</div>
	);
}
