import { config } from 'dotenv';
import postgres from 'postgres';
import {
  chat,
  message,
  messageDeprecated,
  vote,
  voteDeprecated,
} from '../schema';
import { drizzle } from 'drizzle-orm/postgres-js';
import { inArray } from 'drizzle-orm';
import { UIMessage } from 'ai';
import type { ExtendedUIMessage } from '@/lib/types';

config({
  path: '.env.local',
});

if (!process.env.POSTGRES_URL) {
  throw new Error('POSTGRES_URL environment variable is not set');
}

const client = postgres(process.env.POSTGRES_URL);
const db = drizzle(client);

const BATCH_SIZE = 50; // Process 10 chats at a time
const INSERT_BATCH_SIZE = 100; // Insert 100 messages at a time

// Helper function to extract text content from UIMessage (AI SDK 5.0 format only)
function extractTextFromMessage(message: ExtendedUIMessage): string {
  if ('parts' in message && Array.isArray(message.parts)) {
    // AI SDK 5.0 format with parts array
    return message.parts
      .filter(part => part.type === 'text')
      .map(part => (part as any).text)
      .join(' ');
  }
  return '';
}

type NewMessageInsert = {
  id: string;
  chatId: string;
  parts: any[];
  role: string;
  attachments: any[];
  createdAt: Date;
};

type NewVoteInsert = {
  messageId: string;
  chatId: string;
  isUpvoted: boolean;
};

async function createNewTable() {
  const chats = await db.select().from(chat);
  let processedCount = 0;

  // Process chats in batches
  for (let i = 0; i < chats.length; i += BATCH_SIZE) {
    const chatBatch = chats.slice(i, i + BATCH_SIZE);
    const chatIds = chatBatch.map((chat) => chat.id);

    // Fetch all messages and votes for the current batch of chats in bulk
    const allMessages = await db
      .select()
      .from(messageDeprecated)
      .where(inArray(messageDeprecated.chatId, chatIds));

    const allVotes = await db
      .select()
      .from(voteDeprecated)
      .where(inArray(voteDeprecated.chatId, chatIds));

    // Prepare batches for insertion
    const newMessagesToInsert: NewMessageInsert[] = [];
    const newVotesToInsert: NewVoteInsert[] = [];

    // Process each chat in the batch
    for (const chat of chatBatch) {
      processedCount++;
      console.info(`Processed ${processedCount}/${chats.length} chats`);

      // Filter messages and votes for this specific chat
      const messages = allMessages.filter((msg) => msg.chatId === chat.id);
      const votes = allVotes.filter((v) => v.chatId === chat.id);

      // Group messages into sections
      const messageSection: Array<UIMessage> = [];
      const messageSections: Array<Array<UIMessage>> = [];

      for (const message of messages) {
        const { role } = message;

        if (role === 'user' && messageSection.length > 0) {
          messageSections.push([...messageSection]);
          messageSection.length = 0;
        }

        // @ts-expect-error message.content has different type
        messageSection.push(message);
      }

      if (messageSection.length > 0) {
        messageSections.push([...messageSection]);
      }

      // Process each message section
      for (const section of messageSections) {
        const [userMessage, ...assistantMessages] = section;

        const [firstAssistantMessage] = assistantMessages;

        try {
          // Manually construct UI messages since appendResponseMessages is not available in AI SDK 5.0
          const uiSection: ExtendedUIMessage[] = [
            userMessage as ExtendedUIMessage,
            ...assistantMessages.map(msg => ({
              ...msg,
              createdAt: (msg as any).createdAt ?? new Date(),
            } as ExtendedUIMessage))
          ];

          const projectedUISection = uiSection
            .map((message: ExtendedUIMessage) => {
              if (message.role === 'user') {
                const textContent = extractTextFromMessage(message);
                return {
                  id: message.id,
                  chatId: chat.id,
                  parts: [{ type: 'text', text: textContent }],
                  role: message.role,
                  createdAt: message.createdAt,
                  attachments: [],
                } as NewMessageInsert;
              } else if (message.role === 'assistant') {
                return {
                  id: message.id,
                  chatId: chat.id,
                  parts: message.parts || [],
                  role: message.role,
                  createdAt: message.createdAt,
                  attachments: [],
                } as NewMessageInsert;
              }
              return null;
            })
            .filter((msg: NewMessageInsert | null): msg is NewMessageInsert => msg !== null);

          // Add messages to batch
          for (const msg of projectedUISection) {
            newMessagesToInsert.push(msg);

            if (msg.role === 'assistant') {
              const voteByMessage = votes.find((v) => v.messageId === msg.id);
              if (voteByMessage) {
                newVotesToInsert.push({
                  messageId: msg.id,
                  chatId: msg.chatId,
                  isUpvoted: voteByMessage.isUpvoted,
                });
              }
            }
          }
        } catch (error) {
          console.error(`Error processing chat ${chat.id}: ${error}`);
        }
      }
    }

    // Batch insert messages
    for (let j = 0; j < newMessagesToInsert.length; j += INSERT_BATCH_SIZE) {
      const messageBatch = newMessagesToInsert.slice(j, j + INSERT_BATCH_SIZE);
      if (messageBatch.length > 0) {
        // Ensure all required fields are present
        const validMessageBatch = messageBatch.map((msg) => ({
          id: msg.id,
          chatId: msg.chatId,
          parts: msg.parts,
          role: msg.role,
          attachments: msg.attachments,
          createdAt: msg.createdAt,
        }));

        await db.insert(message).values(validMessageBatch);
      }
    }

    // Batch insert votes
    for (let j = 0; j < newVotesToInsert.length; j += INSERT_BATCH_SIZE) {
      const voteBatch = newVotesToInsert.slice(j, j + INSERT_BATCH_SIZE);
      if (voteBatch.length > 0) {
        await db.insert(vote).values(voteBatch);
      }
    }
  }

  console.info(`Migration completed: ${processedCount} chats processed`);
}

createNewTable()
  .then(() => {
    console.info('Script completed successfully');
    process.exit(0);
  })
  .catch((error) => {
    console.error('Script failed:', error);
    process.exit(1);
  });
