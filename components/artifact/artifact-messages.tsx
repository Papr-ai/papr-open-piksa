import { PreviewMessage, ThinkingMessage } from '../message/message';
import { useScrollToBottom } from '../common/use-scroll-to-bottom';
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

  // Logic for showing thinking state - same as main Messages component
  const isReasoningModel = selectedModelId ? modelSupportsReasoning(selectedModelId) : false;

  // Check if there's visible content in the last message
  const hasVisibleContent = messages.length > 0 && messages[messages.length - 1].role === 'assistant' && (
    extractTextFromMessage(messages[messages.length - 1]).trim() ||
    messages[messages.length - 1].parts?.some(part => part.type === 'text' && (part as any).text?.trim()) ||
    (messages[messages.length - 1] as any).toolInvocations?.some((t: any) => t.state === 'result') ||
    (messages[messages.length - 1] as any).tool_calls?.some((tc: any) => tc.function?.output)
  );

  // Determine if we should show the thinking state
  const shouldShowThinking = 
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

  const isLoading = status === 'streaming' || status === 'submitted';

  return (
    <div
      ref={messagesContainerRef}
      className="flex flex-col size-full gap-4 items-center overflow-y-scroll px-4 pt-20"
    >
      <div className="w-[95%] flex flex-col items-center">
        {messages.map((message, index) => {
          // For the last assistant message during streaming
          const isLastAssistantMessage = 
            status === 'streaming' && 
            index === messages.length - 1 && 
            message.role === 'assistant';
          
          // Keep showing the thinking indicator alongside empty assistant messages
          if (isLastAssistantMessage && !hasVisibleContent) {
            return (
              <div key={message.id}>
                <ThinkingMessage selectedModelId={selectedModelId} />
              </div>
            );
          }

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
