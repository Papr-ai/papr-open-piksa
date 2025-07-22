'use client';

import { useAtom, useAtomValue, useSetAtom } from 'jotai';
import {
  appOutputAtom,
  selectedAppIdAtom,
  appUrlAtom,
  previewErrorMessageAtom,
} from '@/atoms/appAtoms';
import { selectedChatIdAtom } from '@/atoms/chatAtoms';
import { useStreamChat } from '@/hooks/useStreamChat';
import { useLoadAppFile } from '@/hooks/useLoadAppFile';
import { useEffect, useRef, useState } from 'react';
import { motion } from 'framer-motion';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from './ui/dropdown-menu';
import {
  Eye,
  Code,
  ChevronDown,
  ChevronUp,
  Logs,
  MoreVertical,
  Cog,
  Power,
  X,
  Sparkles,
  Lightbulb,
  ChevronRight,
} from 'lucide-react';
import type { AppOutput } from '@/types/app';

// Error banner component
interface ErrorBannerProps {
  error: string | undefined;
  onDismiss: () => void;
  onAIFix: () => void;
}

const ErrorBanner = ({ error, onDismiss, onAIFix }: ErrorBannerProps) => {
  const [isCollapsed, setIsCollapsed] = useState(true);

  if (!error) return null;

  const getTruncatedError = () => {
    const firstLine = error.split('\n')[0];
    const snippetLength = 200;
    const snippet = error.substring(0, snippetLength);
    return firstLine.length < snippet.length
      ? firstLine
      : snippet + (snippet.length === snippetLength ? '...' : '');
  };

  return (
    <div className="absolute top-2 inset-x-2 z-10 bg-red-50 dark:bg-red-950 border border-red-200 dark:border-red-800 rounded-md shadow-sm p-2">
      <button
        type="button"
        onClick={onDismiss}
        className="absolute top-1 left-1 p-1 hover:bg-red-100 dark:hover:bg-red-900 rounded"
      >
        <X size={14} className="text-red-500 dark:text-red-400" />
      </button>

      <div className="px-6 py-1 text-sm">
        <button
          type="button"
          className="text-red-700 dark:text-red-300 text-wrap font-mono whitespace-pre-wrap break-words text-xs cursor-pointer flex gap-1 items-start w-full text-left bg-transparent border-0"
          onClick={() => setIsCollapsed(!isCollapsed)}
        >
          <ChevronRight
            size={14}
            className={`mt-0.5 transform transition-transform ${
              isCollapsed ? '' : 'rotate-90'
            }`}
          />
          {isCollapsed ? getTruncatedError() : error}
        </button>
      </div>

      <div className="mt-2 px-6">
        <div className="relative p-2 bg-red-100 dark:bg-red-900 rounded-sm flex gap-1 items-center">
          <div>
            <Lightbulb size={16} className="text-red-800 dark:text-red-300" />
          </div>
          <span className="text-sm text-red-700 dark:text-red-200">
            <span className="font-medium">Tip: </span>Check if restarting the
            app fixes the error.
          </span>
        </div>
      </div>

      <div className="mt-2 flex justify-end">
        <button
          type="button"
          onClick={onAIFix}
          className="cursor-pointer flex items-center space-x-1 px-2 py-0.5 bg-red-500 dark:bg-red-600 text-white rounded text-sm hover:bg-red-600 dark:hover:bg-red-700"
        >
          <Sparkles size={14} />
          <span>Fix error with AI</span>
        </button>
      </div>
    </div>
  );
};

// Preview header component
interface PreviewHeaderProps {
  previewMode: 'preview' | 'code';
  setPreviewMode: (mode: 'preview' | 'code') => void;
  onRestart: () => void;
  onCleanRestart: () => void;
}

const PreviewHeader = ({
  previewMode,
  setPreviewMode,
  onRestart,
  onCleanRestart,
}: PreviewHeaderProps) => (
  <div className="flex items-center justify-between px-4 py-2 border-b border-border">
    <div className="relative flex space-x-2 bg-[var(--background-darkest)] rounded-md p-0.5">
      <button
        type="button"
        className="relative flex items-center space-x-1 px-3 py-1 rounded-md text-sm z-10"
        onClick={() => setPreviewMode('preview')}
      >
        {previewMode === 'preview' && (
          <motion.div
            layoutId="activeIndicator"
            className="absolute inset-0 bg-(--background-lightest) shadow rounded-md -z-1"
            transition={{ type: 'spring', stiffness: 500, damping: 35 }}
          />
        )}
        <Eye size={16} />
        <span>Preview</span>
      </button>
      <button
        type="button"
        className="relative flex items-center space-x-1 px-3 py-1 rounded-md text-sm z-10"
        onClick={() => setPreviewMode('code')}
      >
        {previewMode === 'code' && (
          <motion.div
            layoutId="activeIndicator"
            className="absolute inset-0 bg-(--background-lightest) shadow rounded-md -z-1"
            transition={{ type: 'spring', stiffness: 500, damping: 35 }}
          />
        )}
        <Code size={16} />
        <span>Code</span>
      </button>
    </div>
    <div className="flex items-center">
      <button
        type="button"
        onClick={onRestart}
        className="flex items-center space-x-1 px-3 py-1 rounded-md text-sm hover:bg-[var(--background-darkest)] transition-colors"
        title="Restart App"
      >
        <Power size={16} />
        <span>Restart</span>
      </button>
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <button
            type="button"
            className="flex items-center justify-center p-1.5 rounded-md text-sm hover:bg-[var(--background-darkest)] transition-colors"
            title="More options"
          >
            <MoreVertical size={16} />
          </button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" className="w-60">
          <DropdownMenuItem onClick={onCleanRestart}>
            <Cog size={16} />
            <div className="flex flex-col">
              <span>Rebuild</span>
              <span className="text-xs text-muted-foreground">
                Re-installs node_modules and restarts
              </span>
            </div>
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
    </div>
  </div>
);

// Console header component
interface ConsoleHeaderProps {
  isOpen: boolean;
  onToggle: () => void;
  latestMessage?: string;
}

const ConsoleHeader = ({
  isOpen,
  onToggle,
  latestMessage,
}: ConsoleHeaderProps) => (
  <button
    type="button"
    onClick={onToggle}
    className="flex items-start gap-2 px-4 py-1.5 border-t border-border cursor-pointer hover:bg-[var(--background-darkest)] transition-colors w-full text-left"
  >
    <Logs size={16} className="mt-0.5" />
    <div className="flex flex-col">
      <span className="text-sm font-medium">System Messages</span>
      {!isOpen && latestMessage && (
        <span className="text-xs text-gray-500 truncate max-w-[200px] md:max-w-[400px]">
          {latestMessage}
        </span>
      )}
    </div>
    <div className="flex-1" />
    {isOpen ? <ChevronDown size={16} /> : <ChevronUp size={16} />}
  </button>
);

// Console component
const Console = () => {
  const appOutput = useAtomValue<AppOutput[]>(appOutputAtom);
  return (
    <div className="font-mono text-xs px-4 h-full overflow-auto">
      {appOutput.map((output: AppOutput) => (
        <div key={`${output.timestamp}-${output.message}`}>
          {output.message}
        </div>
      ))}
    </div>
  );
};

// Preview iframe component
const PreviewIframe = ({ loading }: { loading: boolean }) => {
  const selectedAppId = useAtomValue<number | null>(selectedAppIdAtom);
  const { appUrl, originalUrl } = useAtomValue<{
    appUrl: string | null;
    originalUrl: string | null;
  }>(appUrlAtom);
  const setAppOutput = useSetAtom(appOutputAtom);
  const appOutput = useAtomValue(appOutputAtom);
  const [reloadKey, setReloadKey] = useState(0);
  const [errorMessage, setErrorMessage] = useAtom(previewErrorMessageAtom);
  const selectedChatId = useAtomValue(selectedChatIdAtom);
  const { streamMessage } = useStreamChat();
  const [availableRoutes, setAvailableRoutes] = useState<
    Array<{ path: string; label: string }>
  >([]);

  // Load router related files to extract routes
  const { content: routerContent } = useLoadAppFile(
    selectedAppId,
    'src/App.tsx',
  );

  // Effect to parse routes from the router file
  useEffect(() => {
    if (routerContent) {
      try {
        const routes: Array<{ path: string; label: string }> = [];

        // Extract route imports and paths using regex for React Router syntax
        // Match <Route path="/path">
        const routePathsRegex = /<Route\s+(?:[^>]*\s+)?path=["']([^"']+)["']/g;
        let match: RegExpExecArray | null;

        // Find all route paths in the router content
        let result = routePathsRegex.exec(routerContent);
        while (result !== null) {
          const path = result[1];
          // Create a readable label from the path
          const label =
            path === '/'
              ? 'Home'
              : path
                  .split('/')
                  .filter((segment) => segment && !segment.startsWith(':'))
                  .pop()
                  ?.replace(/[-_]/g, ' ')
                  .replace(/^\w/, (c) => c.toUpperCase()) || path;

          if (!routes.some((r) => r.path === path)) {
            routes.push({ path, label });
          }
          result = routePathsRegex.exec(routerContent);
        }

        setAvailableRoutes(routes);
      } catch (e) {
        console.error('Error parsing router file:', e);
      }
    }
  }, [routerContent]);

  // Navigation state
  const [canGoBack, setCanGoBack] = useState(false);
  const [canGoForward, setCanGoForward] = useState(false);
  const [navigationHistory, setNavigationHistory] = useState<string[]>([]);
  const [currentHistoryPosition, setCurrentHistoryPosition] = useState(0);
  const iframeRef = useRef<HTMLIFrameElement>(null);

  // Add message listener for iframe errors and navigation events
  useEffect(() => {
    const handleMessage = (event: MessageEvent) => {
      // Only handle messages from our iframe
      if (event.source !== iframeRef.current?.contentWindow) {
        return;
      }

      const { type, payload } = event.data as {
        type:
          | 'window-error'
          | 'unhandled-rejection'
          | 'iframe-sourcemapped-error'
          | 'build-error-report'
          | 'pushState'
          | 'replaceState';
        payload?: {
          message?: string;
          stack?: string;
          reason?: string;
          newUrl?: string;
          file?: string;
          frame?: string;
        };
      };

      if (
        type === 'window-error' ||
        type === 'unhandled-rejection' ||
        type === 'iframe-sourcemapped-error'
      ) {
        const stack =
          type === 'iframe-sourcemapped-error'
            ? payload?.stack?.split('\n').slice(0, 1).join('\n')
            : payload?.stack;
        const errorMessage = `Error ${
          payload?.message || payload?.reason
        }\nStack trace: ${stack}`;
        console.error('Iframe error:', errorMessage);
        setErrorMessage(errorMessage);
        setAppOutput((prev: AppOutput[]) => [
          ...prev,
          {
            message: `Iframe error: ${errorMessage}`,
            type: 'client-error',
            appId: selectedAppId ?? 'unknown',
            timestamp: Date.now(),
          },
        ]);
      } else if (type === 'build-error-report') {
        setAppOutput((prev: AppOutput[]) => [
          ...prev,
          {
            message: `Build error report: ${JSON.stringify(payload)}`,
            type: 'client-error',
            appId: selectedAppId ?? 'unknown',
            timestamp: Date.now(),
          },
        ]);
      }
    };

    // Add event listener to window instead of iframe
    window.addEventListener('message', handleMessage);
    return () => window.removeEventListener('message', handleMessage);
  }, [selectedAppId, setAppOutput]);

  // Navigation functions
  const handleNavigateBack = () => {
    if (canGoBack) {
      const newPosition = currentHistoryPosition - 1;
      setCurrentHistoryPosition(newPosition);
    }
  };

  const handleNavigateForward = () => {
    if (canGoForward) {
      const newPosition = currentHistoryPosition + 1;
      const canGoForwardNew = newPosition < navigationHistory.length - 1;

      // Update state in a single batch
      const updateState = () => {
        setCurrentHistoryPosition(newPosition);
        setCanGoBack(true);
        setCanGoForward(canGoForwardNew);
      };

      updateState();
    }
  };

  // Effect to update navigation state
  useEffect(() => {
    if (navigationHistory.length > 0) {
      setCanGoBack(currentHistoryPosition > 0);
      setCanGoForward(currentHistoryPosition < navigationHistory.length - 1);
    }
  }, [currentHistoryPosition, navigationHistory.length]);

  useEffect(() => {
    const updateState = () => {
      const lastOutput = appOutput[appOutput.length - 1];
      if (lastOutput?.error) {
        setErrorMessage(lastOutput.error);
      } else {
        setErrorMessage(undefined);
      }
    };

    updateState();
  }, [appOutput, setErrorMessage]);

  return (
    <div className="flex flex-col h-full">
      {/* Rest of the component code remains unchanged */}
    </div>
  );
};

export default PreviewIframe;
