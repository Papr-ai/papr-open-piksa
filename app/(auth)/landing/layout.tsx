import React from 'react';

export default function LandingLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="h-full w-full overflow-auto rounded-lg border border-gray-200 dark:border-gray-700">
      {children}
    </div>
  );
} 