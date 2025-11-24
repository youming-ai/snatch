import { useCallback, useEffect, useState } from "react";
import { errorReporter, reportError } from "./ErrorReporter";

export interface ErrorHandlerOptions {
	context?: Record<string, unknown>;
	showToast?: boolean;
	logToConsole?: boolean;
	rethrow?: boolean;
}

/**
 * Hook for handling errors in components
 */
export function useErrorHandler(options: ErrorHandlerOptions = {}) {
	const [errors, setErrors] = useState<Array<{ error: Error; id: string }>>([]);

	const handleError = useCallback(
		(error: Error, customContext?: Record<string, unknown>) => {
			const errorId = `error_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;

			// Add to local state
			setErrors((prev) => [...prev, { error, id: errorId }]);

			// Create context for error reporting
			const context = {
				...options.context,
				...customContext,
				hook: "useErrorHandler",
			};

			// Report error
			reportError(error, context);

			// Log to console if enabled
			if (options.logToConsole !== false) {
				console.error("Error handled by useErrorHandler:", error);
			}

			// Show toast notification if enabled
			if (options.showToast) {
				// This would integrate with your toast system
				console.warn("Toast notification would be shown here");
			}

			// Rethrow if enabled
			if (options.rethrow) {
				throw error;
			}

			return errorId;
		},
		[options],
	);

	const clearError = useCallback((id?: string) => {
		if (id) {
			setErrors((prev) => prev.filter((e) => e.id !== id));
		} else {
			setErrors([]);
		}
	}, []);

	const clearErrors = useCallback(() => {
		setErrors([]);
	}, []);

	return {
		handleError,
		errors,
		clearError,
		clearErrors,
		hasErrors: errors.length > 0,
	};
}

/**
 * Hook for async error handling
 */
export function useAsyncErrorHandler(options: ErrorHandlerOptions = {}) {
	const { handleError } = useErrorHandler(options);

	const wrapAsync = useCallback(
		<T extends (...args: any[]) => Promise<any>>(
			asyncFn: T,
			context?: Record<string, unknown>,
		): T => {
			return (async (...args: Parameters<T>) => {
				try {
					return await asyncFn(...args);
				} catch (error) {
					handleError(error as Error, context);
					throw error;
				}
			}) as T;
		},
		[handleError],
	);

	return { wrapAsync };
}

/**
 * Hook for handling global errors
 */
export function useGlobalErrorHandler(options: ErrorHandlerOptions = {}) {
	const [globalErrors, setGlobalErrors] = useState<
		Array<{ error: Error; id: string; source: string }>
	>([]);

	useEffect(() => {
		const handleGlobalError = (event: ErrorEvent) => {
			const error = new Error(event.message);
			const errorId = `global_err_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;

			setGlobalErrors((prev) => [
				...prev,
				{ error, id: errorId, source: "window.onerror" },
			]);

			reportError(error, {
				...options.context,
				filename: event.filename,
				lineno: event.lineno,
				colno: event.colno,
				source: "window.onerror",
			});
		};

		const handleUnhandledRejection = (event: PromiseRejectionEvent) => {
			const error = new Error(
				event.reason?.message || "Unhandled promise rejection",
			);
			const errorId = `rejection_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;

			setGlobalErrors((prev) => [
				...prev,
				{ error, id: errorId, source: "unhandledrejection" },
			]);

			reportError(error, {
				...options.context,
				reason: event.reason,
				source: "unhandledrejection",
			});
		};

		// Add event listeners
		window.addEventListener("error", handleGlobalError);
		window.addEventListener("unhandledrejection", handleUnhandledRejection);

		return () => {
			window.removeEventListener("error", handleGlobalError);
			window.removeEventListener(
				"unhandledrejection",
				handleUnhandledRejection,
			);
		};
	}, [options]);

	const clearGlobalError = useCallback((id?: string) => {
		if (id) {
			setGlobalErrors((prev) => prev.filter((e) => e.id !== id));
		} else {
			setGlobalErrors([]);
		}
	}, []);

	return {
		globalErrors,
		clearGlobalError,
		hasGlobalErrors: globalErrors.length > 0,
	};
}

/**
 * Hook for error boundary integration
 */
export function useErrorBoundary() {
	const [error, setError] = useState<Error | null>(null);

	const resetError = useCallback(() => {
		setError(null);
	}, []);

	const captureError = useCallback((error: Error, errorInfo?: any) => {
		setError(error);
		reportError(error, {
			errorInfo,
			source: "useErrorBoundary",
		});
	}, []);

	// Simulate React's componentDidCatch behavior
	useEffect(() => {
		if (error) {
			// In a real error boundary, this would trigger the fallback UI
			console.error("Error captured by useErrorBoundary:", error);
		}
	}, [error]);

	return {
		error,
		captureError,
		resetError,
		hasError: !!error,
	};
}
