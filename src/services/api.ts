// Core API client - Centralized HTTP layer
// All backend routes are under /api

export interface ApiResponse<T> {
  data: T;
  error?: string;
  count?: number;
}

export class ApiError extends Error {
  constructor(
    message: string,
    public statusCode?: number,
    public originalError?: unknown
  ) {
    super(message);
    this.name = 'ApiError';
  }
}

async function request<T>(endpoint: string, options: RequestInit = {}): Promise<T> {
  // All endpoints go through Vite proxy to /api
  const url = endpoint.startsWith('/api') ? endpoint : `/api${endpoint.startsWith('/') ? endpoint : `/${endpoint}`}`;

  try {
    const res = await fetch(url, {
      ...options,
      headers: {
        'Content-Type': 'application/json',
        ...options.headers,
      },
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
      throw new ApiError(
        data?.error || data?.message || 'Request failed',
        res.status
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
  
  post: <T>(url: string, body?: unknown) => 
    request<T>(url, { 
      method: 'POST', 
      body: body ? JSON.stringify(body) : undefined 
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

// Export API_BASE_URL for backward compatibility (not needed with proxy)
export const API_BASE_URL = '';
