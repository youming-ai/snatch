mod extractor;
mod handlers;
mod models;

use axum::{http::Method, routing::{get, post}, Router};
use std::net::SocketAddr;
use tower_http::cors::{Any, CorsLayer};
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
                tracing::warn!("ALLOWED_ORIGINS set but no valid origins parsed, using permissive CORS");
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

    // Build router
    let app = Router::new()
        .route("/api/extract", post(handlers::extract_handler))
        .route("/api/download", get(handlers::download_handler))
        .route("/health", get(handlers::health_handler))
        .layer(cors);

    // Get port from environment or default to 3001
    let port: u16 = std::env::var("PORT")
        .ok()
        .and_then(|p| p.parse().ok())
        .unwrap_or(3001);
    
    let addr = SocketAddr::from(([0, 0, 0, 0], port));
    tracing::info!("🚀 Downloader API running on http://{}", addr);

    let listener = tokio::net::TcpListener::bind(addr)
        .await
        .expect("Failed to bind to address - check if port is available");
    
    axum::serve(listener, app)
        .await
        .expect("Server error - failed to serve application");
}
