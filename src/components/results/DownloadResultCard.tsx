import { motion } from "framer-motion";
import {
	Download,
	ExternalLink,
	Image as ImageIcon,
	Video,
} from "lucide-react";
import { OptimizedImage } from "@/components/OptimizedImage";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import type { DownloadResult } from "@/types/download";

interface DownloadResultCardProps {
	result: DownloadResult;
	isDownloading: boolean;
	onDownload: (result: DownloadResult) => void;
	delay?: number;
}

export function DownloadResultCard({
	result,
	isDownloading,
	onDownload,
	delay = 0,
}: DownloadResultCardProps) {
	return (
		<motion.div
			initial={{ opacity: 0, y: 20 }}
			animate={{ opacity: 1, y: 0 }}
			transition={{ delay }}
		>
			<Card className="border-none shadow-xl bg-background/50 backdrop-blur-md hover:scale-[1.02] transition-all duration-300 group">
				<ResultThumbnail result={result} />
				<CardContent className="p-6 space-y-4">
					<ResultInfo result={result} />
					{result.downloadUrl === result.url && <DirectDownloadWarning />}
					{result.isMock && <MockDataWarning />}
					<ResultActions
						result={result}
						isDownloading={isDownloading}
						onDownload={onDownload}
					/>
				</CardContent>
			</Card>
		</motion.div>
	);
}

function ResultThumbnail({ result }: { result: DownloadResult }) {
	return (
		<div className="relative aspect-video bg-black/5 rounded-t-lg overflow-hidden">
			<OptimizedImage
				src={result.thumbnail}
				alt={result.title}
				className="w-full h-full object-cover transition-transform duration-700 group-hover:scale-110"
				loading="lazy"
				placeholder={`https://via.placeholder.com/400x225/1a1a2e/16213e?text=${encodeURIComponent(result.title)}`}
			/>
			<div className="absolute inset-0 bg-black/20 group-hover:bg-black/10 transition-colors" />

			<MediaInfoBadge result={result} />
			{result.isMock && <DemoBadge />}
			<PlatformBadge platform={result.platform} />
		</div>
	);
}

function MediaInfoBadge({ result }: { result: DownloadResult }) {
	return (
		<div className="absolute top-3 right-3 z-10">
			<Badge
				variant="secondary"
				className="backdrop-blur-md bg-black/60 text-white border border-white/10"
			>
				{result.type === "video" ? (
					<Video size={14} className="mr-1" />
				) : (
					<ImageIcon size={14} className="mr-1" />
				)}
				{result.type === "video" ? "Video" : "Image"}
			</Badge>
		</div>
	);
}

function DemoBadge() {
	return (
		<div className="absolute top-3 left-3 z-10">
			<Badge
				variant="destructive"
				className="backdrop-blur-md shadow-lg border border-white/10"
			>
				Demo Data
			</Badge>
		</div>
	);
}

function PlatformBadge({ platform }: { platform: string }) {
	return (
		<div className="absolute bottom-3 left-3 z-10">
			<Badge
				variant="secondary"
				className="backdrop-blur-md bg-black/60 text-white border border-white/10"
			>
				{platform.charAt(0).toUpperCase() + platform.slice(1)}
			</Badge>
		</div>
	);
}

function ResultInfo({ result }: { result: DownloadResult }) {
	return (
		<div>
			<h3 className="font-bold text-lg line-clamp-1" title={result.title}>
				{result.title}
			</h3>
			<p className="text-sm text-muted-foreground flex items-center gap-2">
				{result.size !== "Unknown" && <span>{result.size} • </span>}
				<span>High Quality</span>
				{result.quality && (
					<Badge variant="outline" className="text-xs">
						{result.quality.toUpperCase()}
					</Badge>
				)}
			</p>
		</div>
	);
}

function DirectDownloadWarning() {
	return (
		<div className="p-3 bg-yellow-50/50 dark:bg-yellow-900/20 rounded-lg border border-yellow-200/50">
			<p className="text-xs text-yellow-600 dark:text-yellow-400">
				<strong>Note:</strong> Direct download unavailable. Opening original
				link.
			</p>
		</div>
	);
}

function MockDataWarning() {
	return (
		<div className="p-3 bg-blue-50/50 dark:bg-blue-900/20 rounded-lg border border-blue-200/50">
			<p className="text-xs text-blue-600 dark:text-blue-400">
				<strong>Demo Data:</strong> Real download failed. Showing sample
				content.
			</p>
		</div>
	);
}

interface ResultActionsProps {
	result: DownloadResult;
	isDownloading: boolean;
	onDownload: (result: DownloadResult) => void;
}

function ResultActions({
	result,
	isDownloading,
	onDownload,
}: ResultActionsProps) {
	return (
		<div className="flex gap-3">
			<Button
				className="flex-1 font-semibold shadow-md"
				variant={result.downloadUrl === result.url ? "outline" : "default"}
				onClick={() => onDownload(result)}
				disabled={isDownloading}
			>
				{isDownloading
					? "Processing..."
					: result.downloadUrl === result.url
						? "Open Link"
						: "Download"}
				{!isDownloading && <Download size={18} className="ml-2" />}
			</Button>
			<Button
				variant="outline"
				size="icon"
				onClick={() => window.open(result.url, "_blank")}
			>
				<ExternalLink size={20} />
			</Button>
		</div>
	);
}
