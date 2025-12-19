use std::process::Stdio;
use tokio::process::Command;
use crate::models::{ExtractResponse, VideoFormat};

/// Extract video information using yt-dlp
pub async fn extract_video_info(url: &str) -> Result<ExtractResponse, String> {
    // Run yt-dlp with JSON output
    let output = Command::new("yt-dlp")
        .args([
            "--dump-json",
            "--no-warnings",
            "--no-playlist",
            url,
        ])
        .stdout(Stdio::piped())
        .stderr(Stdio::piped())
        .output()
        .await
        .map_err(|e| format!("Failed to run yt-dlp: {}. Is yt-dlp installed?", e))?;

    if !output.status.success() {
        let stderr = String::from_utf8_lossy(&output.stderr);
        return Err(format!("yt-dlp error: {}", stderr.trim()));
    }

    let stdout = String::from_utf8_lossy(&output.stdout);
    let json: serde_json::Value = serde_json::from_str(&stdout)
        .map_err(|e| format!("Failed to parse yt-dlp output: {}", e))?;

    // Extract platform
    let platform = detect_platform(url);

    // Extract title
    let title = json["title"]
        .as_str()
        .unwrap_or("Untitled")
        .to_string();

    // Extract thumbnail
    let thumbnail = json["thumbnail"].as_str().map(String::from);

    // Extract formats
    let formats = extract_formats(&json);

    Ok(ExtractResponse::new(platform, title, thumbnail, formats))
}

/// Detect platform from URL
fn detect_platform(url: &str) -> String {
    let url_lower = url.to_lowercase();
    if url_lower.contains("instagram.com") {
        "instagram".to_string()
    } else if url_lower.contains("tiktok.com") {
        "tiktok".to_string()
    } else if url_lower.contains("twitter.com") || url_lower.contains("x.com") {
        "twitter".to_string()
    } else {
        "unknown".to_string()
    }
}

/// Extract video formats from yt-dlp JSON output
fn extract_formats(json: &serde_json::Value) -> Vec<VideoFormat> {
    let mut formats = Vec::new();

    // Try to get the best format directly
    if let Some(url) = json["url"].as_str() {
        formats.push(VideoFormat {
            quality: "best".to_string(),
            url: url.to_string(),
            ext: json["ext"].as_str().unwrap_or("mp4").to_string(),
            filesize: json["filesize"].as_u64(),
        });
        return formats;
    }

    // Parse formats array
    if let Some(format_list) = json["formats"].as_array() {
        // Filter video formats and sort by quality
        let mut video_formats: Vec<_> = format_list
            .iter()
            .filter(|f| {
                let vcodec = f["vcodec"].as_str().unwrap_or("none");
                vcodec != "none" && f["url"].as_str().is_some()
            })
            .collect();

        // Sort by height (quality) descending
        video_formats.sort_by(|a, b| {
            let h_a = a["height"].as_u64().unwrap_or(0);
            let h_b = b["height"].as_u64().unwrap_or(0);
            h_b.cmp(&h_a)
        });

        // Take top 3 qualities
        for f in video_formats.into_iter().take(3) {
            let height = f["height"].as_u64().unwrap_or(0);
            let quality = if height > 0 {
                format!("{}p", height)
            } else {
                f["format_note"].as_str().unwrap_or("unknown").to_string()
            };

            formats.push(VideoFormat {
                quality,
                url: f["url"].as_str().unwrap_or("").to_string(),
                ext: f["ext"].as_str().unwrap_or("mp4").to_string(),
                filesize: f["filesize"].as_u64(),
            });
        }
    }

    // Fallback: try requested_downloads
    if formats.is_empty() {
        if let Some(downloads) = json["requested_downloads"].as_array() {
            for d in downloads {
                if let Some(url) = d["url"].as_str() {
                    formats.push(VideoFormat {
                        quality: "best".to_string(),
                        url: url.to_string(),
                        ext: d["ext"].as_str().unwrap_or("mp4").to_string(),
                        filesize: d["filesize"].as_u64(),
                    });
                }
            }
        }
    }

    formats
}
