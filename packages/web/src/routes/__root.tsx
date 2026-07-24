import { createRootRoute, HeadContent, Outlet, Scripts } from "@tanstack/react-router";
import type { ReactNode } from "react";
import { ErrorBoundary } from "../components/ErrorBoundary";
import appCss from "../styles.css?url";

const DESCRIPTION =
	"Download videos, audio and images from TikTok, X, YouTube, Instagram, Reddit and 15+ more platforms for free. No signup, no ads — paste a link and Snatch grabs the original file.";
const OG_DESCRIPTION =
	"Download videos from X and TikTok for free. No signup, no ads — paste a link and Snatch grabs the original-quality file in seconds.";
const OG_IMAGE = "https://snatch.umuo.app/logo512.png";

const jsonLd = JSON.stringify({
	"@context": "https://schema.org",
	"@type": "WebApplication",
	name: "Snatch",
	url: "https://snatch.umuo.app/",
	description: OG_DESCRIPTION,
	applicationCategory: "MultimediaApplication",
	operatingSystem: "Any",
	browserRequirements: "Requires JavaScript. Requires HTML5.",
	offers: { "@type": "Offer", price: "0", priceCurrency: "USD" },
	featureList: [
		"Download X videos and GIFs",
		"Download TikTok videos without watermark",
		"Original quality, no signup required",
	],
});

const clarity = `(function (c, l, a, r, i, t, y) {
c[a] = c[a] || function () { (c[a].q = c[a].q || []).push(arguments); };
t = l.createElement(r); t.async = 1; t.src = "https://www.clarity.ms/tag/" + i;
y = l.getElementsByTagName(r)[0]; y.parentNode.insertBefore(t, y);
})(window, document, "clarity", "script", "wmm9dx4zn5");`;

export const Route = createRootRoute({
	ssr: false,
	head: () => ({
		meta: [
			{ charSet: "utf-8" },
			{ name: "viewport", content: "width=device-width, initial-scale=1" },
			{ title: "Snatch — Free Social Media Video & Audio Downloader" },
			{ name: "description", content: DESCRIPTION },
			{ name: "robots", content: "index, follow, max-image-preview:large" },
			{ name: "theme-color", content: "#7c3aed" },
			{ property: "og:type", content: "website" },
			{ property: "og:site_name", content: "Snatch" },
			{ property: "og:locale", content: "en_US" },
			{ property: "og:url", content: "https://snatch.umuo.app/" },
			{ property: "og:title", content: "Snatch — Free X & TikTok Video Downloader" },
			{ property: "og:description", content: OG_DESCRIPTION },
			{ property: "og:image", content: OG_IMAGE },
			{ property: "og:image:width", content: "512" },
			{ property: "og:image:height", content: "512" },
			{ property: "og:image:alt", content: "Snatch — social media video downloader" },
			{ name: "twitter:card", content: "summary_large_image" },
			{ name: "twitter:title", content: "Snatch — Free X & TikTok Video Downloader" },
			{ name: "twitter:description", content: OG_DESCRIPTION },
			{ name: "twitter:image", content: OG_IMAGE },
		],
		links: [
			{ rel: "canonical", href: "https://snatch.umuo.app/" },
			{ rel: "icon", type: "image/svg+xml", href: "/logo.svg" },
			{ rel: "icon", type: "image/x-icon", href: "/favicon.ico" },
			{ rel: "apple-touch-icon", href: "/logo192.png" },
			{ rel: "manifest", href: "/manifest.json" },
			{ rel: "preconnect", href: "https://fonts.googleapis.com" },
			{ rel: "preconnect", href: "https://fonts.gstatic.com", crossOrigin: "anonymous" },
			{
				rel: "stylesheet",
				href: "https://fonts.googleapis.com/css2?family=Inter:wght@300;400;500;600;700&display=swap",
			},
			{ rel: "stylesheet", href: appCss },
		],
		scripts: [{ type: "application/ld+json", children: jsonLd }, { children: clarity }],
	}),
	shellComponent: RootDocument,
	component: () => (
		<ErrorBoundary>
			<Outlet />
		</ErrorBoundary>
	),
});

function RootDocument({ children }: { children: ReactNode }) {
	return (
		<html lang="en">
			<head>
				<HeadContent />
			</head>
			<body>
				{children}
				<Scripts />
			</body>
		</html>
	);
}
