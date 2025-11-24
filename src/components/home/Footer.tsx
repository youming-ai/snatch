import { ExternalLink, Github, Heart } from "lucide-react";
import { Button } from "@/components/ui/button";

export function Footer() {
	return (
		<footer className="border-t border-border/50 bg-muted/30">
			<div className="container mx-auto px-4 py-12">
				<div className="grid grid-cols-1 md:grid-cols-4 gap-8">
					{/* Brand section */}
					<div className="space-y-4">
						<h3 className="text-lg font-semibold">MediaGrabber</h3>
						<p className="text-sm text-muted-foreground">
							Download your favorite social media content with ease. Fast,
							secure, and completely free.
						</p>
						<div className="flex items-center space-x-2">
							<Button variant="ghost" size="sm" asChild>
								<a
									href="https://github.com"
									target="_blank"
									rel="noopener noreferrer"
									className="flex items-center gap-1"
								>
									<Github className="w-4 h-4" />
									GitHub
								</a>
							</Button>
						</div>
					</div>

					{/* Features section */}
					<div className="space-y-4">
						<h4 className="text-sm font-semibold uppercase tracking-wider">
							Features
						</h4>
						<ul className="space-y-2 text-sm text-muted-foreground">
							<li>High Quality Downloads</li>
							<li>No Watermarks</li>
							<li>Fast Processing</li>
							<li>Multiple Formats</li>
						</ul>
					</div>

					{/* Platforms section */}
					<div className="space-y-4">
						<h4 className="text-sm font-semibold uppercase tracking-wider">
							Platforms
						</h4>
						<ul className="space-y-2 text-sm text-muted-foreground">
							<li>
								TikTok
								<span className="ml-2 text-xs bg-green-100 dark:bg-green-900/20 text-green-600 px-2 py-1 rounded">
									Working
								</span>
							</li>
							<li>
								Instagram
								<span className="ml-2 text-xs bg-yellow-100 dark:bg-yellow-900/20 text-yellow-600 px-2 py-1 rounded">
									Limited
								</span>
							</li>
							<li>
								X (Twitter)
								<span className="ml-2 text-xs bg-orange-100 dark:bg-orange-900/20 text-orange-600 px-2 py-1 rounded">
									Demo
								</span>
							</li>
						</ul>
					</div>

					{/* Legal section */}
					<div className="space-y-4">
						<h4 className="text-sm font-semibold uppercase tracking-wider">
							Legal
						</h4>
						<ul className="space-y-2 text-sm text-muted-foreground">
							<li>Privacy Policy</li>
							<li>Terms of Service</li>
							<li>Copyright Notice</li>
							<li>Contact</li>
						</ul>
					</div>
				</div>

				<div className="mt-8 pt-8 border-t border-border/50">
					<div className="flex flex-col md:flex-row justify-between items-center space-y-4 md:space-y-0">
						<div className="text-sm text-muted-foreground">
							© 2024 MediaGrabber. All rights reserved.
						</div>
						<div className="flex items-center space-x-4 text-sm text-muted-foreground">
							<span>Made with</span>
							<Heart className="w-4 h-4 text-red-500 fill-current" />
							<span>for the community</span>
						</div>
					</div>
				</div>

				{/* Disclaimer */}
				<div className="mt-8 p-4 bg-muted/50 rounded-lg border border-border/50">
					<div className="flex items-start space-x-2">
						<ExternalLink className="w-4 h-4 text-muted-foreground mt-0.5 flex-shrink-0" />
						<div className="text-xs text-muted-foreground space-y-1">
							<p>
								<strong>Disclaimer:</strong> This tool is for educational and
								personal use only. Please respect copyright laws and terms of
								service of social media platforms.
							</p>
							<p>
								We do not host or store any content. All downloads are processed
								from the original URLs provided by users.
							</p>
						</div>
					</div>
				</div>
			</div>
		</footer>
	);
}
