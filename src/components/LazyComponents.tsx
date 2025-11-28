import {
	type ComponentType,
	lazy,
	Suspense,
	useEffect,
	useRef,
	useState,
} from "react";
import { Skeleton } from "@/components/ui/skeleton";

/**
 * Lazy loading wrapper with fallback
 * @internal Currently unused but kept for future use
 */
function _LazyWrapper<T extends ComponentType<Record<string, never>>>({
	component,
	fallback,
}: {
	component: T;
	fallback?: React.ReactNode;
}) {
	const LazyComponent = lazy(() =>
		import(`./${component.name}`).then((module) => ({
			default: module[component.name as keyof typeof module] as T,
		})),
	);

	const FallbackComponent = fallback || <DefaultSkeleton />;

	return (
		<Suspense fallback={FallbackComponent}>
			<LazyComponent />
		</Suspense>
	);
}

/**
 * Default skeleton fallback
 */
function DefaultSkeleton() {
	return (
		<div className="w-full space-y-4">
			<div className="space-y-2">
				<Skeleton className="h-4 w-1/4" />
				<Skeleton className="h-10 w-full" />
			</div>
			<Skeleton className="h-32 w-full" />
		</div>
	);
}

/**
 * Lazy loaded components
 */
export const LazyDownloadForm = lazy(() =>
	import("./DownloadForm").then((module) => ({ default: module.DownloadForm })),
);
export const LazyResultsDisplay = lazy(() =>
	import("./ResultsDisplay").then((module) => ({
		default: module.ResultsDisplay,
	})),
);
export const LazyFeaturesSection = lazy(() =>
	import("./FeaturesSection").then((module) => ({
		default: module.FeaturesSection,
	})),
);
export const LazyPlatformsSection = lazy(() =>
	import("./PlatformsSection").then((module) => ({
		default: module.PlatformsSection,
	})),
);
export const LazyPerformanceMonitor = lazy(() =>
	import("./PerformanceMonitor").then((module) => ({
		default: module.PerformanceMonitor,
	})),
);

/**
 * Preload utilities
 */
export const preloadComponents = {
	downloadForm: () => import("./DownloadForm"),
	resultsDisplay: () => import("./ResultsDisplay"),
	featuresSection: () => import("./FeaturesSection"),
	platformsSection: () => import("./PlatformsSection"),
	performanceMonitor: () => import("./PerformanceMonitor"),
};

/**
 * Intersection Observer based lazy loading for better performance
 */
export function useIntersectionLazyLoad<
	T extends ComponentType<Record<string, never>>,
>(
	component: T,
	options: {
		threshold?: number;
		rootMargin?: string;
		fallback?: React.ReactNode;
	} = {},
) {
	const [isVisible, setIsVisible] = useState(false);
	const elementRef = useRef<HTMLDivElement>(null);

	useEffect(() => {
		const element = elementRef.current;
		if (!element) return;

		const observer = new IntersectionObserver(
			([entry]) => {
				if (entry.isIntersecting) {
					setIsVisible(true);
					observer.disconnect();
				}
			},
			{
				threshold: options.threshold || 0.1,
				rootMargin: options.rootMargin || "50px",
			},
		);

		observer.observe(element);

		return () => observer.disconnect();
	}, [options.threshold, options.rootMargin]);

	const LazyComponent = lazy(() =>
		import(`./${component.name}`).then((module) => ({
			default: module[component.name as keyof typeof module] as T,
		})),
	);

	return {
		elementRef,
		Component: isVisible ? (
			<Suspense fallback={options.fallback || <DefaultSkeleton />}>
				<LazyComponent />
			</Suspense>
		) : (
			options.fallback || <DefaultSkeleton />
		),
	};
}

/**
 * Route-based code splitting utilities
 */
export function createLazyRoute<T extends ComponentType<Record<string, never>>>(
	componentPath: string,
	componentName: string,
) {
	return lazy(() =>
		import(componentPath).then((module) => ({
			default: module[componentName as keyof typeof module] as T,
		})),
	);
}

/**
 * Preload component on user interaction
 */
export function preloadOnInteraction<
	T extends ComponentType<Record<string, never>>,
>(component: T, trigger: "hover" | "focus" | "click" = "hover") {
	const Component = lazy(() =>
		import(`./${component.name}`).then((module) => ({
			default: module[component.name as keyof typeof module] as T,
		})),
	);

	const preloadComponent = () => {
		import(`./${component.name}`);
	};

	const eventHandlers = {
		hover: {
			onMouseEnter: preloadComponent,
		},
		focus: {
			onFocus: preloadComponent,
		},
		click: {
			onClick: preloadComponent,
		},
	};

	return {
		Component,
		...eventHandlers[trigger],
	};
}
