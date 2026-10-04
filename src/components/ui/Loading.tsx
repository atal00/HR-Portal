'use client';

import React from 'react';
import { Loader2 } from 'lucide-react';

// ==========================================
// 1. LoadingSpinner
// ==========================================
export interface LoadingSpinnerProps {
  size?: 'xs' | 'sm' | 'md' | 'lg' | 'xl';
  variant?: 'primary' | 'white' | 'slate' | 'emerald' | 'red' | 'current';
  className?: string;
  label?: string;
}

export function LoadingSpinner({
  size = 'md',
  variant = 'current',
  className = '',
  label = 'Loading...',
}: LoadingSpinnerProps) {
  const sizeClasses = {
    xs: 'w-3 h-3',
    sm: 'w-4 h-4',
    md: 'w-5 h-5',
    lg: 'w-6 h-6',
    xl: 'w-8 h-8',
  }[size];

  const variantClasses = {
    primary: 'text-[#0B2A4A]',
    white: 'text-white',
    slate: 'text-slate-400',
    emerald: 'text-emerald-600',
    red: 'text-red-600',
    current: 'text-current',
  }[variant];

  return (
    <span
      role="status"
      aria-label={label}
      className={`inline-flex items-center justify-center ${className}`}
    >
      <Loader2
        className={`animate-spin ${sizeClasses} ${variantClasses} shrink-0`}
        aria-hidden="true"
      />
      <span className="sr-only">{label}</span>
    </span>
  );
}

// ==========================================
// 2. LoadingButton
// ==========================================
export interface LoadingButtonProps
  extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  loading?: boolean;
  loadingText?: React.ReactNode;
  spinnerSize?: 'xs' | 'sm' | 'md';
  spinnerVariant?: 'primary' | 'white' | 'slate' | 'emerald' | 'red' | 'current';
}

export const LoadingButton = React.forwardRef<HTMLButtonElement, LoadingButtonProps>(
  (
    {
      children,
      loading = false,
      loadingText,
      disabled = false,
      spinnerSize = 'sm',
      spinnerVariant = 'current',
      className = '',
      onClick,
      ...props
    },
    ref
  ) => {
    const isDisabled = disabled || loading;

    const handleClick = (e: React.MouseEvent<HTMLButtonElement>) => {
      if (isDisabled) {
        e.preventDefault();
        e.stopPropagation();
        return;
      }
      onClick?.(e);
    };

    return (
      <button
        ref={ref}
        type={props.type || 'button'}
        disabled={isDisabled}
        aria-busy={loading}
        aria-disabled={isDisabled}
        onClick={handleClick}
        className={`inline-flex items-center justify-center gap-2 transition-all select-none ${
          isDisabled ? 'cursor-not-allowed opacity-75' : ''
        } ${className}`}
        {...props}
      >
        {loading && (
          <LoadingSpinner
            size={spinnerSize}
            variant={spinnerVariant}
            label={typeof loadingText === 'string' ? loadingText : 'Processing...'}
          />
        )}
        <span>{loading && loadingText ? loadingText : children}</span>
      </button>
    );
  }
);
LoadingButton.displayName = 'LoadingButton';

// ==========================================
// 3. Skeleton & TableSkeleton
// ==========================================
export interface SkeletonProps {
  className?: string;
  style?: React.CSSProperties;
}

export function Skeleton({ className = '', style }: SkeletonProps) {
  return (
    <div
      role="status"
      aria-label="Loading..."
      aria-busy="true"
      className={`animate-pulse bg-slate-200 rounded ${className}`}
      style={style}
    >
      <span className="sr-only">Loading...</span>
    </div>
  );
}

export interface TableSkeletonProps {
  rows?: number;
  columns?: number;
  className?: string;
}

export function TableSkeleton({
  rows = 5,
  columns = 5,
  className = '',
}: TableSkeletonProps) {
  return (
    <div className={`w-full overflow-hidden bg-white border border-slate-200 rounded-xl shadow-xs ${className}`}>
      {/* Table Header Skeleton */}
      <div className="bg-slate-50 border-b border-slate-200 px-6 py-3.5 flex items-center gap-4">
        {Array.from({ length: columns }).map((_, i) => (
          <Skeleton
            key={`header-${i}`}
            className="h-4 flex-1 first:max-w-[120px] last:max-w-[90px]"
          />
        ))}
      </div>
      {/* Table Rows Skeleton */}
      <div className="divide-y divide-slate-100">
        {Array.from({ length: rows }).map((_, rowIdx) => (
          <div
            key={`row-${rowIdx}`}
            className="px-6 py-4 flex items-center gap-4"
          >
            {Array.from({ length: columns }).map((_, colIdx) => (
              <Skeleton
                key={`cell-${rowIdx}-${colIdx}`}
                className={`h-4 flex-1 ${
                  colIdx === 0
                    ? 'h-5 max-w-[140px]'
                    : colIdx === 1
                    ? 'max-w-[180px]'
                    : colIdx === columns - 1
                    ? 'max-w-[80px]'
                    : ''
                }`}
              />
            ))}
          </div>
        ))}
      </div>
    </div>
  );
}

// ==========================================
// 4. InlineLoader
// ==========================================
export interface InlineLoaderProps {
  text?: string;
  size?: 'xs' | 'sm' | 'md';
  className?: string;
}

export function InlineLoader({
  text = 'Loading...',
  size = 'sm',
  className = '',
}: InlineLoaderProps) {
  return (
    <div
      role="status"
      className={`inline-flex items-center gap-2 text-slate-500 text-sm ${className}`}
    >
      <LoadingSpinner size={size} variant="primary" label={text} />
      <span>{text}</span>
    </div>
  );
}

// ==========================================
// 5. PageLoader
// ==========================================
export interface PageLoaderProps {
  title?: string;
  subtitle?: string;
  className?: string;
}

export function PageLoader({
  title = 'Loading...',
  subtitle = 'Please wait while we fetch the latest portal data.',
  className = '',
}: PageLoaderProps) {
  return (
    <div
      role="status"
      aria-live="polite"
      aria-busy="true"
      className={`min-h-[350px] w-full flex flex-col items-center justify-center p-8 text-center ${className}`}
    >
      <div className="w-12 h-12 rounded-2xl bg-[#0B2A4A]/5 border border-[#0B2A4A]/10 flex items-center justify-center mb-4">
        <LoadingSpinner size="lg" variant="primary" label={title} />
      </div>
      <h3 className="text-base font-semibold text-slate-900 mb-1">{title}</h3>
      {subtitle && <p className="text-xs text-slate-500 max-w-sm">{subtitle}</p>}
    </div>
  );
}

// ==========================================
// 6. ModalSkeleton
// ==========================================
export function ModalSkeleton({ className = '' }: { className?: string }) {
  return (
    <div className={`p-6 space-y-5 animate-pulse ${className}`} role="status">
      <div className="flex items-center justify-between border-b border-slate-100 pb-4">
        <Skeleton className="h-6 w-1/3" />
        <Skeleton className="h-5 w-5 rounded-full" />
      </div>
      <div className="space-y-3">
        <Skeleton className="h-4 w-full" />
        <Skeleton className="h-4 w-5/6" />
        <Skeleton className="h-10 w-full rounded-lg" />
      </div>
      <div className="grid grid-cols-2 gap-4 pt-2">
        <Skeleton className="h-10 rounded-lg" />
        <Skeleton className="h-10 rounded-lg" />
      </div>
    </div>
  );
}
