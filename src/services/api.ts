
export interface ApiResponse<T> {
  data: T;
  error?: string;
  count?: number;
}

export class ApiError extends Error {
  constructor(
    message: string,
    public statusCode?: number,
    public originalError?: unknown,
    public details?: string[] | string
  ) {
    super(message);
    this.name = 'ApiError';
  }
}

async function request<T>(endpoint: string, options: RequestInit = {}): Promise<T> {
  const backendUrl = import.meta.env.VITE_BACKEND_URL;
  const isProduction = import.meta.env.PROD;
  
  // Construct URL: use full URL in production if backendUrl is set, otherwise use relative (for same-domain deployment)
  let url: string;
  if (isProduction && backendUrl) {
    // Production with explicit backend URL
    const cleanEndpoint = endpoint.startsWith('/api') 
      ? endpoint 
      : `/api${endpoint.startsWith('/') ? endpoint : `/${endpoint}`}`;
    url = `${backendUrl}${cleanEndpoint}`;
  } else {
    // Development (uses Vite proxy) or production on same domain
    url = endpoint.startsWith('/api') ? endpoint : `/api${endpoint.startsWith('/') ? endpoint : `/${endpoint}`}`;
  }

  try {
    // Don't set Content-Type for FormData - browser will set it automatically with boundary
    const isFormData = options.body instanceof FormData;
    
    // Build headers object
    const headers: HeadersInit = {};
    
    if (!isFormData) {
      // For non-FormData requests, set Content-Type
      headers['Content-Type'] = 'application/json';
    }
    
    // Add any provided headers, but skip Content-Type for FormData
    if (options.headers) {
      const providedHeaders = options.headers instanceof Headers
        ? Object.fromEntries(options.headers.entries())
        : options.headers;
      
      for (const [key, value] of Object.entries(providedHeaders)) {
        // Skip Content-Type for FormData - browser will set it with boundary
        if (isFormData && key.toLowerCase() === 'content-type') {
          continue;
        }
        headers[key] = value as string;
      }
    }

    const res = await fetch(url, {
      ...options,
      headers,
      credentials: 'include',
    });

    // Handle empty responses
    const contentType = res.headers.get('content-type');
    if (!contentType || !contentType.includes('application/json')) {
      if (res.ok) {
        return {} as T;
      }
      throw new ApiError('Invalid response format', res.status);
    }

    let data;
    try {
      const text = await res.text();
      data = text ? JSON.parse(text) : null;
    } catch (parseError) {
      console.error('Failed to parse JSON response:', parseError);
      throw new ApiError('Invalid JSON response', res.status);
    }

    if (!res.ok) {
      const errorMessage = data?.error || data?.message || 'Request failed';
      const errorDetails = data?.details;
      throw new ApiError(
        errorMessage,
        res.status,
        undefined,
        errorDetails
      );
    }

    // Ensure we return a valid object, not null
    if (data === null || data === undefined) {
      console.warn('API returned null/undefined for:', url);
      return {} as T;
    }

    return data;
  } catch (error) {
    if (error instanceof ApiError) throw error;
    throw new ApiError(
      error instanceof Error ? error.message : 'Network error',
      undefined,
      error
    );
  }
}

// HTTP methods
export const api = {
  get: <T>(url: string) => request<T>(url),
  
  post: <T>(url: string, body?: unknown, options?: RequestInit) => 
    request<T>(url, { 
      method: 'POST', 
      body: body instanceof FormData ? body : (body ? JSON.stringify(body) : undefined),
      ...options,
    }),
  
  put: <T>(url: string, body?: unknown) => 
    request<T>(url, { 
      method: 'PUT', 
      body: body ? JSON.stringify(body) : undefined 
    }),
  
  patch: <T>(url: string, body?: unknown) => 
    request<T>(url, { 
      method: 'PATCH', 
      body: body ? JSON.stringify(body) : undefined 
    }),
  
  delete: <T>(url: string, body?: unknown) => 
    request<T>(url, { 
      method: 'DELETE', 
      body: body ? JSON.stringify(body) : undefined 
    }),
};

// Export API_BASE_URL for backward compatibility
// In production, this will be the backend URL if set, otherwise empty (for same-domain deployment)
export const API_BASE_URL = import.meta.env.PROD && import.meta.env.VITE_BACKEND_URL 
  ? import.meta.env.VITE_BACKEND_URL 
  : '';
