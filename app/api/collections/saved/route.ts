import {
  addChatToCollection,
  getOrCreateSavedChatsCollection,
} from '@/lib/db/queries';
import { auth } from '@/app/(auth)/auth';
import { NextResponse } from 'next/server';

export async function POST(req: Request) {
  try {
    const session = await auth();

    if (!session || !session.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const userId = session.user.id;

    // Check if user ID is available
    if (!userId) {
      return NextResponse.json({ error: 'User ID not found' }, { status: 400 });
    }

    const { chatId } = await req.json();

    if (!chatId) {
      return NextResponse.json({ error: 'Missing chatId' }, { status: 400 });
    }

    // Get or create the Saved Chats collection
    const savedChatsCollection = await getOrCreateSavedChatsCollection({
      userId,
    });

    // Add the chat to the collection
    await addChatToCollection({
      chatId,
      collectionId: savedChatsCollection.id,
    });

    return NextResponse.json({
      success: true,
      message: 'Chat added to Saved Chats collection',
    });
  } catch (error) {
    console.error('Error adding chat to Saved Chats collection:', error);
    return NextResponse.json(
      { error: 'Failed to add chat to collection' },
      { status: 500 },
    );
  }
}
