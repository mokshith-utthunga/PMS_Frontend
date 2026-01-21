// Centralized Toast Utility
import { toast as baseToast } from '@/hooks/use-toast';
import { getErrorMessage } from '@/errors';

type ToastVariant = 'default' | 'destructive';

interface ToastOptions {
  title?: string;
  description?: string;
  variant?: ToastVariant;
  duration?: number;
}

// Success toast
export function showSuccess(message: string, description?: string): void {
  baseToast({
    title: message,
    description,
    variant: 'default',
  });
}

// Error toast
export function showError(error: unknown, title = 'Error'): void {
  const message = getErrorMessage(error);
  baseToast({
    title,
    description: message,
    variant: 'destructive',
  });
}

// Warning toast
export function showWarning(message: string, description?: string): void {
  baseToast({
    title: message,
    description,
    variant: 'default',
  });
}

// Info toast
export function showInfo(message: string, description?: string): void {
  baseToast({
    title: message,
    description,
  });
}

// Generic toast
export function showToast(options: ToastOptions): void {
  baseToast(options);
}

// Grouped export for convenience
export const toasts = {
  success: showSuccess,
  error: showError,
  warning: showWarning,
  info: showInfo,
  show: showToast,
};
