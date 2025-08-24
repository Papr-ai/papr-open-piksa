'use client';

import { useEffect, useRef, useState } from 'react';
import { useVirtualizer } from '@tanstack/react-virtual';
import type { UIMessage } from 'ai';
import type { Vote } from '@/lib/db/schema';
import type { UseChatHelpers } from '@ai-sdk/react';
import { PreviewMessage, ThinkingMessage } from './preview-message';
import { Button } from '../ui/button';
import { cn } from '@/lib/utils';
import { debounce } from 'lodash';

interface VirtualizedMessagesProps {
  messages: UIMessage[];
  votes: Record<string, Vote>;
  isLoading: boolean;
  chatId: string;
  setMessages: UseChatHelpers<UIMessage>['setMessages'];
  reload: UseChatHelpers<UIMessage>['regenerate'];
  isReadonly?: boolean;
  selectedModelId?: string;
  enableUniversalReasoning?: boolean;
}

export function VirtualizedMessages({
  messages,
  votes,
  isLoading,
  chatId,
  setMessages,
  reload,
  isReadonly = false,
  selectedModelId,
  enableUniversalReasoning,
}: VirtualizedMessagesProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [hasNewMessages, setHasNewMessages] = useState(false);
  const [userHasScrolled, setUserHasScrolled] = useState(false);
  const lastMessageCountRef = useRef(messages.length);

  // Set up virtualization
  const rowVirtualizer = useVirtualizer({
    count: messages.length,
    getScrollElement: () => containerRef.current,
    estimateSize: () => 100, // Rough estimate of message height
    overscan: 5, // Number of items to render outside of the visible area
  });

  // Handle automatic scrolling
  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    // Check if new messages have been added
    if (messages.length > lastMessageCountRef.current) {
      setHasNewMessages(true);
      lastMessageCountRef.current = messages.length;

      // Auto-scroll only if user hasn't manually scrolled up
      if (!userHasScrolled) {
        container.scrollTop = container.scrollHeight;
      }
    }
  }, [messages.length]);

  // Handle scroll events with debounce
  const handleScroll = debounce(() => {
    const container = containerRef.current;
    if (!container) return;

    const { scrollTop, scrollHeight, clientHeight } = container;
    const isAtBottom = Math.abs(scrollHeight - scrollTop - clientHeight) < 10;

    // Update user scroll state
    setUserHasScrolled(!isAtBottom);

    // Clear new messages notification when scrolled to bottom
    if (isAtBottom) {
      setHasNewMessages(false);
    }
  }, 100);

  // Scroll to bottom function
  const scrollToBottom = () => {
    const container = containerRef.current;
    if (!container) return;

    container.scrollTo({
      top: container.scrollHeight,
      behavior: 'smooth',
    });
    setHasNewMessages(false);
    setUserHasScrolled(false);
  };

  return (
    <div className="relative flex-1 overflow-hidden">
      <div
        ref={containerRef}
        className="h-full overflow-auto"
        onScroll={handleScroll}
      >
        <div
          style={{
            height: `${rowVirtualizer.getTotalSize()}px`,
            width: '100%',
            position: 'relative',
          }}
        >
          {rowVirtualizer.getVirtualItems().map((virtualRow) => {
            const message = messages[virtualRow.index];
            return (
              <div
                key={message.id}
                data-index={virtualRow.index}
                ref={(el) => rowVirtualizer.measureElement(el)}
                style={{
                  position: 'absolute',
                  top: 0,
                  left: 0,
                  width: '100%',
                  transform: `translateY(${virtualRow.start}px)`,
                }}
              >
                <PreviewMessage
                  chatId={chatId}
                  message={message}
                  vote={votes[message.id]}
                  isLoading={isLoading}
                  setMessages={setMessages}
                  reload={reload}
                  isReadonly={isReadonly}
                  selectedModelId={selectedModelId}
                  enableUniversalReasoning={enableUniversalReasoning}
                />
              </div>
            );
          })}
        </div>
      </div>

      {/* New Messages Button */}
      {hasNewMessages && userHasScrolled && (
        <Button
          className={cn(
            'absolute bottom-4 left-1/2 transform -translate-x-1/2',
            'bg-primary text-primary-foreground shadow-lg'
          )}
          onClick={scrollToBottom}
        >
          New Messages ↓
        </Button>
      )}

      {/* Thinking Message */}
      {isLoading && (
        <div className="absolute bottom-0 left-0 w-full bg-gradient-to-t from-background to-transparent pt-10">
          <ThinkingMessage selectedModelId={selectedModelId} />
        </div>
      )}
    </div>
  );
} 