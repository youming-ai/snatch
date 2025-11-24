import { Link2 } from "lucide-react";
import { useCallback, useMemo, useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { validate } from "@/lib/validation";
import { downloadService } from "@/services/unified-download.service";
import type { DownloadResult } from "@/types/download";

interface DownloadFormProps {
	onDownloadStart: (loading: boolean) => void;
	onResults: (results: DownloadResult[]) => void;
	onError: (error: string | null) => void;
}

export function DownloadForm({
	onDownloadStart,
	onResults,
	onError,
}: DownloadFormProps) {
	const [url, setUrl] = useState("");

	// 使用已有的验证函数，避免重复逻辑
	const urlValidation = useMemo(() => validate(url), [url]);
	const isButtonDisabled = !url.trim() || !urlValidation.isValid;

	const handleDownload = useCallback(async () => {
		if (!urlValidation.isValid) {
			onError(urlValidation.errors.join(", "));
			return;
		}

		onDownloadStart(true);
		onError(null);
		onResults([]);

		try {
			const response = await downloadService.download(url.trim());

			if (!response.success) {
				throw new Error(response.error || "Failed to download content");
			}

			if (response.results) {
				onResults(response.results);
			}
		} catch (err) {
			console.error("Download error:", err);
			onError(
				err instanceof Error
					? err.message
					: "Failed to download content. Please try again.",
			);
		} finally {
			onDownloadStart(false);
		}
	}, [urlValidation, url, onDownloadStart, onResults, onError]);

	const handleKeyDown = useCallback(
		(e: React.KeyboardEvent) => {
			if (e.key === "Enter") {
				handleDownload();
			}
		},
		[handleDownload],
	);

	return (
		<Card className="border-none shadow-2xl bg-background/60 backdrop-blur-xl overflow-visible">
			<CardContent className="p-8 gap-6">
				<div className="relative group">
					<div className="absolute -inset-1 bg-gradient-to-r from-cyan-500 to-purple-600 rounded-2xl blur opacity-20 group-hover:opacity-40 transition duration-500" />
					<div className="relative">
						<Input
							placeholder="Paste URL from Instagram, TikTok or X..."
							value={url}
							onChange={(e) => setUrl(e.target.value)}
							className="text-lg h-16 bg-background/50 hover:bg-background/80 transition-colors shadow-inner border-border/20 pr-12"
							onKeyDown={handleKeyDown}
						/>
						<Link2 className="absolute right-4 top-1/2 transform -translate-y-1/2 text-muted-foreground pointer-events-none" />
					</div>
				</div>

				<Button
					size="lg"
					className="w-full font-bold text-lg mt-4 h-14 bg-gradient-to-r from-cyan-500 to-blue-600 shadow-lg shadow-cyan-500/25 hover:shadow-cyan-500/40 transition-shadow"
					onClick={handleDownload}
					disabled={isButtonDisabled}
				>
					Download Now
				</Button>
			</CardContent>
		</Card>
	);
}
