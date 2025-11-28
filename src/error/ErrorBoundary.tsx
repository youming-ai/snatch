import { AlertTriangle, Home, RefreshCw } from "lucide-react";
import { Component, type ErrorInfo, type ReactNode } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { errorReporter } from "./ErrorReporter";

interface ErrorBoundaryState {
	hasError: boolean;
	error: Error | null;
	errorInfo: ErrorInfo | null;
	errorId: string | null;
}

interface ErrorBoundaryProps {
	children: ReactNode;
	fallback?: ReactNode;
	onError?: (error: Error, errorInfo: ErrorInfo, errorId: string) => void;
	isolate?: boolean; // If true, errors won't bubble up to parent boundaries
	showErrorDetails?: boolean; // Show technical error details
}

export class ErrorBoundary extends Component<
	ErrorBoundaryProps,
	ErrorBoundaryState
> {
	private retryCount = 0;
	private maxRetries = 3;

	constructor(props: ErrorBoundaryProps) {
		super(props);

		this.state = {
			hasError: false,
			error: null,
			errorInfo: null,
			errorId: null,
		};
	}

	static getDerivedStateFromError(error: Error): Partial<ErrorBoundaryState> {
		return {
			hasError: true,
			error,
			errorId: `err_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
		};
	}

	componentDidCatch(error: Error, errorInfo: ErrorInfo) {
		this.setState({ errorInfo });

		// Report error to our error reporter
		const errorReport = {
			error,
			errorInfo: {
				componentStack: errorInfo.componentStack,
			},
			context: {
				url: window.location.href,
				additionalData: {
					componentName: this.getDisplayName(),
					props: this.props,
					retryCount: this.retryCount,
				},
			},
		};

		errorReporter.report(errorReport);

		// Call custom error handler if provided
		if (this.props.onError && this.state.errorId) {
			this.props.onError(error, errorInfo, this.state.errorId);
		}

		// If not isolating, rethrow to bubble up to parent boundaries
		if (!this.props.isolate) {
			setTimeout(() => {
				throw error;
			}, 0);
		}
	}

	private getDisplayName(): string {
		const component = this.props.children as React.ReactElement<{ type?: { displayName?: string; name?: string } }> | null;
		if (component && typeof component === 'object' && 'type' in component) {
			const componentType = component.type as { displayName?: string; name?: string } | undefined;
			return componentType?.displayName || componentType?.name || "Unknown";
		}
		return "Unknown";
	}

	private handleRetry = () => {
		if (this.retryCount < this.maxRetries) {
			this.retryCount++;
			this.setState({
				hasError: false,
				error: null,
				errorInfo: null,
				errorId: null,
			});
		}
	};

	private handleGoHome = () => {
		window.location.href = "/";
	};

	private canRetry(): boolean {
		return this.retryCount < this.maxRetries;
	}

	render() {
		if (this.state.hasError) {
			// Custom fallback provided
			if (this.props.fallback) {
				return this.props.fallback;
			}

			// Default error UI
			return (
				<div className="min-h-screen flex items-center justify-center p-4">
					<Card className="w-full max-w-2xl">
						<CardHeader className="text-center">
							<div className="mx-auto w-16 h-16 bg-destructive/10 rounded-full flex items-center justify-center mb-4">
								<AlertTriangle className="w-8 h-8 text-destructive" />
							</div>
							<CardTitle className="text-2xl font-bold text-destructive">
								Oops! Something went wrong
							</CardTitle>
						</CardHeader>

						<CardContent className="space-y-6">
							<div className="text-center space-y-2">
								<p className="text-muted-foreground">
									We're sorry, but something unexpected happened. Our team has
									been notified and is working on a fix.
								</p>

								{this.state.errorId && (
									<p className="text-xs text-muted-foreground">
										Error ID:{" "}
										<code className="bg-muted px-2 py-1 rounded">
											{this.state.errorId}
										</code>
									</p>
								)}
							</div>

							{/* Show error details in development */}
							{import.meta.env.DEV &&
								this.props.showErrorDetails !== false &&
								this.state.error && (
									<details className="bg-muted/50 rounded-lg p-4">
										<summary className="cursor-pointer font-mono text-sm font-medium mb-2">
											Error Details (Development Only)
										</summary>
										<div className="space-y-2">
											<div>
												<strong>Error:</strong>
												<pre className="mt-1 text-xs bg-background p-2 rounded border overflow-auto">
													{this.state.error.message}
												</pre>
											</div>

											{this.state.error.stack && (
												<div>
													<strong>Stack Trace:</strong>
													<pre className="mt-1 text-xs bg-background p-2 rounded border overflow-auto max-h-32">
														{this.state.error.stack}
													</pre>
												</div>
											)}

											{this.state.errorInfo?.componentStack && (
												<div>
													<strong>Component Stack:</strong>
													<pre className="mt-1 text-xs bg-background p-2 rounded border overflow-auto max-h-32">
														{this.state.errorInfo.componentStack}
													</pre>
												</div>
											)}
										</div>
									</details>
								)}

							<div className="flex flex-col sm:flex-row gap-3 justify-center">
								{this.canRetry() && (
									<Button
										onClick={this.handleRetry}
										className="flex-1 sm:flex-none"
									>
										<RefreshCw className="w-4 h-4 mr-2" />
										Try Again ({this.maxRetries - this.retryCount} attempts
										left)
									</Button>
								)}

								<Button
									variant="outline"
									onClick={this.handleGoHome}
									className="flex-1 sm:flex-none"
								>
									<Home className="w-4 h-4 mr-2" />
									Go Home
								</Button>
							</div>

							<div className="text-center text-xs text-muted-foreground">
								<p>
									If this problem persists, please contact support or check our
									status page.
								</p>
							</div>
						</CardContent>
					</Card>
				</div>
			);
		}

		return this.props.children;
	}
}

/**
 * Functional Error Boundary wrapper
 */
interface ErrorBoundaryWrapperProps {
	children: ReactNode;
	fallback?: ReactNode;
	onError?: (error: Error, errorInfo: ErrorInfo, errorId: string) => void;
}

export function ErrorBoundaryWrapper({
	children,
	fallback,
	onError,
}: ErrorBoundaryWrapperProps) {
	return (
		<ErrorBoundary fallback={fallback} onError={onError}>
			{children}
		</ErrorBoundary>
	);
}

/**
 * Async Error Boundary for handling async operations
 */
export class AsyncErrorBoundary extends Component<
	ErrorBoundaryProps,
	ErrorBoundaryState
> {
	private unsubscribe: (() => void) | null = null;

	constructor(props: ErrorBoundaryProps) {
		super(props);

		this.state = {
			hasError: false,
			error: null,
			errorInfo: null,
			errorId: null,
		};
	}

	componentDidMount() {
		// Listen for custom error events
		this.unsubscribe = this.subscribeToErrors();
	}

	componentWillUnmount() {
		this.unsubscribe?.();
	}

	private subscribeToErrors() {
		const handleError = (event: CustomEvent<{ error: Error }>) => {
			this.setState({
				hasError: true,
				error: event.detail.error,
				errorId: `async_err_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
			});

			// Report async error
			errorReporter.report({
				error: event.detail.error,
				context: {
					additionalData: {
						type: "async",
						source: "AsyncErrorBoundary",
					},
				},
			});
		};

		window.addEventListener("asyncError", handleError as EventListener);

		return () => {
			window.removeEventListener("asyncError", handleError as EventListener);
		};
	}

	static getDerivedStateFromError(error: Error): Partial<ErrorBoundaryState> {
		return {
			hasError: true,
			error,
			errorId: `err_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
		};
	}

	componentDidCatch(error: Error, errorInfo: ErrorInfo) {
		this.setState({ errorInfo });
		errorReporter.report({
			error,
			errorInfo: { componentStack: errorInfo.componentStack },
		});
	}

	render() {
		if (this.state.hasError) {
			return (
				this.props.fallback || (
					<ErrorBoundary {...this.props} fallback={undefined}>
						{null}
					</ErrorBoundary>
				)
			);
		}

		return this.props.children;
	}
}

/**
 * Utility to trigger async error handling
 */
export function reportAsyncError(error: Error): void {
	const event = new CustomEvent("asyncError", { detail: { error } });
	window.dispatchEvent(event);
}
