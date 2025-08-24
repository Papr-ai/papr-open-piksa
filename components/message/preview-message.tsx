'use client';

import { useState, memo, useEffect } from 'react';
import type { UIMessage } from 'ai';
import type { Vote } from '@/lib/db/schema';
import { AnimatePresence, motion } from 'framer-motion';
import { cn } from '@/lib/utils';
import { useSession } from 'next-auth/react';
import Image from 'next/image';
import equal from 'fast-deep-equal';
import type { UseChatHelpers } from '@ai-sdk/react';
import { useThinkingState } from '@/lib/thinking-state';
import { modelSupportsReasoning } from '@/lib/ai/models';
import type { ExtendedUIMessage } from '@/lib/types';

// Helper function to extract text content from UIMessage parts
const extractTextFromMessage = (message: UIMessage): string => {
  if (!message.parts) return '';
  return message.parts
    .filter((part: any) => part.type === 'text')
    .map((part: any) => part.text)
    .join('\n')
    .trim();
};

import { TextPart } from './text-part';
import { ToolInvocation } from './tool-invocation';
import { AttachmentGrid } from './attachment-grid';
import { MemorySection } from './memory-section';
import { MessageActions } from './message-actions';
import { MessageEditor } from './message-editor';
import { MessageReasoning } from './message-reasoning';

// Helper function to find the user query that preceded this assistant message
function findUserQuery(message: UIMessage): string {
  try {
    // First check if there's a preceding user message in context
    const contextParts = message.parts?.filter(part => {
      const typedPart = part as any;
      return typedPart.type === 'data' && 
             typedPart.data?.type === 'context' && 
             typedPart.data?.context;
    });
    
    if (contextParts && contextParts.length > 0) {
      const contextData = (contextParts[0] as any).data?.context;
      if (typeof contextData === 'string') {
        return contextData;
      } else if (contextData && typeof contextData === 'object') {
        return contextData.text || contextData.query || '';
      }
    }
    
    // Try to look for tool calls that might have a query
    const toolParts = message.parts?.filter(part => {
      const typedPart = part as any;
      return typedPart.type === 'tool-invocation' &&
             typedPart.toolInvocation?.toolName === 'searchMemories';
    });
    
    if (toolParts && toolParts.length > 0) {
      const searchQuery = (toolParts[0] as any).toolInvocation?.args?.query;
      if (searchQuery) {
        return searchQuery;
      }
    }
    
    // If we have any message content as a fallback
    const textContent = extractTextFromMessage(message);
    if (textContent) {
      return textContent;
    }
    
    return '';
  } catch (error) {
    console.error('Error extracting user query:', error);
    return '';
  }
}

// Helper to extract reasoning events from message parts
function extractReasoningEvents(message: UIMessage) {
  const reasoningEvents = message.parts?.reduce((events, part) => {
    const typedPart = part as any;

    if (typedPart.type === 'reasoning') {
      events.push({
        type: 'reasoning',
        content: {
          text: typeof typedPart.reasoning === 'string' ? 
            typedPart.reasoning : 
            typedPart.reasoning?.text || '',
          timestamp: typeof typedPart.reasoning === 'string' ? 
            new Date().toISOString() : 
            typedPart.reasoning?.timestamp || new Date().toISOString(),
          step: typeof typedPart.reasoning === 'string' ? 
            'complete' : 
            typedPart.reasoning?.step || 'complete',
        },
      });
    }

    return events;
  }, [] as any[]);

  return reasoningEvents;
}

interface PreviewMessageProps {
  chatId: string;
  message: UIMessage;
  vote: Vote | undefined;
  isLoading: boolean;
  setMessages: UseChatHelpers<UIMessage>['setMessages'];
  reload: UseChatHelpers<UIMessage>['regenerate'];
  isReadonly: boolean;
  selectedModelId?: string;
  enableUniversalReasoning?: boolean;
}

function PurePreviewMessage({
  chatId,
  message,
  vote,
  isLoading,
  setMessages,
  reload,
  isReadonly,
  selectedModelId,
  enableUniversalReasoning,
}: PreviewMessageProps) {
  const [mode, setMode] = useState<'view' | 'edit'>('view');
  const { data: session } = useSession();
  const userEmail = session?.user?.email || '';
  const userName = session?.user?.name || '';
  const userImage = session?.user?.image;

  // Extract reasoning events and determine if we should show reasoning
  const reasoningEvents = extractReasoningEvents(message);
  const isReasoningEnabled = selectedModelId ? modelSupportsReasoning(selectedModelId) : false;
  const messageModelId = (message as ExtendedUIMessage).modelId;
  const messageSupportsReasoning = messageModelId ? modelSupportsReasoning(messageModelId) : false;
  const modelSupportsReasoningCapability = isReasoningEnabled || messageSupportsReasoning;
  
  const hasComplexReasoning = reasoningEvents.some(event => 
    (event.content.text && event.content.text.length > 50) || 
    event.content.text?.includes('memory') ||
    event.content.text?.includes('search')
  );

  const shouldShowReasoning = modelSupportsReasoningCapability && 
                             reasoningEvents && 
                             reasoningEvents.length > 0 && 
                             hasComplexReasoning;

  const isReasoningComplete = !isLoading || 
    reasoningEvents.some(event => event.content.step === 'complete');

  const userQuery = message.role === 'assistant' ? findUserQuery(message) : '';

  return (
    <AnimatePresence>
      <motion.div
        data-testid={`message-${message.role}`}
        className="relative mb-4 flex flex-col w-full"
        initial={{ y: 5, opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
        data-role={message.role}
      >
        {mode === 'view' ? (
          <div className="flex w-full">
            <div className="flex items-start gap-3 w-full">
              {/* Avatar */}
              <div className={cn("flex-shrink-0 h-8 w-8 flex items-center justify-center rounded-full shrink-0", {
                "ring-1 ring-border bg-background": message.role === "assistant",
                "overflow-hidden": message.role === "user"
              })}>
                {message.role === "assistant" ? (
                  <div className="w-5 h-5 flex items-center justify-center">
                    <Image
                      src="/images/papr-logo.svg"
                      alt="Assistant Avatar"
                      width={16}
                      height={16}
                      className="object-contain"
                    />
                  </div>
                ) : (
                  <Image
                    src={userImage || `https://avatar.vercel.sh/${userEmail}`}
                    alt={userName || userEmail || 'User Avatar'}
                    width={32}
                    height={32}
                    className="rounded-full"
                  />
                )}
              </div>

              {/* Message Content */}
              <div className="flex-1 flex flex-col gap-3 w-full">
                {message.role === 'assistant' && (
                  <>
                    {shouldShowReasoning && (
                      <MessageReasoning
                        isLoading={isLoading && !isReasoningComplete}
                        reasoning={reasoningEvents[0]?.content?.text || ''}
                        events={reasoningEvents}
                        userQuery={userQuery}
                        selectedModelId={selectedModelId}
                      />
                    )}

                    {(message as ExtendedUIMessage).attachments && (
                      <AttachmentGrid attachments={(message as ExtendedUIMessage).attachments!.map(att => ({
                        type: 'file' as const,
                        url: att.url,
                        filename: att.name,
                        mediaType: att.contentType
                      }))} />
                    )}
                  </>
                )}

                {message.parts?.map((part, index) => {
                  const typedPart = part as any;
                  const key = `message-${message.id}-part-${index}`;

                  if (typedPart.type === 'text') {
                    return (
                      <TextPart
                        key={key}
                        content={typedPart.text}
                        isAssistant={message.role === 'assistant'}
                        isReadonly={isReadonly}
                        onEdit={() => setMode('edit')}
                      />
                    );
                  }

                  if (typedPart.type === 'tool-invocation') {
                    return (
                      <ToolInvocation
                        key={key}
                        toolName={typedPart.toolInvocation.toolName}
                        state={typedPart.toolInvocation.state}
                        toolCallId={typedPart.toolInvocation.toolCallId}
                        args={typedPart.toolInvocation.args}
                        result={typedPart.toolInvocation.result}
                        isReadonly={isReadonly}
                      />
                    );
                  }

                  return null;
                })}

                {/* Memory Results */}
                <MemorySection message={message} />

                {/* Message Actions */}
                {!isReadonly && message.role === 'assistant' && (
                  <MessageActions
                    key={`action-${message.id}`}
                    chatId={chatId}
                    message={message}
                    vote={vote}
                    isLoading={isLoading}
                  />
                )}
              </div>
            </div>
          </div>
        ) : (
          // Edit mode
          <div className="flex items-start gap-3 w-full">
            <div className="flex-shrink-0 h-8 w-8" />
            <MessageEditor
              key={message.id}
              message={message}
              setMode={setMode}
              setMessages={setMessages}
              reload={reload}
            />
          </div>
        )}
      </motion.div>
    </AnimatePresence>
  );
}

export const PreviewMessage = memo(
  PurePreviewMessage,
  (prevProps: PreviewMessageProps, nextProps: PreviewMessageProps) => {
    if (prevProps.isLoading !== nextProps.isLoading) return false;
    if (prevProps.message.id !== nextProps.message.id) return false;
    if (!equal(prevProps.message.parts, nextProps.message.parts)) return false;
    if (!equal(prevProps.vote, nextProps.vote)) return false;

    return true;
  },
);

// Thinking Message Component
export function ThinkingMessage({ selectedModelId }: { selectedModelId?: string }) {
  const role = 'assistant';
  const { state: thinkingState } = useThinkingState();
  const [dots, setDots] = useState('...');
  const isReasoningModel = selectedModelId ? modelSupportsReasoning(selectedModelId) : false;
  
  useEffect(() => {
    const interval = setInterval(() => {
      setDots(prev => prev.length >= 3 ? '.' : prev + '.');
    }, 400);
    return () => clearInterval(interval);
  }, []);

  const getDisplayText = () => {
    const message = typeof thinkingState === 'string' ? thinkingState : thinkingState.message;
    
    if (message && message !== 'Thinking...') {
      return message;
    }
    
    return isReasoningModel ? `Thinking${dots}` : `Processing${dots}`;
  };

  const displayText = getDisplayText();

  return (
    <motion.div
      data-testid="message-assistant-loading"
      className="relative mb-4 flex flex-col w-full"
      initial={{ opacity: 1 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0, transition: { duration: 0.3 } }}
      data-role={role}
      layout
    >
      <div className="flex w-full">
        <div className="flex items-start gap-3 w-full">
          <div className={cn("flex-shrink-0 h-8 w-8 flex items-center justify-center rounded-full shrink-0", {
            "ring-1 ring-border bg-background": true
          })}>
            <div className="w-5 h-5 flex items-center justify-center">
              <Image
                src="/images/papr-logo.svg"
                alt="Assistant Avatar"
                width={16}
                height={16}
                className="object-contain"
              />
            </div>
          </div>

          <div className="flex-1 flex flex-col gap-3 w-full">
            <div className="flex flex-row items-center mt-2">
              <div className="font-medium text-sm text-muted-foreground">{displayText}</div>
            </div>
          </div>
        </div>
      </div>
    </motion.div>
  );
} 