use crate::extractor::extract_video_info;
use crate::models::{ErrorResponse, ExtractRequest, ExtractResponse};
use crate::validation::validate_url;
use axum::{
    body::Body,
    extract::Query,
    http::{header, StatusCode},
    response::{IntoResponse, Response},
    Json,
};
use serde::Deserialize;

/// Handle POST /api/extract
pub async fn extract_handler(
    Json(payload): Json<ExtractRequest>,
) -> Result<Json<ExtractResponse>, (StatusCode, Json<ErrorResponse>)> {
    // Validate URL using the centralized validation module
    // This checks for: empty URL, invalid format, dangerous characters, and supported platforms
    if let Err(error_msg) = validate_url(&payload.url) {
        return Err((StatusCode::BAD_REQUEST, Json(ErrorResponse::new(error_msg))));
    }

    // Extract video info (also has validation, but we've already validated above)
    match extract_video_info(&payload.url).await {
        Ok(response) => Ok(Json(response)),
        Err(error) => Err((
            StatusCode::INTERNAL_SERVER_ERROR,
            Json(ErrorResponse::new(error)),
        )),
    }
}

#[derive(Debug, Deserialize)]
pub struct DownloadQuery {
    /// Original social media URL (not the direct video URL)
    url: String,
}

/// Download endpoint - uses yt-dlp to download and stream the video
pub async fn download_handler(Query(query): Query<DownloadQuery>) -> Response {
    use std::process::Stdio;
    use tokio::process::Command;

    // Validate URL before processing
    if let Err(error_msg) = validate_url(&query.url) {
        return (StatusCode::BAD_REQUEST, error_msg).into_response();
    }

    let video_url = &query.url;

    // Use yt-dlp to download to stdout
    let mut child = match Command::new("yt-dlp")
        .args([
            "-o",
            "-", // Output to stdout
            "--no-warnings",
            "--no-playlist",
            "-f",
            "best[ext=mp4]/best", // Prefer mp4
            video_url,
        ])
        .stdout(Stdio::piped())
        .stderr(Stdio::piped())
        .spawn()
    {
        Ok(c) => c,
        Err(e) => {
            return (
                StatusCode::INTERNAL_SERVER_ERROR,
                format!("Failed to start yt-dlp: {}", e),
            )
                .into_response();
        }
    };

    // Get the stdout
    let stdout = match child.stdout.take() {
        Some(s) => s,
        None => {
            return (
                StatusCode::INTERNAL_SERVER_ERROR,
                "Failed to get yt-dlp stdout",
            )
                .into_response();
        }
    };

    // Create a stream from stdout
    let stream = tokio_util::io::ReaderStream::new(stdout);
    let body = Body::from_stream(stream);

    // Build response
    Response::builder()
        .status(StatusCode::OK)
        .header(header::CONTENT_TYPE, "video/mp4")
        .header(
            header::CONTENT_DISPOSITION,
            "attachment; filename=\"video.mp4\"",
        )
        .header(header::ACCESS_CONTROL_ALLOW_ORIGIN, "*")
        .body(body)
        .unwrap_or_else(|_| {
            (
                StatusCode::INTERNAL_SERVER_ERROR,
                "Failed to build response",
            )
                .into_response()
        })
}

/// Health check endpoint
pub async fn health_handler() -> &'static str {
    "OK"
}

#[cfg(test)]
mod tests {
    use super::*;
    use axum::http::Method;
    use serde_json::json;
    use tower::ServiceExt;

    /// Create a test router for testing
    fn create_test_router() -> axum::Router {
        axum::Router::new()
            .route("/api/extract", post(extract_handler))
            .route("/health", get(health_handler))
    }

    #[tokio::test]
    async fn test_extract_handler_empty_url() {
        let app = create_test_router();

        let response = app
            .oneshot(
                axum::http::Request::builder()
                    .method(Method::POST)
                    .uri("/api/extract")
                    .header("content-type", "application/json")
                    .body(Body::from(json!({ "url": "" }).to_string()))
                    .unwrap(),
            )
            .await
            .unwrap();

        assert_eq!(response.status(), StatusCode::BAD_REQUEST);
    }

    #[tokio::test]
    async fn test_extract_handler_invalid_url_format() {
        let app = create_test_router();

        let response = app
            .oneshot(
                axum::http::Request::builder()
                    .method(Method::POST)
                    .uri("/api/extract")
                    .header("content-type", "application/json")
                    .body(Body::from(json!({ "url": "not-a-url" }).to_string()))
                    .unwrap(),
            )
            .await
            .unwrap();

        assert_eq!(response.status(), StatusCode::BAD_REQUEST);
    }

    #[tokio::test]
    async fn test_extract_handler_unsupported_platform() {
        let app = create_test_router();

        let response = app
            .oneshot(
                axum::http::Request::builder()
                    .method(Method::POST)
                    .uri("/api/extract")
                    .header("content-type", "application/json")
                    .body(Body::from(
                        json!({ "url": "https://youtube.com/watch?v=test" }).to_string(),
                    ))
                    .unwrap(),
            )
            .await
            .unwrap();

        assert_eq!(response.status(), StatusCode::BAD_REQUEST);
    }

    #[tokio::test]
    async fn test_extract_handler_command_injection() {
        let app = create_test_router();

        // Test various command injection patterns
        let malicious_urls = vec![
            "https://instagram.com/p/123; rm -rf /",
            "https://instagram.com/p/123| cat /etc/passwd",
            "https://instagram.com/p/123& malicious",
            "https://instagram.com/p/123$(whoami)",
            "https://instagram.com/p/123`whoami`",
        ];

        for url in malicious_urls {
            let response = app
                .clone()
                .oneshot(
                    axum::http::Request::builder()
                        .method(Method::POST)
                        .uri("/api/extract")
                        .header("content-type", "application/json")
                        .body(Body::from(json!({ "url": url }).to_string()))
                        .unwrap(),
                )
                .await
                .unwrap();

            // Should reject URLs with dangerous characters
            assert_eq!(
                response.status(),
                StatusCode::BAD_REQUEST,
                "URL should be rejected: {}",
                url
            );
        }
    }

    #[tokio::test]
    async fn test_health_handler() {
        let app = create_test_router();

        let response = app
            .oneshot(
                axum::http::Request::builder()
                    .method(Method::GET)
                    .uri("/health")
                    .body(Body::empty())
                    .unwrap(),
            )
            .await
            .unwrap();

        assert_eq!(response.status(), StatusCode::OK);

        let body = hyper::body::to_bytes(response.into_body()).await.unwrap();
        assert_eq!(&body[..], b"OK");
    }

    #[tokio::test]
    async fn test_extract_handler_valid_platform_urls() {
        let app = create_test_router();

        // Test valid URLs from supported platforms
        let valid_urls = vec![
            "https://instagram.com/p/ABC123",
            "https://www.instagram.com/reel/xyz",
            "https://tiktok.com/@user/video/123",
            "https://x.com/user/status/123",
            "https://twitter.com/user/status/123",
        ];

        for url in valid_urls {
            let response = app
                .clone()
                .oneshot(
                    axum::http::Request::builder()
                        .method(Method::POST)
                        .uri("/api/extract")
                        .header("content-type", "application/json")
                        .body(Body::from(json!({ "url": url }).to_string()))
                        .unwrap(),
                )
                .await
                .unwrap();

            // Should pass validation (may still fail due to yt-dlp not being available)
            // but we expect either OK (if yt-dlp works) or INTERNAL_SERVER_ERROR (if yt-dlp fails)
            // NOT BAD_REQUEST which would mean validation failed
            assert_ne!(
                response.status(),
                StatusCode::BAD_REQUEST,
                "URL should pass validation: {}",
                url
            );
        }
    }
}
