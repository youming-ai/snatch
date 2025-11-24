"use client";

import { useEffect, useRef, useState } from "react";

interface PerformanceMetrics {
	loadTime: number;
	renderTime: number;
	memoryUsage?: number;
	apiCalls?: number;
	avgApiResponseTime?: number;
}

interface PerformanceMonitorProps {
	trackAPICalls?: boolean;
	trackMemory?: boolean;
	enabled?: boolean;
}

export function PerformanceMonitor({
	trackAPICalls = false,
	enabled = process.env.NODE_ENV === "development",
}: PerformanceMonitorProps) {
	const [metrics, setMetrics] = useState<PerformanceMetrics>({
		loadTime: 0,
		renderTime: 0,
	});
	const startTimeRef = useRef<number>(Date.now());
	const apiCallTimesRef = useRef<number[]>([]);

	// Measure initial page load and render time
	useEffect(() => {
		if (!enabled) return;

		// Measure page load time
		const measureLoadTime = () => {
			const navigation = performance.getEntriesByType(
				"navigation",
			)[0] as PerformanceNavigationTiming;
			const loadTime = navigation.loadEventEnd - navigation.loadEventStart;

			setMetrics((prev) => ({
				...prev,
				loadTime: Math.round(loadTime),
			}));
		};

		// Measure component render time
		const renderTime = Date.now() - startTimeRef.current;
		setMetrics((prev) => ({
			...prev,
			renderTime,
		}));

		measureLoadTime();
	}, [enabled]);

	// Hook to track API calls
	useEffect(() => {
		if (!enabled || !trackAPICalls) return;

		const originalFetch = window.fetch;
		let callCount = 0;

		window.fetch = async (...args) => {
			const startTime = performance.now();
			callCount++;

			try {
				const response = await originalFetch(...args);
				const endTime = performance.now();
				const duration = endTime - startTime;

				// 只记录成功的 API 调用
				if (response.ok || response.status < 500) {
					apiCallTimesRef.current.push(duration);

					setMetrics((prev) => ({
						...prev,
						apiCalls: callCount,
						avgApiResponseTime: Math.round(
							apiCallTimesRef.current.reduce((a, b) => a + b, 0) /
								apiCallTimesRef.current.length,
						),
					}));
				}

				return response;
			} catch (error) {
				const endTime = performance.now();
				const duration = endTime - startTime;

				// 记录失败的调用但不重复统计
				apiCallTimesRef.current.push(duration);

				setMetrics((prev) => ({
					...prev,
					apiCalls: callCount,
					avgApiResponseTime: Math.round(
						apiCallTimesRef.current.reduce((a, b) => a + b, 0) /
							apiCallTimesRef.current.length,
					),
				}));

				// 确保错误能正确传播，不吞没任何错误
				console.error("Fetch error tracked by PerformanceMonitor:", error);
				throw error;
			}
		};

		return () => {
			// 清理：恢复原始 fetch
			window.fetch = originalFetch;
		};
	}, [enabled, trackAPICalls]);

	if (!enabled) return null;

	return (
		<div className="fixed bottom-4 right-4 bg-background/90 backdrop-blur-sm border border-border rounded-lg p-3 text-xs font-mono opacity-75 hover:opacity-100 transition-opacity">
			<div className="space-y-1">
				<div>Load: {metrics.loadTime}ms</div>
				<div>Render: {metrics.renderTime}ms</div>
				{metrics.memoryUsage && <div>Memory: {metrics.memoryUsage}MB</div>}
				{trackAPICalls && metrics.apiCalls !== undefined && (
					<>
						<div>Calls: {metrics.apiCalls}</div>
						{metrics.avgApiResponseTime && (
							<div>Avg: {metrics.avgApiResponseTime}ms</div>
						)}
					</>
				)}
			</div>
		</div>
	);
}

// Custom hook for performance tracking
export function _usePerformanceTracker(name: string) {
	const startTimeRef = useRef<number>();

	const start = () => {
		startTimeRef.current = performance.now();
	};

	const end = () => {
		if (startTimeRef.current) {
			const duration = performance.now() - startTimeRef.current;
			console.log(`${name} took ${duration.toFixed(2)}ms`);
			return duration;
		}
		return 0;
	};

	return { start, end };
}
