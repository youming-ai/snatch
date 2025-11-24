import { useCallback, useState } from "react";
import type { DownloadResult } from "@/types/download";

export function useDownloadHandler() {
	const [downloadingItems, setDownloadingItems] = useState<Set<string>>(
		new Set(),
	);

	const handleDownload = useCallback(async (result: DownloadResult) => {
		const itemId = result.id;

		// Set downloading state
		setDownloadingItems((prev) => new Set([...prev, itemId]));

		try {
			if (result.downloadUrl === result.url) {
				// Open in new tab if direct download not available
				window.open(result.url, "_blank");
			} else {
				// Trigger file download
				const link = document.createElement("a");
				link.href = result.downloadUrl;
				link.download = `${result.title.replace(/[^a-z0-9]/gi, "_")}.${result.type === "video" ? "mp4" : "jpg"}`;
				link.target = "_blank";
				document.body.appendChild(link);
				link.click();
				document.body.removeChild(link);
			}
		} catch (error) {
			console.error("Download failed:", error);
		} finally {
			// Remove downloading state
			setDownloadingItems((prev) => {
				const newSet = new Set(prev);
				newSet.delete(itemId);
				return newSet;
			});
		}
	}, []);

	const isDownloading = useCallback(
		(id: string) => {
			return downloadingItems.has(id);
		},
		[downloadingItems],
	);

	return {
		handleDownload,
		isDownloading,
	};
}
