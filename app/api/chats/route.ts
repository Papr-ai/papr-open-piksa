import { getChatById, getChatsByUserId } from '@/lib/db/queries';
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
    const id = searchParams.get('id');

    // If an ID is provided, return the specific chat
    if (id) {
      const chat = await getChatById({ id });
      // If chat not yet created or only has default title, return 204 to avoid polling errors
      if (!chat || chat.title === 'New Chat') {
        return new NextResponse(null, { status: 204 });
      }

      // Verify the authenticated user owns this chat or the chat is public
      if (chat.userId !== session.user.id && chat.visibility !== 'public') {
        return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
      }

      return NextResponse.json(chat);
    }

    // Otherwise, handle the list request
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
