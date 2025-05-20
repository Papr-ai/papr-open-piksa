import { cookies } from 'next/headers';
import { notFound } from 'next/navigation';

import { auth } from '@/app/(auth)/auth';
import { Chat } from '@/components/chat';
import { getChatById, getMessagesByChatId } from '@/lib/db/queries';
import { DataStreamHandler } from '@/components/data-stream-handler';
import { DEFAULT_CHAT_MODEL } from '@/lib/ai/models';
import type { DBMessage } from '@/lib/db/schema';
import type { Attachment, UIMessage } from 'ai';

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
      const parts = Array.isArray(message.parts)
        ? message.parts.map((part) => {
            if (message.role === 'user') {
              // For user messages, ensure each part is a TextUIPart
              if (typeof part === 'string') {
                return { type: 'text', text: part };
              } else if (typeof part === 'object' && 'text' in part) {
                return { type: 'text', text: part.text };
              } else if (
                typeof part === 'object' &&
                'type' in part &&
                part.type === 'text'
              ) {
                return part;
              }
              // Default case - convert to string and wrap in TextUIPart
              return { type: 'text', text: String(part) };
            }
            // For assistant messages, preserve the part as is if it's properly formatted
            if (typeof part === 'object' && 'type' in part) {
              return part;
            }
            // Default case for assistant messages
            return { type: 'text', text: String(part) };
          })
        : [{ type: 'text', text: '' }];

      return {
        id: message.id,
        parts,
        role: message.role as UIMessage['role'],
        content: '',
        createdAt: message.createdAt,
        experimental_attachments:
          (message.attachments as Array<Attachment>) ?? [],
      };
    });
  }

  const cookieStore = await cookies();
  const chatModelFromCookie = cookieStore.get('chat-model');

  if (!chatModelFromCookie) {
    return (
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
    );
  }

  return (
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
  );
}
