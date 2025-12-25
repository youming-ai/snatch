mod cache;
mod extractor;
mod handlers;
mod models;
mod retry;
mod validation;

use axum::{
    http::Method,
    routing::{get, post},
    Router,
};
use handlers::AppState;
use std::net::SocketAddr;
use std::sync::Arc;
use std::time::Duration;
use tokio::sync::Mutex;
use tower_http::cors::{Any, CorsLayer};
use tower_http::limit::RequestBodyLimitLayer;
use tower_http::timeout::TimeoutLayer;
use tracing_subscriber;

#[tokio::main]
async fn main() {
    // Initialize logging
    tracing_subscriber::fmt::init();

    // Configure CORS - Use environment variable for allowed origins
    // In production, set ALLOWED_ORIGINS to your domain(s), comma-separated
    // Example: ALLOWED_ORIGINS=https://snatch.example.com,https://www.snatch.example.com
    let cors = match std::env::var("ALLOWED_ORIGINS") {
        Ok(origins) if !origins.is_empty() => {
            let allowed_origins: Vec<_> = origins
                .split(',')
                .filter_map(|s| s.trim().parse().ok())
                .collect();

            if allowed_origins.is_empty() {
                tracing::warn!(
                    "ALLOWED_ORIGINS set but no valid origins parsed, using permissive CORS"
                );
                CorsLayer::new()
                    .allow_origin(Any)
                    .allow_methods([Method::GET, Method::POST, Method::OPTIONS])
                    .allow_headers(Any)
            } else {
                tracing::info!("CORS configured for origins: {:?}", allowed_origins);
                CorsLayer::new()
                    .allow_origin(allowed_origins)
                    .allow_methods([Method::GET, Method::POST, Method::OPTIONS])
                    .allow_headers(Any)
            }
        }
        _ => {
            // Development mode - allow all origins
            tracing::warn!("ALLOWED_ORIGINS not set, using permissive CORS (development mode)");
            CorsLayer::new()
                .allow_origin(Any)
                .allow_methods([Method::GET, Method::POST, Method::OPTIONS])
                .allow_headers(Any)
        }
    };

    // Initialize cache (100 entries, 5 minute TTL)
    let cache = Arc::new(Mutex::new(cache::Cache::new(100, Duration::from_secs(300))));

    // Build application state
    let app_state = AppState { cache };

    // Build router with middleware layers
    let app = Router::new()
        .route("/api/extract", post(handlers::extract_handler))
        .route("/api/download", get(handlers::download_handler))
        .route("/health", get(handlers::health_handler))
        .with_state(app_state)
        // Layer order matters: timeout -> body limit -> cors
        .layer(TimeoutLayer::new(Duration::from_secs(60)))
        .layer(RequestBodyLimitLayer::new(1024 * 10)) // 10KB max body size
        .layer(cors);

    // Get port from environment or default to 3001
    let port: u16 = std::env::var("PORT")
        .ok()
        .and_then(|p| p.parse().ok())
        .unwrap_or(3001);

    let addr = SocketAddr::from(([0, 0, 0, 0], port));
    tracing::info!("🚀 Downloader API running on http://{}", addr);

    let listener = match tokio::net::TcpListener::bind(addr).await {
        Ok(l) => l,
        Err(e) => {
            tracing::error!("Failed to bind to {}: {}", addr, e);
            tracing::error!("Check if the port is already in use");
            return;
        }
    };

    tracing::info!("Server listening on {}", addr);

    if let Err(e) = axum::serve(listener, app).await {
        tracing::error!("Server error: {}", e);
    };
}
