import { createRootRoute, HeadContent, Scripts } from "@tanstack/react-router";
import { ErrorBoundary } from "@/components/ErrorBoundary";
import { PerformanceMonitor } from "@/components/PerformanceMonitor";

import appCss from "../styles.css?url";

export const Route = createRootRoute({
	head: () => ({
		meta: [
			{
				charSet: "utf-8",
			},
			{
				name: "viewport",
				content: "width=device-width, initial-scale=1",
			},
			{
				title: "Social Media Downloader",
			},
		],
		links: [
			{
				rel: "stylesheet",
				href: appCss,
			},
			{
				rel: "preconnect",
				href: "https://fonts.googleapis.com",
			},
			{
				rel: "preconnect",
				href: "https://fonts.gstatic.com",
				crossOrigin: "anonymous",
			},
			{
				rel: "stylesheet",
				href: "https://fonts.googleapis.com/css2?family=Inter:wght@300;400;500;600;700&display=swap",
			},
		],
	}),

	shellComponent: RootDocument,
});

function RootDocument({ children }: { children: React.ReactNode }) {
	return (
		<html lang="en">
			<head>
				<HeadContent />
				<meta name="viewport" content="width=device-width, initial-scale=1" />
				<meta
					name="description"
					content="Download videos and images from Instagram, TikTok, and X (Twitter)"
				/>
				<meta name="robots" content="index, follow" />
				<meta
					property="og:title"
					content="MediaGrabber - Social Media Downloader"
				/>
				<meta
					property="og:description"
					content="Download high-quality videos and images from your favorite social platforms"
				/>
				<meta property="og:type" content="website" />
			</head>
			<body>
				<ErrorBoundary
					onError={(error, errorInfo) => {
						// Error is automatically logged by ErrorBoundary
						console.error("Application error:", error, errorInfo);
					}}
				>
					{children}
				</ErrorBoundary>
				<PerformanceMonitor
					trackAPICalls={import.meta.env.DEV}
					trackMemory={import.meta.env.DEV}
				/>
				<Scripts />
			</body>
		</html>
	);
}
