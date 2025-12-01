/**
 * Performance optimization utilities
 */
import { useEffect, useState } from "react";

/**
 * Debounce utility for preventing excessive function calls
 */
export function debounce<T extends (...args: unknown[]) => unknown>(
	func: T,
	wait: number,
	immediate = false,
): (...args: Parameters<T>) => void {
	let timeout: NodeJS.Timeout | null = null;

	return function executedFunction(...args: Parameters<T>) {
		const later = () => {
			timeout = null;
			if (!immediate) func(...args);
		};

		const callNow = immediate && !timeout;

		if (timeout) clearTimeout(timeout);
		timeout = setTimeout(later, wait);

		if (callNow) func(...args);
	};
}

/**
 * Throttle utility for limiting function call frequency
 */
export function throttle<T extends (...args: unknown[]) => unknown>(
	func: T,
	limit: number,
): (...args: Parameters<T>) => void {
	let inThrottle: boolean;

	return function executedFunction(...args: Parameters<T>) {
		if (!inThrottle) {
			func(...args);
			inThrottle = true;
			setTimeout(() => {
				inThrottle = false;
			}, limit);
		}
	};
}

/**
 * Memoize utility for caching expensive computations
 */
export function memoize<T extends (...args: unknown[]) => unknown>(
	func: T,
	keyGenerator?: (...args: Parameters<T>) => string,
): T {
	const cache = new Map<string, ReturnType<T>>();

	return function executedFunction(...args: Parameters<T>): ReturnType<T> {
		const key = keyGenerator ? keyGenerator(...args) : JSON.stringify(args);

		if (cache.has(key)) {
			return cache.get(key) as ReturnType<T>;
		}

		const result = func(...args) as ReturnType<T>;
		cache.set(key, result);

		// Limit cache size to prevent memory leaks
		if (cache.size > 100) {
			const firstKey = cache.keys().next().value;
			if (firstKey) cache.delete(firstKey);
		}

		return result;
	} as T;
}

/**
 * Intersection Observer hook for lazy loading
 */
export function useIntersectionObserver(
	elementRef: React.RefObject<Element>,
	options: IntersectionObserverInit = {},
): boolean {
	const [isIntersecting, setIsIntersecting] = useState(false);

	useEffect(() => {
		const element = elementRef.current;
		if (!element) return;

		const observer = new IntersectionObserver(
			([entry]) => {
				setIsIntersecting(entry.isIntersecting);
			},
			{
				threshold: 0.1,
				rootMargin: "50px",
				...options,
			},
		);

		observer.observe(element);

		return () => {
			observer.disconnect();
		};
	}, [elementRef, options]);

	return isIntersecting;
}

/**
 * Performance monitoring utilities
 */
export class PerformanceMonitor {
	private static instance: PerformanceMonitor;
	private metrics: Map<string, number[]> = new Map();

	private constructor() {}

	static getInstance(): PerformanceMonitor {
		if (!PerformanceMonitor.instance) {
			PerformanceMonitor.instance = new PerformanceMonitor();
		}
		return PerformanceMonitor.instance;
	}

	/**
	 * Measure execution time of a function
	 */
	measure<T>(name: string, fn: () => T): T {
		const start = performance.now();
		const result = fn();
		const end = performance.now();

		this.recordMetric(name, end - start);
		return result;
	}

	/**
	 * Measure async execution time
	 */
	async measureAsync<T>(name: string, fn: () => Promise<T>): Promise<T> {
		const start = performance.now();
		const result = await fn();
		const end = performance.now();

		this.recordMetric(name, end - start);
		return result;
	}

	/**
	 * Record a metric
	 */
	private recordMetric(name: string, value: number): void {
		if (!this.metrics.has(name)) {
			this.metrics.set(name, []);
		}

		const values = this.metrics.get(name);
		if (values) {
			values.push(value);

			// Keep only last 100 measurements
			if (values.length > 100) {
				values.shift();
			}
		}
	}

	/**
	 * Get average metric value
	 */
	getAverage(name: string): number {
		const values = this.metrics.get(name);
		if (!values || values.length === 0) return 0;

		return values.reduce((sum, val) => sum + val, 0) / values.length;
	}

	/**
	 * Get all metrics
	 */
	getMetrics(): Record<
		string,
		{ average: number; count: number; min: number; max: number }
	> {
		const result: Record<
			string,
			{ average: number; count: number; min: number; max: number }
		> = {};

		for (const [name, values] of this.metrics.entries()) {
			result[name] = {
				average: this.getAverage(name),
				count: values.length,
				min: Math.min(...values),
				max: Math.max(...values),
			};
		}

		return result;
	}

	/**
	 * Clear all metrics
	 */
	clearMetrics(): void {
		this.metrics.clear();
	}
}

/**
 * Resource loading utilities
 */
const loadedScripts = new Set<string>();
const loadedStyles = new Set<string>();

/**
 * Load external script
 */
export async function loadScript(
	src: string,
	options: {
		async?: boolean;
		defer?: boolean;
		integrity?: string;
		crossOrigin?: string;
	} = {},
): Promise<void> {
	if (loadedScripts.has(src)) {
		return;
	}

	return new Promise((resolve, reject) => {
		const script = document.createElement("script");
		script.src = src;
		script.async = options.async ?? true;
		script.defer = options.defer ?? false;

		if (options.integrity) {
			script.integrity = options.integrity;
		}

		if (options.crossOrigin) {
			script.crossOrigin = options.crossOrigin;
		}

		script.onload = () => {
			loadedScripts.add(src);
			resolve();
		};

		script.onerror = () => {
			reject(new Error(`Failed to load script: ${src}`));
		};

		document.head.appendChild(script);
	});
}

/**
 * Load external stylesheet
 */
export async function loadStyle(href: string): Promise<void> {
	if (loadedStyles.has(href)) {
		return;
	}

	return new Promise((resolve, reject) => {
		const link = document.createElement("link");
		link.rel = "stylesheet";
		link.href = href;

		link.onload = () => {
			loadedStyles.add(href);
			resolve();
		};

		link.onerror = () => {
			reject(new Error(`Failed to load stylesheet: ${href}`));
		};

		document.head.appendChild(link);
	});
}

/**
 * Memory usage monitoring (in supported browsers)
 */
interface PerformanceMemory {
	usedJSHeapSize: number;
	totalJSHeapSize: number;
	jsHeapSizeLimit: number;
}

interface PerformanceWithMemory extends Performance {
	memory?: PerformanceMemory;
}

export function getMemoryUsage(): {
	used: number;
	allocated: number;
	limit: number;
} | null {
	const perf = performance as PerformanceWithMemory;
	if (!perf.memory) {
		return null;
	}

	const memory = perf.memory;
	return {
		used: memory.usedJSHeapSize,
		allocated: memory.totalJSHeapSize,
		limit: memory.jsHeapSizeLimit,
	};
}

/**
 * Network information utility
 */
interface NetworkInformation {
	effectiveType?: string;
	downlink?: number;
	rtt?: number;
	saveData?: boolean;
}

interface NavigatorWithConnection extends Navigator {
	connection?: NetworkInformation;
}

export function getNetworkInfo(): {
	effectiveType?: string;
	downlink?: number;
	rtt?: number;
	saveData?: boolean;
} | null {
	const nav = navigator as NavigatorWithConnection;
	if (!nav.connection) {
		return null;
	}

	const connection = nav.connection;
	return {
		effectiveType: connection.effectiveType,
		downlink: connection.downlink,
		rtt: connection.rtt,
		saveData: connection.saveData,
	};
}

/**
 * Performance marks and measures
 */

/**
 * Mark a performance point
 */
export function markPerformance(name: string): void {
	performance.mark(name);
}

/**
 * Measure between two marks
 */
export function measurePerformance(
	name: string,
	startMark: string,
	endMark?: string,
): number {
	const measureName = `${name}-measure`;

	try {
		performance.measure(measureName, startMark, endMark);
		const entries = performance.getEntriesByName(measureName, "measure");
		return entries[entries.length - 1]?.duration || 0;
	} catch (error) {
		console.warn("Performance measure failed:", error);
		return 0;
	}
}

/**
 * Clear marks
 */
export function clearPerformanceMarks(name?: string): void {
	if (name) {
		performance.clearMarks(name);
	} else {
		performance.clearMarks();
	}
}

/**
 * Clear measures
 */
export function clearPerformanceMeasures(name?: string): void {
	if (name) {
		performance.clearMeasures(name);
	} else {
		performance.clearMeasures();
	}
}
