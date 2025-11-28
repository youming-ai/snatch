import { ExternalLink, Instagram, Music, Twitter } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import type { PlatformInfo } from "@/hooks/useDownloader";

interface PlatformsSectionProps {
	supportedPlatforms: PlatformInfo[];
}

export function PlatformsSection({
	supportedPlatforms,
}: PlatformsSectionProps) {
	const getPlatformIcon = (name: string) => {
		switch (name) {
			case "Instagram":
				return <Instagram className="w-12 h-12 text-pink-500" />;
			case "TikTok":
				return <Music className="w-12 h-12 text-black dark:text-white" />;
			case "X (Twitter)":
				return <Twitter className="w-12 h-12 text-blue-400" />;
			default:
				return <div className="w-12 h-12 bg-muted rounded-lg" />;
		}
	};

	const getPlatformStatus = (name: string) => {
		switch (name) {
			case "TikTok":
				return {
					status: "Working",
					color: "text-green-600",
					bgColor: "bg-green-100 dark:bg-green-900/20",
				};
			case "Instagram":
				return {
					status: "Limited",
					color: "text-yellow-600",
					bgColor: "bg-yellow-100 dark:bg-yellow-900/20",
				};
			case "X (Twitter)":
				return {
					status: "Demo Only",
					color: "text-orange-600",
					bgColor: "bg-orange-100 dark:bg-orange-900/20",
				};
			default:
				return {
					status: "Unknown",
					color: "text-gray-600",
					bgColor: "bg-gray-100 dark:bg-gray-900/20",
				};
		}
	};

	return (
		<div className="space-y-6">
			<div className="text-center space-y-2">
				<h2 className="text-3xl font-bold">Supported Platforms</h2>
				<p className="text-muted-foreground max-w-2xl mx-auto">
					We support the most popular social media platforms. More coming soon!
				</p>
			</div>

			<div className="grid grid-cols-1 md:grid-cols-3 gap-6 max-w-6xl mx-auto">
				{supportedPlatforms.map((platform) => {
					const status = getPlatformStatus(platform.name);
					return (
						<Card
							key={platform.name}
							className="group hover:shadow-lg transition-all duration-200 hover:-translate-y-1 border-border/50 hover:border-border"
						>
							<CardHeader className="text-center pb-4">
								<div className="mx-auto mb-2 group-hover:scale-110 transition-transform duration-200">
									{getPlatformIcon(platform.name)}
								</div>
								<CardTitle className="text-xl">{platform.name}</CardTitle>
								<div className="flex items-center justify-center gap-1 text-xs">
									<span
										className={`px-2 py-1 rounded-full font-medium ${status.bgColor} ${status.color}`}
									>
										{status.status}
									</span>
								</div>
							</CardHeader>
							<CardContent className="space-y-4">
								<p className="text-sm text-muted-foreground text-center">
									{platform.description}
								</p>

								<div className="flex justify-center">
									<Button
										variant="outline"
										size="sm"
										asChild
										className="group-hover:bg-primary group-hover:text-primary-foreground transition-colors"
									>
										<a
											href={platform.url}
											target="_blank"
											rel="noopener noreferrer"
											className="flex items-center gap-1"
										>
											Visit Platform
											<ExternalLink className="w-3 h-3" />
										</a>
									</Button>
								</div>

								{/* Platform-specific info */}
								<div className="text-xs text-muted-foreground space-y-1 pt-2 border-t border-border/50">
									{platform.name === "TikTok" && (
										<div>
											<p>✅ Video downloads working</p>
											<p>✅ Metadata extraction</p>
										</div>
									)}
									{platform.name === "Instagram" && (
										<div>
											<p>⚠️ Limited by anti-scraping</p>
											<p>ℹ️ Requires alternative approach</p>
										</div>
									)}
									{platform.name === "X (Twitter)" && (
										<div>
											<p>⚠️ Mock data only</p>
											<p>ℹ️ Real data requires authentication</p>
										</div>
									)}
								</div>
							</CardContent>
						</Card>
					);
				})}
			</div>

			{/* Feature highlights */}
			<div className="mt-12 text-center space-y-4">
				<h3 className="text-xl font-semibold">Why Choose Our Downloader?</h3>
				<div className="grid grid-cols-2 md:grid-cols-4 gap-4 max-w-4xl mx-auto">
					{[
						{
							title: "No Watermarks",
							description: "Clean downloads without platform watermarks",
						},
						{
							title: "Fast Processing",
							description: "Quick extraction and download speeds",
						},
						{
							title: "Multiple Formats",
							description: "Support for videos, images, and audio",
						},
						{
							title: "Privacy First",
							description: "We don't store your downloaded content",
						},
					].map((feature) => (
						<div key={feature.title} className="p-4 text-center">
							<h4 className="font-medium mb-1">{feature.title}</h4>
							<p className="text-xs text-muted-foreground">
								{feature.description}
							</p>
						</div>
					))}
				</div>
			</div>
		</div>
	);
}
