import { cn } from "@/lib/utils";

interface LoadingPlaceholderProps {
	placeholder?: string;
	className?: string;
}

export function LoadingPlaceholder({
	placeholder,
	className,
}: LoadingPlaceholderProps) {
	return (
		<div
			className={cn(
				"absolute inset-0 bg-muted flex items-center justify-center",
				className,
			)}
			style={{
				backgroundImage: placeholder ? `url(${placeholder})` : undefined,
				backgroundSize: "cover",
				backgroundPosition: "center",
				filter: placeholder ? "blur(10px)" : "none",
			}}
		>
			{!placeholder && (
				<div className="w-8 h-8 border-2 border-muted-foreground/20 border-t-muted-foreground rounded-full animate-spin" />
			)}
		</div>
	);
}

interface ErrorStateProps {
	onRetry: () => void;
	className?: string;
}

export function ErrorState({ onRetry, className }: ErrorStateProps) {
	return (
		<div
			className={cn(
				"absolute inset-0 bg-destructive/10 flex items-center justify-center",
				className,
			)}
		>
			<div className="text-center text-destructive p-4">
				<div className="text-sm font-medium">Failed to load image</div>
				<button
					type="button"
					onClick={onRetry}
					className="mt-2 text-xs underline hover:no-underline"
				>
					Retry
				</button>
			</div>
		</div>
	);
}

interface MainImageProps {
	src: string;
	alt: string;
	loading: "lazy" | "eager";
	onLoad: () => void;
	onError: () => void;
	isLoaded: boolean;
	className?: string;
}

export function MainImage({
	src,
	alt,
	loading,
	onLoad,
	onError,
	isLoaded,
	className,
}: MainImageProps) {
	return (
		<img
			src={src}
			alt={alt}
			className={cn(
				"w-full h-full object-cover transition-opacity duration-300",
				isLoaded ? "opacity-100" : "opacity-0",
				className,
			)}
			onLoad={onLoad}
			onError={onError}
			loading={loading}
			decoding="async"
		/>
	);
}
