'use client';

import { useId, useState, useEffect } from 'react';
import { Button } from './ui/button';
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from './ui/tooltip';

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
      height={size * 1.18}
      viewBox="0 0 105 124"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
    >
      <path
        d="M27.9998 101.5C-11.5 158 6.99988 51 43.4008 60.5002C99.2884 75.0861 115.18 20.7781 83.6804 8.27816C40.2693 -8.94844 51.9998 65 27.9998 101.5Z"
        stroke={isEnabled ? `url(#${gradientId})` : 'currentColor'}
        strokeWidth="8"
        strokeLinecap="round"
        strokeLinejoin="round"
        className={isEnabled ? '' : 'opacity-70'}
      />
      <defs>
        <linearGradient
          id={gradientId}
          x1="17.2207"
          y1="89.4214"
          x2="68.8959"
          y2="35.8394"
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
