import { cookies } from 'next/headers';
import { Chat } from '@/components/message/chat';
import { DEFAULT_CHAT_MODEL } from '@/lib/ai/models';
import { generateUUID } from '@/lib/utils';
import { DataStreamHandler } from '@/components/message/data-stream-handler';
import { ChatBreadcrumb } from '@/components/chat/chat-breadcrumb';
import { UseCasesSection } from '@/components/use-cases-section';

export default async function Page() {
  const id = generateUUID();

  const cookieStore = await cookies();
  const modelIdFromCookie = cookieStore.get('chat-model');

  return (
    <>
      <ChatBreadcrumb title="New Chat" chatId={id} />
      
      {!modelIdFromCookie ? (
        <>
          <Chat
            key={id}
            id={id}
            initialMessages={[]}
            selectedChatModel={DEFAULT_CHAT_MODEL}
            selectedVisibilityType="private"
            isReadonly={false}
          />
          <DataStreamHandler id={id} />
        </>
      ) : (
        <>
          <Chat
            key={id}
            id={id}
            initialMessages={[]}
            selectedChatModel={modelIdFromCookie.value}
            selectedVisibilityType="private"
            isReadonly={false}
          />
          <DataStreamHandler id={id} />
        </>
      )}
          </>
  );
}
