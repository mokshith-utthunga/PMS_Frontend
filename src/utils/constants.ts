// Environment Configuration
export const API_BASE_URL = import.meta.env.VITE_BACKEND_URL || 'http://localhost:3001';
export const API_PREFIX = import.meta.env.VITE_API_PREFIX || '/api';

// API URL helper - works in both dev and production
// In development: uses relative URLs (Vite proxy handles it)
// In production: uses full URL if VITE_BACKEND_URL is set, otherwise relative (same domain)
export const getApiUrl = (endpoint: string): string => {
  const backendUrl = import.meta.env.VITE_BACKEND_URL;
  const isProduction = import.meta.env.PROD;
  
  // Ensure endpoint starts with /api
  const cleanEndpoint = endpoint.startsWith('/api') 
    ? endpoint 
    : `/api${endpoint.startsWith('/') ? endpoint : `/${endpoint}`}`;
  
  if (isProduction && backendUrl) {
    // Production with explicit backend URL
    return `${backendUrl}${cleanEndpoint}`;
  } else {
    // Development (uses Vite proxy) or production on same domain
    return cleanEndpoint;
  }
};

// Status color mappings
export const STATUS_COLORS: Record<string, 'default' | 'secondary' | 'destructive' | 'outline'|'submitted'> = {
  draft: 'secondary',
  submitted: 'submitted',
  approved: 'submitted',
  returned: 'destructive',
  locked: 'outline',
  active: 'default',
  inactive: 'secondary',
  on_leave: 'outline',
  terminated: 'destructive',
};

// Metric type labels
export const METRIC_TYPE_LABELS: Record<string, string> = {
  number: 'Numeric',
  percentage: 'Percentage',
  milestone: 'Milestone',
  qualitative: 'Qualitative',
};

// Pagination
export const DEFAULT_PAGE_SIZE = 20;

// KRA/KPI constraints
export const MIN_KRAS = 3;
export const MAX_KRAS = 5;
export const TOTAL_WEIGHT = 100;

// Cache time constants (in milliseconds)
export const CACHE_STALE_TIME = 30 * 60 * 1000; // 30 minutes - data is fresh for this duration
export const CACHE_GC_TIME = 60 * 60 * 1000; // 1 hour - keep in cache for this duration after last use
export const LOCAL_STORAGE_CACHE_DURATION = 30 * 60 * 1000; // 30 minutes - localStorage cache expires after this duration