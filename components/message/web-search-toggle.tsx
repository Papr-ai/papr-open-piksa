'use client';

import { useId, useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip';

// Custom Web Search Icon component
const WebSearchIcon = ({
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
      height={size}
      viewBox="0 0 20 20"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
    >
      <circle
        cx="10"
        cy="10"
        r="8"
        stroke={isEnabled ? `url(#${gradientId})` : 'currentColor'}
        strokeWidth="1.5"
        fill="none"
        className={isEnabled ? '' : 'opacity-70'}
      />
      <path
        d="M2 10h16M10 2a15.3 15.3 0 0 1 4 8 15.3 15.3 0 0 1-4 8 15.3 15.3 0 0 1-4-8 15.3 15.3 0 0 1 4-8z"
        stroke={isEnabled ? `url(#${gradientId})` : 'currentColor'}
        strokeWidth="1.5"
        fill="none"
        className={isEnabled ? '' : 'opacity-70'}
      />
      <defs>
        <linearGradient
          id={gradientId}
          x1="2"
          y1="18"
          x2="18"
          y2="2"
          gradientUnits="userSpaceOnUse"
        >
          <stop stopColor="#0161E0" />
          <stop offset="0.6" stopColor="#0CCDFF" />
          <stop offset="1" stopColor="#00FEFE" />
        </linearGradient>
      </defs>
    </svg>
  );
};

export function WebSearchToggle() {
  // Generate a unique ID for the gradient
  const gradientId = useId();

  // Use regular useState with a default value for SSR compatibility
  const [isWebSearchEnabled, setIsWebSearchEnabled] = useState(false);
  const [isClient, setIsClient] = useState(false);

  // After component mounts (client-side only), load from localStorage
  useEffect(() => {
    setIsClient(true);
    const storedValue = localStorage.getItem('web-search-enabled');
    if (storedValue !== null) {
      setIsWebSearchEnabled(storedValue === 'true');
    }
  }, []);

  const toggleWebSearch = (e: React.MouseEvent) => {
    // Prevent default to avoid any page refresh
    e.preventDefault();
    e.stopPropagation();

    // Toggle the web search state and store in localStorage
    const newState = !isWebSearchEnabled;
    setIsWebSearchEnabled(newState);

    // Only update localStorage on the client
    if (typeof window !== 'undefined') {
      localStorage.setItem('web-search-enabled', String(newState));

      // Dispatch a custom event that other components can listen for
      const event = new CustomEvent('web-search-toggle-changed', {
        detail: { enabled: newState },
      });
      window.dispatchEvent(event);

      console.log('[Web Search Toggle] Changed to:', newState);
    }
  };

  return (
    <TooltipProvider>
      <Tooltip>
        <TooltipTrigger asChild>
          <Button
            data-testid="web-search-toggle-button"
            className={`rounded-md rounded-bl-lg p-[7px] h-fit dark:border-zinc-700 hover:dark:bg-zinc-900 hover:bg-zinc-200 transition-colors duration-200 ${isClient && isWebSearchEnabled ? '' : 'text-gray-500 dark:text-gray-400'}`}
            style={{
              color: isClient && isWebSearchEnabled ? '#0161E0' : undefined
            }}
            onClick={toggleWebSearch}
            variant="ghost"
            aria-label={
              isWebSearchEnabled ? 'Disable web search' : 'Enable web search'
            }
            type="button"
          >
            <WebSearchIcon
              size={20}
              isEnabled={isClient && isWebSearchEnabled}
              gradientId={gradientId}
            />
          </Button>
        </TooltipTrigger>
        <TooltipContent side="top">
          {isWebSearchEnabled ? 'Web search enabled' : 'Web search disabled'}
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );
}
