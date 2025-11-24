import { AnimatePresence } from "framer-motion";
import type { DownloadResult } from "@/types/download";
import { useDownloadHandler } from "./results/DownloadHook";
import { DownloadResultCard } from "./results/DownloadResultCard";
import { ResultsHeader } from "./results/ResultsHeader";

interface ResultsDisplayProps {
	results: DownloadResult[];
}

export function ResultsDisplay({ results }: ResultsDisplayProps) {
	const { handleDownload, isDownloading } = useDownloadHandler();

	if (results.length === 0) {
		return null;
	}

	return (
		<AnimatePresence>
			<div className="w-full max-w-5xl space-y-8">
				<ResultsHeader visible={results.length > 0} />

				<div className="grid grid-cols-1 md:grid-cols-2 gap-6">
					{results.map((result, index) => (
						<DownloadResultCard
							key={result.id}
							result={result}
							isDownloading={isDownloading(result.id)}
							onDownload={handleDownload}
							delay={index * 0.1}
						/>
					))}
				</div>
			</div>
		</AnimatePresence>
	);
}
