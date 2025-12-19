mod extractor;
mod handlers;
mod models;

use axum::{routing::{get, post}, Router};
use std::net::SocketAddr;
use tower_http::cors::{Any, CorsLayer};
use tracing_subscriber;

#[tokio::main]
async fn main() {
    // Initialize logging
    tracing_subscriber::fmt::init();

    // Configure CORS
    let cors = CorsLayer::new()
        .allow_origin(Any)
        .allow_methods(Any)
        .allow_headers(Any);

    // Build router
    let app = Router::new()
        .route("/api/extract", post(handlers::extract_handler))
        .route("/api/download", get(handlers::download_handler))
        .route("/health", get(handlers::health_handler))
        .layer(cors);

    // Start server
    let addr = SocketAddr::from(([0, 0, 0, 0], 3001));
    println!("🚀 Downloader API running on http://{}", addr);

    let listener = tokio::net::TcpListener::bind(addr).await.unwrap();
    axum::serve(listener, app).await.unwrap();
}
