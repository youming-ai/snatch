import { DownloadResult } from "@/components/DownloadResult";
import type { DownloadResult as DownloadResultType } from "@/services/unified-download.service";

interface ResultsSectionProps {
	results: DownloadResultType[];
	loading: boolean;
	onClearResults: () => void;
}

export function ResultsSection({
	results,
	loading,
	onClearResults,
}: ResultsSectionProps) {
	if (loading) {
		return (
			<div className="space-y-6">
				<div className="text-center space-y-4">
					<div className="inline-flex items-center justify-center w-16 h-16 bg-primary/10 rounded-full">
						<div className="animate-spin rounded-full h-8 w-8 border-2 border-primary border-t-transparent" />
					</div>
					<div>
						<h3 className="text-xl font-semibold">Processing Your Request</h3>
						<p className="text-muted-foreground">
							We're extracting content from the URL. This usually takes a few
							seconds...
						</p>
					</div>
				</div>

				{/* Loading skeleton */}
				<div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
					{Array.from({ length: 3 }).map((_, index) => (
						<div
							key={index}
							className="animate-pulse border rounded-lg p-4 space-y-3"
						>
							<div className="bg-muted rounded h-32 w-full" />
							<div className="space-y-2">
								<div className="bg-muted rounded h-4 w-3/4" />
								<div className="bg-muted rounded h-3 w-1/2" />
							</div>
							<div className="bg-muted rounded h-10 w-full" />
						</div>
					))}
				</div>
			</div>
		);
	}

	if (results.length === 0) {
		return null;
	}

	return (
		<div className="space-y-6">
			{/* Results header */}
			<div className="flex items-center justify-between">
				<div>
					<h3 className="text-2xl font-bold">Download Results</h3>
					<p className="text-muted-foreground">
						Found {results.length} item{results.length > 1 ? "s" : ""} ready for
						download
					</p>
				</div>
				<button
					onClick={onClearResults}
					className="text-sm text-muted-foreground hover:text-foreground transition-colors"
				>
					Clear Results
				</button>
			</div>

			{/* Download results grid */}
			<div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
				{results.map((result, index) => (
					<div
						key={result.id || index}
						className="animate-in slide-in-from-bottom-2 fade-in duration-300"
						style={{ animationDelay: `${index * 100}ms` }}
					>
						<DownloadResult result={result} />
					</div>
				))}
			</div>

			{/* Download all button */}
			{results.length > 1 && (
				<div className="text-center pt-6">
					<div className="inline-flex flex-col items-center space-y-2">
						<p className="text-sm text-muted-foreground">
							Download all {results.length} items at once
						</p>
						<button className="inline-flex items-center justify-center rounded-md text-sm font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:opacity-50 disabled:pointer-events-none ring-offset-background bg-primary text-primary-foreground hover:bg-primary/90 h-10 px-4 py-2">
							Download All Items
						</button>
					</div>
				</div>
			)}

			{/* Tips section */}
			<div className="mt-12 p-6 bg-muted/50 rounded-lg border border-border/50">
				<h4 className="font-semibold mb-3">Download Tips</h4>
				<div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-sm text-muted-foreground">
					<div className="space-y-2">
						<p>• Right-click and select "Save link as..." to download</p>
						<p>• Check the file size before downloading large videos</p>
					</div>
					<div className="space-y-2">
						<p>• Some videos may be available in multiple quality options</p>
						<p>• Download links expire after a certain time period</p>
					</div>
				</div>
			</div>
		</div>
	);
}
