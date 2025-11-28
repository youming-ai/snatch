import { cn } from "@/lib/utils";
import { ErrorState, LoadingPlaceholder, MainImage } from "./image/ImageStates";
import { useImageOptimization } from "./image/useImageOptimization";

interface OptimizedImageProps {
	src: string;
	alt: string;
	className?: string;
	width?: number;
	height?: number;
	loading?: "lazy" | "eager";
	placeholder?: string;
	onLoad?: () => void;
	onError?: (error: Error) => void;
	quality?: number;
	format?: "webp" | "avif" | "original";
}

export function OptimizedImage({
	src,
	alt,
	className,
	width,
	height,
	loading = "lazy",
	placeholder,
	onLoad,
	onError,
	quality = 80,
	format = "original",
}: OptimizedImageProps) {
	const {
		imageState,
		optimizedSrc,
		imgRef,
		handleLoad,
		handleError,
		retry,
		showPlaceholder,
		showImage,
		showError,
	} = useImageOptimization({
		src,
		loading,
		quality,
		format,
		width,
		height,
	});

	const handleLoadWithCallback = () => {
		handleLoad();
		onLoad?.();
	};

	const handleErrorWithCallback = () => {
		handleError();
		const error = new Error(`Failed to load image: ${src}`);
		onError?.(error);
		console.error("Image load error:", error);
	};

	return (
		<div
			ref={imgRef}
			className={cn("relative overflow-hidden", className)}
			style={{
				width: width ? `${width}px` : "100%",
				height: height ? `${height}px` : "auto",
			}}
		>
			{/* Loading state */}
			{showPlaceholder && <LoadingPlaceholder placeholder={placeholder} />}

			{/* Main image */}
			{showImage && (
				<MainImage
					src={optimizedSrc}
					alt={alt}
					loading={loading}
					onLoad={handleLoadWithCallback}
					onError={handleErrorWithCallback}
					isLoaded={imageState === "loaded"}
				/>
			)}

			{/* Error state */}
			{showError && <ErrorState onRetry={retry} />}

			{/* Gradient overlay for better text readability */}
			<div className="absolute inset-0 bg-gradient-to-t from-black/20 to-transparent pointer-events-none" />
		</div>
	);
}

export { generateLQIP } from "./image/useImageOptimization";
