import { createRootRoute, HeadContent, Outlet, Scripts } from "@tanstack/react-router";
import type { ReactNode } from "react";
import { ErrorBoundary } from "../components/ErrorBoundary";
import appCss from "../styles.css?url";

/**
 * Deployment-specific values, all optional and baked in at build time.
 *
 * Empty means "not ours to claim": a self-hosted instance must not point its
 * canonical link, its social preview image or its analytics at the domain this
 * project happens to be deployed on.
 */
const SITE_URL = (import.meta.env.VITE_SITE_URL ?? "").replace(/\/+$/, "");
const CLARITY_ID = import.meta.env.VITE_CLARITY_ID ?? "";

const TITLE = "Snatch — Free Social Media Video & Audio Downloader";
const DESCRIPTION =
	"Paste a link and download the original video or audio file — no signup, no ads. Powered by yt-dlp, so it works on YouTube, X, TikTok, Instagram, Reddit and ~1,800 more sites.";

const canonicalUrl = SITE_URL ? `${SITE_URL}/` : undefined;
const ogImage = SITE_URL ? `${SITE_URL}/logo512.png` : undefined;

const jsonLd = JSON.stringify({
	"@context": "https://schema.org",
	"@type": "WebApplication",
	name: "Snatch",
	...(canonicalUrl ? { url: canonicalUrl } : {}),
	description: DESCRIPTION,
	applicationCategory: "MultimediaApplication",
	operatingSystem: "Any",
	browserRequirements: "Requires JavaScript. Requires HTML5.",
	offers: { "@type": "Offer", price: "0", priceCurrency: "USD" },
	featureList: [
		"Download X videos and GIFs",
		"Download TikTok videos without watermark",
		"Video and audio in the original quality, no signup required",
	],
});

const clarity = CLARITY_ID
	? `(function (c, l, a, r, i, t, y) {
c[a] = c[a] || function () { (c[a].q = c[a].q || []).push(arguments); };
t = l.createElement(r); t.async = 1; t.src = "https://www.clarity.ms/tag/" + i;
y = l.getElementsByTagName(r)[0]; y.parentNode.insertBefore(t, y);
})(window, document, "clarity", "script", ${JSON.stringify(CLARITY_ID)});`
	: null;

export const Route = createRootRoute({
	ssr: false,
	head: () => ({
		meta: [
			{ charSet: "utf-8" },
			{ name: "viewport", content: "width=device-width, initial-scale=1" },
			{ title: TITLE },
			{ name: "description", content: DESCRIPTION },
			{ name: "robots", content: "index, follow, max-image-preview:large" },
			{ name: "theme-color", content: "#7c3aed" },
			{ property: "og:type", content: "website" },
			{ property: "og:site_name", content: "Snatch" },
			{ property: "og:locale", content: "en_US" },
			{ property: "og:title", content: TITLE },
			{ property: "og:description", content: DESCRIPTION },
			...(canonicalUrl ? [{ property: "og:url", content: canonicalUrl }] : []),
			...(ogImage
				? [
						{ property: "og:image", content: ogImage },
						{ property: "og:image:width", content: "512" },
						{ property: "og:image:height", content: "512" },
						{ property: "og:image:alt", content: "Snatch — social media video downloader" },
					]
				: []),
			{ name: "twitter:card", content: "summary_large_image" },
			{ name: "twitter:title", content: TITLE },
			{ name: "twitter:description", content: DESCRIPTION },
			...(ogImage ? [{ name: "twitter:image", content: ogImage }] : []),
		],
		links: [
			...(canonicalUrl ? [{ rel: "canonical", href: canonicalUrl }] : []),
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
		scripts: [
			{ type: "application/ld+json", children: jsonLd },
			...(clarity ? [{ children: clarity }] : []),
		],
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
