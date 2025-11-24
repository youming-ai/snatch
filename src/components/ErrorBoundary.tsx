import { AlertTriangle } from "lucide-react";
import { Component, type ErrorInfo, type ReactNode } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

interface Props {
	children: ReactNode;
	fallback?: ReactNode;
	onError?: (error: Error, errorInfo: ErrorInfo) => void;
}

interface State {
	hasError: boolean;
	error?: Error;
	errorInfo?: ErrorInfo;
}

export class ErrorBoundary extends Component<Props, State> {
	constructor(props: Props) {
		super(props);
		this.state = { hasError: false };
	}

	static getDerivedStateFromError(error: Error): State {
		return {
			hasError: true,
			error,
		};
	}

	componentDidCatch(error: Error, errorInfo: ErrorInfo) {
		console.error("ErrorBoundary caught an error:", error, errorInfo);

		// Log to external service in production
		if (
			typeof window !== "undefined" &&
			window.location?.hostname !== "localhost"
		) {
			// You could integrate with error tracking services like Sentry, LogRocket, etc.
			console.log("Production error - would send to tracking service");
		}

		this.setState({
			error,
			errorInfo,
		});

		// Call custom error handler if provided
		this.props.onError?.(error, errorInfo);
	}

	handleReset = () => {
		this.setState({ hasError: false, error: undefined, errorInfo: undefined });
	};

	render() {
		if (this.state.hasError) {
			// Custom fallback UI
			if (this.props.fallback) {
				return this.props.fallback;
			}

			return (
				<div className="min-h-screen flex items-center justify-center p-4">
					<Card className="max-w-md w-full">
						<CardHeader className="text-center">
							<div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-full bg-destructive/10">
								<AlertTriangle className="h-6 w-6 text-destructive" />
							</div>
							<CardTitle className="text-xl">Something went wrong</CardTitle>
						</CardHeader>
						<CardContent className="space-y-4 text-center">
							<p className="text-muted-foreground">
								We encountered an unexpected error. Please try again or refresh
								the page.
							</p>

							{process.env.NODE_ENV === "development" && this.state.error && (
								<details className="mt-4 text-left">
									<summary className="cursor-pointer text-sm font-mono text-destructive">
										Error Details (Development Only)
									</summary>
									<pre className="mt-2 overflow-auto text-xs bg-muted p-2 rounded">
										<code>
											{this.state.error.toString()}
											{this.state.errorInfo?.componentStack}
										</code>
									</pre>
								</details>
							)}

							<div className="flex gap-2 pt-4">
								<Button onClick={this.handleReset} variant="default">
									Try Again
								</Button>
								<Button
									onClick={() => window.location.reload()}
									variant="outline"
								>
									Refresh Page
								</Button>
							</div>
						</CardContent>
					</Card>
				</div>
			);
		}

		return this.props.children;
	}
}

// Hook version for functional components
export function useErrorHandler() {
	return (error: Error, errorInfo?: ErrorInfo) => {
		console.error("Error caught by error handler:", error, errorInfo);

		// In production, you might want to send this to an error tracking service
		if (
			typeof window !== "undefined" &&
			window.location?.hostname !== "localhost"
		) {
			// Integration with error tracking services
			console.log("Error would be tracked in production");
		}
	};
}
