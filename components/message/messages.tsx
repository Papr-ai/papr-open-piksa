'use client';

import type { UIMessage } from 'ai';
import { PreviewMessage, ThinkingMessage } from './message';
import { useScrollToBottom } from '../common/use-scroll-to-bottom';
import { Greeting } from '../layout/greeting';
import { memo, useEffect, useState, useRef, useMemo } from 'react';
import type { Vote } from '@/lib/db/schema';
import equal from 'fast-deep-equal';
import type { UseChatHelpers } from '@ai-sdk/react';
import { modelSupportsReasoning } from '@/lib/ai/models';
import type { VoiceChatState } from '@/hooks/use-voice-chat-webrtc';
import { useIsMobile } from '@/hooks/use-mobile';

interface MessagesProps {
  chatId: string;
  status: UseChatHelpers<UIMessage>['status'];
  votes: Array<Vote> | undefined;
  messages: Array<UIMessage>;
  setMessages: UseChatHelpers<UIMessage>['setMessages'];
  reload: UseChatHelpers<UIMessage>['regenerate'];
  isReadonly: boolean;
  isArtifactVisible: boolean;
  reasoningSteps?: any[];
  selectedModelId?: string;
  enableUniversalReasoning?: boolean;
  voiceState?: VoiceChatState;
  setInput?: (input: string) => void;
  handleSubmit?: (e?: React.FormEvent) => void;
  sendMessage?: (message: { role: 'user'; parts: Array<{ type: 'text'; text: string }> }) => void;
}

function PureMessages({
  chatId,
  status,
  votes,
  messages,
  setMessages,
  reload,
  isReadonly,
  isArtifactVisible,
  reasoningSteps = [],
  selectedModelId,
  enableUniversalReasoning,
  voiceState,
  setInput,
  handleSubmit,
  sendMessage,
}: MessagesProps) {
  // Mobile detection hook
  const isMobile = useIsMobile();
  
  const [messagesContainerRef, messagesEndRef, scrollToBottom] =
    useScrollToBottom<HTMLDivElement>();
  
  const [isScrolledUp, setIsScrolledUp] = useState(false);
  
  // Track if the latest AI message has meaningful reasoning content or tool calls
  const [hasVisibleContent, setHasVisibleContent] = useState(false);
  const prevMessagesLengthRef = useRef(messages.length);
  
  // Handle scroll events to check if user has scrolled up
  useEffect(() => {
    const container = messagesContainerRef.current;
    if (!container) return;
    
    const handleScroll = () => {
      const { scrollTop, scrollHeight, clientHeight } = container;
      const isAtBottom = scrollHeight - scrollTop - clientHeight < 100;
      setIsScrolledUp(!isAtBottom);
    };
    
    container.addEventListener('scroll', handleScroll);
    return () => container.removeEventListener('scroll', handleScroll);
  }, []);
  
  // Force scroll to bottom when user sends a new message
  useEffect(() => {
    // If messages length increased and the newest message is from the user
    if (
      messages.length > prevMessagesLengthRef.current &&
      messages.length > 0 &&
      messages[messages.length - 1].role === 'user'
    ) {
      // Force scroll to bottom when user sends a message
      scrollToBottom();
    }
    
    prevMessagesLengthRef.current = messages.length;
  }, [messages.length, messages, scrollToBottom]);
  
  
  // Check if the last message has proper content to display
  useEffect(() => {
    const lastMessage = messages.length > 0 ? messages[messages.length - 1] : null;
    
    // If the last message is from the assistant, check for content
    if (lastMessage && lastMessage.role === 'assistant') {
      // Debug logging removed to prevent infinite loops
      
      // Check for any content that should be displayed
      const hasContent = lastMessage.parts && lastMessage.parts.length > 0 && lastMessage.parts.some(part => {
        // Safely check part type without TypeScript errors
        const partType = part.type;
        
        // Check for tool calls
        if (partType === 'tool-invocation') {
          // Debug logging removed
          return true;
        }
        
        // Check for reasoning parts
        if (partType === 'reasoning') {
          // Debug logging removed
          return true;
        }
        
        // Check for step-start events
        if (partType === 'step-start') {
          // Debug logging removed
          return true;
        }
        
        // Check for text content
        if (partType === 'text' && 'text' in part && typeof part.text === 'string' && part.text.length > 0) {
          // Debug logging removed
          return true;
        }
        
        // Check for parts with reasoning field
        if ('reasoning' in part && typeof part.reasoning === 'string' && part.reasoning.length > 20) {
          // Debug logging removed
          return true;
        }
        
        // Check for parts with details array and reasoning
        if ('details' in part && Array.isArray(part.details) && 'reasoning' in part) {
          // Debug logging removed
          return true;
        }
        
        // Debug logging removed
        return false;
      });
      
      // Debug logging removed
      setHasVisibleContent(!!hasContent);
    } else {
      setHasVisibleContent(false);
    }
  }, [messages, status]);

  // Check if we're using the reasoning model
  const isReasoningModel = selectedModelId ? modelSupportsReasoning(selectedModelId) : false;
  
  // Check if we have any reasoning content in the current messages
  const hasReasoningContent = messages.some(message => {
    if (message.role !== 'assistant') return false;
    
    // Check for reasoning parts
    if (message.parts?.some(part => (part as any).type === 'reasoning')) {
      return true;
    }
    
    // Check for <think> blocks in text content
    const textContent = message.parts
      ?.filter(part => (part as any).type === 'text')
      ?.map(part => (part as any).text)
      ?.join(' ') || '';
    
    return /<think>[\s\S]*<\/think>/.test(textContent);
  });

  // Don't filter messages, just modify how they're displayed
  // This ensures tool calls and reasoning events are always visible
  const displayMessages = messages;
  
  const isLoading = status === 'streaming' || status === 'submitted';

  // Disable global thinking indicator since we now show inline "Processing..." in messages
  // This prevents duplicate processing indicators
  const shouldShowThinking = false;

  return (
    <div className="relative ">
      <div
        ref={messagesContainerRef}
        className={`flex flex-col min-w-0 gap-6 flex-1 overflow-y-scroll pt-4 mx-auto ${
          isMobile ? 'w-full px-4' : 'w-[65%]'
        } ${isArtifactVisible ? '' : ''}`}
        data-testid="messages-container"
        id="messages"
      >
        {displayMessages.length === 0 && <Greeting />}

        {displayMessages.map((message, index) => {
          // AI SDK v5 embeds tool results as parts within assistant messages,
          // so we don't need to handle separate tool messages

          // Check if this is an assistant message during active streaming/processing
          const isStreamingAssistantMessage = 
            (status === 'streaming' || status === 'submitted') && 
            message.role === 'assistant';
          
          // Check if THIS specific message has visible content (not just the last one)
          const messageHasVisibleContent = message.parts && message.parts.length > 0 && message.parts.some(part => {
            const partType = part.type;
            // Handle UI message part types (after streaming conversion)
            if (partType === 'text' && 'text' in part && typeof part.text === 'string') return true; // Removed length > 0 to allow streaming deltas
            if (partType === 'reasoning') return true;
            if (partType === 'step-start') return true;
            if (partType.startsWith('tool-')) return true; // tool-* parts
            if (partType === 'dynamic-tool') return true;
            if (partType === 'file') return true;
            if (partType === 'source-url' || partType === 'source-document') return true;
            if (partType.startsWith('data-')) return true; // data-* parts
            // Additional checks for parts with reasoning content
            if ('reasoning' in part && typeof part.reasoning === 'string' && part.reasoning.length > 20) return true;
            if ('details' in part && Array.isArray(part.details) && 'reasoning' in part) return true;
            return false;
          });
          
          // Debug logging removed to prevent infinite loops
          
          // For empty streaming assistant messages, show them with thinking state
          // This provides immediate visual feedback while waiting for data stream updates
          const isEmptyStreamingMessage = isStreamingAssistantMessage && !messageHasVisibleContent && 
            index === displayMessages.length - 1; // Only for the last (current) message
          
          // Skip reasoning steps augmentation - MessageReasoning component handles this
          // This was causing infinite loops by creating new message objects on every render
          
          // Debug logging removed to prevent infinite loops
          
          return (
            <div key={message.id}>
              <PreviewMessage
                chatId={chatId}
                message={message}
                isLoading={isLoading}
                vote={votes?.find((vote) => vote.messageId === message.id)}
                setMessages={setMessages}
                reload={reload}
                isReadonly={isReadonly}
                selectedModelId={selectedModelId}
                enableUniversalReasoning={enableUniversalReasoning}
                sendMessage={sendMessage}
              />
            </div>
          );
        })}

        {/* Show the global thinking indicator when AI is processing but no assistant message exists yet */}
        {shouldShowThinking && <ThinkingMessage selectedModelId={selectedModelId} />}
        
        <div
          ref={messagesEndRef}
          className="shrink-0 min-w-[24px] min-h-[24px]"
        />

        <style jsx>{`
          #messages {
            padding-bottom: ${isArtifactVisible ? '250px' : '0'};
          }
        `}</style>
      </div>
      
      {isScrolledUp && (
        <button 
          onClick={scrollToBottom}
          className={`fixed bg-primary text-primary-foreground rounded-full p-2 shadow-md z-10 hover:bg-primary/90 transition-opacity ${
            isMobile 
              ? 'bottom-20 right-4 w-10 h-10' 
              : 'bottom-24 right-8 w-12 h-12'
          }`}
          aria-label="Scroll to bottom"
        >
          <svg 
            xmlns="http://www.w3.org/2000/svg" 
            width={isMobile ? "20" : "24"} 
            height={isMobile ? "20" : "24"} 
            viewBox="0 0 24 24" 
            fill="none" 
            stroke="currentColor" 
            strokeWidth="2" 
            strokeLinecap="round" 
            strokeLinejoin="round"
          >
            <path d="M12 5v14"></path>
            <path d="m19 12-7 7-7-7"></path>
          </svg>
        </button>
      )}
    </div>
  );
}

export const Messages = memo(PureMessages, (prevProps, nextProps) => {
  if (prevProps.isArtifactVisible !== nextProps.isArtifactVisible) return false;

  if (prevProps.status !== nextProps.status) return false;
  if (prevProps.status && nextProps.status) return false;
  if (prevProps.messages.length !== nextProps.messages.length) return false;
  if (!equal(prevProps.messages, nextProps.messages)) return false;
  if (!equal(prevProps.votes, nextProps.votes)) return false;

  return true;
});
