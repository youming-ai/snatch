use serde::{Deserialize, Serialize};

/// Request body for extract endpoint
#[derive(Debug, Deserialize)]
pub struct ExtractRequest {
    pub url: String,
}

/// Video format information
#[derive(Debug, Serialize, Clone)]
pub struct VideoFormat {
    pub quality: String,
    pub url: String,
    pub ext: String,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub filesize: Option<u64>,
}

/// Successful extraction response
#[derive(Debug, Serialize)]
pub struct ExtractResponse {
    pub success: bool,
    pub platform: String,
    pub title: String,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub thumbnail: Option<String>,
    pub formats: Vec<VideoFormat>,
}

/// Error response
#[derive(Debug, Serialize)]
pub struct ErrorResponse {
    pub success: bool,
    pub error: String,
}

impl ExtractResponse {
    pub fn new(platform: String, title: String, thumbnail: Option<String>, formats: Vec<VideoFormat>) -> Self {
        Self {
            success: true,
            platform,
            title,
            thumbnail,
            formats,
        }
    }
}

impl ErrorResponse {
    pub fn new(error: impl Into<String>) -> Self {
        Self {
            success: false,
            error: error.into(),
        }
    }
}
