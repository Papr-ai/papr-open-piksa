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
      userId: session.user!.id,
      contentLength: content.length
    });

    // Use a transaction to properly handle versioning
    const result = await db.transaction(async (tx) => {
      // First, check if the book chapter exists
      const existingChapter = await tx.execute(
        sql`SELECT * FROM "Books" 
            WHERE "bookId" = ${bookId} 
            AND "chapterNumber" = ${currentChapter}
            AND "userId" = ${session.user!.id} 
            AND "is_latest" = true
            ORDER BY "createdAt" DESC
            LIMIT 1
            FOR UPDATE`
      );

      if (existingChapter.length === 0) {
        throw new Error('BOOK_NOT_FOUND');
      }

      const currentChapterData = existingChapter[0];
      const currentVersion = parseInt(String(currentChapterData.version || '1'));
      const nextVersion = (currentVersion + 1).toString();

      // Mark the current version as not latest
      await tx.execute(
        sql`UPDATE "Books" 
            SET "is_latest" = false 
            WHERE "bookId" = ${bookId} 
            AND "chapterNumber" = ${currentChapter}
            AND "userId" = ${session.user!.id} 
            AND "is_latest" = true`
      );

      // Create new version as latest
      const newVersionResult = await tx.execute(
        sql`INSERT INTO "Books" ("id", "bookId", "bookTitle", "chapterNumber", "chapterTitle", "content", "userId", "createdAt", "updatedAt", "version", "is_latest")
            VALUES (gen_random_uuid(), ${bookId}, ${currentChapterData.bookTitle}, ${currentChapter}, ${currentChapterData.chapterTitle}, ${content}, ${session.user!.id}, NOW(), NOW(), ${nextVersion}, true)
            RETURNING *`
      );

      return newVersionResult;
    });

    if (result.length === 0) {
      return new NextResponse('Book not found or no permission', { status: 404 });
    }

    console.log('[BOOK SAVE API] Successfully updated book content');

    return NextResponse.json({ success: true, updated: result.length });
  } catch (error) {
    console.error('[BOOK SAVE API] Error saving book:', error);
    
    // Handle specific error cases
    if (error instanceof Error && error.message === 'BOOK_NOT_FOUND') {
      return new NextResponse('Book not found or no permission', { status: 404 });
    }
    
    return new NextResponse('Internal Server Error', { status: 500 });
  }
}
