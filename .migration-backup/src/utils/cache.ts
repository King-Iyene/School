/**
 * Simple localStorage-based caching utility with TTL (Time To Live).
 */

interface CacheItem<T> {
  data: T;
  expiry: number;
}

export const cache = {
  /**
   * Set data in cache
   * @param key Cache key
   * @param data Data to store
   * @param ttl TTL in milliseconds (default 1 hour)
   */
  set: <T>(key: string, data: T, ttl: number = 3600000) => {
    const item: CacheItem<T> = {
      data,
      expiry: Date.now() + ttl,
    };
    try {
      localStorage.setItem(`school_portal_cache_${key}`, JSON.stringify(item));
    } catch (e) {
      console.warn('Cache write failed:', e);
    }
  },

  /**
   * Get data from cache
   * @param key Cache key
   */
  get: <T>(key: string): T | null => {
    try {
      const stored = localStorage.getItem(`school_portal_cache_${key}`);
      if (!stored) return null;

      const item: CacheItem<T> = JSON.parse(stored);
      if (Date.now() > item.expiry) {
        localStorage.removeItem(`school_portal_cache_${key}`);
        return null;
      }
      return item.data;
    } catch (e) {
      return null;
    }
  },

  /**
   * Remove a specific key
   */
  remove: (key: string) => {
    localStorage.removeItem(`school_portal_cache_${key}`);
  },

  /**
   * Clear all school portal cache
   */
  clear: () => {
    Object.keys(localStorage)
      .filter(key => key.startsWith('school_portal_cache_'))
      .forEach(key => localStorage.removeItem(key));
  },

  /**
   * Invalidate cache keys starting with a prefix
   */
  invalidate: (prefix: string) => {
    Object.keys(localStorage)
      .filter(key => key.startsWith(`school_portal_cache_${prefix}`))
      .forEach(key => localStorage.removeItem(key));
  },

  /**
   * Wrapper for fetching data with cache
   */
  fetch: async <T>(key: string, fetcher: () => Promise<T>, ttl?: number): Promise<T> => {
    const cached = cache.get<T>(key);
    if (cached) return cached;

    const fresh = await fetcher();
    cache.set(key, fresh, ttl);
    return fresh;
  },
};
