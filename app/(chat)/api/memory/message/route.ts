import { NextResponse } from 'next/server';
import { auth } from '@/app/(auth)/auth';
import { saveMessageMemories, getMessageMemories } from '@/lib/db/queries';

// Save memories for a specific message
export async function POST(request: Request) {
  try {
    const session = await auth();
    if (!session || !session.user || !session.user.id) {
      return new NextResponse('Unauthorized', { status: 401 });
    }

    // Parse request body
    let body;
    try {
      body = await request.json();
      console.log('[API] Memory message save request received:', {
        messageId: body.messageId?.substring(0, 8),
        chatId: body.chatId?.substring(0, 8),
        memoryCount: body.memories?.length
      });
    } catch (parseError) {
      console.error('[API] Error parsing memory save request body:', parseError);
      return new NextResponse('Invalid JSON body', { status: 400 });
    }

    const { messageId, chatId, memories } = body;
    
    if (!messageId || !chatId || !memories) {
      console.error('[API] Missing required fields for memory save:', { 
        hasMessageId: !!messageId, 
        hasChatId: !!chatId, 
        hasMemories: !!memories
      });
      return new NextResponse('Missing required fields', { status: 400 });
    }

    // Save memories to the database
    console.log(`[API] Saving ${memories.length} memories for message ${messageId}`);
    const result = await saveMessageMemories({
      messageId,
      chatId,
      memories,
    });

    if (!result.success) {
      console.error('[API] Failed to save memories:', result.error);
      return new NextResponse('Failed to save memories', { status: 500 });
    }

    console.log(`[API] Successfully saved ${memories.length} memories for message ${messageId}`);
    return NextResponse.json({ success: true, memoryCount: memories.length });
  } catch (error) {
    console.error('[API] Error saving message memories:', error);
    return new NextResponse('Internal Server Error', { status: 500 });
  }
}

// Get memories for a specific message
export async function GET(request: Request) {
  try {
    const session = await auth();
    if (!session || !session.user || !session.user.id) {
      return new NextResponse('Unauthorized', { status: 401 });
    }

    // Extract the messageId from the URL query parameters
    const url = new URL(request.url);
    const messageId = url.searchParams.get('messageId');

    console.log(`[API] Memory fetch request for message ID: ${messageId}`);

    if (!messageId) {
      console.error('[API] Memory fetch missing messageId parameter');
      return new NextResponse('Message ID is required', { status: 400 });
    }

    // Get memories from the database
    const memories = await getMessageMemories({ messageId });

    if (!memories) {
      console.log(`[API] No memories found for message ${messageId}`);
      return NextResponse.json({ memories: [], message: "No memories found" });
    }

    console.log(`[API] Found ${Array.isArray(memories) ? memories.length : 'unknown'} memories for message ${messageId}`);
    return NextResponse.json({ 
      memories, 
      count: Array.isArray(memories) ? memories.length : (typeof memories === 'object' ? 1 : 0) 
    });
  } catch (error) {
    console.error('[API] Error retrieving message memories:', error);
    return new NextResponse('Internal Server Error', { status: 500 });
  }
} 