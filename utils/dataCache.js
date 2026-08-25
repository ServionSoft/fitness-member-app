import AsyncStorage from '@react-native-async-storage/async-storage';

/**
 * Data caching utility for reducing API calls and improving UX
 * Caches data for 5 minutes by default
 */

const CACHE_TTL = 5 * 60 * 1000; // 5 minutes

export class DataCache {
  /**
   * Get cached data if it exists and is not expired
   */
  static async get(key) {
    try {
      const cached = await AsyncStorage.getItem(`cache_${key}`);
      if (!cached) return null;
      
      const parsed = JSON.parse(cached);
      if (!parsed || !parsed.timestamp || !parsed.data) return null;
      
      const isExpired = Date.now() - parsed.timestamp > CACHE_TTL;
      if (isExpired) {
        await AsyncStorage.removeItem(`cache_${key}`);
        return null;
      }
      
      return parsed.data;
    } catch (error) {
      console.error('Error getting cache:', error);
      return null;
    }
  }

  /**
   * Store data in cache
   */
  static async set(key, data) {
    try {
      const cache = {
        timestamp: Date.now(),
        data: data,
      };
      await AsyncStorage.setItem(`cache_${key}`, JSON.stringify(cache));
    } catch (error) {
      console.error('Error setting cache:', error);
    }
  }

  /**
   * Clear cached data for a specific key
   */
  static async clear(key) {
    try {
      await AsyncStorage.removeItem(`cache_${key}`);
    } catch (error) {
      console.error('Error clearing cache:', error);
    }
  }

  /**
   * Clear all cached data
   */
  static async clearAll() {
    try {
      const keys = await AsyncStorage.getAllKeys();
      const cacheKeys = keys.filter(key => key.startsWith('cache_'));
      await AsyncStorage.multiRemove(cacheKeys);
    } catch (error) {
      console.error('Error clearing all cache:', error);
    }
  }
}

