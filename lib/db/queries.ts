'use server';

import { genSaltSync, hashSync } from 'bcrypt-ts';
import { and, asc, desc, eq, gt, gte, inArray, lt, sql } from 'drizzle-orm';
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
  messageMemory,
} from './schema';
import type { User, Suggestion, DBMessage, Chat } from './schema';
import type { ArtifactKind } from '@/components/artifact/artifact';
// Update imports to get Papr namespace
import { initPaprMemory } from '../ai/memory/index';
import Papr from '@papr/memory';

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

export async function getUserById(id: string): Promise<User | null> {
  try {
    const users = await db.select().from(user).where(eq(user.id, id));
    return users.length > 0 ? users[0] : null;
  } catch (error) {
    console.error('Failed to get user by ID from database');
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
      .values({ email, password: hash, onboardingCompleted: false })
      .returning();

    // If we have a Papr Memory API key, create a user in Papr Memory
    const paprApiKey = process.env.PAPR_MEMORY_API_KEY;
    if (paprApiKey && userResult.length > 0) {
      try {
        const userId = userResult[0].id;
        console.log(
          `[Memory] Creating Papr Memory user for ${email} (App user ID: ${userId})`,
        );

        // Use createMemoryService instead of directly initializing a client
        const { createMemoryService } = await import('@/lib/ai/memory/service');
        
        // For user creation, we still need direct API access since the memory service
        // doesn't expose user-related methods
        const { initPaprMemory } = await import('@/lib/ai/memory');
        const API_BASE_URL = process.env.PAPR_MEMORY_API_URL || 'https://memory.papr.ai';
        const paprClient = initPaprMemory(paprApiKey, {
          baseURL: API_BASE_URL,
        });

        let paprUserId = null;

        try {
          // Try to create a user in Papr Memory
          const paprUserResponse = await paprClient.user.create({
            external_id: `PaprChat-user-${userId}`,
            email: email,
            metadata: {
              source: 'PaprChat',
              app_user_id: userId,
            },
          });

          // If successful, store the Papr user ID in our database
          if (paprUserResponse && paprUserResponse.user_id) {
            paprUserId = paprUserResponse.user_id;
            console.log(
              `[Memory] Created Papr Memory user with ID: ${paprUserId}`,
            );
          } else {
            console.error(
              `[Memory] Failed to create Papr Memory user - no user_id in response`,
            );
          }
        } catch (createError: any) {
          console.log(`[Memory] User creation failed:`, createError);
          
          // Check if this is a 409 "User already exists" error
          if (createError.status === 409) {
            console.log(`[Memory] User already exists in Papr Memory with email: ${email}`);
            console.log(`[Memory] Attempting to create with different external_id to work around existing user`);
            
            // Try with a timestamp-based external_id to avoid conflicts
            const timestamp = Date.now();
            const alternativeExternalId = `PaprChat-user-${userId}-${timestamp}`;
            
            try {
              const alternativeUserResponse = await paprClient.user.create({
                external_id: alternativeExternalId,
                email: `${timestamp}-${email}`, // Use a different email to avoid conflict
                metadata: {
                  source: 'PaprChat-Alternative',
                  app_user_id: userId,
                  original_email: email,
                  note: 'Created with alternative ID due to existing user conflict'
                },
              });
              
              if (alternativeUserResponse?.user_id) {
                paprUserId = alternativeUserResponse.user_id;
                console.log(`[Memory] Created alternative Papr Memory user with ID: ${paprUserId}`);
              } else {
                console.error(`[Memory] Failed to create alternative Papr Memory user`);
              }
            } catch (alternativeError) {
              console.error(`[Memory] Failed to create alternative user:`, alternativeError);
            }
          } else {
            // Re-throw non-409 errors
            throw createError;
          }
        }

        if (paprUserId) {
          // Update the user record with the Papr user ID
          await db
            .update(user)
            .set({ paprUserId: paprUserId })
            .where(eq(user.id, userId));

          console.log(`[Memory] Updated local user record with Papr user ID`);
        }
      } catch (paprError) {
        // Don't fail signup if Papr user creation fails - just log the error
        console.error('[Memory] Error creating Papr Memory user:', paprError);
      }
    }

    return userResult;
  } catch (error) {
    console.error('Failed to create user in database:', error);
    console.error('Error details:', {
      message: error instanceof Error ? error.message : 'Unknown error',
      stack: error instanceof Error ? error.stack : 'No stack trace',
      email: email,
      passwordLength: password.length
    });
    throw error;
  }
}

export async function createOAuthUser(email: string, name?: string, image?: string) {
  console.log(`[DB] createOAuthUser called for email: ${email}, name: ${name}, image: ${image}`);
  
  try {
    console.log(`[DB] Attempting to create OAuth user in database`);
    
    // Create the user in the local database first (no password for OAuth users)
    const userResult = await db
      .insert(user)
      .values({ 
        email, 
        password: null,  // OAuth users don't have passwords
        name: name || null,
        image: image || null,
        onboardingCompleted: false  // New users need onboarding
      })
      .returning();

    console.log(`[DB] User created successfully:`, {
      id: userResult[0].id,
      email: userResult[0].email,
      name: userResult[0].name,
      image: userResult[0].image,
      paprUserId: userResult[0].paprUserId,
    });

    // If we have a Papr Memory API key, create a user in Papr Memory
    const paprApiKey = process.env.PAPR_MEMORY_API_KEY;
    console.log(`[DB] Papr API key available: ${!!paprApiKey}`);
    
    if (paprApiKey && userResult.length > 0) {
      try {
        const userId = userResult[0].id;
        console.log(
          `[Memory] Creating Papr Memory user for OAuth user ${email} (App user ID: ${userId})`,
        );

        // Initialize the Papr SDK
        const API_BASE_URL =
          process.env.PAPR_MEMORY_API_URL || 'https://memory.papr.ai';
        const paprClient = initPaprMemory(paprApiKey, {
          baseURL: API_BASE_URL,
        });

        console.log(`[Memory] Papr client initialized, creating user...`);

        let paprUserId = null;

        try {
          // Properly define request params with SDK type
          const userParams: Papr.UserCreateParams = {
            external_id: `PaprChat-user-${userId}`,
            email: email,
            metadata: {
              source: 'PaprChat-OAuth',
              app_user_id: userId,
              name: name || null,
            },
          };

          // Try to create a user in Papr Memory
          const paprUserResponse: Papr.UserResponse = await paprClient.user.create(userParams);

          console.log(`[Memory] Papr user creation response:`, paprUserResponse);

          // Extract user_id from response using the SDK's type
          if (paprUserResponse && paprUserResponse.user_id) {
            paprUserId = paprUserResponse.user_id;
            console.log(`[Memory] Created Papr Memory user with ID: ${paprUserId}`);
          } else {
            console.error(`[Memory] Failed to create Papr Memory user - no user_id in response`);
          }
        } catch (createError: any) {
          console.log(`[Memory] User creation failed:`, createError);
          
          // Check if this is a 409 "User already exists" error
          if (createError.status === 409) {
            console.log(`[Memory] User already exists in Papr Memory with email: ${email}`);
            console.log(`[Memory] Attempting to create with different external_id to work around existing user`);
            
            // Try with a timestamp-based external_id to avoid conflicts
            const timestamp = Date.now();
            const alternativeExternalId = `PaprChat-user-${userId}-${timestamp}`;
            
            try {
              // Properly define request params with SDK type
              const alternativeParams: Papr.UserCreateParams = {
                external_id: alternativeExternalId,
                email: `${timestamp}-${email}`, // Use a different email to avoid conflict
                metadata: {
                  source: 'PaprChat-OAuth-Alternative',
                  app_user_id: userId,
                  name: name || null,
                  original_email: email,
                  note: 'Created with alternative ID due to existing user conflict'
                },
              };
              
              const alternativeUserResponse: Papr.UserResponse = await paprClient.user.create(alternativeParams);
              
              if (alternativeUserResponse && alternativeUserResponse.user_id) {
                paprUserId = alternativeUserResponse.user_id;
                console.log(`[Memory] Created alternative Papr Memory user with ID: ${paprUserId}`);
              } else {
                console.error(`[Memory] Failed to create alternative Papr Memory user - no user_id in response`);
              }
            } catch (alternativeError) {
              console.error(`[Memory] Failed to create alternative user:`, alternativeError);
            }
          } else {
            // Re-throw non-409 errors
            throw createError;
          }
        }

        if (paprUserId) {
          // Update the user record with the Papr user ID
          await db
            .update(user)
            .set({ paprUserId: paprUserId })
            .where(eq(user.id, userId));

          console.log(`[Memory] Updated local user record with Papr user ID`);
        }
      } catch (paprError) {
        // Don't fail signup if Papr user creation fails - just log the error
        console.error('[Memory] Error creating Papr Memory user:', paprError);
        console.error('[Memory] Papr error stack:', paprError instanceof Error ? paprError.stack : 'No stack trace');
      }
    } else {
      console.log(`[Memory] Skipping Papr user creation - no API key or user creation failed`);
    }

    console.log(`[DB] Returning user:`, userResult[0]);
    return userResult[0];
  } catch (error) {
    console.error('[DB] Failed to create OAuth user in database:', error);
    console.error('[DB] Error stack:', error instanceof Error ? error.stack : 'No stack trace');
    throw error;
  }
}

export async function updateUserProfile(userId: string, name?: string | null, image?: string | null) {
  console.log(`[DB] Updating user profile for ${userId}, name: ${name}, image: ${image}`);
  
  try {
    await db
      .update(user)
      .set({
        name: name || null,
        image: image || null,
      })
      .where(eq(user.id, userId));
    
    console.log(`[DB] User profile updated successfully`);
    return true;
  } catch (error) {
    console.error('[DB] Failed to update user profile:', error);
    return false;
  }
}

export async function saveChat({
  id,
  userId,
  title,
  userContext,
}: {
  id: string;
  userId: string;
  title: string;
  userContext?: string;
}) {
  try {
    return await db.insert(chat).values({
      id,
      createdAt: new Date(),
      userId,
      title,
      userContext,
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

// getBookChapters function removed - now handled by /api/books endpoint

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
    console.log(`[DB] Saving document (ID: ${id}, Title: ${title})`);

    // Books are handled by the dedicated books table and API, not the Document table
    if (kind === 'book') {
      console.log(`[DB] Skipping save for book artifact - books are handled by /api/books endpoint`);
      return { success: true, message: 'Books are handled by dedicated books system' };
    }

    // Get all existing versions of this document
    const existingVersions = await db
      .select({
        createdAt: document.createdAt,
        version: document.version,
      })
      .from(document)
      .where(eq(document.id, id))
      .orderBy(desc(document.createdAt));

    // Determine the next version number
    let nextVersion = '1';
    if (existingVersions.length > 0) {
      const latestVersion = existingVersions[0]?.version ?? '0';
      const versionNum = Number.parseInt(latestVersion, 10);
      nextVersion = (versionNum + 1).toString();
    }

    // Create a new timestamp that's guaranteed to be after the latest version
    const newTimestamp =
      existingVersions.length > 0
        ? new Date(new Date(existingVersions[0].createdAt).getTime() + 1)
        : new Date();

    console.log(`[DB] Creating new version ${nextVersion} for document ${id}`);

    try {
      // First, mark all existing versions as not latest
      if (existingVersions.length > 0) {
        await db
          .update(document)
          .set({ is_latest: false })
          .where(eq(document.id, id));
      }

      // Then insert the new version
      const result = await db.insert(document).values({
        id,
        title,
        kind: kind as any, // Cast to avoid enum type issues during development
        content,
        userId,
        createdAt: newTimestamp,
        is_latest: true,
        version: nextVersion,
      });

      console.log(`[DB] Document saved successfully as version ${nextVersion}`);
      return result;
    } catch (insertError) {
      // Check if this is a constraint violation error
      if (
        insertError instanceof Error &&
        insertError.message.includes('idx_document_latest_unique')
      ) {
        console.log(
          `[DB] Constraint violation detected, running migration fix`,
        );

        // Execute the migration to remove the constraint if it exists
        await db.execute(
          sql`ALTER TABLE "Document" DROP CONSTRAINT IF EXISTS "idx_document_latest_unique"`,
        );

        // Try again with the same approach
        // First, mark all existing versions as not latest
        if (existingVersions.length > 0) {
          await db
            .update(document)
            .set({ is_latest: false })
            .where(eq(document.id, id));
        }

        // Then insert the new version
        const result = await db.insert(document).values({
          id,
          title,
          kind: kind as any, // Cast to avoid enum type issues during development
          content,
          userId,
          createdAt: newTimestamp,
          is_latest: true,
          version: nextVersion,
        });

        console.log(`[DB] Document saved successfully after constraint fix`);
        return result;
      }

      // If it's another type of error, rethrow it
      throw insertError;
    }
  } catch (error) {
    console.error('Failed to save document in database', error);
    throw error;
  }
}

export async function getDocumentsById({ id }: { id: string }) {
  try {
    console.log(`[DB] Getting documents by ID: ${id}`);
    const documents = await db
      .select()
      .from(document)
      .where(eq(document.id, id))
      .orderBy(asc(document.createdAt));

    console.log(`[DB] Retrieved ${documents.length} documents`);
    return documents;
  } catch (error) {
    console.error('Failed to get document by id from database', error);
    throw error;
  }
}

export async function getDocumentById({ id }: { id: string }) {
  try {
    console.log(`[DB] Getting latest document by ID: ${id}`);
    const [selectedDocument] = await db
      .select()
      .from(document)
      .where(eq(document.id, id))
      .orderBy(desc(document.createdAt));

    if (!selectedDocument) {
      console.log(`[DB] No document found with ID: ${id}`);
    } else {
      console.log(`[DB] Retrieved document: ${selectedDocument.title}`);
    }

    return selectedDocument;
  } catch (error) {
    console.error('Failed to get document by id from database', error);
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

// Function to check database constraints and structure
export async function checkDatabaseStructure() {
  try {
    console.log('Checking database structure...');

    // Check for the unique constraint that might be causing problems
    const constraints = await db.execute(sql`
      SELECT c.conname, c.contype, pg_get_constraintdef(c.oid) as def
      FROM pg_constraint c
      JOIN pg_class t ON c.conrelid = t.oid
      JOIN pg_namespace n ON t.relnamespace = n.oid
      WHERE t.relname = 'Document'
      AND n.nspname = 'public'
    `);

    console.log('Document table constraints:', constraints);

    // Check table structure
    const columns = await db.execute(sql`
      SELECT column_name, data_type, is_nullable
      FROM information_schema.columns
      WHERE table_name = 'Document'
      AND table_schema = 'public'
    `);

    console.log('Document table structure:', columns);

    return { constraints, columns };
  } catch (error) {
    console.error('Error checking database structure:', error);
    throw error;
  }
}

// Save memories for a message
export async function saveMessageMemories({
  messageId,
  chatId,
  memories,
}: {
  messageId: string;
  chatId: string;
  memories: any[];
}) {
  try {
    console.log(`[DB] Saving ${memories.length} memories for message ${messageId} in chat ${chatId}`);
    
    // Check if entry exists first
    const existingEntry = await db
      .select()
      .from(messageMemory)
      .where(eq(messageMemory.messageId, messageId))
      .limit(1);
    
    if (existingEntry.length > 0) {
      console.log(`[DB] Found existing memory entry for message ${messageId}, updating...`);
      // Update existing entry
      await db
        .update(messageMemory)
        .set({
          memories: memories as any,
        })
        .where(eq(messageMemory.messageId, messageId));
    } else {
      console.log(`[DB] Creating new memory entry for message ${messageId}`);
      // Create new entry
      await db.insert(messageMemory).values({
        messageId,
        chatId,
        memories: memories as any,
        createdAt: new Date(),
      });
    }
    
    console.log(`[DB] Successfully saved memories for message ${messageId}`);
    return { success: true };
  } catch (error) {
    console.error(`[DB] Error saving memories for message ${messageId}:`, error);
    return { success: false, error };
  }
}

// Get memories for a message
export async function getMessageMemories({
  messageId,
}: {
  messageId: string;
}) {
  try {
    console.log(`[DB] Retrieving memories for message ${messageId}`);
    
    const result = await db
      .select()
      .from(messageMemory)
      .where(eq(messageMemory.messageId, messageId))
      .limit(1);
    
    if (result.length === 0) {
      console.log(`[DB] No memories found for message ${messageId}`);
      return null;
    }
    
    console.log(`[DB] Found memories for message ${messageId}, retrieving...`);
    return result[0].memories;
  } catch (error) {
    console.error(`[DB] Error retrieving memories for message ${messageId}:`, error);
    return null;
  }
}
