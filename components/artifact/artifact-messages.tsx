import { PreviewMessage, ThinkingMessage } from '../message/message';
import { useScrollToBottom } from '../common/use-scroll-to-bottom';
import { Greeting } from '../layout/greeting';
import type { Vote } from '@/lib/db/schema';
import type { UIMessage } from 'ai';
import { memo } from 'react';
import equal from 'fast-deep-equal';
import type { UIArtifact } from './artifact';
import type { UseChatHelpers } from '@ai-sdk/react';
import { modelSupportsReasoning } from '@/lib/ai/models';

// Helper function to safely extract text from UIMessage
function extractTextFromMessage(message: UIMessage): string {
  // Handle legacy content property
  if (typeof (message as any).content === 'string') {
    return (message as any).content;
  }
  
  // Handle new parts array structure
  if (message.parts && Array.isArray(message.parts)) {
    return message.parts
      .filter(part => part.type === 'text')
      .map(part => (part as any).text)
      .join('');
  }
  
  return '';
}

// Removed hasVisibleContent function - no longer needed with simplified streaming logic

interface ArtifactMessagesProps {
  chatId: string;
  status: UseChatHelpers<UIMessage>['status'];
  votes: Array<Vote> | undefined;
  messages: UseChatHelpers<UIMessage>['messages'];
  setMessages: UseChatHelpers<UIMessage>['setMessages'];
  reload: UseChatHelpers<UIMessage>['regenerate'];
  isReadonly: boolean;
  artifactStatus: UIArtifact['status'];
  selectedModelId?: string;
  setInput?: (input: string) => void;
  handleSubmit?: (e?: React.FormEvent) => void;
  sendMessage?: (message: { role: 'user'; parts: Array<{ type: 'text'; text: string }> }) => void;
}

function PureArtifactMessages({
  chatId,
  status,
  votes,
  messages,
  setMessages,
  reload,
  isReadonly,
  selectedModelId,
  setInput,
  handleSubmit,
  sendMessage,
}: ArtifactMessagesProps) {
  const [messagesContainerRef, messagesEndRef, scrollToBottom] =
    useScrollToBottom<HTMLDivElement>();

  // Simplified streaming logic - always show content immediately
  const isLoading = status === 'streaming' || status === 'submitted';
  
  // Show thinking indicator only when submitted and no assistant message yet
  const shouldShowThinking = status === 'submitted' && 
    messages.length > 0 && 
    messages[messages.length - 1].role === 'user';

  return (
    <div
      ref={messagesContainerRef}
      className="flex flex-col size-full gap-4 items-center overflow-y-scroll px-4 pt-20"
    >
      <div className="w-[95%] flex flex-col items-center">
        {messages.length === 0 && <Greeting />}
        
        {messages.map((message, index) => {
          return (
            <PreviewMessage
              chatId={chatId}
              key={message.id}
              message={message}
              isLoading={isLoading && index === messages.length - 1}
              vote={
                votes
                  ? votes.find((vote) => vote.messageId === message.id)
                  : undefined
              }
              setMessages={setMessages}
              reload={reload}
              isReadonly={isReadonly}
              selectedModelId={selectedModelId}
              setInput={setInput}
              handleSubmit={handleSubmit}
              sendMessage={sendMessage}
            />
          );
        })}

        {/* Only show the global thinking indicator if there's no assistant message being displayed yet */}
        {shouldShowThinking && !messages.some(
          (msg) => msg.role === 'assistant' && msg.id === messages[messages.length - 1].id
        ) && <ThinkingMessage selectedModelId={selectedModelId} />}
      </div>

      <div
        ref={messagesEndRef}
        className="shrink-0 min-w-[24px] min-h-[24px]"
      />
    </div>
  );
}

function areEqual(
  prevProps: ArtifactMessagesProps,
  nextProps: ArtifactMessagesProps,
) {
  if (
    prevProps.artifactStatus === 'streaming' &&
    nextProps.artifactStatus === 'streaming'
  )
    return true;

  if (prevProps.status !== nextProps.status) return false;
  if (prevProps.status && nextProps.status) return false;
  if (prevProps.messages.length !== nextProps.messages.length) return false;
  if (!equal(prevProps.votes, nextProps.votes)) return false;
  if (prevProps.selectedModelId !== nextProps.selectedModelId) return false;

  return true;
}

export const ArtifactMessages = memo(PureArtifactMessages, areEqual);
