import { auth } from '@/app/(auth)/auth';
import { getChatById, getVotesByChatId, voteMessage } from '@/lib/db/queries';
import { vote } from '@/lib/db/schema';
import { and, eq } from 'drizzle-orm';
import { drizzle } from 'drizzle-orm/postgres-js';
import postgres from 'postgres';

// Initialize DB connection - this mirrors the setup in lib/db/queries.ts
// biome-ignore lint: Forbidden non-null assertion.
const client = postgres(process.env.POSTGRES_URL!);
const db = drizzle(client);

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const chatId = searchParams.get('chatId');

  if (!chatId) {
    return new Response('chatId is required', { status: 400 });
  }

  const session = await auth();

  if (!session || !session.user || !session.user.email) {
    return new Response('Unauthorized', { status: 401 });
  }

  const chat = await getChatById({ id: chatId });

  if (!chat) {
    return new Response('Chat not found', { status: 404 });
  }

  if (chat.userId !== session.user.id) {
    return new Response('Unauthorized', { status: 401 });
  }

  const votes = await getVotesByChatId({ id: chatId });

  return Response.json(votes, { status: 200 });
}

export async function POST(request: Request) {
  const formData = await request.formData();
  const chatId = formData.get('chatId') as string;
  const messageId = formData.get('messageId') as string;

  if (!chatId || !messageId) {
    return new Response('chatId and messageId are required', { status: 400 });
  }

  const session = await auth();

  if (!session || !session.user || !session.user.email) {
    return new Response('Unauthorized', { status: 401 });
  }

  const chat = await getChatById({ id: chatId });

  if (!chat) {
    return new Response('Chat not found', { status: 404 });
  }

  if (chat.userId !== session.user.id) {
    return new Response('Unauthorized', { status: 401 });
  }

  try {
    // First, ensure the vote record exists (create it or update it)
    await voteMessage({
      chatId,
      messageId,
      type: 'up', // Default to upvote when saving
    });

    // Get the current vote record
    const votes = await getVotesByChatId({ id: chatId });
    const existingVote = votes.find((v) => v.messageId === messageId);

    // If we found the vote record, update it to set isSaved = true
    if (existingVote) {
      await db
        .update(vote)
        .set({ isSaved: true })
        .where(and(eq(vote.messageId, messageId), eq(vote.chatId, chatId)));
    } else {
      // This shouldn't normally happen as voteMessage should have created the record
      await db.insert(vote).values({
        chatId,
        messageId,
        isUpvoted: true,
        isSaved: true,
      });
    }

    return new Response('Message saved', { status: 200 });
  } catch (error) {
    console.error('Failed to save message:', error);
    return new Response('Failed to save message', { status: 500 });
  }
}

export async function PATCH(request: Request) {
  const {
    chatId,
    messageId,
    type,
  }: { chatId: string; messageId: string; type: 'up' | 'down' } =
    await request.json();

  if (!chatId || !messageId || !type) {
    return new Response('messageId and type are required', { status: 400 });
  }

  const session = await auth();

  if (!session || !session.user || !session.user.email) {
    return new Response('Unauthorized', { status: 401 });
  }

  const chat = await getChatById({ id: chatId });

  if (!chat) {
    return new Response('Chat not found', { status: 404 });
  }

  if (chat.userId !== session.user.id) {
    return new Response('Unauthorized', { status: 401 });
  }

  await voteMessage({
    chatId,
    messageId,
    type: type,
  });

  return new Response('Message voted', { status: 200 });
}
