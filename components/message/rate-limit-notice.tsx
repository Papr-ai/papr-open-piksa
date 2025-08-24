'use client';

import { Alert, AlertDescription } from '@/components/ui/alert';
import { InfoIcon } from '@/components/common/icons';

interface RateLimitNoticeProps {
  show: boolean;
  originalCount: number;
  truncatedCount: number;
  onDismiss?: () => void;
}

export function RateLimitNotice({ 
  show, 
  originalCount, 
  truncatedCount, 
  onDismiss 
}: RateLimitNoticeProps) {
  if (!show) return null;

  return (
    <Alert className="mb-4 border-orange-200 bg-orange-50">
      <InfoIcon className="h-4 w-4 text-orange-600" />
      <AlertDescription className="text-orange-800">
        <div className="flex items-center justify-between">
          <div>
            Message history was automatically reduced from {originalCount} to {truncatedCount} messages 
            to fit within the model&apos;s rate limit. Recent messages are preserved.
          </div>
          {onDismiss && (
            <button
              onClick={onDismiss}
              className="ml-2 text-orange-600 hover:text-orange-800"
              aria-label="Dismiss"
            >
              ×
            </button>
          )}
        </div>
      </AlertDescription>
    </Alert>
  );
}
