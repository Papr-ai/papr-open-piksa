import { CrossIcon } from './icons';
import { cn } from '@/lib/utils';
import { useEffect } from 'react';

interface MemoryItem {
  content: string;
  timestamp: string;
  id?: string;
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
  const sortedMemories = [...memories].sort((a, b) => 
    new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime()
  );

  return (
    <div className="fixed inset-0 z-50 bg-black/20 dark:bg-black/40">
      <div 
        className={cn(
          "fixed right-0 top-0 h-full w-[400px] bg-background shadow-lg",
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
              {sortedMemories.map((memory, index) => (
                <div
                  key={memory.id || index}
                  className="bg-muted/50 border rounded-lg p-4"
                >
                  <div className="flex flex-col gap-2">
                    <div className="text-sm text-muted-foreground">
                      {new Date(memory.timestamp).toLocaleDateString()}
                    </div>
                    <div className="text-sm whitespace-pre-wrap">
                      {memory.content}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
} 