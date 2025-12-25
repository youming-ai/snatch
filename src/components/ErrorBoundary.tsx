import { Component, ReactNode } from "react";
import { AlertCircle, RefreshCw } from "lucide-react";

interface Props {
	children: ReactNode;
	fallback?: ReactNode;
}

interface State {
	hasError: boolean;
	error?: Error;
	errorInfo?: React.ErrorInfo;
}

/**
 * Error Boundary component to catch and handle React component errors
 * Prevents the entire app from crashing due to component-level errors
 */
export class ErrorBoundary extends Component<Props, State> {
	constructor(props: Props) {
		super(props);
		this.state = { hasError: false };
	}

	static getDerivedStateFromError(error: Error): State {
		// Update state so the next render will show the fallback UI
		return { hasError: true, error };
	}

	componentDidCatch(error: Error, errorInfo: React.ErrorInfo): void {
		// Log the error to console in development
		if (import.meta.env.DEV) {
			console.error("Error Boundary caught an error:", error, errorInfo);
		}

		// In production, you might want to send this to an error reporting service
		this.setState({ errorInfo });
	}

	handleReset = (): void => {
		this.setState({ hasError: false, error: undefined, errorInfo: undefined });
	};

	handleReload = (): void => {
		window.location.reload();
	};

	render(): ReactNode {
		if (this.state.hasError) {
			// Use custom fallback if provided
			if (this.props.fallback) {
				return this.props.fallback;
			}

			// Default error UI
			return (
				<div className="min-h-screen bg-black text-white flex items-center justify-center p-4">
					<div className="max-w-md w-full space-y-6 text-center">
						{/* Error Icon */}
						<div className="flex justify-center">
							<div className="w-16 h-16 rounded-full bg-red-500/10 flex items-center justify-center">
								<AlertCircle className="w-8 h-8 text-red-500" />
							</div>
						</div>

						{/* Error Message */}
						<div className="space-y-2">
							<h1 className="text-2xl font-bold text-white">
								Something went wrong
							</h1>
							<p className="text-gray-400">
								{this.state.error?.message ||
									"An unexpected error occurred. Please try again."}
							</p>
						</div>

						{/* Error Details (Development Only) */}
						{import.meta.env.DEV && this.state.error && (
							<details className="text-left bg-white/5 rounded-lg p-4 border border-white/10">
								<summary className="cursor-pointer text-sm text-gray-400 hover:text-white transition-colors">
									Error Details
								</summary>
								<pre className="mt-3 text-xs text-red-400 overflow-auto max-h-40 whitespace-pre-wrap">
									{this.state.error.toString()}
									{this.state.errorInfo?.componentStack}
								</pre>
							</details>
						)}

						{/* Action Buttons */}
						<div className="flex flex-col sm:flex-row gap-3 justify-center">
							<button
								type="button"
								onClick={this.handleReset}
								className="px-6 py-3 bg-white/10 hover:bg-white/20 border border-white/10 rounded-xl text-white font-medium transition-all duration-200 flex items-center justify-center gap-2"
							>
								<RefreshCw className="w-4 h-4" />
								Try Again
							</button>
							<button
								type="button"
								onClick={this.handleReload}
								className="px-6 py-3 bg-gradient-to-r from-purple-600 to-blue-600 hover:from-purple-500 hover:to-blue-500 rounded-xl text-white font-medium transition-all duration-200"
							>
								Reload Page
							</button>
						</div>

						{/* Support Link */}
						<p className="text-sm text-gray-500">
							If this problem persists, please contact support.
						</p>
					</div>
				</div>
			);
		}

		return this.props.children;
	}
}
