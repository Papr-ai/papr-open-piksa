import { NextResponse } from 'next/server';
import { auth } from '@/app/(auth)/auth';
import { db } from '@/lib/db/db';
import { Book } from '@/lib/db/schema';
import { sql } from 'drizzle-orm';

export async function POST(request: Request) {
  try {
    const session = await auth();
    if (!session || !session.user || !session.user.id) {
      return new NextResponse('Unauthorized', { status: 401 });
    }

    const { bookId, content, currentChapter = 1 } = await request.json();
    if (!bookId || !content) {
      return new NextResponse('Missing bookId or content', { status: 400 });
    }

    console.log('[BOOK SAVE API] Saving book content:', {
      bookId,
      currentChapter,
      userId: session.user.id,
      contentLength: content.length
    });

    // Update the specific chapter for this book
    const result = await db.execute(
      sql`UPDATE "Books" 
          SET "content" = ${content}, "updatedAt" = NOW()
          WHERE "bookId" = ${bookId} 
          AND "chapterNumber" = ${currentChapter}
          AND "userId" = ${session.user.id} 
          AND "is_latest" = true
          RETURNING *`
    );

    if (result.length === 0) {
      return new NextResponse('Book not found or no permission', { status: 404 });
    }

    console.log('[BOOK SAVE API] Successfully updated book content');

    return NextResponse.json({ success: true, updated: result.length });
  } catch (error) {
    console.error('[BOOK SAVE API] Error saving book:', error);
    return new NextResponse('Internal Server Error', { status: 500 });
  }
}
