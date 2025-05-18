import 'server-only';

import { genSaltSync, hashSync } from 'bcrypt-ts';
import { and, asc, desc, eq, gt, gte, inArray, lt } from 'drizzle-orm';
import type { SQL } from 'drizzle-orm';
import { drizzle } from 'drizzle-orm/postgres-js';
import postgres from 'postgres';

import {
  user,
  chat,
  document,
  suggestion,
  message,
  vote,
  collection,
  chatCollection,
} from './schema';
import type { User, Suggestion, DBMessage, Chat } from './schema';
import type { ArtifactKind } from '@/components/artifact';
import { initPaprMemory } from '../ai/memory/index';

// Optionally, if not using email/pass login, you can
// use the Drizzle adapter for Auth.js / NextAuth
// https://authjs.dev/reference/adapter/drizzle

// biome-ignore lint: Forbidden non-null assertion.
const client = postgres(process.env.POSTGRES_URL!);
const db = drizzle(client);

export async function getUser(email: string): Promise<Array<User>> {
  try {
    return await db.select().from(user).where(eq(user.email, email));
  } catch (error) {
    console.error('Failed to get user from database');
    throw error;
  }
}

export async function createUser(email: string, password: string) {
  const salt = genSaltSync(10);
  const hash = hashSync(password, salt);

  try {
    // Create the user in the local database first
    const userResult = await db
      .insert(user)
      .values({ email, password: hash })
      .returning();

    // If we have a Papr Memory API key, create a user in Papr Memory
    const paprApiKey = process.env.PAPR_MEMORY_API_KEY;
    if (paprApiKey && userResult.length > 0) {
      try {
        const userId = userResult[0].id;
        console.log(
          `[Memory] Creating Papr Memory user for ${email} (App user ID: ${userId})`,
        );

        // Initialize the Papr SDK
        const API_BASE_URL =
          process.env.PAPR_MEMORY_API_URL ||
          'https://memoryserver-development.azurewebsites.net';
        const paprClient = initPaprMemory(paprApiKey, {
          baseURL: API_BASE_URL,
        });

        // Create a user in Papr Memory
        const testId = `v0chat-${Date.now()}`;
        const paprUserResponse = await paprClient.user.create({
          external_id: `v0chat-user-${userId}`,
          email: email,
          metadata: {
            source: 'v0chat',
            app_user_id: userId,
          },
        });

        // If successful, store the Papr user ID in our database
        if (paprUserResponse?.user_id) {
          const paprUserId = paprUserResponse.user_id;
          console.log(
            `[Memory] Created Papr Memory user with ID: ${paprUserId}`,
          );

          // Update the user record with the Papr user ID
          await db
            .update(user)
            .set({ paprUserId: paprUserId })
            .where(eq(user.id, userId));

          console.log(`[Memory] Updated local user record with Papr user ID`);
        } else {
          console.error(
            `[Memory] Failed to create Papr Memory user - no user_id in response`,
          );
        }
      } catch (paprError) {
        // Don't fail signup if Papr user creation fails - just log the error
        console.error('[Memory] Error creating Papr Memory user:', paprError);
      }
    }

    return userResult;
  } catch (error) {
    console.error('Failed to create user in database');
    throw error;
  }
}

export async function saveChat({
  id,
  userId,
  title,
}: {
  id: string;
  userId: string;
  title: string;
}) {
  try {
    return await db.insert(chat).values({
      id,
      createdAt: new Date(),
      userId,
      title,
    });
  } catch (error) {
    console.error('Failed to save chat in database');
    throw error;
  }
}

export async function deleteChatById({ id }: { id: string }) {
  try {
    await db.delete(vote).where(eq(vote.chatId, id));
    await db.delete(message).where(eq(message.chatId, id));

    return await db.delete(chat).where(eq(chat.id, id));
  } catch (error) {
    console.error('Failed to delete chat by id from database');
    throw error;
  }
}

export async function getChatsByUserId({
  id,
  limit,
  startingAfter,
  endingBefore,
}: {
  id: string;
  limit: number;
  startingAfter: string | null;
  endingBefore: string | null;
}) {
  try {
    const extendedLimit = limit + 1;

    const query = (whereCondition?: SQL<any>) =>
      db
        .select()
        .from(chat)
        .where(
          whereCondition
            ? and(whereCondition, eq(chat.userId, id))
            : eq(chat.userId, id),
        )
        .orderBy(desc(chat.createdAt))
        .limit(extendedLimit);

    let filteredChats: Array<Chat> = [];

    if (startingAfter) {
      const [selectedChat] = await db
        .select()
        .from(chat)
        .where(eq(chat.id, startingAfter))
        .limit(1);

      if (!selectedChat) {
        throw new Error(`Chat with id ${startingAfter} not found`);
      }

      filteredChats = await query(gt(chat.createdAt, selectedChat.createdAt));
    } else if (endingBefore) {
      const [selectedChat] = await db
        .select()
        .from(chat)
        .where(eq(chat.id, endingBefore))
        .limit(1);

      if (!selectedChat) {
        throw new Error(`Chat with id ${endingBefore} not found`);
      }

      filteredChats = await query(lt(chat.createdAt, selectedChat.createdAt));
    } else {
      filteredChats = await query();
    }

    const hasMore = filteredChats.length > limit;

    return {
      chats: hasMore ? filteredChats.slice(0, limit) : filteredChats,
      hasMore,
    };
  } catch (error) {
    console.error('Failed to get chats by user from database');
    throw error;
  }
}

export async function getChatById({ id }: { id: string }) {
  try {
    const [selectedChat] = await db.select().from(chat).where(eq(chat.id, id));
    return selectedChat;
  } catch (error) {
    console.error('Failed to get chat by id from database');
    throw error;
  }
}

export async function saveMessages({
  messages,
}: {
  messages: Array<DBMessage>;
}) {
  try {
    return await db.insert(message).values(messages);
  } catch (error) {
    console.error('Failed to save messages in database', error);
    throw error;
  }
}

export async function getMessagesByChatId({ id }: { id: string }) {
  try {
    return await db
      .select()
      .from(message)
      .where(eq(message.chatId, id))
      .orderBy(asc(message.createdAt));
  } catch (error) {
    console.error('Failed to get messages by chat id from database', error);
    throw error;
  }
}

export async function voteMessage({
  chatId,
  messageId,
  type,
}: {
  chatId: string;
  messageId: string;
  type: 'up' | 'down';
}) {
  try {
    const [existingVote] = await db
      .select()
      .from(vote)
      .where(and(eq(vote.messageId, messageId)));

    if (existingVote) {
      // Preserve the isSaved property when updating
      return await db
        .update(vote)
        .set({
          isUpvoted: type === 'up',
          // Preserve isSaved if it exists, otherwise default to false
          isSaved: existingVote.isSaved ?? false,
        })
        .where(and(eq(vote.messageId, messageId), eq(vote.chatId, chatId)));
    }
    return await db.insert(vote).values({
      chatId,
      messageId,
      isUpvoted: type === 'up',
      isSaved: false, // Default to false for new votes
    });
  } catch (error) {
    console.error('Failed to upvote message in database', error);
    throw error;
  }
}

export async function getVotesByChatId({ id }: { id: string }) {
  try {
    return await db.select().from(vote).where(eq(vote.chatId, id));
  } catch (error) {
    console.error('Failed to get votes by chat id from database', error);
    throw error;
  }
}

export async function saveDocument({
  id,
  title,
  kind,
  content,
  userId,
}: {
  id: string;
  title: string;
  kind: ArtifactKind;
  content: string;
  userId: string;
}) {
  try {
    return await db.insert(document).values({
      id,
      title,
      kind,
      content,
      userId,
      createdAt: new Date(),
    });
  } catch (error) {
    console.error('Failed to save document in database');
    throw error;
  }
}

export async function getDocumentsById({ id }: { id: string }) {
  try {
    const documents = await db
      .select()
      .from(document)
      .where(eq(document.id, id))
      .orderBy(asc(document.createdAt));

    return documents;
  } catch (error) {
    console.error('Failed to get document by id from database');
    throw error;
  }
}

export async function getDocumentById({ id }: { id: string }) {
  try {
    const [selectedDocument] = await db
      .select()
      .from(document)
      .where(eq(document.id, id))
      .orderBy(desc(document.createdAt));

    return selectedDocument;
  } catch (error) {
    console.error('Failed to get document by id from database');
    throw error;
  }
}

export async function deleteDocumentsByIdAfterTimestamp({
  id,
  timestamp,
}: {
  id: string;
  timestamp: Date;
}) {
  try {
    await db
      .delete(suggestion)
      .where(
        and(
          eq(suggestion.documentId, id),
          gt(suggestion.documentCreatedAt, timestamp),
        ),
      );

    return await db
      .delete(document)
      .where(and(eq(document.id, id), gt(document.createdAt, timestamp)));
  } catch (error) {
    console.error(
      'Failed to delete documents by id after timestamp from database',
    );
    throw error;
  }
}

export async function saveSuggestions({
  suggestions,
}: {
  suggestions: Array<Suggestion>;
}) {
  try {
    return await db.insert(suggestion).values(suggestions);
  } catch (error) {
    console.error('Failed to save suggestions in database');
    throw error;
  }
}

export async function getSuggestionsByDocumentId({
  documentId,
}: {
  documentId: string;
}) {
  try {
    return await db
      .select()
      .from(suggestion)
      .where(and(eq(suggestion.documentId, documentId)));
  } catch (error) {
    console.error(
      'Failed to get suggestions by document version from database',
    );
    throw error;
  }
}

export async function getMessageById({ id }: { id: string }) {
  try {
    return await db.select().from(message).where(eq(message.id, id));
  } catch (error) {
    console.error('Failed to get message by id from database');
    throw error;
  }
}

export async function deleteMessagesByChatIdAfterTimestamp({
  chatId,
  timestamp,
}: {
  chatId: string;
  timestamp: Date;
}) {
  try {
    const messagesToDelete = await db
      .select({ id: message.id })
      .from(message)
      .where(
        and(eq(message.chatId, chatId), gte(message.createdAt, timestamp)),
      );

    const messageIds = messagesToDelete.map((message) => message.id);

    if (messageIds.length > 0) {
      await db
        .delete(vote)
        .where(
          and(eq(vote.chatId, chatId), inArray(vote.messageId, messageIds)),
        );

      return await db
        .delete(message)
        .where(
          and(eq(message.chatId, chatId), inArray(message.id, messageIds)),
        );
    }
  } catch (error) {
    console.error(
      'Failed to delete messages by id after timestamp from database',
    );
    throw error;
  }
}

export async function updateChatVisiblityById({
  chatId,
  visibility,
}: {
  chatId: string;
  visibility: 'private' | 'public';
}) {
  try {
    return await db.update(chat).set({ visibility }).where(eq(chat.id, chatId));
  } catch (error) {
    console.error('Failed to update chat visibility in database');
    throw error;
  }
}

export async function getSavedMessagesByUserId({ userId }: { userId: string }) {
  try {
    return await db
      .select({
        messageId: vote.messageId,
        chatId: vote.chatId,
        savedAt: message.createdAt, // Use message creation date as a proxy for saved date
      })
      .from(vote)
      .innerJoin(message, eq(vote.messageId, message.id))
      .innerJoin(chat, eq(vote.chatId, chat.id))
      .where(and(eq(chat.userId, userId), eq(vote.isSaved, true)))
      .orderBy(desc(message.createdAt))
      .limit(100); // Limit to recent saved messages
  } catch (error) {
    console.error('Failed to get saved messages by user from database', error);
    throw error;
  }
}

export async function getSavedDocumentsByUserId({
  userId,
}: { userId: string }) {
  try {
    // For documents, we need a different approach as they're not stored in votes
    // Get only the most recent version of each document (by ID)
    // First get distinct document IDs
    const distinctDocumentIds = await db
      .selectDistinct({ id: document.id })
      .from(document)
      .where(eq(document.userId, userId))
      .limit(100);

    // If we have document IDs, get their latest versions
    if (distinctDocumentIds.length > 0) {
      const docs = [];

      for (const { id } of distinctDocumentIds) {
        const [latestDoc] = await db
          .select({
            id: document.id,
            title: document.title,
            kind: document.kind,
            createdAt: document.createdAt,
          })
          .from(document)
          .where(and(eq(document.id, id), eq(document.userId, userId)))
          .orderBy(desc(document.createdAt))
          .limit(1);

        if (latestDoc) {
          docs.push(latestDoc);
        }
      }

      // Sort by creation date, newest first
      return docs.sort(
        (a, b) =>
          new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime(),
      );
    }

    return [];
  } catch (error) {
    console.error('Failed to get saved documents by user from database', error);
    throw error;
  }
}

export async function getAllSavedItemsByUserId({ userId }: { userId: string }) {
  try {
    // Get both saved messages and documents
    const [savedMessages, savedDocuments] = await Promise.all([
      getSavedMessagesByUserId({ userId }),
      getSavedDocumentsByUserId({ userId }),
    ]);

    return {
      messages: savedMessages,
      documents: savedDocuments,
    };
  } catch (error) {
    console.error('Failed to get all saved items by user from database', error);
    throw error;
  }
}

// Collection functions
export async function getCollectionsByUserId({ userId }: { userId: string }) {
  try {
    return await db
      .select()
      .from(collection)
      .where(eq(collection.userId, userId));
  } catch (error) {
    console.error('Failed to get collections by user from database');
    throw error;
  }
}

export async function createCollection({
  title,
  description,
  userId,
  isSystem = false,
  systemType = null,
}: {
  title: string;
  description?: string;
  userId: string;
  isSystem?: boolean;
  systemType?: string | null;
}) {
  try {
    const result = await db
      .insert(collection)
      .values({
        title,
        description,
        userId,
        createdAt: new Date(),
        updatedAt: new Date(),
        isSystem,
        systemType,
      })
      .returning();

    return result[0];
  } catch (error) {
    console.error('Failed to create collection in database');
    throw error;
  }
}

export async function getOrCreateSavedChatsCollection({
  userId,
}: { userId: string }) {
  try {
    // Try to find existing Saved Chats collection
    const savedChatsCollections = await db
      .select()
      .from(collection)
      .where(
        and(
          eq(collection.userId, userId),
          eq(collection.isSystem, true),
          eq(collection.systemType, 'saved_chats'),
        ),
      );

    // If it exists, return it
    if (savedChatsCollections.length > 0) {
      return savedChatsCollections[0];
    }

    // Otherwise create it
    return await createCollection({
      title: 'Saved Chats',
      description: 'Chats you have explicitly saved for later reference',
      userId,
      isSystem: true,
      systemType: 'saved_chats',
    });
  } catch (error) {
    console.error('Failed to get or create saved chats collection');
    throw error;
  }
}

export async function addChatToCollection({
  chatId,
  collectionId,
}: {
  chatId: string;
  collectionId: string;
}) {
  try {
    // Check if association already exists
    const existing = await db
      .select()
      .from(chatCollection)
      .where(
        and(
          eq(chatCollection.chatId, chatId),
          eq(chatCollection.collectionId, collectionId),
        ),
      );

    if (existing.length === 0) {
      // Add new association
      return await db
        .insert(chatCollection)
        .values({
          chatId,
          collectionId,
          addedAt: new Date(),
        })
        .returning();
    }

    return existing;
  } catch (error) {
    console.error('Failed to add chat to collection');
    throw error;
  }
}

export async function removeChatFromCollection({
  chatId,
  collectionId,
}: {
  chatId: string;
  collectionId: string;
}) {
  try {
    return await db
      .delete(chatCollection)
      .where(
        and(
          eq(chatCollection.chatId, chatId),
          eq(chatCollection.collectionId, collectionId),
        ),
      );
  } catch (error) {
    console.error('Failed to remove chat from collection');
    throw error;
  }
}

export async function getCollectionChats({
  collectionId,
}: { collectionId: string }) {
  try {
    // Get all chats in this collection
    const result = await db
      .select({
        chat: chat,
        chatCollection: chatCollection,
      })
      .from(chatCollection)
      .innerJoin(chat, eq(chatCollection.chatId, chat.id))
      .where(eq(chatCollection.collectionId, collectionId));

    return result.map((row) => row.chat);
  } catch (error) {
    console.error('Failed to get collection chats');
    throw error;
  }
}

export async function getUncategorizedChats({ userId }: { userId: string }) {
  try {
    // Get all chats by user
    const allChats = await db
      .select()
      .from(chat)
      .where(eq(chat.userId, userId));

    // Get all chat IDs that are in any collection
    const categorizedChatIds = await db
      .select({ chatId: chatCollection.chatId })
      .from(chatCollection)
      .innerJoin(collection, eq(chatCollection.collectionId, collection.id))
      .where(eq(collection.userId, userId));

    const categorizedChatIdSet = new Set(
      categorizedChatIds.map((row) => row.chatId),
    );

    // Return only uncategorized chats
    return allChats.filter((chat) => !categorizedChatIdSet.has(chat.id));
  } catch (error) {
    console.error('Failed to get uncategorized chats');
    throw error;
  }
}
