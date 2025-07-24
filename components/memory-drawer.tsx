import { CrossIcon } from './icons';
import { cn } from '@/lib/utils';
import { useEffect } from 'react';

interface MemoryItem {
  content: string;
  timestamp?: string;
  id?: string;
  createdAt?: string;
  emoji_tags?: string[];
  topics?: string[];
  hierarchical_structure?: string;
  category?: string;
  customMetadata?: {
    category?: string;
  };
}

interface MemoryDrawerProps {
  isOpen: boolean;
  onClose: () => void;
  memories: MemoryItem[];
}

export function MemoryDrawer({ isOpen, onClose, memories }: MemoryDrawerProps) {
  // Handle escape key to close drawer
  useEffect(() => {
    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', handleEscape);
    return () => window.removeEventListener('keydown', handleEscape);
  }, [onClose]);

  if (!isOpen) return null;

  // Sort memories from newest to oldest
  const sortedMemories = [...memories].sort((a, b) => {
    const dateA = a.createdAt || a.timestamp || '';
    const dateB = b.createdAt || b.timestamp || '';
    return new Date(dateB).getTime() - new Date(dateA).getTime();
  });

  return (
    <div className="fixed inset-0 z-50 bg-black/20 dark:bg-black/40">
      <div 
        className={cn(
          "fixed right-0 top-0 h-full w-[500px] bg-background shadow-lg",
          "transform transition-transform duration-300 ease-in-out",
          isOpen ? "translate-x-0" : "translate-x-full"
        )}
      >
        <div className="flex flex-col h-full">
          {/* Header */}
          <div className="flex justify-between items-center p-4 border-b">
            <h2 className="text-lg font-semibold">Related Memories</h2>
            <button 
              onClick={onClose}
              className="p-2 hover:bg-muted rounded-lg transition-colors"
            >
              <CrossIcon size={20} />
            </button>
          </div>

          {/* Content */}
          <div className="flex-1 overflow-y-auto p-4">
            <div className="space-y-4">
              {sortedMemories.map((memory, index) => {
                // Get category from either top-level or from customMetadata
                const category = memory.category || memory.customMetadata?.category || 'unknown';
                const timestamp = memory.createdAt || memory.timestamp;
                
                return (
                  <div
                    key={memory.id || index}
                    className="bg-muted/50 border rounded-lg p-4"
                  >
                    <div className="flex flex-col gap-3">
                      {/* Header with timestamp and category */}
                      <div className="flex justify-between items-center">
                        <div className="text-sm font-medium">
                          Category: <span className="text-blue-600">{category}</span>
                        </div>
                        <div className="text-sm text-muted-foreground">
                          {timestamp ? new Date(timestamp).toLocaleDateString() : 'Unknown date'}
                        </div>
                      </div>

                      {/* Main content */}
                      <div className="text-sm whitespace-pre-wrap">
                        {memory.content}
                      </div>
                      
                      {/* Organization metadata */}
                      <div className="border-t pt-2 mt-2 space-y-2">
                        {/* Emoji tags */}
                        {memory.emoji_tags && memory.emoji_tags.length > 0 && (
                          <div className="text-xl">
                            {memory.emoji_tags.join(' ')}
                          </div>
                        )}
                        
                        {/* Topics */}
                        {memory.topics && memory.topics.length > 0 && (
                          <div className="flex flex-wrap gap-1">
                            {memory.topics.map((topic, i) => (
                              <span 
                                key={i} 
                                className="bg-blue-100 text-blue-800 text-xs px-2 py-1 rounded-full"
                              >
                                {topic}
                              </span>
                            ))}
                          </div>
                        )}
                        
                        {/* Hierarchical structure */}
                        {memory.hierarchical_structure && (
                          <div className="text-xs text-muted-foreground flex items-center gap-1 mt-1">
                            <span>Path:</span>
                            <code className="bg-muted p-1 rounded text-xs">
                              {memory.hierarchical_structure}
                            </code>
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
} 