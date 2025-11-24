import type { DownloadTask, WebSocketMessage } from "@/types/download";

export type WebSocketEventHandler = (message: WebSocketMessage) => void;

export class WebSocketManager {
	private static instance: WebSocketManager;
	private ws: WebSocket | null = null;
	private userId: string | null = null;
	private eventHandlers: Set<WebSocketEventHandler> = new Set();
	private reconnectAttempts = 0;
	private maxReconnectAttempts = 5;
	private reconnectDelay = 1000; // Start with 1 second
	private isConnecting = false;

	private constructor() {}

	static getInstance(): WebSocketManager {
		if (!WebSocketManager.instance) {
			WebSocketManager.instance = new WebSocketManager();
		}
		return WebSocketManager.instance;
	}

	/**
	 * Connect to WebSocket for real-time updates
	 */
	connect(userId: string): Promise<void> {
		return new Promise((resolve, reject) => {
			if (this.ws && this.ws.readyState === WebSocket.OPEN) {
				resolve();
				return;
			}

			if (this.isConnecting) {
				reject(new Error("Connection already in progress"));
				return;
			}

			this.isConnecting = true;
			this.userId = userId;

			const wsUrl =
				process.env.NODE_ENV === "production"
					? `wss://your-production-api.com/ws/${userId}`
					: `ws://localhost:8000/ws/${userId}`;

			try {
				this.ws = new WebSocket(wsUrl);

				this.ws.onopen = () => {
					console.log("WebSocket connected for user:", userId);
					this.isConnecting = false;
					this.reconnectAttempts = 0;
					this.reconnectDelay = 1000;
					resolve();
				};

				this.ws.onmessage = (event) => {
					try {
						const message: WebSocketMessage = JSON.parse(event.data);
						this.notifyHandlers(message);
					} catch (error) {
						console.error("Failed to parse WebSocket message:", error);
					}
				};

				this.ws.onclose = () => {
					console.log("WebSocket disconnected");
					this.isConnecting = false;
					this.ws = null;
					this.attemptReconnect();
				};

				this.ws.onerror = (error) => {
					console.error("WebSocket error:", error);
					this.isConnecting = false;
					reject(new Error("WebSocket connection failed"));
				};
			} catch (error) {
				this.isConnecting = false;
				reject(error);
			}
		});
	}

	/**
	 * Disconnect from WebSocket
	 */
	disconnect(): void {
		if (this.ws) {
			this.ws.close();
			this.ws = null;
		}
		this.userId = null;
		this.reconnectAttempts = 0;
	}

	/**
	 * Add event handler for WebSocket messages
	 */
	addEventHandler(handler: WebSocketEventHandler): () => void {
		this.eventHandlers.add(handler);

		// Return unsubscribe function
		return () => {
			this.eventHandlers.delete(handler);
		};
	}

	/**
	 * Remove all event handlers
	 */
	clearEventHandlers(): void {
		this.eventHandlers.clear();
	}

	/**
	 * Get current connection status
	 */
	getConnectionStatus(): "connecting" | "connected" | "disconnected" {
		if (this.isConnecting) return "connecting";
		if (this.ws && this.ws.readyState === WebSocket.OPEN) return "connected";
		return "disconnected";
	}

	/**
	 * Send message to server
	 */
	sendMessage(message: Record<string, unknown>): boolean {
		if (this.ws && this.ws.readyState === WebSocket.OPEN) {
			try {
				this.ws.send(JSON.stringify(message));
				return true;
			} catch (error) {
				console.error("Failed to send WebSocket message:", error);
				return false;
			}
		}
		return false;
	}

	private notifyHandlers(message: WebSocketMessage): void {
		this.eventHandlers.forEach((handler) => {
			try {
				handler(message);
			} catch (error) {
				console.error("Error in WebSocket event handler:", error);
			}
		});
	}

	private attemptReconnect(): void {
		if (this.reconnectAttempts >= this.maxReconnectAttempts) {
			console.error("Max reconnect attempts reached");
			return;
		}

		if (!this.userId) {
			console.error("Cannot reconnect: no user ID");
			return;
		}

		this.reconnectAttempts++;
		console.log(
			`Attempting to reconnect (${this.reconnectAttempts}/${this.maxReconnectAttempts})...`,
		);

		setTimeout(() => {
			if (this.userId) {
				this.connect(this.userId).catch((error) => {
					console.error("Reconnection failed:", error);
				});
			}
		}, this.reconnectDelay);

		// Exponential backoff
		this.reconnectDelay = Math.min(this.reconnectDelay * 2, 30000); // Max 30 seconds
	}
}

// Export singleton instance
export const webSocketManager = WebSocketManager.getInstance();
