import { cookies } from 'next/headers';
import { notFound } from 'next/navigation';
import { auth } from '@/app/(auth)/auth';
import { Chat } from '@/components/chat';
import { getChatById, getMessagesByChatId } from '@/lib/db/queries';
import { DataStreamHandler } from '@/components/data-stream-handler';
import { DEFAULT_CHAT_MODEL } from '@/lib/ai/models';
import type { DBMessage } from '@/lib/db/schema';
import type { Attachment, UIMessage } from 'ai';
import { ChatBreadcrumb } from '@/components/chat-breadcrumb';

type PageProps = {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ documentId?: string }>;
};

export default async function Page({ params, searchParams }: PageProps) {
  const resolvedParams = await params;
  const { id } = resolvedParams;
  const resolvedSearchParams = await searchParams;
  const { documentId } = resolvedSearchParams;
  const chat = await getChatById({ id });

  if (!chat) {
    notFound();
  }

  const session = await auth();

  if (chat.visibility === 'private') {
    if (!session || !session.user) {
      return notFound();
    }

    if (session.user.id !== chat.userId) {
      return notFound();
    }
  }

  const messagesFromDb = await getMessagesByChatId({
    id,
  });

  function convertToUIMessages(messages: Array<DBMessage>): Array<UIMessage> {
    return messages.map((message) => {
      // Ensure parts are properly formatted
      let parts = message.parts as Array<any>;

      // Handle old messages with content instead of parts
      if (!parts || !Array.isArray(parts) || parts.length === 0) {
        try {
          // For older messages, try to convert content to parts
          const content = (message as any).content;
          if (content) {
            if (typeof content === 'string') {
              parts = [{ type: 'text', text: content }];
            } else if (typeof content === 'object') {
              // Legacy format
              if ('text' in content) {
                parts = [{ type: 'text', text: content.text }];
              } else {
                console.error('Unknown content format:', content);
                parts = [{ type: 'text', text: JSON.stringify(content) }];
              }
            }
          } else {
            parts = [];
          }
        } catch (error) {
          console.error('Error converting message content to parts:', error);
          parts = [];
        }
      }

      return {
        id: message.id,
        parts,
        role: message.role as UIMessage['role'],
        content: '',
        createdAt: message.createdAt,
        experimental_attachments:
          (message.attachments as Array<Attachment>) ?? [],
        tool_calls: message.tool_calls as any,
        memories: message.memories as any, // Include memories from the message
        modelId: message.modelId, // Include model ID
      };
    });
  }

  const cookieStore = await cookies();
  const chatModelFromCookie = cookieStore.get('chat-model');

  return (
    <>
      <ChatBreadcrumb title={chat.title || `Chat ${id.substring(0, 8)}...`} chatId={id} />
      
      {!chatModelFromCookie ? (
        <>
          <Chat
            id={chat.id}
            initialMessages={convertToUIMessages(messagesFromDb)}
            selectedChatModel={DEFAULT_CHAT_MODEL}
            selectedVisibilityType={chat.visibility}
            isReadonly={session?.user?.id !== chat.userId}
            documentId={documentId}
          />
          <DataStreamHandler id={id} />
        </>
      ) : (
        <>
          <Chat
            id={chat.id}
            initialMessages={convertToUIMessages(messagesFromDb)}
            selectedChatModel={chatModelFromCookie.value}
            selectedVisibilityType={chat.visibility}
            isReadonly={session?.user?.id !== chat.userId}
            documentId={documentId}
          />
          <DataStreamHandler id={id} />
        </>
      )}
    </>
  );
}
