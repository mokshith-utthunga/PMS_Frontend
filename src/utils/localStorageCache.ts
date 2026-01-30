// Utility functions for persisting React Query cache to localStorage
import { LOCAL_STORAGE_CACHE_DURATION } from '@/utils/constants';

const STORAGE_PREFIX = 'pms-cache-';
const TIMESTAMP_PREFIX = 'pms-cache-timestamp-';
const CACHE_DURATION = LOCAL_STORAGE_CACHE_DURATION;

/**
 * Save data to localStorage with a key and timestamp
 */
export function saveToLocalStorage(key: string, data: any): void {
  try {
    const storageKey = `${STORAGE_PREFIX}${key}`;
    const timestampKey = `${TIMESTAMP_PREFIX}${key}`;
    const now = Date.now();
    
    localStorage.setItem(storageKey, JSON.stringify(data));
    localStorage.setItem(timestampKey, now.toString());
  } catch (e) {
    console.warn(`Failed to save ${key} to localStorage:`, e);
  }
}

/**
 * Load data from localStorage by key
 * Returns null if cache is older than 30 minutes
 */
export function loadFromLocalStorage<T>(key: string): T | null {
  try {
    const storageKey = `${STORAGE_PREFIX}${key}`;
    const timestampKey = `${TIMESTAMP_PREFIX}${key}`;
    
    const timestampStr = localStorage.getItem(timestampKey);
    if (!timestampStr) {
      // No timestamp means old cache format or no cache - remove it
      localStorage.removeItem(storageKey);
      return null;
    }
    
    const timestamp = parseInt(timestampStr, 10);
    const now = Date.now();
    const age = now - timestamp;
    
    // If cache is older than 30 minutes, clear it and return null
    if (age > CACHE_DURATION) {
      localStorage.removeItem(storageKey);
      localStorage.removeItem(timestampKey);
      return null;
    }
    
    const item = localStorage.getItem(storageKey);
    if (item) {
      return JSON.parse(item) as T;
    }
  } catch (e) {
    console.warn(`Failed to load ${key} from localStorage:`, e);
  }
  return null;
}

/**
 * Remove data from localStorage by key
 */
export function removeFromLocalStorage(key: string): void {
  try {
    const storageKey = `${STORAGE_PREFIX}${key}`;
    localStorage.removeItem(storageKey);
  } catch (e) {
    console.warn(`Failed to remove ${key} from localStorage:`, e);
  }
}

/**
 * Clear all PMS cache from localStorage (including timestamps)
 */
export function clearAllCacheFromLocalStorage(): void {
  try {
    const keys = Object.keys(localStorage);
    keys.forEach(key => {
      if (key.startsWith(STORAGE_PREFIX) || key.startsWith(TIMESTAMP_PREFIX)) {
        localStorage.removeItem(key);
      }
    });
  } catch (e) {
    console.warn('Failed to clear cache from localStorage:', e);
  }
}
