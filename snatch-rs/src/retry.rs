use std::time::Duration;
use tokio::time::sleep;

/// Retry an async operation with exponential backoff
///
/// # Arguments
/// * `operation` - A closure that returns a Future yielding a Result
/// * `max_retries` - Maximum number of retry attempts
///
/// # Returns
/// * `Ok(T)` if the operation succeeds
/// * `Err(E)` if all retry attempts fail
///
/// # Example
/// ```no_run
/// use crate::retry::retry_with_backoff;
///
/// # async fn example() -> Result<(), String> {
/// let result = retry_with_backoff(
///     || async { fetch_data().await },
///     3,
/// ).await?;
/// # Ok(())
/// # }
/// ```
pub async fn retry_with_backoff<T, E, F, Fut>(mut operation: F, max_retries: u32) -> Result<T, E>
where
    F: FnMut() -> Fut,
    Fut: std::future::Future<Output = Result<T, E>>,
{
    let mut attempt = 0;
    let mut delay = Duration::from_millis(500);
    let mut last_error: Option<E> = None;

    loop {
        match operation().await {
            Ok(result) => return Ok(result),
            Err(e) if attempt < max_retries => {
                attempt += 1;
                last_error = Some(e);

                // Log retry attempt in debug mode
                tracing::debug!(
                    "Operation failed, retrying in {:?} (attempt {}/{})",
                    delay,
                    attempt,
                    max_retries
                );

                sleep(delay).await;
                delay = delay.saturating_mul(2);

                // Cap the delay at 30 seconds
                if delay > Duration::from_secs(30) {
                    delay = Duration::from_secs(30);
                }
            }
            Err(e) => return Err(e),
        }
    }
}

/// Check if an error is retryable
///
/// Some errors should not be retried (e.g., invalid input)
/// This function helps determine if a retry is worthwhile
pub fn is_retryable_error(error: &str) -> bool {
    // Don't retry on these error types
    const NON_RETRYABLE_PATTERNS: &[&str] = &[
        "invalid URL",
        "unsupported platform",
        "URL contains",
        "Only HTTP and HTTPS",
    ];

    let error_lower = error.to_lowercase();

    // Check if error contains non-retryable patterns
    for pattern in NON_RETRYABLE_PATTERNS {
        if error_lower.contains(&pattern.to_lowercase()) {
            return false;
        }
    }

    // Default to retryable for network-related errors
    true
}

#[cfg(test)]
mod tests {
    use super::*;

    #[tokio::test]
    async fn test_retry_success_on_first_try() {
        let mut count = 0;
        let result = retry_with_backoff(
            || async {
                count += 1;
                Ok::<(), String>(())
            },
            3,
        )
        .await;

        assert!(result.is_ok());
        assert_eq!(count, 1);
    }

    #[tokio::test]
    async fn test_retry_success_after_failure() {
        let mut count = 0;
        let result = retry_with_backoff(
            || async {
                count += 1;
                if count < 2 {
                    Err::<(), String>("temporary error".to_string())
                } else {
                    Ok(())
                }
            },
            3,
        )
        .await;

        assert!(result.is_ok());
        assert_eq!(count, 2);
    }

    #[tokio::test]
    async fn test_retry_failure_after_max_attempts() {
        let result = retry_with_backoff(
            || async { Err::<(), String>("persistent error".to_string()) },
            2,
        )
        .await;

        assert!(result.is_err());
        assert_eq!(result.unwrap_err(), "persistent error");
    }

    #[test]
    fn test_is_retryable_error() {
        assert!(!is_retryable_error("invalid URL format"));
        assert!(!is_retryable_error("Unsupported platform: youtube.com"));
        assert!(!is_retryable_error("URL contains invalid character ';'"));

        assert!(is_retryable_error("connection timeout"));
        assert!(is_retryable_error("network error"));
        assert!(is_retryable_error("temporary failure"));
    }
}
