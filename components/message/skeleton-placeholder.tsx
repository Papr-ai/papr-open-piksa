'use client';

import { cn } from '@/lib/utils';

interface SkeletonPlaceholderProps {
  type: 'code' | 'memory' | 'github' | 'weather';
  className?: string;
}

export function SkeletonPlaceholder({ type, className }: SkeletonPlaceholderProps) {
  switch (type) {
    case 'code':
      return (
        <div className={cn('space-y-3 rounded-lg bg-muted/10 p-4', className)}>
          <div className="h-4 w-3/4 animate-pulse rounded bg-muted" />
          <div className="h-4 w-1/2 animate-pulse rounded bg-muted" />
          <div className="h-4 w-2/3 animate-pulse rounded bg-muted" />
        </div>
      );

    case 'memory':
      return (
        <div className={cn('space-y-2 rounded-lg bg-muted/5 p-3', className)}>
          <div className="flex items-center gap-2">
            <div className="h-4 w-4 animate-pulse rounded-full bg-muted" />
            <div className="h-4 w-1/4 animate-pulse rounded bg-muted" />
          </div>
          <div className="h-3 w-1/2 animate-pulse rounded bg-muted" />
        </div>
      );

    case 'github':
      return (
        <div className={cn('space-y-4 rounded-lg border p-4', className)}>
          <div className="flex items-center gap-3">
            <div className="h-8 w-8 animate-pulse rounded-full bg-muted" />
            <div className="space-y-2">
              <div className="h-4 w-32 animate-pulse rounded bg-muted" />
              <div className="h-3 w-24 animate-pulse rounded bg-muted" />
            </div>
          </div>
          <div className="h-24 animate-pulse rounded bg-muted/10" />
        </div>
      );

    case 'weather':
      return (
        <div className={cn('flex items-center gap-4 rounded-lg bg-muted/5 p-4', className)}>
          <div className="h-12 w-12 animate-pulse rounded-full bg-muted" />
          <div className="space-y-2">
            <div className="h-5 w-24 animate-pulse rounded bg-muted" />
            <div className="h-4 w-16 animate-pulse rounded bg-muted" />
          </div>
          <div className="ml-auto text-4xl">
            <div className="h-8 w-16 animate-pulse rounded bg-muted" />
          </div>
        </div>
      );
  }
} 