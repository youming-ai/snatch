use crate::models::{ExtractResponse, VideoFormat};
use crate::retry::{is_retryable_error, retry_with_backoff};
use crate::validation::{extract_platform, validate_url};
use std::process::Stdio;
use std::time::Duration;
use tokio::process::Command;
use tokio::time::timeout;

/// Extract video information using yt-dlp with retry logic
pub async fn extract_video_info(url: &str) -> Result<ExtractResponse, String> {
    // Validate URL first to prevent command injection
    validate_url(url)?;

    // Use retry logic for the extraction
    // Clone URL for the async closure
    let url = url.to_string();
    retry_with_backoff(|| extract_video_info_internal(&url), 3).await
}

/// Internal extraction function (can be retried)
async fn extract_video_info_internal(url: &str) -> Result<ExtractResponse, String> {
    // Run yt-dlp with JSON output and timeout
    let yt_dlp_timeout = Duration::from_secs(30);

    let output = timeout(yt_dlp_timeout, async {
        Command::new("yt-dlp")
            .args(["--dump-json", "--no-warnings", "--no-playlist", url])
            .stdout(Stdio::piped())
            .stderr(Stdio::piped())
            .output()
            .await
    })
    .await
    .map_err(|_| {
        "Request timeout (30s). The video may be too large or the server is busy.".to_string()
    })?
    .map_err(|e| format!("Failed to run yt-dlp: {}. Is yt-dlp installed?", e))?;

    if !output.status.success() {
        let stderr = String::from_utf8_lossy(&output.stderr);
        return Err(format!("yt-dlp error: {}", stderr.trim()));
    }

    let stdout = String::from_utf8_lossy(&output.stdout);
    let json: serde_json::Value = serde_json::from_str(&stdout)
        .map_err(|e| format!("Failed to parse yt-dlp output: {}", e))?;

    // Extract platform using the validation module
    let platform = extract_platform(url);

    // Extract title
    let title = json["title"].as_str().unwrap_or("Untitled").to_string();

    // Extract thumbnail
    let thumbnail = json["thumbnail"].as_str().map(String::from);

    // Extract formats
    let formats = extract_formats(&json);

    Ok(ExtractResponse::new(platform, title, thumbnail, formats))
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

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_extract_formats_from_single_url() {
        let json = serde_json::json!({
            "url": "https://example.com/video.mp4",
            "ext": "mp4",
            "filesize": 12345678
        });

        let formats = extract_formats(&json);
        assert_eq!(formats.len(), 1);
        assert_eq!(formats[0].quality, "best");
        assert_eq!(formats[0].url, "https://example.com/video.mp4");
        assert_eq!(formats[0].ext, "mp4");
        assert_eq!(formats[0].filesize, Some(12345678));
    }

    #[test]
    fn test_extract_formats_from_array() {
        let json = serde_json::json!({
            "formats": [
                {
                    "url": "https://example.com/720p.mp4",
                    "ext": "mp4",
                    "height": 720,
                    "vcodec": "h264",
                    "filesize": 5000000
                },
                {
                    "url": "https://example.com/1080p.mp4",
                    "ext": "mp4",
                    "height": 1080,
                    "vcodec": "h264",
                    "filesize": 10000000
                },
                {
                    "url": "https://example.com/480p.mp4",
                    "ext": "mp4",
                    "height": 480,
                    "vcodec": "h264",
                    "filesize": 3000000
                }
            ]
        });

        let formats = extract_formats(&json);
        assert_eq!(formats.len(), 3);
        // Should be sorted by quality descending
        assert_eq!(formats[0].quality, "1080p");
        assert_eq!(formats[1].quality, "720p");
        assert_eq!(formats[2].quality, "480p");
    }

    #[test]
    fn test_extract_formats_filters_audio_only() {
        let json = serde_json::json!({
            "formats": [
                {
                    "url": "https://example.com/video.mp4",
                    "ext": "mp4",
                    "height": 1080,
                    "vcodec": "h264"
                },
                {
                    "url": "https://example.com/audio.mp3",
                    "ext": "mp3",
                    "vcodec": "none",
                    "acodec": "aac"
                }
            ]
        });

        let formats = extract_formats(&json);
        assert_eq!(formats.len(), 1);
        assert_eq!(formats[0].quality, "1080p");
    }

    #[test]
    fn test_extract_formats_fallback_to_requested_downloads() {
        let json = serde_json::json!({
            "formats": [],
            "requested_downloads": [
                {
                    "url": "https://example.com/video.mp4",
                    "ext": "mp4",
                    "filesize": 8000000
                }
            ]
        });

        let formats = extract_formats(&json);
        assert_eq!(formats.len(), 1);
        assert_eq!(formats[0].quality, "best");
    }

    #[test]
    fn test_extract_formats_empty_json() {
        let json = serde_json::json!({});

        let formats = extract_formats(&json);
        assert_eq!(formats.len(), 0);
    }

    #[test]
    fn test_extract_formats_without_height() {
        let json = serde_json::json!({
            "formats": [
                {
                    "url": "https://example.com/video.mp4",
                    "ext": "mp4",
                    "vcodec": "h264",
                    "format_note": "medium"
                }
            ]
        });

        let formats = extract_formats(&json);
        assert_eq!(formats.len(), 1);
        assert_eq!(formats[0].quality, "medium");
    }
}
