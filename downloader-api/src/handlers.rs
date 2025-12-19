use axum::{
    body::Body,
    extract::Query,
    http::{header, StatusCode},
    response::{IntoResponse, Response},
    Json,
};
use crate::extractor::extract_video_info;
use crate::models::{ErrorResponse, ExtractRequest, ExtractResponse};
use serde::Deserialize;

/// Handle POST /api/extract
pub async fn extract_handler(
    Json(payload): Json<ExtractRequest>,
) -> Result<Json<ExtractResponse>, (StatusCode, Json<ErrorResponse>)> {
    // Validate URL
    if payload.url.trim().is_empty() {
        return Err((
            StatusCode::BAD_REQUEST,
            Json(ErrorResponse::new("URL is required")),
        ));
    }

    // Validate URL format
    if !payload.url.starts_with("http://") && !payload.url.starts_with("https://") {
        return Err((
            StatusCode::BAD_REQUEST,
            Json(ErrorResponse::new("Invalid URL format")),
        ));
    }

    // Extract video info
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
    use tokio::io::AsyncReadExt;
    
    let video_url = &query.url;
    
    // Use yt-dlp to download to stdout
    let mut child = match Command::new("yt-dlp")
        .args([
            "-o", "-",           // Output to stdout
            "--no-warnings",
            "--no-playlist",
            "-f", "best[ext=mp4]/best",  // Prefer mp4
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
            ).into_response();
        }
    };

    // Get the stdout
    let stdout = match child.stdout.take() {
        Some(s) => s,
        None => {
            return (
                StatusCode::INTERNAL_SERVER_ERROR,
                "Failed to get yt-dlp stdout",
            ).into_response();
        }
    };

    // Create a stream from stdout
    let stream = tokio_util::io::ReaderStream::new(stdout);
    let body = Body::from_stream(stream);

    // Build response
    Response::builder()
        .status(StatusCode::OK)
        .header(header::CONTENT_TYPE, "video/mp4")
        .header(header::CONTENT_DISPOSITION, "attachment; filename=\"video.mp4\"")
        .header(header::ACCESS_CONTROL_ALLOW_ORIGIN, "*")
        .body(body)
        .unwrap_or_else(|_| {
            (StatusCode::INTERNAL_SERVER_ERROR, "Failed to build response").into_response()
        })
}

/// Health check endpoint
pub async fn health_handler() -> &'static str {
    "OK"
}
