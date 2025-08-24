'use server';

import { generateText, tool } from 'ai';
import { z } from 'zod';
import { google } from '@ai-sdk/google';
import {
  getUncategorizedChats,
  getCollectionsByUserId,
  createCollection,
  addChatToCollection,
  getCollectionChats,
  getOrCreateSavedChatsCollection,
} from '@/lib/db/queries';

// Schema for chat collection categorization
const chatCollectionSchema = z.object({
  existingCollections: z
    .array(
      z.object({
        collectionId: z.string().describe('ID of the existing collection'),
        chatIds: z
          .array(z.string())
          .describe('Chat IDs to add to this collection'),
      }),
    )
    .describe('Chats that should be added to existing collections'),
  newCollections: z
    .array(
      z.object({
        title: z
          .string()
          .max(50)
          .describe('Short, compelling title (max 3 words)'),
        description: z
          .string()
          .max(200)
          .describe('Brief one-sentence description'),
        chatIds: z.array(z.string()).describe('Chat IDs for this collection'),
      }),
    )
    .describe(
      "New collections to create for chats that don't fit existing collections",
    ),
});

export type ChatCategorization = z.infer<typeof chatCollectionSchema>;

// Define the tool with execute function  
const categorizeTool = tool({
  description: 'Categorize chats into collections',
  parameters: chatCollectionSchema,
  execute: async (args: any) => args,
} as any);

// Interface for collection results
export interface Collection {
  id: string;
  title: string;
  description: string;
  chatIds: string[];
  isSystem?: boolean;
  systemType?: string | null;
}

// Function to categorize uncategorized chats and save them
export async function categorizeAndSaveChats(userId: string): Promise<void> {
  try {
    // Get existing collections from the database
    const dbCollections = await getCollectionsByUserId({ userId });

    // Get only uncategorized chats that need analysis
    const uncategorizedChats = await getUncategorizedChats({ userId });

    if (uncategorizedChats.length === 0) {
      // No uncategorized chats to process
      return;
    }

    // Format existing collections for the AI model with complete information
    const existingCollections = await Promise.all(
      dbCollections.map(async (col) => {
        const chats = await getCollectionChats({ collectionId: col.id });
        return {
          id: col.id,
          title: col.title,
          description: col.description || '',
          chatIds: chats.map((c) => c.id),
        };
      }),
    );

    // Format uncategorized chats for the AI model
    const chatData = uncategorizedChats.map((chat) => ({
      id: chat.id,
      title: chat.title,
      createdAt: chat.createdAt.toISOString(),
    }));

    // Call the AI model to categorize chats
    const { toolResults } = await generateText({
      model: google('gemini-2.0-flash'),
      maxOutputTokens: 1000, // Reasonable limit for categorization task
      messages: [
        {
          role: 'system',
          content: `You are an expert at organizing chat conversations into logical collections.
          Analyze the given chat titles and organize them into meaningful collections.
          If a chat fits an existing collection, add it there. If chats don't fit existing collections, create new ones.
          Keep new collection titles short (max 3 words), and keep descriptions concise (one sentence).
          Don't use catch-all titles like 'Misc' or titles with one or two letters.
          Don't create new collections with the same title as existing collections.
          Return your analysis as a JSON object matching the schema provided.`,
        },
        {
          role: 'user',
          content: `
          Chats to organize: ${JSON.stringify(chatData)}
          Existing collections: ${JSON.stringify(existingCollections.map(col => ({
            collectionId: col.id,
            title: col.title,
            description: col.description
          })))}
          `,
        },
      ],
      tools: {
        categorizeChats: categorizeTool,
      },
      toolChoice: 'required',
    });

    if (!toolResults || toolResults.length === 0) {
      throw new Error('No tool results returned');
    }

    const result = toolResults.find(
      (result) => result.toolName === 'categorizeChats',
    );

    if (!result) {
      throw new Error('Failed to categorize chats');
    }

    // Access the tool result - in AI SDK 5.0
    const categorization = (result as any).args as ChatCategorization;

    // Save categorization results to the database

    // Update existing collections
    for (const collection of categorization.existingCollections) {
      for (const chatId of collection.chatIds) {
        await addChatToCollection({
          chatId,
          collectionId: collection.collectionId,
        });
      }
    }

    // Create new collections
    for (const newCol of categorization.newCollections) {
      // Create the collection in the database
      const dbCollection = await createCollection({
        title: newCol.title,
        description: newCol.description,
        userId,
      });

      // Add chats to the new collection
      for (const chatId of newCol.chatIds) {
        await addChatToCollection({
          chatId,
          collectionId: dbCollection.id,
        });
      }
    }
  } catch (error) {
    console.error('Error in categorizeAndSaveChats:', error);
    throw error;
  }
}

// Function to get all collections including the special Saved Chats collection
export async function getAllCollections(userId: string): Promise<Collection[]> {
  try {
    // Get saved chats collection (create if doesn't exist)
    const savedChatsCollection = await getOrCreateSavedChatsCollection({
      userId,
    });

    // Get all other collections
    const userCollections = await getCollectionsByUserId({ userId });

    // Format all collections with their chats
    const formattedCollections = await Promise.all(
      userCollections.map(async (col) => {
        const chats = await getCollectionChats({ collectionId: col.id });
        return {
          id: col.id,
          title: col.title,
          description: col.description || '',
          chatIds: chats.map((c) => c.id),
          isSystem: col.isSystem,
          systemType: col.systemType,
        };
      }),
    );

    // Ensure we have the latest data for saved chats collection
    const savedChatsChats = await getCollectionChats({
      collectionId: savedChatsCollection.id,
    });

    // If the saved chats collection isn't in the result yet, add it
    if (!formattedCollections.some((c) => c.id === savedChatsCollection.id)) {
      formattedCollections.unshift({
        id: savedChatsCollection.id,
        title: savedChatsCollection.title,
        description:
          savedChatsCollection.description || 'Chats you have explicitly saved',
        chatIds: savedChatsChats.map((c) => c.id),
        isSystem: true,
        systemType: 'saved_chats',
      });
    }

    return formattedCollections;
  } catch (error) {
    console.error('Error fetching collections:', error);
    throw error;
  }
}
