// Environment Configuration
export const API_BASE_URL = import.meta.env.VITE_BACKEND_URL || 'http://localhost:3001';
export const API_PREFIX = import.meta.env.VITE_API_PREFIX || '/api';

// Full API URL helper
export const getApiUrl = (endpoint: string): string => {
  const cleanEndpoint = endpoint.startsWith('/') ? endpoint : `/${endpoint}`;
  return `${API_BASE_URL}${API_PREFIX}${cleanEndpoint}`;
};

// Status color mappings
export const STATUS_COLORS: Record<string, 'default' | 'secondary' | 'destructive' | 'outline'> = {
  draft: 'secondary',
  submitted: 'default',
  approved: 'outline',
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

// Rating descriptions
export const BONUS_RATING_DESCRIPTION = 
  'Extra achievements that earn bonus points. Rating 5 = +5 pts, Rating 4 = +3 pts, Rating 3 = 0 pts, Rating 2 = -3 pts, Rating 1 = -5 pts.';
