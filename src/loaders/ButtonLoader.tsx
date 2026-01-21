// Reusable Button Loader Component
import { Loader2 } from 'lucide-react';

interface ButtonLoaderProps {
  size?: 'sm' | 'md' | 'lg';
  className?: string;
}

const sizeClasses = {
  sm: 'h-3 w-3',
  md: 'h-4 w-4',
  lg: 'h-5 w-5',
};

export function ButtonLoader({ size = 'md', className = '' }: ButtonLoaderProps) {
  return (
    <Loader2 className={`animate-spin ${sizeClasses[size]} ${className}`} />
  );
}
