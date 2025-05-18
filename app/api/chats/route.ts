import { getChatsByUserId } from '@/lib/db/queries';
import { auth } from '@/app/(auth)/auth';
import { NextResponse } from 'next/server';

export async function GET(req: Request) {
  try {
    const session = await auth();

    if (!session || !session.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { searchParams } = new URL(req.url);
    const userId = searchParams.get('userId');

    if (!userId) {
      return NextResponse.json(
        { error: 'Missing userId parameter' },
        { status: 400 },
      );
    }

    // Validate that the requested userId matches the authenticated user
    if (userId !== session.user.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { chats } = await getChatsByUserId({
      id: userId,
      limit: 100,
      startingAfter: null,
      endingBefore: null,
    });

    // Format chat data for the response
    const formattedChats = chats.map((chat) => ({
      id: chat.id,
      title: chat.title,
      createdAt: chat.createdAt,
    }));

    return NextResponse.json(formattedChats);
  } catch (error) {
    console.error('Error fetching chats:', error);
    return NextResponse.json(
      { error: 'Failed to fetch chats' },
      { status: 500 },
    );
  }
}
