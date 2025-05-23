import { useState, useEffect } from 'react';
import { MemoryCardGrid } from './memory-card';
import type { MemoryItem } from './memory-card';
import { Button } from './ui/button';
import { Skeleton } from './ui/skeleton';
import { RefreshIcon } from './icons';

interface MemoryResultsProps {
  memories: any; // Raw memory response from the API
  isLoading?: boolean;
  error?: string | null;
  onRetry?: () => void;
}

export function MemoryResults({
  memories,
  isLoading = false,
  error = null,
  onRetry,
}: MemoryResultsProps) {
  const [parsedMemories, setParsedMemories] = useState<MemoryItem[]>([]);
  const [selectedMemory, setSelectedMemory] = useState<MemoryItem | null>(null);

  // Parse the memory data when it changes
  useEffect(() => {
    if (!memories) {
      console.log('[Memory UI] No memories data provided');
      setParsedMemories([]);
      return;
    }

    try {
      console.log('[Memory UI] Parsing memory data:', JSON.stringify(memories));
      // Handle different memory response formats
      let memoryItems: MemoryItem[] = [];

      if (Array.isArray(memories)) {
        // Direct array of memories
        memoryItems = memories.map((item: any) => ({
          content:
            typeof item.content === 'string'
              ? item.content
              : JSON.stringify(item.content),
          id:
            item.id || `memory-${Math.random().toString(36).substring(2, 11)}`,
          timestamp:
            item.timestamp || item.created_at || new Date().toISOString(),
        }));
      } else if (memories.memories && Array.isArray(memories.memories)) {
        // { memories: [...] } format
        memoryItems = memories.memories.map((item: any) => ({
          content:
            typeof item.content === 'string'
              ? item.content
              : JSON.stringify(item.content),
          id:
            item.id || `memory-${Math.random().toString(36).substring(2, 11)}`,
          timestamp:
            item.timestamp || item.created_at || new Date().toISOString(),
        }));
      } else if (typeof memories === 'string') {
        // Try to parse the string as JSON
        try {
          const parsed = JSON.parse(memories);
          if (parsed.memories && Array.isArray(parsed.memories)) {
            memoryItems = parsed.memories.map((item: any) => ({
              content:
                typeof item.content === 'string'
                  ? item.content
                  : JSON.stringify(item.content),
              id:
                item.id ||
                `memory-${Math.random().toString(36).substring(2, 11)}`,
              timestamp:
                item.timestamp || item.created_at || new Date().toISOString(),
            }));
          }
        } catch (err) {
          console.error('[Memory UI] Error parsing memory string:', err);
        }
      }

      console.log(
        `[Memory UI] Parsed ${memoryItems.length} memory items:`,
        memoryItems,
      );
      setParsedMemories(memoryItems);
    } catch (err) {
      console.error('[Memory UI] Error parsing memory data:', err);
      setParsedMemories([]);
    }
  }, [memories]);

  const handleMemoryClick = (memory: MemoryItem) => {
    setSelectedMemory(memory);
    // Additional actions could be implemented here (e.g., copying to clipboard)
  };

  // Loading state
  if (isLoading) {
    return (
      <div className="space-y-3">
        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-3">
          {[...Array(3)].map((_, i) => (
            <div
              key={`memory-skeleton-${i}-${Math.random().toString(36).substring(2, 7)}`}
              className="border rounded-lg p-3 space-y-2"
            >
              <div className="flex items-center gap-2">
                <Skeleton className="h-4 w-4 rounded-full" />
                <Skeleton className="h-3 w-24" />
              </div>
              <Skeleton className="h-12 w-full" />
            </div>
          ))}
        </div>
      </div>
    );
  }

  // Error state
  if (error) {
    return (
      <div className="bg-red-50 dark:bg-red-900/20 text-red-800 dark:text-red-300 p-4 rounded-md mb-4">
        <p className="mb-2">{error}</p>
        {onRetry && (
          <Button
            variant="outline"
            size="sm"
            className="flex items-center gap-2"
            onClick={onRetry}
          >
            <RefreshIcon size={14} />
            <span>Retry</span>
          </Button>
        )}
      </div>
    );
  }

  // Empty state
  if (parsedMemories.length === 0) {
    return (
      <div className="bg-muted p-4 rounded-lg text-center">
        <p className="text-muted-foreground">No memories found</p>
      </div>
    );
  }

  // Memory detail view
  if (selectedMemory) {
    return (
      <div className="space-y-3">
        <Button
          variant="ghost"
          size="sm"
          onClick={() => setSelectedMemory(null)}
          className="mb-2"
        >
          ← Back to all memories
        </Button>

        <div className="border rounded-lg p-4">
          <div className="text-xs text-muted-foreground mb-2">
            {new Date(selectedMemory.timestamp).toLocaleString()}
          </div>
          <p className="whitespace-pre-wrap">{selectedMemory.content}</p>
        </div>
      </div>
    );
  }

  // Normal grid view of memories
  return (
    <MemoryCardGrid
      memories={parsedMemories}
      onMemoryClick={handleMemoryClick}
    />
  );
}
