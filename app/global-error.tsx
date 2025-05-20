'use client';

import { Button } from '@/components/ui/button';

export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <div className="flex h-screen w-screen items-center justify-center">
      <div className="text-center">
        <h1 className="text-4xl font-bold">Something went wrong</h1>
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
