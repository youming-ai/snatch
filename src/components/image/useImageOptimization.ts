import { useEffect, useRef, useState } from "react";

interface ImageOptimizationOptions {
	src: string;
	loading?: "lazy" | "eager";
	quality?: number;
	format?: "webp" | "avif" | "original";
	width?: number;
	height?: number;
}

export function useImageOptimization({
	src,
	loading = "lazy",
	quality = 80,
	format = "original",
	width,
	height,
}: ImageOptimizationOptions) {
	const [imageState, setImageState] = useState<"loading" | "loaded" | "error">(
		"loading",
	);
	const [isIntersecting, setIsIntersecting] = useState(false);
	const imgRef = useRef<HTMLImageElement>(null);
	const observerRef = useRef<IntersectionObserver | null>(null);

	// Setup intersection observer for lazy loading
	useEffect(() => {
		if (loading === "eager") {
			setIsIntersecting(true);
			return;
		}

		observerRef.current = new IntersectionObserver(
			([entry]) => {
				if (entry.isIntersecting) {
					setIsIntersecting(true);
					observerRef.current?.disconnect();
				}
			},
			{
				rootMargin: "50px", // Start loading 50px before it comes into view
			},
		);

		if (imgRef.current) {
			observerRef.current.observe(imgRef.current);
		}

		return () => {
			observerRef.current?.disconnect();
		};
	}, [loading]);

	const handleLoad = () => {
		setImageState("loaded");
	};

	const handleError = () => {
		setImageState("error");
	};

	// Generate optimized src based on format
	const getOptimizedSrc = (originalSrc: string) => {
		if (format === "original") return originalSrc;

		// In a real application, you would use an image optimization service
		// This is a placeholder for demonstration
		const params = new URLSearchParams({
			q: quality.toString(),
			f: format,
			w: width?.toString() || "",
			h: height?.toString() || "",
		});

		return `${originalSrc}?${params.toString()}`;
	};

	const optimizedSrc = getOptimizedSrc(src);

	const retry = () => {
		setImageState("loading");
		// Force re-render to retry loading
		const img = imgRef.current?.querySelector("img");
		if (img) {
			const currentSrc = img.src;
			img.src = "";
			img.src = currentSrc;
		}
	};

	return {
		imageState,
		isIntersecting,
		optimizedSrc,
		imgRef,
		handleLoad,
		handleError,
		retry,
		showPlaceholder: imageState === "loading" || !isIntersecting,
		showImage: isIntersecting && imageState !== "error",
		showError: imageState === "error",
	};
}

// Low-quality image placeholder (LQIP) generator
export function generateLQIP(
	src: string,
	width: number = 20,
	height: number = 20,
): Promise<string> {
	return new Promise((resolve) => {
		const img = new Image();
		img.onload = () => {
			const canvas = document.createElement("canvas");
			const ctx = canvas.getContext("2d");

			if (!ctx) {
				resolve("");
				return;
			}

			canvas.width = width;
			canvas.height = height;

			// Draw low-quality version
			ctx.imageSmoothingEnabled = false;
			ctx.drawImage(img, 0, 0, width, height);

			// Convert to base64
			const lqip = canvas.toDataURL("image/jpeg", 0.1);
			resolve(lqip);
		};

		img.onerror = () => resolve("");
		img.src = src;
	});
}
