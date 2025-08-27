'use client';

import { useState, memo, useEffect } from 'react';
import type { UIMessage, ToolUIPart, ReasoningUIPart, TextUIPart, UIMessagePart } from 'ai';
import { isToolUIPart } from 'ai';

// Import existing tool result types  
import type { ArtifactKind } from '@/components/artifact/artifact';

// Tool output type definitions based on existing interfaces
interface WeatherAtLocation {
  latitude: number;
  longitude: number;
  generationtime_ms: number;
  utc_offset_seconds: number;
  timezone: string;
  timezone_abbreviation: string;
  elevation: number;
  current_units: {
    time: string;
    interval: string;
    temperature_2m: string;
  };
  current: {
    time: string;
    interval: number;
    temperature_2m: number;
  };
  hourly_units: {
    time: string;
    temperature_2m: string;
  };
  hourly: {
    time: string[];
    temperature_2m: number[];
  };
  daily_units: {
    time: string;
    sunrise: string;
    sunset: string;
  };
  daily: {
    time: string[];
    sunrise: string[];
    sunset: string[];
  };
}

interface GitHubToolResult {
  success: boolean;
  error?: string;
  repositories?: any[];
  files?: any[];
  file?: any;
  repository?: any;
  currentPath?: string;
  repositoryName?: string;
  searchResults?: any[];
  searchQuery?: string;
  editSuggestion?: {
    message: string;
    action: string;
    repository: { owner: string; name: string };
    filePath: string;
  };
  message?: string;
  branchName?: string;
  stagedFiles?: any[];
  stagedFilesCount?: number;
  clearedCount?: number;
  requiresApproval?: boolean;
  project?: any;
}

// Document tool result type
interface DocumentToolOutput {
  id: string;
  title: string;
  kind: ArtifactKind;
}

// Memory tool result type (simple interface since it's not complex)
interface MemoryToolOutput {
  success?: boolean;
  memories?: Array<{
    id: string;
    content: string;
    timestamp: string;
  }>;
}
import cx from 'classnames';
import { AnimatePresence, motion } from 'framer-motion';
import type { Vote } from '@/lib/db/schema';
import { DocumentToolCall, DocumentToolResult } from '@/components/document/document';
import { PencilEditIcon, SparklesIcon, LoaderIcon, CopyIcon } from '../common/icons';
import { Markdown } from '../common/markdown';
import { MessageActions } from './message-actions';
import { PreviewAttachment } from './preview-attachment';
import { Weather } from '../weather';
import equal from 'fast-deep-equal';
import { cn } from '@/lib/utils';
import { Button } from '../ui/button';
import { Tooltip, TooltipContent, TooltipTrigger } from '../ui/tooltip';
import { MessageEditor } from './message-editor';
import { MessageReasoning } from './message-reasoning';
import { WebSearchResults } from './web-search-results';
import { SearchSources } from './search-sources';
import type { UseChatHelpers } from '@ai-sdk/react';

// Helper function to extract text content from UIMessage parts
const extractTextFromMessage = (message: UIMessage): string => {
  if (!message.parts) return '';
  return message.parts
    .filter((part: any) => part.type === 'text')
    .map((part: any) => part.text)
    .join('\n')
    .trim();
};
import { useThinkingState } from '@/lib/thinking-state';
import { ProcessedMessage } from './processed-message';
import type { ExtendedUIMessage } from '@/lib/types';
import { modelSupportsReasoning } from '@/lib/ai/models';
import Image from 'next/image';
import { useSession } from 'next-auth/react';
import { useUserAvatar } from '@/hooks/use-user-avatar';
import { GitHubRepoResults } from '../github/github-repo-results';
import { GitHubSearchResults } from '../github/github-search-results';
import { ChatMemoryResults } from '../memory/chat-memory-results';

import type { Repository } from '@/components/github/github-repo-card';

// Truncated file display component
function TruncatedFileDisplay({ 
  file, 
  maxLines = 10,
  editSuggestion 
}: { 
  file: { name: string; size: number; content: string; path?: string };
  maxLines?: number;
  editSuggestion?: {
    message: string;
    action: string;
    repository: any;
    filePath: string;
  };
}) {
  const [isExpanded, setIsExpanded] = useState(false);
  const lines = file.content.split('\n');
  const shouldTruncate = lines.length > maxLines;
  const displayLines = isExpanded ? lines : lines.slice(0, maxLines);
  
  return (
    <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 my-4">
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2">
          <svg className="w-5 h-5 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
          </svg>
          <h4 className="font-medium text-blue-800">{file.name}</h4>
          {file.path && (
            <span className="text-xs text-blue-600 bg-blue-100 px-2 py-1 rounded">
              {file.path}
            </span>
          )}
        </div>
        <div className="flex items-center gap-2">
          <span className="text-sm text-blue-600">{file.size} bytes</span>
          <span className="text-xs text-blue-500">
            {lines.length} lines
          </span>
        </div>
      </div>

      {/* Edit suggestion banner */}
      {editSuggestion && (
        <div className="bg-green-50 border border-green-200 rounded-lg p-3 mb-3">
          <div className="flex items-start gap-2">
            <svg className="w-5 h-5 text-green-600 mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
            <div className="flex-1">
              <p className="text-sm text-green-800 font-medium mb-1">💡 Editing Suggestion</p>
              <p className="text-sm text-green-700 mb-2">{editSuggestion.message}</p>
              <Button
                size="sm"
                variant="outline"
                onClick={() => {
                  const chatInput = document.querySelector('textarea[placeholder*="Ask"]') as HTMLTextAreaElement;
                  if (chatInput) {
                    chatInput.value = `Please open the GitHub file explorer for the ${editSuggestion.repository.owner}/${editSuggestion.repository.name} repository so I can edit the ${file.name} file with the full editing interface.`;
                    chatInput.focus();
                    const event = new Event('input', { bubbles: true });
                    chatInput.dispatchEvent(event);
                  }
                }}
                className="text-green-600 hover:text-green-800 bg-green-100 hover:bg-green-200"
              >
                <svg className="w-4 h-4 mr-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 20l4-16m4 4l4 4-4 4M6 16l-4-4 4-4" />
                </svg>
                Open GitHub File Explorer
              </Button>
            </div>
          </div>
        </div>
      )}
      
      <div className="relative">
        <pre className="bg-gray-900 text-gray-100 p-3 rounded-md overflow-x-auto text-sm">
          <code>{displayLines.join('\n')}</code>
        </pre>
        
        {shouldTruncate && (
          <div className="mt-2 flex items-center justify-between">
            <Button
              size="sm"
              variant="outline"
              onClick={() => setIsExpanded(!isExpanded)}
              className="text-blue-600 hover:text-blue-800"
            >
              {isExpanded ? (
                <>
                  <svg className="w-4 h-4 mr-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 15l7-7 7 7" />
                  </svg>
                  Show Less
                </>
              ) : (
                <>
                  <svg className="w-4 h-4 mr-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                  </svg>
                  Show More ({lines.length - maxLines} more lines)
                </>
              )}
            </Button>
            
            <div className="flex gap-2">
              <Button
                size="sm"
                variant="outline"
                onClick={() => navigator.clipboard.writeText(file.content)}
                className="text-gray-600 hover:text-gray-800"
              >
                <CopyIcon size={16} />
              </Button>
              <Button
                size="sm"
                variant="outline"
                onClick={() => {
                  // Find the chat input and suggest opening file explorer
                  const chatInput = document.querySelector('textarea[placeholder*="Ask"]') as HTMLTextAreaElement;
                  if (chatInput) {
                    chatInput.value = `Please open the GitHub file explorer so I can edit the ${file.name} file.`;
                    chatInput.focus();
                    const event = new Event('input', { bubbles: true });
                    chatInput.dispatchEvent(event);
                  }
                }}
                className="text-green-600 hover:text-green-800"
              >
                <svg className="w-4 h-4 mr-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                </svg>
                Edit in GitHub
              </Button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

type ReasoningStep = 'start' | 'init' | 'search' | 'complete' | 'error' | 'reading' | 'think';

interface ReasoningContent {
  text: string;
  timestamp: string;
  step: ReasoningStep;
}

interface ReasoningEvent {
  type: 'reasoning';
  content: ReasoningContent;
}

interface ReasoningPart {
  type: 'reasoning';
  reasoning: ReasoningContent | string;
}

interface TextPart {
  type: 'text';
  text: string;
}

interface DataPart {
  type: 'data';
  data: {
    type: 'part' | 'reasoning';
    data?: {
      type: 'reasoning';
      reasoning: ReasoningContent;
    };
    reasoning?: ReasoningContent;
  };
}

interface StepStartPart {
  type: 'step-start';
  data?: {
    type: 'reasoning';
    reasoning: ReasoningContent;
  };
}

// Add ToolInvocationPart interface
interface ToolInvocationPart {
  type: 'tool-invocation';
  toolInvocation: {
    toolName: string;
    state: 'call' | 'result';
    toolCallId?: string;
    step?: number;
    args?: any;
    result?: any;
  };
}

// Keep ToolInvocationInfo for the other uses
interface ToolInvocationInfo {
  toolName: string;
  args?: any;
  result?: any;
  state?: string;
}

type MessagePart = 
  | TextPart
  | ReasoningPart
  | DataPart
  | StepStartPart
  | ToolInvocationPart
  | { type: string; text?: string };

// Add type definition for message roles
type MessageRole = 'user' | 'assistant' | 'system' | 'tool' | 'function';

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

// Add a helper function to detect and extract tool call information
const extractToolCallsFromMessage = (message: UIMessage | ExtendedUIMessage): ReasoningEvent[] => {
  const toolCallEvents: ReasoningEvent[] = [];
  
  // Check for toolInvocations in newer format
  if ((message as any).toolInvocations?.length) {
    for (const invocation of (message as any).toolInvocations) {
      // Starting tool call
      toolCallEvents.push({
        type: 'reasoning',
        content: {
          text: `Calling ${invocation.toolName}${invocation.args ? `: ${JSON.stringify(invocation.args || {})}` : ''}`,
          timestamp: new Date().toISOString(),
          step: 'start',
        }
      });
      
      // Tool call result
      if (invocation.state === 'result' && invocation.result) {
        // Handle success case
        toolCallEvents.push({
          type: 'reasoning',
          content: {
            text: invocation.toolName === 'searchMemories' || invocation.toolName === 'get_memory'
              ? `Found ${invocation.result?.memories?.length || 0} relevant memories` 
              : `Result from ${invocation.toolName}: ${typeof invocation.result === 'object' ? 
                  JSON.stringify(invocation.result) : String(invocation.result)}`,
            timestamp: new Date(Date.now() + 10).toISOString(),
            step: 'complete',
          }
        });
      } else if (invocation.state === 'result' && !invocation.result) {
        // Handle error or empty result
        toolCallEvents.push({
          type: 'reasoning',
          content: {
            text: `Error accessing ${invocation.toolName}`,
            timestamp: new Date(Date.now() + 10).toISOString(),
            step: 'error',
          }
        });
      }
    }
  }
  
  // Check for tool_calls in older format
  const extendedMessage = message as ExtendedUIMessage;
  if (extendedMessage.tool_calls?.length) {
    for (const call of extendedMessage.tool_calls) {
      if (call?.function?.name) {
        // Starting tool call
        toolCallEvents.push({
          type: 'reasoning',
          content: {
            text: `Calling ${call.function.name}${
              'arguments' in call.function ? `: ${call.function.arguments}` : ''
            }`,
            timestamp: new Date().toISOString(),
            step: 'start',
          }
        });
        
        // Tool call result
        if (call.function?.output) {
          let outputText = call.function.output;
          try {
            // For memory searches, provide a cleaner result
            if (call.function.name === 'searchMemories' || call.function.name === 'get_memory') {
              const outputObj = typeof outputText !== 'string' ? outputText : JSON.parse(outputText);
              const memoryCount = outputObj?.memories?.length || 0;
              
              toolCallEvents.push({
                type: 'reasoning',
                content: {
                  text: `Found ${memoryCount} relevant memories`,
                  timestamp: new Date(Date.now() + 10).toISOString(),
                  step: 'complete',
                }
              });
            } else {
              // Default handling for other tools
              if (typeof outputText !== 'string') {
                outputText = JSON.stringify(outputText);
              }
              
              toolCallEvents.push({
                type: 'reasoning',
                content: {
                  text: `Result from ${call.function.name}: ${outputText}`,
                  timestamp: new Date(Date.now() + 10).toISOString(),
                  step: 'complete',
                }
              });
            }
          } catch (e) {
            // In case of error parsing JSON
            toolCallEvents.push({
              type: 'reasoning',
              content: {
                text: `Result from ${call.function.name}: ${String(outputText)}`,
                timestamp: new Date(Date.now() + 10).toISOString(),
                step: 'complete',
              }
            });
          }
        } else {
          // No output means error or empty result
          toolCallEvents.push({
            type: 'reasoning',
            content: {
              text: `Error accessing ${call.function.name}`,
              timestamp: new Date(Date.now() + 10).toISOString(),
              step: 'error',
            }
          });
        }
      }
    }
  }
  
  return toolCallEvents;
};

// Helper to extract context from user queries
const extractQueryContext = (userMessage: UIMessage): string | null => {
  if (!userMessage.parts) return null;
  
  // Extract text content using our helper
  const textContent = extractTextFromMessage(userMessage);
  if (textContent) {
    return textContent;
  }
  
  // Otherwise try to extract from parts
  const textParts = userMessage.parts?.filter(part => {
    const typedPart = part as MessagePart;
    return typedPart.type === 'text';
  });
  
  if (textParts?.length) {
    const textPart = textParts[0] as TextPart;
    return textPart.text;
  }
  
  return null;
};

// Helper to extract all thinking content from message
const extractAllThinkingContent = (message: UIMessage): ReasoningEvent[] => {
  const thinkingEvents: ReasoningEvent[] = [];
  
  // Extract from message content
  const textContent = extractTextFromMessage(message);
  if (textContent) {
    const thinkBlockRegex = /<think>([\s\S]*?)<\/think>/g;
    let match;
    
    while ((match = thinkBlockRegex.exec(textContent)) !== null) {
      if (match[1]) {
        thinkingEvents.push({
          type: 'reasoning',
          content: {
            text: match[1].trim(),
            timestamp: new Date().toISOString(),
            step: 'think',
          },
        });
      }
    }
  }
  
  // Extract from message parts
  message.parts?.forEach((part, index) => {
    const typedPart = part as MessagePart;
    
    if (typedPart.type === 'text') {
      const textContent = (typedPart as TextPart).text;
      const thinkBlockRegex = /<think>([\s\S]*?)<\/think>/g;
      let match;
      
      while ((match = thinkBlockRegex.exec(textContent)) !== null) {
        if (match[1]) {
          thinkingEvents.push({
            type: 'reasoning',
            content: {
              text: match[1].trim(),
              timestamp: new Date(Date.now() + index).toISOString(),
              step: 'think',
            },
          });
        }
      }
    } else if (typedPart.type === 'reasoning' || (typedPart as any).reasoning) {
      thinkingEvents.push({
        type: 'reasoning',
        content: {
          text: typeof (typedPart as any).reasoning === 'string' 
            ? (typedPart as any).reasoning 
            : (typedPart as any).reasoning?.text || '',
          timestamp: new Date(Date.now() + index).toISOString(),
          step: 'think',
        },
      });
    }
  });
  
  return thinkingEvents;
};


const PurePreviewMessage = ({
  chatId,
  message,
  vote,
  isLoading,
  setMessages,
  reload,
  isReadonly,
  selectedModelId,
  enableUniversalReasoning,
}: {
  chatId: string;
  message: UIMessage;
  vote: Vote | undefined;
  isLoading: boolean;
  setMessages: UseChatHelpers<UIMessage>['setMessages'];
  reload: UseChatHelpers<UIMessage>['regenerate'];
  isReadonly: boolean;
  selectedModelId?: string;
  enableUniversalReasoning?: boolean;
}) => {
  const [mode, setMode] = useState<'view' | 'edit'>('view');
  const { data: session, status: sessionStatus } = useSession();
  const { userImage, userName, userEmail, isLoading: avatarLoading } = useUserAvatar();
  
  // Debug session loading for user messages
  useEffect(() => {
    if (process.env.NODE_ENV === 'development' && message.role === 'user') {
      console.log('[Message] Avatar debug:', {
        sessionStatus,
        hasSession: !!session,
        hasUser: !!session?.user,
        userImage,
        userEmail,
        avatarLoading
      });
    }
  }, [sessionStatus, session, userImage, userEmail, message.role, avatarLoading]);
  
  // Debug logging for development only
  useEffect(() => {
    if (process.env.NODE_ENV === 'development') {
      console.log('[Message] Processing message:', {
        id: message.id,
        role: message.role,
        partTypes: message.parts?.map((part, index) => ({
          index,
          type: (part as any).type,
        })),
      });
    }
  }, [message]);
  
  // Extract reasoning events from message parts
  const reasoningEvents = message.parts?.reduce((events, part) => {
    const typedPart = part as MessagePart;
    // Process message parts for reasoning extraction

    // Handle direct reasoning parts
    if (typedPart.type === 'reasoning') {
      console.log('[Message] Found direct reasoning part:', typedPart);
      const reasoningPart = typedPart as ReasoningPart;
      
      // Handle the actual structure from the logs: { type: "reasoning", text: "...", providerOptions: {...} }
      const reasoningText = (reasoningPart as any).text || 
                           (typeof reasoningPart.reasoning === 'string' ? reasoningPart.reasoning : 
                            (reasoningPart.reasoning as ReasoningContent)?.text || '');
      
      events.push({
        type: 'reasoning',
        content: {
          text: reasoningText,
          timestamp: typeof reasoningPart.reasoning === 'string' ? 
            new Date().toISOString() : 
            (reasoningPart.reasoning as ReasoningContent)?.timestamp || new Date().toISOString(),
          step: typeof reasoningPart.reasoning === 'string' ? 
            'complete' : 
            (reasoningPart.reasoning as ReasoningContent)?.step || 'complete',
        },
      });
    }
    // Handle parts with direct reasoning field (as seen in logs)
    else if ('reasoning' in typedPart && typeof typedPart.reasoning === 'string' && typedPart.reasoning) {
      console.log('[Message] Found part with direct reasoning field:', typedPart);
      events.push({
        type: 'reasoning',
        content: {
          text: typedPart.reasoning,
          timestamp: new Date().toISOString(),
          step: 'complete',
        },
      });
    }
    // Handle parts with details array and reasoning field (seen in logs)
    else if ('details' in typedPart && Array.isArray(typedPart.details) && 'reasoning' in typedPart) {
      console.log('[Message] Found part with details array and reasoning:', typedPart);
      events.push({
        type: 'reasoning',
        content: {
          text: typeof typedPart.reasoning === 'string' ? typedPart.reasoning : '',
          timestamp: new Date().toISOString(),
          step: 'complete',
        },
      });
    }
    // Legacy tool-invocation format - not used in AI SDK v5
    // else if (typedPart.type === 'tool-invocation') {
    //   const toolPart = typedPart as ToolInvocationPart;
    //   const { toolName, state, args, result } = toolPart.toolInvocation;
    //   if (toolName === 'searchMemories') {
    //     if (state === 'result') {
    //       console.log('[Message] Found searchMemories call:', args);
    //       events.push({
    //         type: 'reasoning',
    //         content: {
    //           text: `🔍 Starting memory search with query: "${args.query}"`,
    //           timestamp: new Date().toISOString(),
    //           step: 'start',
    //         },
    //       });
    //     } else if (state === 'result' && result) {
    //       console.log('[Message] Found searchMemories result:', result);
    //       events.push({
    //         type: 'reasoning',
    //         content: {
    //           text: `✅ Found ${result.memories?.length || 0} relevant memories`,
    //           timestamp: new Date().toISOString(),
    //           step: 'reading',
    //         },
    //       });
    //     }
    //   }
    // }
    // Handle data events
    else if (typedPart.type === 'data') {
      const dataPart = typedPart as DataPart;
      if (dataPart.data.type === 'part' && dataPart.data.data?.type === 'reasoning') {
        const reasoningData = dataPart.data.data;
        console.log('[Message] Found data part with reasoning:', reasoningData);
        events.push({
          type: 'reasoning',
          content: reasoningData.reasoning,
        });
      } else if (dataPart.data.type === 'reasoning' && dataPart.data.reasoning) {
        console.log('[Message] Found direct reasoning data:', dataPart.data);
        events.push({
          type: 'reasoning',
          content: dataPart.data.reasoning,
        });
      }
    }
    // Handle step-start events
    else if (typedPart.type === 'step-start') {
      const stepPart = typedPart as StepStartPart;
      if (stepPart.data?.type === 'reasoning' && stepPart.data.reasoning) {
        console.log('[Message] Found step-start reasoning:', stepPart.data);
        events.push({
          type: 'reasoning',
          content: stepPart.data.reasoning,
        });
      } else {
        console.log('[Message] Found step-start without data:', typedPart);
        events.push({
          type: 'reasoning',
          content: {
            text: 'Processing...',
            timestamp: new Date().toISOString(),
            step: 'init',
          },
        });
      }
    }
    return events;
  }, [] as ReasoningEvent[]);

  // Check if we're using a model with reasoning support
  const isReasoningEnabled = selectedModelId ? modelSupportsReasoning(selectedModelId) : false;
  
  // Check if the message itself has a model ID with reasoning support
  const messageModelId = (message as ExtendedUIMessage).modelId;
  const messageSupportsReasoning = messageModelId ? modelSupportsReasoning(messageModelId) : false;
  
  // Only add tool call events as reasoning events if the model actually supports reasoning
  const modelSupportsReasoningCapability = isReasoningEnabled || messageSupportsReasoning;
  
  if (modelSupportsReasoningCapability && 
      ((message as any).toolInvocations?.length || (message as ExtendedUIMessage).tool_calls?.length)) {
    const toolCallEvents = extractToolCallsFromMessage(message);
    reasoningEvents.push(...toolCallEvents);
  }

  console.log('[Message] Extracted reasoning events:', reasoningEvents);

  // For messages with think blocks: extract all thinking content from text now,
  // so gating below can consider these tokens.
  const thinkingEvents = extractAllThinkingContent(message);
  reasoningEvents.push(...thinkingEvents);

  // Render MessageReasoning whenever there are reasoning parts/events.
  // This aligns with AI SDK v5 where models can stream many short reasoning tokens.
  const hasAnyReasoning = reasoningEvents.length > 0;
  
  // Avoid showing if the only item is the generic placeholder during loading
  const isOnlyProcessingPlaceholder = isLoading && 
    reasoningEvents.length === 1 && 
    reasoningEvents[0].content.text === 'Processing...';
  
  const shouldShowReasoning = modelSupportsReasoningCapability && hasAnyReasoning && !isOnlyProcessingPlaceholder;
  
  // Determine if reasoning is complete based on events
  const isReasoningComplete = !isLoading || 
    reasoningEvents.some(event => event.content.step === 'complete');
  
  // Extract user query for reasoning title
  const userQuery = message.role === 'assistant' ? findUserQuery(message) : '';
  
  // Add user query context for memory searches
  if ((message as any).toolInvocations?.some((invocation: ToolInvocationInfo) => 
      invocation.toolName === 'searchMemories' || invocation.toolName === 'get_memory'
    )) {
    // Try to find the preceding user message to get context
    const userQuery = findUserQuery(message);
    
    // Add context for memory search if we have a user query
    if (userQuery && !reasoningEvents.some(event => event.content.step === 'think')) {
      reasoningEvents.push({
        type: 'reasoning',
        content: {
          text: `The user is asking about "${userQuery}". I need to search through memories to find relevant information.`,
          timestamp: new Date().toISOString(),
          step: 'think',
        }
      });
    }
  }

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

              {/* Message Content with markdown style overrides */}
              <div className="flex-1 flex flex-col gap-3 w-full">
                {/* Only show attachments, reasoning, etc. for assistant messages */}
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
                      <div>
                        {(message as ExtendedUIMessage).attachments!.map((attachment: any) => (
                          <div key={attachment.url} className="flex flex-wrap gap-2">
                            <PreviewAttachment key={attachment.url} attachment={{
                              type: 'file' as const,
                              url: attachment.url,
                              filename: attachment.name,
                              mediaType: attachment.contentType
                            }} />
                          </div>
                        ))}
                      </div>
                    )}
                  </>
                )}



                {message.parts?.map((part, index) => {
                  const typedPart = part as MessagePart;
                  const { type } = typedPart;
                  const key = `message-${message.id}-part-${index}`;

                  if (type === 'text') {
                    const textContent = (typedPart as TextPart).text;
                    const hasThinkBlock = textContent.includes('<think>');
                    
                    console.log('[Message] Rendering text part:', { textContent, hasThinkBlock, messageRole: message.role });
                    
                    // Extract think block content for assistant messages
                    if (message.role === 'assistant' && hasThinkBlock) {
                      // If we have an opening <think> but no closing yet, hide everything after the opening tag
                      if (textContent.includes('<think>') && !textContent.includes('</think>')) {
                        const visibleText = textContent.slice(0, textContent.indexOf('<think>')).trim();
                        return (
                          <div key={key} className="w-full message-content">
                            {visibleText ? <Markdown>{visibleText}</Markdown> : null}
                          </div>
                        );
                      }
                      // When we have a complete <think>...</think> block, strip it from the assistant text
                      const thinkBlockRegex = /<think>([\s\S]*?)<\/think>/g;
                      const cleanedContent = textContent.replace(thinkBlockRegex, '').trim();
                      return (
                        <div key={key} className="w-full message-content">
                          <Markdown>{cleanedContent}</Markdown>
                        </div>
                      );
                    }
                    
                    if (message.role === 'user') {
                      return (
                        <div key={key} className="flex flex-col w-full gap-2">
                          <div className=" text-foreground py-1 rounded-xl message-content">
                            <div className="pt-0 mt-0">
                              <ProcessedMessage content={textContent} />
                            </div>
                          </div>
                          {!isReadonly && (
                            <div className="flex justify-start gap-2">
                              <Tooltip>
                                <TooltipTrigger asChild>
                                  <Button
                                    data-testid="message-copy-button"
                                    size="sm"
                                    variant="outline"
                                    className="py-1 px-2 h-fit text-muted-foreground"
                                    onClick={() => {
                                      navigator.clipboard.writeText(textContent);
                                    }}
                                  >
                                    <CopyIcon />
                                  </Button>
                                </TooltipTrigger>
                                <TooltipContent>Copy message</TooltipContent>
                              </Tooltip>

                              <Tooltip>
                                <TooltipTrigger asChild>
                                  <Button
                                    data-testid="message-edit-button"
                                    size="sm"
                                    variant="outline"
                                    className="py-1 px-2 h-fit text-muted-foreground"
                                    onClick={() => setMode('edit')}
                                  >
                                    <PencilEditIcon />
                                  </Button>
                                </TooltipTrigger>
                                <TooltipContent>Edit message</TooltipContent>
                              </Tooltip>
                            </div>
                          )}
                        </div>
                      );
                    } else {
                      return (
                        <div key={key} className="w-full message-content">
                          <ProcessedMessage 
                            content={textContent} 
                            isAssistantMessage={true} 
                          />
                        </div>
                      );
                    }
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
                            <Weather weatherAtLocation={output as WeatherAtLocation} />
                          ) : toolName === 'createDocument' ? (
                            <DocumentToolResult
                              type="create"
                              result={output as DocumentToolOutput}
                              isReadonly={isReadonly}
                            />
                          ) : toolName === 'updateDocument' ? (
                            <DocumentToolResult
                              type="update"
                              result={output as DocumentToolOutput}
                              isReadonly={isReadonly}
                            />
                          ) : toolName === 'requestSuggestions' ? (
                            <DocumentToolResult
                              type="request-suggestions"
                              result={output as DocumentToolOutput}
                              isReadonly={isReadonly}
                            />
                          ) : toolName === 'searchMemories' ? (
                            <ChatMemoryResults message={message} />
                          ) : [
                            'listRepositories',
                            'createProject', 
                            'getRepositoryFiles',
                            'getFileContent',
                            'searchFiles',
                            'openFileExplorer',
                            'createRepository',
                            'requestRepositoryApproval'
                          ].includes(toolName) ? (
                            <div className="github-tool-result">
                              {(output as GitHubToolResult).success ? (
                                <>
                                  {(output as GitHubToolResult).repositories && (
                                    <GitHubRepoResults
                                      repositories={(output as GitHubToolResult).repositories!}
                                      onRepositorySelect={(repo: Repository) => {
                                        console.log('Repository selected:', repo);
                                      }}
                                    />
                                  )}
                                  {(output as GitHubToolResult).searchResults && (
                                    <GitHubSearchResults
                                      searchResults={(output as GitHubToolResult).searchResults!}
                                      searchQuery={(output as GitHubToolResult).searchQuery || ''}
                                      onFileSelect={(searchResult: any) => {
                                        console.log('Search result selected:', searchResult);
                                      }}
                                    />
                                  )}
                                  {(output as GitHubToolResult).file && (
                                    <TruncatedFileDisplay 
                                      file={(output as GitHubToolResult).file!} 
                                      editSuggestion={(output as GitHubToolResult).editSuggestion}
                                    />
                                  )}
                                  {(output as GitHubToolResult).repository && (
                                    <div className="bg-green-50 border border-green-200 rounded-lg p-4">
                                      <div className="flex items-center gap-2 text-green-800 font-medium">
                                        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                                        </svg>
                                        Repository Created Successfully
                                      </div>
                                      <p className="text-green-700 mt-2">
                                        Created repository: <strong>{(output as GitHubToolResult).repository!.name}</strong>
                                      </p>
                                      <a 
                                        href={(output as GitHubToolResult).repository!.url} 
                                        target="_blank" 
                                        rel="noopener noreferrer"
                                        className="text-blue-600 hover:text-blue-800 underline mt-2 inline-block"
                                      >
                                        View on GitHub →
                                      </a>
                                    </div>
                                  )}
                                </>
                              ) : (
                                <div className="bg-red-50 border border-red-200 rounded-lg p-4">
                                  <div className="flex items-center gap-2 text-red-800 font-medium">
                                    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                                    </svg>
                                    Error
                                  </div>
                                  <p className="text-red-700 mt-2">{(output as GitHubToolResult).error}</p>
                                </div>
                              )}
                            </div>
                          ) : (
                            <pre>{JSON.stringify(output, null, 2)}</pre>
                          )}
                        </div>
                      );
                    }

                    // Handle tool call initiation (state: 'input-available')
                    if (state === 'input-available' && input) {
                      return (
                        <div key={toolCallId || key} className={cx({ skeleton: ['getWeather'].includes(toolName) })}>
                          {toolName === 'getWeather' ? (
                            <Weather />
                          ) : toolName === 'createDocument' ? (
                            <DocumentToolCall
                              type="create"
                              args={{title: '', ...input}}
                              isReadonly={isReadonly}
                            />
                          ) : toolName === 'updateDocument' ? (
                            <DocumentToolCall
                              type="update"
                              args={{title: '', ...input}}
                              isReadonly={isReadonly}
                            />
                          ) : toolName === 'requestSuggestions' ? (
                            <DocumentToolCall
                              type="request-suggestions"
                              args={{title: '', ...input}}
                              isReadonly={isReadonly}
                            />
                          ) : null}
                        </div>
                      );
                      }
                    }
                  }

                  return null;
                })}

                {/* Render ChatMemoryResults as fallback only if not already rendered by searchMemories tool */}
                {message.role === 'assistant' && !message.parts?.some((part: any) => 
                  part.type?.includes('searchMemories') && part.state === 'output-available'
                ) && <ChatMemoryResults message={message as any} />}
                
                {/* Render WebSearchResults if grounding metadata is available */}
                {message.role === 'assistant' && (message as any).groundingMetadata && (
                  <WebSearchResults groundingMetadata={(message as any).groundingMetadata} />
                )}
                
                {/* Render SearchSources if sources are available */}
                {message.role === 'assistant' && ((message as any).metadata?.sources || (message as any).sources) && (
                  <SearchSources sources={(message as any).metadata?.sources || (message as any).sources} />
                )}

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
};

export const PreviewMessage = memo(
  PurePreviewMessage,
  (prevProps: {
    chatId: string;
    message: UIMessage;
    vote: Vote | undefined;
    isLoading: boolean;
    setMessages: UseChatHelpers<UIMessage>['setMessages'];
    reload: UseChatHelpers<UIMessage>['regenerate'];
    isReadonly: boolean;
    selectedModelId?: string;
    enableUniversalReasoning?: boolean;
  }, nextProps: {
    chatId: string;
    message: UIMessage;
    vote: Vote | undefined;
    isLoading: boolean;
    setMessages: UseChatHelpers<UIMessage>['setMessages'];
    reload: UseChatHelpers<UIMessage>['regenerate'];
    isReadonly: boolean;
    selectedModelId?: string;
    enableUniversalReasoning?: boolean;
  }) => {
    if (prevProps.isLoading !== nextProps.isLoading) return false;
    if (prevProps.message.id !== nextProps.message.id) return false;
    if (!equal(prevProps.message.parts, nextProps.message.parts)) return false;
    if (!equal(prevProps.vote, nextProps.vote)) return false;

    return true;
  },
);

export const ThinkingMessage = ({ selectedModelId }: { selectedModelId?: string }) => {
  const role = 'assistant';
  const { state: thinkingState } = useThinkingState();
  const [dots, setDots] = useState('...');
  const isReasoningModel = selectedModelId ? modelSupportsReasoning(selectedModelId) : false;
  
  // Simple dots animation
  useEffect(() => {
    const interval = setInterval(() => {
      setDots(prev => prev.length >= 3 ? '.' : prev + '.');
    }, 400);
    return () => clearInterval(interval);
  }, []);

  // Use the thinking state from context if available, otherwise fallback to generic loading text
  const getDisplayText = () => {
    // Extract the message from the thinking state
    const message = typeof thinkingState === 'string' ? thinkingState : thinkingState.message;
    
    // If we have a specific thinking state that's not the default, use it
    if (message && message !== 'Thinking...') {
      return message;
    }
    
    // Otherwise use model-appropriate loading text
    return isReasoningModel ? `Thinking${dots}` : `Processing${dots}`;
  };

  const displayText = getDisplayText();

  return (
    <motion.div
      data-testid="message-assistant-loading"
      className="relative mb-4 flex flex-col w-full"
      initial={{ opacity: 1 }} // Start fully visible
      animate={{ opacity: 1 }}
      exit={{ opacity: 0, transition: { duration: 0.3 } }} // Fade out smoothly
      data-role={role}
      layout // Add layout prop for smoother transitions
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
};
