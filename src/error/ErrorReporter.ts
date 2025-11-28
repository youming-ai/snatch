import { config } from "@/config/env";

export interface ErrorInfo {
	error: Error;
	errorInfo?: {
		componentStack: string;
	};
	context?: {
		url?: string;
		userAgent?: string;
		timestamp?: string;
		userId?: string;
		sessionId?: string;
		additionalData?: Record<string, unknown>;
	};
}

/**
 * Global error reporter
 * Handles error logging and reporting to external services
 */
export class ErrorReporter {
	private static instance: ErrorReporter;
	private errorQueue: ErrorInfo[] = [];
	private isOnline = typeof navigator !== "undefined" ? navigator.onLine : true;

	private constructor() {
		if (typeof window !== "undefined") {
			this.setupEventListeners();
			this.setupOnlineStatusMonitoring();
		}
	}

	static getInstance(): ErrorReporter {
		if (!ErrorReporter.instance) {
			ErrorReporter.instance = new ErrorReporter();
		}
		return ErrorReporter.instance;
	}

	/**
	 * Report an error with context
	 */
	report(error: ErrorInfo): void {
		const errorWithTimestamp = {
			...error,
			context: {
				...error.context,
				timestamp: new Date().toISOString(),
				userAgent:
					typeof navigator !== "undefined" ? navigator.userAgent : "server",
			},
		};

		if (config.isDevelopment) {
			this.logToConsole(errorWithTimestamp);
		}

		if (config.isProduction) {
			this.logToService(errorWithTimestamp);
		}

		// Add to queue for offline support
		if (!this.isOnline) {
			this.errorQueue.push(errorWithTimestamp);
		}
	}

	/**
	 * Log error to console in development
	 */
	private logToConsole(errorInfo: ErrorInfo): void {
		console.group("🚨 Application Error");
		console.error("Error:", errorInfo.error);
		console.error("Context:", errorInfo.context);
		if (errorInfo.errorInfo?.componentStack) {
			console.error("Component Stack:", errorInfo.errorInfo.componentStack);
		}
		console.groupEnd();
	}

	/**
	 * Send error to external service
	 */
	private async logToService(errorInfo: ErrorInfo): Promise<void> {
		try {
			// In a real application, you would send to services like Sentry, LogRocket, etc.
			if (config.sentryDsn) {
				// Example: Send to Sentry
				await this.sendToSentry(errorInfo);
			}

			// Custom error endpoint
			if (config.apiBaseUrl) {
				await this.sendToCustomEndpoint(errorInfo);
			}
		} catch (serviceError) {
			console.error("Failed to report error to service:", serviceError);
		}
	}

	/**
	 * Send error to Sentry (placeholder implementation)
	 */
	private async sendToSentry(errorInfo: ErrorInfo): Promise<void> {
		// This would integrate with @sentry/browser
		// For now, we'll just log that we would send it
		console.info("Would send to Sentry:", {
			dsn: config.sentryDsn,
			error: errorInfo.error.message,
			stack: errorInfo.error.stack,
		});
	}

	/**
	 * Send error to custom endpoint
	 */
	private async sendToCustomEndpoint(errorInfo: ErrorInfo): Promise<void> {
		const response = await fetch(`${config.apiBaseUrl}/api/errors`, {
			method: "POST",
			headers: {
				"Content-Type": "application/json",
			},
			body: JSON.stringify(errorInfo),
		});

		if (!response.ok) {
			throw new Error(`Failed to report error: ${response.status}`);
		}
	}

	/**
	 * Setup global error event listeners
	 */
	private setupEventListeners(): void {
		if (typeof window === "undefined") return;

		// Handle unhandled JavaScript errors
		window.addEventListener("error", (event) => {
			this.report({
				error: new Error(event.message),
				context: {
					additionalData: {
						filename: event.filename,
						lineno: event.lineno,
						colno: event.colno,
						source: "window.onerror",
					},
				},
			});
		});

		// Handle unhandled promise rejections
		window.addEventListener("unhandledrejection", (event) => {
			this.report({
				error: new Error(
					event.reason?.message || "Unhandled promise rejection",
				),
				context: {
					additionalData: {
						reason: event.reason,
						source: "unhandledrejection",
					},
				},
			});
		});

		// Handle resource loading errors
		window.addEventListener(
			"error",
			(event) => {
				if (event.target && (event.target as HTMLElement).tagName) {
					const element = event.target as HTMLElement;
					this.report({
						error: new Error(`Resource loading failed: ${element.tagName}`),
						context: {
							additionalData: {
								tagName: element.tagName,
								source:
									element.getAttribute("src") || element.getAttribute("href"),
								type: "resource-loading",
							},
						},
					});
				}
			},
			true,
		);
	}

	/**
	 * Setup online/offline status monitoring
	 */
	private setupOnlineStatusMonitoring(): void {
		if (typeof window === "undefined") return;

		window.addEventListener("online", () => {
			this.isOnline = true;
			this.flushErrorQueue();
		});

		window.addEventListener("offline", () => {
			this.isOnline = false;
		});
	}

	/**
	 * Flush queued errors when back online
	 */
	private async flushErrorQueue(): Promise<void> {
		if (this.errorQueue.length === 0) return;

		const errors = [...this.errorQueue];
		this.errorQueue = [];

		for (const errorInfo of errors) {
			try {
				await this.logToService(errorInfo);
			} catch (serviceError) {
				console.error("Failed to flush queued error:", serviceError);
				// Re-queue failed errors
				this.errorQueue.push(errorInfo);
			}
		}
	}

	/**
	 * Get error statistics
	 */
	getErrorStats(): {
		totalErrors: number;
		queuedErrors: number;
		isOnline: boolean;
	} {
		return {
			totalErrors: this.errorQueue.length,
			queuedErrors: this.errorQueue.length,
			isOnline: this.isOnline,
		};
	}
}

// Export singleton instance
export const errorReporter = ErrorReporter.getInstance();

/**
 * Utility function to report errors
 */
export function reportError(
	error: Error,
	context?: ErrorInfo["context"],
): void {
	errorReporter.report({ error, context });
}

/**
 * Higher-order function to wrap functions with error reporting
 */
export function withErrorReporting<T extends (...args: unknown[]) => unknown>(
	fn: T,
	context?: ErrorInfo["context"],
): T {
	return ((...args: Parameters<T>) => {
		try {
			const result = fn(...args);

			// Handle async functions
			if (result instanceof Promise) {
				return result.catch((error) => {
					reportError(error, context);
					throw error;
				});
			}

			return result;
		} catch (error) {
			reportError(error as Error, context);
			throw error;
		}
	}) as T;
}
