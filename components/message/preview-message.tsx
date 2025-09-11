'use client';

import { useState, memo, useEffect } from 'react';
import type { UIMessage } from 'ai';
import type { Vote } from '@/lib/db/schema';
import { AnimatePresence, motion } from 'framer-motion';
import { cn } from '@/lib/utils';
import { useSession } from 'next-auth/react';
import { useUserAvatar } from '@/hooks/use-user-avatar';
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
import { Weather } from '../weather';
import { DocumentToolResult } from '@/components/document/document';
import { BookToolResult } from '@/components/book/book-tool-result';
import { AddMemoryResults } from '@/components/memory/add-memory-results';
import { SearchBooksResults } from '@/components/book/search-books-results';
import { TaskCard } from '@/components/task-card';
import { ImageResult } from '@/components/common/image-result';
import { MergedImagesResult } from '@/components/message/merged-images-result';
import { ImageEditResult } from '@/components/common/image-edit-result';
import { CreateImageResult } from './create-image-result';
import { StructuredBookImageResults } from './structured-book-image-results';
import { BookImagePlanResult } from './book-image-plan-result';
import { SingleBookImageResult } from './single-book-image-result';
import { SearchBookPropsResult } from './search-book-props-result';
import { ChatMemoryResults } from '../memory/chat-memory-results';
import { MessageActions } from './message-actions';
import { MessageEditor } from './message-editor';
import { MessageReasoning } from './message-reasoning';

// Tool input/output types
import type { 
  WeatherAtLocation,
  DocumentToolOutput, 
  CreateBookOutput,
  SearchBooksOutput,
  AddMemoryOutput,
  AddMemoryInput,
  GenerateImageOutput,
  EditImageOutput,
  ToolUIPart,
  MessagePart,
  TextPart as TextPartType
} from '@/lib/types';

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
  sendMessage?: (message: { role: 'user'; parts: Array<{ type: 'text'; text: string }> }) => void;
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
  sendMessage,
}: PreviewMessageProps) {
  const [mode, setMode] = useState<'view' | 'edit'>('view');
  const { data: session, status: sessionStatus } = useSession();
  const { userImage, userName, userEmail, isLoading: avatarLoading } = useUserAvatar();
  
  // Debug session loading for user messages
  useEffect(() => {
    if (process.env.NODE_ENV === 'development' && message.role === 'user') {
      console.log('[PreviewMessage] Avatar debug:', {
        sessionStatus,
        hasSession: !!session,
        hasUser: !!session?.user,
        userImage,
        userEmail,
        avatarLoading
      });
    }
  }, [sessionStatus, session, userImage, userEmail, message.role, avatarLoading]);

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
                  <div className="relative">
                    {/* Show loading skeleton while session is loading */}
                    {sessionStatus === 'loading' || avatarLoading ? (
                      <div className="w-8 h-8 rounded-full bg-muted animate-pulse" />
                    ) : (
                      <Image
                        src={userImage || `https://avatar.vercel.sh/${userEmail}`}
                        alt={userName || userEmail || 'User Avatar'}
                        width={32}
                        height={32}
                        className="rounded-full"
                        unoptimized={!userImage} // Don't optimize fallback avatars
                      />
                    )}
                  </div>
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
                  const typedPart = part as MessagePart;
                  const { type } = typedPart;
                  const key = `message-${message.id}-part-${index}`;

                  if (type === 'text') {
                    return (
                      <TextPart
                        key={key}
                        content={(typedPart as TextPartType).text}
                        isAssistant={message.role === 'assistant'}
                        isReadonly={isReadonly}
                        onEdit={() => setMode('edit')}
                      />
                    );
                  }

                  // Handle AI SDK v5 tool parts (format: tool-{toolName})
                  if (type.startsWith('tool-')) {
                    const toolName = type.replace('tool-', '');
                    
                    // Cast to ToolUIPart for AI SDK v5 tool handling
                    const toolPart = typedPart as ToolUIPart;
                    if (toolPart.toolCallId) {
                      const { toolCallId, state, input, output } = toolPart;

                      // Handle tool call results (state: 'output-available')
                      if (state === 'output-available' && output) {
                        return (
                        <div key={toolCallId || key}>
                          {toolName === 'getWeather' ? (
                            <Weather weatherAtLocation={output as any} />
                          ) : toolName === 'createDocument' ? (
                            <DocumentToolResult
                              type="create"
                              result={output as DocumentToolOutput}
                              isReadonly={isReadonly}
                              chatId={chatId}
                            />
                          ) : toolName === 'updateDocument' ? (
                            <DocumentToolResult
                              type="update"
                              result={output as DocumentToolOutput}
                              isReadonly={isReadonly}
                              chatId={chatId}
                            />
                          ) : toolName === 'requestSuggestions' ? (
                            <DocumentToolResult
                              type="request-suggestions"
                              result={output as DocumentToolOutput}
                              isReadonly={isReadonly}
                              chatId={chatId}
                            />
                          ) : toolName === 'searchMemories' ? (
                            <ChatMemoryResults message={message} />
                          ) : toolName === 'createBook' ? (
                            <BookToolResult
                              result={output as CreateBookOutput}
                              isReadonly={isReadonly}
                              chatId={chatId}
                            />
                          ) : toolName === 'searchBooks' ? (
                            <SearchBooksResults
                              searchResult={output as SearchBooksOutput}
                            />
                          ) : toolName === 'createImage' ? (
                            <CreateImageResult
                              result={output as any}
                              isReadonly={isReadonly}
                            />
                          ) : toolName === 'createStructuredBookImages' ? (
                            <StructuredBookImageResults
                              result={output as any}
                              isReadonly={isReadonly}
                              sendMessage={sendMessage}
                            />
                          ) : toolName === 'createBookImagePlan' ? (
                            <BookImagePlanResult
                              result={output as any}
                              isReadonly={isReadonly}
                            />
                          ) : toolName === 'createSingleBookImage' ? (
                            <SingleBookImageResult
                              result={output as any}
                              isReadonly={isReadonly}
                            />
                          ) : toolName === 'searchBookProps' ? (
                            <SearchBookPropsResult
                              result={output as any}
                              isReadonly={isReadonly}
                            />
                          ) : toolName === 'generateImage' ? (
                            <ImageResult
                              result={output as GenerateImageOutput}
                              isReadonly={isReadonly}
                            />
                          ) : toolName === 'editImage' ? (
                            <ImageEditResult
                              result={output as EditImageOutput}
                              isReadonly={isReadonly}
                            />
                          ) : toolName === 'mergeImages' ? (
                            <MergedImagesResult
                              mergedImageUrl={(output as any).mergedImageUrl}
                              gridLayout={(input as any).images || []} // Use input images since output gridLayout might be truncated
                              dimensions={(output as any).dimensions || { width: 1024, height: 1024 }}
                              processedImages={(output as any).processedImages || (input as any).images?.length || 0}
                              format={(output as any).format || "png"}
                            />
                          ) : toolName === 'addMemory' ? (
                            <AddMemoryResults
                              memoryResult={{
                                success: (output as AddMemoryOutput)?.success || false,
                                message: (output as AddMemoryOutput)?.message,
                                memoryId: (output as AddMemoryOutput)?.memoryId,
                                error: (output as AddMemoryOutput)?.error,
                                category: (input as AddMemoryInput)?.category || (input as AddMemoryInput)?.type,
                                content: (input as AddMemoryInput)?.content,
                              }}
                            />
                          ) : ['createTaskPlan', 'updateTask', 'completeTask', 'getTaskStatus', 'addTask'].includes(toolName) ? (
                            <TaskCard 
                              type={(output as any)?.type || 'task-status'}
                              tasks={(output as any)?.tasks}
                              task={(output as any)?.task}
                              nextTask={(output as any)?.nextTask}
                              progress={(output as any)?.progress}
                              allCompleted={(output as any)?.allCompleted}
                              message={(output as any)?.message}
                            />
                          ) : (
                            // Fallback to generic ToolInvocation for unhandled tools
                            <ToolInvocation
                              toolName={toolName}
                              state={state === 'output-available' || state === 'output-error' ? 'result' : 'call'}
                              toolCallId={toolCallId}
                              args={input}
                              result={output}
                              isReadonly={isReadonly}
                            />
                          )}
                        </div>
                        );
                      }

                      // Handle tool calls in progress (state: 'call' or 'partial-call')
                      return (
                        <ToolInvocation
                          key={toolCallId || key}
                          toolName={toolName}
                          state={state === 'input-streaming' || state === 'input-available' || state === 'output-available' || state === 'output-error' ? (state.startsWith('output') ? 'result' : 'call') : 'call'}
                          toolCallId={toolCallId}
                          args={input}
                          result={output}
                          isReadonly={isReadonly}
                        />
                      );
                    }
                  }

                  // Handle legacy tool-invocation format (fallback for older messages)
                  if (type === 'tool-invocation') {
                    return (
                      <ToolInvocation
                        key={key}
                        toolName={(typedPart as any).toolInvocation.toolName}
                        state={(typedPart as any).toolInvocation.state}
                        toolCallId={(typedPart as any).toolInvocation.toolCallId}
                        args={(typedPart as any).toolInvocation.args}
                        result={(typedPart as any).toolInvocation.result}
                        isReadonly={isReadonly}
                      />
                    );
                  }

                  return null;
                })}

                {/* Removed duplicate "Working on your request..." placeholder */}
                {/* The global "Thinking..." indicator in messages.tsx handles this */}

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
    
    return `Thinking${dots}`;
  };

  const displayText = getDisplayText();

  return (
    <motion.div
      data-testid="message-assistant-loading"
      className="relative mb-4 flex flex-col w-full"
      initial={{ opacity: 0, y: 10 }} // Start slightly below and transparent
      animate={{ opacity: 1, y: 0 }} // Fade in and slide up
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
            <div className="flex flex-row items-center gap-2 mt-2">
              {/* Animated thinking dots */}
              <div className="flex items-center gap-1">
                <div className="w-1.5 h-1.5 bg-muted-foreground rounded-full thinking-dot" />
                <div className="w-1.5 h-1.5 bg-muted-foreground rounded-full thinking-dot" />
                <div className="w-1.5 h-1.5 bg-muted-foreground rounded-full thinking-dot" />
              </div>
              <div className="font-medium text-sm text-muted-foreground">{displayText}</div>
            </div>
          </div>
        </div>
      </div>
    </motion.div>
  );
} 