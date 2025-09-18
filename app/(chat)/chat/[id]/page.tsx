import { cookies } from 'next/headers';
import { notFound, redirect } from 'next/navigation';
import { auth } from '@/app/(auth)/auth';
import { Chat } from '@/components/message/chat';
import { getChatById, getMessagesByChatId, getUser } from '@/lib/db/queries';
import { DEFAULT_CHAT_MODEL } from '@/lib/ai/models';
import type { DBMessage } from '@/lib/db/schema';
import type { FileUIPart, UIMessage } from 'ai';
import { ChatBreadcrumb } from '@/components/chat/chat-breadcrumb';

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

  // If chat doesn't exist, we'll create it when the first message is sent
  // This allows for new chats to be created by navigating to /chat/[new-uuid]
  if (!chat) {
    // For new chats, we'll use default values
    const defaultChat = {
      id,
      title: 'New Chat',
      visibility: 'private' as const,
      userId: null, // Will be set when first message is sent
    };
    
    const session = await auth();
    
    if (!session?.user?.email) {
      redirect('/login');
    }

    const [dbUser] = await getUser(session.user.email);
    
    if (!dbUser) {
      redirect('/login');
    }

    // Check if onboarding is completed
    if (!dbUser.onboardingCompleted) {
      redirect('/onboarding');
    }

    // Render chat with empty messages for new chat
    const selectedModel = DEFAULT_CHAT_MODEL;
    
    return (
      <>
        <ChatBreadcrumb title="New Chat" chatId={id} />
        <Chat
          id={id}
          initialMessages={[]}
          selectedChatModel={selectedModel}
          selectedVisibilityType="private"
          isReadonly={false}
          documentId={undefined}
        />
      </>
    );
  }

  const session = await auth();
  
  // Check authentication and onboarding status for private chats
  if (chat.visibility === 'private') {
    if (!session?.user?.email) {
      redirect('/login');
    }

    const [dbUser] = await getUser(session.user.email);
    
    if (!dbUser) {
      redirect('/login');
    }

    // Check if onboarding is completed
    if (!dbUser.onboardingCompleted) {
      redirect('/onboarding');
    }
  }

  // Additional authorization check for private chats
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
        attachments:
          (message.attachments as Array<FileUIPart>) ?? [],
        tool_calls: message.tool_calls as any,
        memories: message.memories as any, // Include memories from the message
        sources: message.sources as any, // Include sources from the message
        modelId: message.modelId, // Include model ID
      };
    });
  }

  const cookieStore = await cookies();
  const chatModelFromCookie = cookieStore.get('chat-model');

  const selectedModel = chatModelFromCookie?.value || DEFAULT_CHAT_MODEL;

  return (
    <>
      <ChatBreadcrumb title={chat.title || `Chat ${id.substring(0, 8)}...`} chatId={id} />
      <Chat
        id={chat.id}
        initialMessages={convertToUIMessages(messagesFromDb)}
        selectedChatModel={selectedModel}
        selectedVisibilityType={chat.visibility}
        isReadonly={session?.user?.id !== chat.userId}
        documentId={documentId}
      />
    </>
  );
}
