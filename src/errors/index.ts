// Centralized Error Handling Utility
import { ApiError } from '@/services/api';

export interface AppError {
  message: string;
  code?: string;
  statusCode?: number;
  field?: string;
}

// Standard error messages
export const ERROR_MESSAGES = {
  NETWORK: 'Network error. Please check your connection.',
  UNAUTHORIZED: 'You are not authorized to perform this action.',
  NOT_FOUND: 'The requested resource was not found.',
  VALIDATION: 'Please check your input and try again.',
  SERVER: 'Something went wrong. Please try again later.',
  TIMEOUT: 'Request timed out. Please try again.',
  DEFAULT: 'An unexpected error occurred.',
} as const;

// Parse any error into AppError format
export function parseError(error: unknown): AppError {
  if (error instanceof ApiError) {
    return {
      message: error.message,
      statusCode: error.statusCode,
    };
  }

  if (error instanceof Error) {
    return {
      message: error.message || ERROR_MESSAGES.DEFAULT,
    };
  }

  if (typeof error === 'string') {
    return { message: error };
  }

  return { message: ERROR_MESSAGES.DEFAULT };
}

// Get user-friendly error message based on status code
export function getErrorMessage(error: unknown): string {
  const appError = parseError(error);

  if (appError.statusCode) {
    switch (appError.statusCode) {
      case 400:
        return appError.message || ERROR_MESSAGES.VALIDATION;
      case 401:
        return ERROR_MESSAGES.UNAUTHORIZED;
      case 403:
        return ERROR_MESSAGES.UNAUTHORIZED;
      case 404:
        return ERROR_MESSAGES.NOT_FOUND;
      case 408:
        return ERROR_MESSAGES.TIMEOUT;
      case 500:
      case 502:
      case 503:
        return ERROR_MESSAGES.SERVER;
      default:
        return appError.message || ERROR_MESSAGES.DEFAULT;
    }
  }

  return appError.message || ERROR_MESSAGES.DEFAULT;
}

// Log error for debugging (can be extended to send to monitoring service)
export function logError(error: unknown, context?: string): void {
  const appError = parseError(error);
  console.error(`[${context || 'Error'}]:`, appError);
}
