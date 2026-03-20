use std::collections::HashMap;
use std::hash::Hash;
use std::time::Duration;

/// Cache entry with expiration time
#[derive(Clone)]
struct CacheEntry<V> {
    data: V,
    expires_at: u64, // Unix timestamp
}

/// Simple in-memory LRU cache with TTL support
///
/// Note: This is a single-instance cache. For distributed systems,
/// consider using Redis or a similar distributed cache.
pub struct Cache<K, V>
where
    K: Hash + Eq + Clone,
    V: Clone,
{
    data: HashMap<K, CacheEntry<V>>,
    max_size: usize,
    ttl: Duration,
    now_fn: fn() -> u64, // For testing
}

impl<K, V> Cache<K, V>
where
    K: Hash + Eq + Clone,
    V: Clone,
{
    /// Create a new cache
    ///
    /// # Arguments
    /// * `max_size` - Maximum number of entries (LRU eviction when exceeded)
    /// * `ttl` - Time-to-live for cache entries
    pub fn new(max_size: usize, ttl: Duration) -> Self {
        Self {
            data: HashMap::new(),
            max_size,
            ttl,
            now_fn: || {
                std::time::SystemTime::now()
                    .duration_since(std::time::UNIX_EPOCH)
                    .map(|d| d.as_secs())
                    .unwrap_or(0)
            },
        }
    }

    /// Get a value from the cache
    ///
    /// Returns `None` if the key doesn't exist or has expired
    pub fn get(&mut self, key: &K) -> Option<V> {
        let now = (self.now_fn)();

        if let Some(entry) = self.data.get(key) {
            if now < entry.expires_at {
                return Some(entry.data.clone());
            }
            // Entry expired, remove it
            self.data.remove(key);
        }
        None
    }

    /// Put a value into the cache
    ///
    /// If the cache is full, the oldest entry will be evicted
    pub fn put(&mut self, key: K, value: V) {
        // If cache is full, evict oldest entries
        while self.data.len() >= self.max_size {
            self.evict_oldest();
        }

        let now = (self.now_fn)();
        let expires_at = now
            .saturating_add(self.ttl.as_secs())
            .saturating_add(self.ttl.subsec_nanos() as u64 / 1_000_000_000);

        self.data.insert(
            key,
            CacheEntry {
                data: value,
                expires_at,
            },
        );
    }

    /// Remove a specific key from the cache
    pub fn remove(&mut self, key: &K) -> Option<V> {
        self.data.remove(key).map(|e| e.data)
    }

    /// Clear all entries from the cache
    pub fn clear(&mut self) {
        self.data.clear();
    }

    /// Get the number of entries in the cache
    pub fn len(&self) -> usize {
        self.data.len()
    }

    /// Check if the cache is empty
    pub fn is_empty(&self) -> bool {
        self.data.is_empty()
    }

    /// Remove expired entries from the cache
    pub fn cleanup_expired(&mut self) {
        let now = (self.now_fn)();
        self.data.retain(|_, entry| now < entry.expires_at);
    }

    /// Evict the oldest entry from the cache
    fn evict_oldest(&mut self) {
        if let Some(key) = self.data
            .iter()
            .min_by_key(|(_, entry)| entry.expires_at)
            .map(|(key, _)| key.clone())
        {
            self.data.remove(&key);
        }
    }

    /// Get cache statistics
    pub fn stats(&self) -> CacheStats {
        CacheStats {
            entries: self.data.len(),
            max_size: self.max_size,
            ttl_secs: self.ttl.as_secs(),
        }
    }
}

impl<K, V> Default for Cache<K, V>
where
    K: Hash + Eq + Clone,
    V: Clone,
{
    fn default() -> Self {
        Self::new(100, Duration::from_secs(300)) // 100 entries, 5 minute TTL
    }
}

/// Cache statistics
#[derive(Debug, Clone)]
pub struct CacheStats {
    pub entries: usize,
    pub max_size: usize,
    pub ttl_secs: u64,
}

#[cfg(test)]
mod tests {
    use super::*;

    fn create_test_cache() -> Cache<String, String> {
        Cache::new(3, Duration::from_millis(100))
    }

    #[test]
    fn test_cache_get_put() {
        let mut cache = create_test_cache();

        assert_eq!(cache.get(&"key1".to_string()), None);

        cache.put("key1".to_string(), "value1".to_string());
        assert_eq!(cache.get(&"key1".to_string()), Some("value1".to_string()));
    }

    #[test]
    fn test_cache_lru_eviction() {
        let mut cache = create_test_cache();

        // Fill cache to max
        cache.put("key1".to_string(), "value1".to_string());
        cache.put("key2".to_string(), "value2".to_string());
        cache.put("key3".to_string(), "value3".to_string());

        // Add one more - should evict oldest
        cache.put("key4".to_string(), "value4".to_string());

        assert_eq!(cache.len(), 3);
        // Oldest entry should be evicted
        assert_eq!(cache.get(&"key1".to_string()), None);
        assert_eq!(cache.get(&"key4".to_string()), Some("value4".to_string()));
    }

    #[test]
    fn test_cache_expiration() {
        let mut cache = Cache::new(10, Duration::from_millis(50));

        cache.put("key1".to_string(), "value1".to_string());
        assert_eq!(cache.get(&"key1".to_string()), Some("value1".to_string()));

        // Wait for expiration
        std::thread::sleep(Duration::from_millis(60));
        assert_eq!(cache.get(&"key1".to_string()), None);
    }

    #[test]
    fn test_cache_remove() {
        let mut cache = create_test_cache();

        cache.put("key1".to_string(), "value1".to_string());
        assert_eq!(
            cache.remove(&"key1".to_string()),
            Some("value1".to_string())
        );
        assert_eq!(cache.remove(&"key1".to_string()), None);
    }

    #[test]
    fn test_cache_clear() {
        let mut cache = create_test_cache();

        cache.put("key1".to_string(), "value1".to_string());
        cache.put("key2".to_string(), "value2".to_string());

        cache.clear();
        assert!(cache.is_empty());
    }

    #[test]
    fn test_cache_stats() {
        let cache = create_test_cache();
        let stats = cache.stats();

        assert_eq!(stats.entries, 0);
        assert_eq!(stats.max_size, 3);
    }
}
