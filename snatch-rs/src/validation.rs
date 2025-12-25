use std::collections::HashSet;

/// Allowed platform domains for URL validation
const ALLOWED_PLATFORMS: &[&str] = &["instagram.com", "tiktok.com", "twitter.com", "x.com"];

/// Dangerous characters that could lead to command injection
const DANGEROUS_CHARS: &[char] = &[';', '|', '&', '$', '`', '\n', '\r', '\t', '\\', '<', '>'];

/// Validates a URL to prevent command injection and ensure it's from a supported platform
///
/// # Arguments
/// * `url` - The URL string to validate
///
/// # Returns
/// * `Ok(())` if the URL is valid
/// * `Err(String)` with an error message if validation fails
pub fn validate_url(url: &str) -> Result<(), String> {
    // Check for dangerous characters first (before parsing)
    for char in url.chars() {
        if DANGEROUS_CHARS.contains(&char) {
            return Err(format!(
                "URL contains invalid character '{}'. Only alphanumeric and standard URL characters are allowed.",
                char
            ));
        }
    }

    // Basic URL format validation
    let parsed = url::Url::parse(url).map_err(|e| format!("Invalid URL format: {}", e))?;

    // Protocol check - only allow HTTP and HTTPS
    match parsed.scheme() {
        "http" | "https" => {}
        scheme => {
            return Err(format!(
                "Unsupported protocol '{}'. Only HTTP and HTTPS are allowed.",
                scheme
            ))
        }
    }

    // Domain whitelist check
    let host = parsed.host_str().unwrap_or("");
    if host.is_empty() {
        return Err("URL has no host".to_string());
    }

    // Convert to lowercase for comparison
    let host_lower = host.to_lowercase();
    let is_allowed = ALLOWED_PLATFORMS
        .iter()
        .any(|platform| host_lower == *platform || host_lower.ends_with(&format!(".{}", platform)));

    if !is_allowed {
        return Err(format!(
            "Unsupported platform: '{}'. Supported platforms are: {}",
            host,
            ALLOWED_PLATFORMS.join(", ")
        ));
    }

    Ok(())
}

/// Extracts the platform name from a valid URL
///
/// # Arguments
/// * `url` - The URL string (should already be validated)
///
/// # Returns
/// * The platform name as a string ("instagram", "tiktok", "twitter", or "unknown")
pub fn extract_platform(url: &str) -> String {
    if let Ok(parsed) = url::Url::parse(url) {
        if let Some(host) = parsed.host_str() {
            let host_lower = host.to_lowercase();
            if host_lower.contains("instagram.com") {
                return "instagram".to_string();
            } else if host_lower.contains("tiktok.com") {
                return "tiktok".to_string();
            } else if host_lower.contains("x.com") || host_lower.contains("twitter.com") {
                return "twitter".to_string();
            }
        }
    }
    "unknown".to_string()
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_validate_url_valid_instagram() {
        assert!(validate_url("https://instagram.com/p/ABC123").is_ok());
        assert!(validate_url("https://www.instagram.com/reel/xyz").is_ok());
    }

    #[test]
    fn test_validate_url_valid_tiktok() {
        assert!(validate_url("https://tiktok.com/@user/video/123").is_ok());
        assert!(validate_url("https://www.tiktok.com/video/123").is_ok());
    }

    #[test]
    fn test_validate_url_valid_twitter() {
        assert!(validate_url("https://twitter.com/user/status/123").is_ok());
        assert!(validate_url("https://x.com/user/status/123").is_ok());
    }

    #[test]
    fn test_validate_url_invalid_protocol() {
        assert!(validate_url("ftp://example.com").is_err());
        assert!(validate_url("javascript:alert(1)").is_err());
    }

    #[test]
    fn test_validate_url_unsupported_domain() {
        assert!(validate_url("https://youtube.com/watch?v=123").is_err());
        assert!(validate_url("https://facebook.com/video/123").is_err());
    }

    #[test]
    fn test_validate_url_command_injection() {
        assert!(validate_url("https://instagram.com/p/123; rm -rf /").is_err());
        assert!(validate_url("https://instagram.com/p/123| cat /etc/passwd").is_err());
        assert!(validate_url("https://instagram.com/p/123& malicious").is_err());
        assert!(validate_url("https://instagram.com/p/123$HOME").is_err());
        assert!(validate_url("https://instagram.com/p/123`whoami`").is_err());
    }

    #[test]
    fn test_validate_url_invalid_format() {
        assert!(validate_url("not-a-url").is_err());
        assert!(validate_url("://invalid").is_err());
    }

    #[test]
    fn test_extract_platform() {
        assert_eq!(extract_platform("https://instagram.com/p/123"), "instagram");
        assert_eq!(
            extract_platform("https://www.instagram.com/reel/123"),
            "instagram"
        );
        assert_eq!(
            extract_platform("https://tiktok.com/@user/video/123"),
            "tiktok"
        );
        assert_eq!(extract_platform("https://x.com/user/status/123"), "twitter");
        assert_eq!(
            extract_platform("https://twitter.com/user/status/123"),
            "twitter"
        );
        assert_eq!(extract_platform("https://unknown.com/page"), "unknown");
    }
}
