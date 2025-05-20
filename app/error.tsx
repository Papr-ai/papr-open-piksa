'use client';

import { useEffect } from 'react';
import { Button } from '@/components/ui/button';

export default function ErrorBoundary({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    // Log the error to an error reporting service
    console.error(error);
  }, [error]);

  return (
    <div className="flex min-h-screen items-center justify-center">
      <div className="text-center">
        <h2 className="text-4xl font-bold">Something went wrong!</h2>
        <p className="mt-2 text-lg text-gray-600">
          {error.message || 'An unexpected error occurred'}
        </p>
        <div className="mt-4 flex gap-4 justify-center">
          <Button onClick={reset}>Try again</Button>
          <Button
            variant="outline"
            onClick={() => {
              window.location.href = '/';
            }}
          >
            Go Home
          </Button>
        </div>
      </div>
    </div>
  );
}
