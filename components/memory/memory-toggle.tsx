'use client';

import { useId, useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip';

// Custom Memory Icon component
const MemoryIcon = ({
  size = 14,
  isEnabled = false,
  gradientId,
}: {
  size?: number;
  isEnabled: boolean;
  gradientId: string;
}) => {
  return (
    <svg
      width={size}
      height={size * 1.2}
      viewBox="0 0 20 20"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
    >
      <path
        d="M9.16274 17.5H8.3294L9.16274 11.6667H6.24607C5.51274 11.6667 5.97107 11.0417 5.98774 11.0167C7.06274 9.11667 8.6794 6.28333 10.8377 2.5H11.6711L10.8377 8.33333H13.7627C14.0961 8.33333 14.2794 8.49167 14.0961 8.88333C10.8044 14.625 9.16274 17.5 9.16274 17.5Z"
        stroke={isEnabled ? `url(#${gradientId})` : 'currentColor'}
        strokeWidth="1.5"
        strokeLinecap="round"
        strokeLinejoin="round"
        fill={isEnabled ? `url(#${gradientId})` : 'none'}
        className={isEnabled ? '' : 'opacity-70'}
      />
      <defs>
        <linearGradient
          id={gradientId}
          x1="5"
          y1="17"
          x2="14"
          y2="3"
          gradientUnits="userSpaceOnUse"
        >
          <stop stopColor="#0060E0" />
          <stop offset="0.6" stopColor="#00ACFA" />
          <stop offset="1" stopColor="#0BCDFF" />
        </linearGradient>
      </defs>
    </svg>
  );
};

export function MemoryToggle() {
  // Generate a unique ID for the gradient
  const gradientId = useId();

  // Use regular useState with a default value for SSR compatibility
  const [isMemoryEnabled, setIsMemoryEnabled] = useState(true);
  const [isClient, setIsClient] = useState(false);

  // After component mounts (client-side only), load from localStorage
  useEffect(() => {
    setIsClient(true);
    const storedValue = localStorage.getItem('memory-enabled');
    if (storedValue !== null) {
      setIsMemoryEnabled(storedValue === 'true');
    }
  }, []);

  const toggleMemory = (e: React.MouseEvent) => {
    // Prevent default to avoid any page refresh
    e.preventDefault();
    e.stopPropagation();

    // Toggle the memory state and store in localStorage
    const newState = !isMemoryEnabled;
    setIsMemoryEnabled(newState);

    // Only update localStorage on the client
    if (typeof window !== 'undefined') {
      localStorage.setItem('memory-enabled', String(newState));

      // Dispatch a custom event that other components can listen for
      const event = new CustomEvent('memory-toggle-changed', {
        detail: { enabled: newState },
      });
      window.dispatchEvent(event);

      console.log('[Memory Toggle] Changed to:', newState);
    }
  };

  return (
    <TooltipProvider>
      <Tooltip>
        <TooltipTrigger asChild>
          <Button
            data-testid="memory-toggle-button"
            className={`rounded-md rounded-bl-lg p-[7px] h-fit dark:border-zinc-700 hover:dark:bg-zinc-900 hover:bg-zinc-200 transition-colors duration-200 ${isClient && isMemoryEnabled ? 'text-blue-500 dark:text-blue-400' : 'text-gray-500 dark:text-gray-400'}`}
            onClick={toggleMemory}
            variant="ghost"
            aria-label={
              isMemoryEnabled ? 'Disable memory search' : 'Enable memory search'
            }
            type="button"
          >
            <MemoryIcon
              size={20}
              isEnabled={isClient && isMemoryEnabled}
              gradientId={gradientId}
            />
          </Button>
        </TooltipTrigger>
        <TooltipContent side="top">
          {isMemoryEnabled ? 'Memory search enabled' : 'Memory search disabled'}
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );
}
