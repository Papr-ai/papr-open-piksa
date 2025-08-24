'use client';

import type { UIMessage } from 'ai';
import { PreviewMessage, ThinkingMessage } from './message';
import { useScrollToBottom } from '../common/use-scroll-to-bottom';
import { Greeting } from '../layout/greeting';
import { memo, useEffect, useState, useRef } from 'react';
import type { Vote } from '@/lib/db/schema';
import equal from 'fast-deep-equal';
import type { UseChatHelpers } from '@ai-sdk/react';
import { modelSupportsReasoning } from '@/lib/ai/models';

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
}: MessagesProps) {
  const [messagesContainerRef, messagesEndRef] =
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
      // Force scroll to bottom
      messagesEndRef.current?.scrollIntoView({ behavior: 'smooth', block: 'end' });
    }
    
    prevMessagesLengthRef.current = messages.length;
  }, [messages.length, messages]);
  
  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth', block: 'end' });
  };
  
  // Check if the last message has proper content to display
  useEffect(() => {
    const lastMessage = messages.length > 0 ? messages[messages.length - 1] : null;
    
    // If the last message is from the assistant, check for content
    if (lastMessage && lastMessage.role === 'assistant') {
      // Check for any content that should be displayed
      const hasContent = lastMessage.parts?.some(part => {
        // Safely check part type without TypeScript errors
        const partType = part.type;
        
        // Check for tool calls
        if (partType === 'tool-invocation') return true;
        
        // Check for reasoning parts
        if (partType === 'reasoning') return true;
        
        // Check for step-start events
        if (partType === 'step-start') return true;
        
        // Check for text content
        if (partType === 'text' && 'text' in part && typeof part.text === 'string' && part.text.length > 0) return true;
        
        // Check for parts with reasoning field
        if ('reasoning' in part && typeof part.reasoning === 'string' && part.reasoning.length > 20) return true;
        
        // Check for parts with details array and reasoning
        if ('details' in part && Array.isArray(part.details) && 'reasoning' in part) return true;
        
        return false;
      });
      
      setHasVisibleContent(!!hasContent);
    } else {
      setHasVisibleContent(false);
    }
  }, [messages]);

  // Check if we're using the reasoning model
  const isReasoningModel = selectedModelId ? modelSupportsReasoning(selectedModelId) : false;
  
  // Determine if we should show the thinking state - unified approach
  const shouldShowThinking = 
    // For non-reasoning model, show during submit and streaming (for tool execution)
    !isReasoningModel ? 
      // Show loading indicator during submit state or streaming without visible content
      ((status === 'submitted' || status === 'streaming') && 
       messages.length > 0 && 
       messages[messages.length - 1].role === 'user') ||
      // Also show during streaming if the last message is an assistant message without visible content
      (status === 'streaming' && 
       messages.length > 0 && 
       messages[messages.length - 1].role === 'assistant' && 
       !hasVisibleContent)
      :
      // For reasoning model, show if no message with reasoning is being displayed
      ((status === 'submitted' || status === 'streaming') && 
       messages.length > 0 && 
       messages[messages.length - 1].role === 'user' && 
       !hasVisibleContent) ||
      // Also show during streaming if the last message is an assistant message without visible content
      (status === 'streaming' && 
       messages.length > 0 && 
       messages[messages.length - 1].role === 'assistant' && 
       !hasVisibleContent);
  
  // Don't filter messages, just modify how they're displayed
  // This ensures tool calls and reasoning events are always visible
  const displayMessages = messages;
  
  const isLoading = status === 'streaming' || status === 'submitted';

  return (
    <div className="relative ">
      <div
        ref={messagesContainerRef}
        className={`flex flex-col min-w-0 gap-6 flex-1 overflow-y-scroll pt-4 w-[65%] mx-auto ${
          isArtifactVisible ? '' : ''
        }`}
        data-testid="messages-container"
        id="messages"
      >
        {displayMessages.length === 0 && <Greeting />}

        {displayMessages.map((message, index) => {
          // AI SDK v5 embeds tool results as parts within assistant messages,
          // so we don't need to handle separate tool messages

          // For the last assistant message during streaming
          const isLastAssistantMessage = 
            status === 'streaming' && 
            index === displayMessages.length - 1 && 
            message.role === 'assistant';
          
          // Keep showing the thinking indicator alongside empty assistant messages
          // instead of hiding the entire assistant message
          if (isLastAssistantMessage && !hasVisibleContent) {
            return (
              <div key={message.id}>
                <ThinkingMessage selectedModelId={selectedModelId} />
              </div>
            );
          }
          
          // Augment the message with reasoning steps if applicable
          if (reasoningSteps.length > 0 && index === displayMessages.length - 1 && message.role === 'assistant') {
            // Clone the message to avoid mutating the original
            const messageWithReasoningSteps = {
              ...message,
              parts: [...(message.parts || [])],
            };
            
            // Add reasoning steps as step-start parts
            reasoningSteps.forEach((step, stepIndex) => {
              if (stepIndex > 0) { // Skip adding a step boundary at the beginning
                messageWithReasoningSteps.parts?.push({
                  type: 'step-start'
                });
              }
            });
            
            // AI SDK v5 already includes tool results as parts in the assistant message
            const combinedMessageWithReasoning = messageWithReasoningSteps;

            return (
              <div key={message.id}>
                <PreviewMessage
                  chatId={chatId}
                  message={combinedMessageWithReasoning}
                  isLoading={isLoading}
                  vote={votes?.find((vote) => vote.messageId === message.id)}
                  setMessages={setMessages}
                  reload={reload}
                  isReadonly={isReadonly}
                  selectedModelId={selectedModelId}
                  enableUniversalReasoning={enableUniversalReasoning}
                />
              </div>
            );
          }
          
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
              />
            </div>
          );
        })}

        {/* Only show the global thinking indicator if there's no assistant message being displayed yet */}
        {shouldShowThinking && !displayMessages.some(
          (msg) => msg.role === 'assistant' && msg.id === messages[messages.length - 1].id
        ) && <ThinkingMessage selectedModelId={selectedModelId} />}
        
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
          className="fixed bottom-24 right-8 bg-primary text-primary-foreground rounded-full p-2 shadow-md z-10 hover:bg-primary/90 transition-opacity"
          aria-label="Scroll to bottom"
        >
          <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
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
