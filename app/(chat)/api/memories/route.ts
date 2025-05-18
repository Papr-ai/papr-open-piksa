import { auth } from '@/app/(auth)/auth';
import {
  getAllSavedItemsByUserId,
  getSavedDocumentsByUserId,
  getSavedMessagesByUserId,
  getChatById,
  getMessageById,
  getMessagesByChatId,
  getChatsByUserId,
} from '@/lib/db/queries';

type SavedItemResult =
  | Awaited<ReturnType<typeof getAllSavedItemsByUserId>>
  | Awaited<ReturnType<typeof getSavedMessagesByUserId>>
  | Awaited<ReturnType<typeof getSavedDocumentsByUserId>>;

// Define types for the chat cache
interface ChatCacheEntry {
  chat: any;
  messages: any[];
}

// Helper function to find chat for a document
async function findChatForDocument(
  documentId: string,
  userId: string,
  chatCache: Map<string, ChatCacheEntry>,
) {
  // Nothing to do with the cache passed in except check its size and possibly add to it
  if (chatCache.size === 0) {
    const { chats } = await getChatsByUserId({
      id: userId,
      limit: 50,
      startingAfter: null,
      endingBefore: null,
    });

    // Load all messages for these chats and cache them
    for (const chat of chats) {
      const messages = await getMessagesByChatId({ id: chat.id });
      chatCache.set(chat.id, { chat, messages });
    }
  }

  // Now look through the cached chats/messages for this document ID
  for (const [chatId, { chat, messages }] of chatCache.entries()) {
    // Look for messages that contain this document ID
    for (const msg of messages) {
      if (msg.parts && typeof msg.parts === 'object') {
        const parts = Array.isArray(msg.parts) ? msg.parts : [msg.parts];

        for (const part of parts) {
          if (
            part.type === 'tool-invocation' &&
            part.toolInvocation &&
            (part.toolInvocation.toolName === 'createDocument' ||
              part.toolInvocation.toolName === 'updateDocument') &&
            part.toolInvocation.state === 'result' &&
            part.toolInvocation.result &&
            part.toolInvocation.result.id === documentId
          ) {
            return chatId;
          }
        }
      }
    }
  }

  return null;
}

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const type = searchParams.get('type') || 'all'; // 'all', 'messages', 'documents'

  const session = await auth();

  if (!session || !session.user || !session.user.id) {
    return new Response('Unauthorized', { status: 401 });
  }

  const userId = session.user.id;

  try {
    let result: SavedItemResult;
    // Create a cache for chat messages to avoid redundant queries
    const chatCache = new Map<string, ChatCacheEntry>();

    switch (type) {
      case 'messages':
        result = await getSavedMessagesByUserId({ userId });
        break;
      case 'documents':
        result = await getSavedDocumentsByUserId({ userId });

        // For each document, try to find a chat that references it
        if (Array.isArray(result)) {
          const enhancedDocuments = await Promise.all(
            result.map(async (doc) => {
              const chatId = await findChatForDocument(
                doc.id,
                userId,
                chatCache,
              );

              return {
                ...doc,
                chatId: chatId || null,
              };
            }),
          );

          result = enhancedDocuments;
        }
        break;
      case 'all':
      default:
        result = await getAllSavedItemsByUserId({ userId });

        // Enhance messages with chat titles
        if ('messages' in result && result.messages.length > 0) {
          const enhancedMessages = await Promise.all(
            result.messages.map(async (msg) => {
              const chat = await getChatById({ id: msg.chatId });
              const [messageContent] = await getMessageById({
                id: msg.messageId,
              });

              // Get message preview safely
              let preview = 'No content';
              if (
                messageContent &&
                typeof messageContent.parts === 'object' &&
                messageContent.parts !== null
              ) {
                const content = JSON.stringify(messageContent.parts);
                preview = `${content.substring(0, 50)}...`;
              }

              return {
                ...msg,
                chatTitle: chat?.title || 'Untitled Chat',
                messagePreview: preview,
              };
            }),
          );
          result.messages = enhancedMessages;
        }

        // Enhance documents with chat references
        if ('documents' in result && result.documents.length > 0) {
          const enhancedDocuments = await Promise.all(
            result.documents.map(async (doc) => {
              const chatId = await findChatForDocument(
                doc.id,
                userId,
                chatCache,
              );

              return {
                ...doc,
                chatId: chatId || null,
              };
            }),
          );

          result.documents = enhancedDocuments;
        }
        break;
    }

    return Response.json(result, { status: 200 });
  } catch (error) {
    console.error('Error fetching saved memories:', error);
    return new Response('Internal Server Error', { status: 500 });
  }
}
