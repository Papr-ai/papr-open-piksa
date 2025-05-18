import { NextResponse } from 'next/server';
import { auth } from '@/app/(auth)/auth';
import { storeContentInMemory } from '@/lib/ai/memory/middleware';
import { drizzle } from 'drizzle-orm/postgres-js';
import postgres from 'postgres';
import { vote } from '@/lib/db/schema';
import { eq, and } from 'drizzle-orm';

// Initialize database connection
const postgresUrl = process.env.POSTGRES_URL;
if (!postgresUrl) {
  throw new Error('POSTGRES_URL is not defined');
}
const client = postgres(postgresUrl);
const db = drizzle(client);

export async function POST(request: Request) {
  try {
    const session = await auth();
    if (!session || !session.user || !session.user.id) {
      return new NextResponse('Unauthorized', { status: 401 });
    }

    const { content, type = 'text', metadata = {} } = await request.json();
    if (!content) {
      return new NextResponse('Content is required', { status: 400 });
    }

    // Get the API key for Papr memory
    const apiKey = process.env.PAPR_MEMORY_API_KEY;
    if (!apiKey) {
      return new NextResponse('Memory service not configured', { status: 500 });
    }

    // Store the content in memory
    const result = await storeContentInMemory({
      userId: session.user.id,
      content,
      type,
      metadata,
      apiKey,
    });

    // If this is an assistant message, also update the vote record
    if (metadata.chatId && metadata.messageId) {
      try {
        // Check if a vote record exists
        const existingVote = await db
          .select()
          .from(vote)
          .where(
            and(
              eq(vote.chatId, metadata.chatId),
              eq(vote.messageId, metadata.messageId),
            ),
          )
          .limit(1);

        if (existingVote.length > 0) {
          // Update existing vote record
          await db
            .update(vote)
            .set({ isSaved: true })
            .where(
              and(
                eq(vote.chatId, metadata.chatId),
                eq(vote.messageId, metadata.messageId),
              ),
            );
        } else {
          // Insert new vote record
          await db.insert(vote).values({
            chatId: metadata.chatId,
            messageId: metadata.messageId,
            isUpvoted: false, // Default value, not related to saving
            isSaved: true,
          });
        }
      } catch (dbError) {
        console.error('Error updating database for saved message:', dbError);
        // Continue even if database update fails, as memory was saved
      }
    }

    return NextResponse.json({ success: result });
  } catch (error) {
    console.error('Error saving to memory:', error);
    return new NextResponse('Internal Server Error', { status: 500 });
  }
}
