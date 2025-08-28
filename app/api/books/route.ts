import { auth } from '@/app/(auth)/auth';
import { db } from '@/lib/db/db';
import { sql, eq, and, desc } from 'drizzle-orm';
import { Book } from '@/lib/db/schema';
import { generateUUID } from '@/lib/utils';
import { NextRequest, NextResponse } from 'next/server';

// GET /api/books - Get all books or chapters for a specific book
export async function GET(request: NextRequest) {
  try {
    const session = await auth();
    
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const bookTitle = searchParams.get('bookTitle');
    const bookId = searchParams.get('bookId');

    if (bookId) {
      // Get all chapters for a specific book by bookId
      const chapters = await db.execute(
        sql`SELECT * FROM "Books" 
            WHERE "bookId" = ${bookId} 
            AND "userId" = ${session.user.id} 
            AND "is_latest" = true
            ORDER BY "chapterNumber"`
      );

      return NextResponse.json(chapters);
    } else if (bookTitle) {
      // Get all chapters for a specific book by title
      const chapters = await db.execute(
        sql`SELECT * FROM "Books" 
            WHERE "bookTitle" = ${bookTitle} 
            AND "userId" = ${session.user.id} 
            AND "is_latest" = true
            ORDER BY "chapterNumber"`
      );

      return NextResponse.json(chapters);
    } else {
      // Get all books (distinct book titles with their bookIds)
      const books = await db.execute(
        sql`SELECT DISTINCT "bookId", "bookTitle", MAX("createdAt") as "createdAt",
                   COUNT(*) as "chapterCount", 
                   MAX("chapterNumber") as "lastChapterNumber"
            FROM "Books" 
            WHERE "userId" = ${session.user.id} 
            AND "is_latest" = true
            GROUP BY "bookId", "bookTitle"
            ORDER BY "createdAt" DESC`
      );

      return NextResponse.json(books);
    }
  } catch (error) {
    console.error('Error fetching books:', error);
    return NextResponse.json(
      { error: 'Failed to fetch books' },
      { status: 500 }
    );
  }
}

// POST /api/books - Create or add chapter to a book
export async function POST(request: NextRequest) {
  try {
    const session = await auth();
    
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await request.json();
    console.log(`[POST /api/books] Request body:`, JSON.stringify(body, null, 2));
    const { bookTitle, chapterTitle, chapterNumber, content, bookId: providedBookId } = body;

    if (!bookTitle || !chapterTitle || !chapterNumber || !content) {
      return NextResponse.json(
        { error: 'Missing required fields' },
        { status: 400 }
      );
    }

    // Use provided bookId or find/create one
    let bookId: string;
    
    if (providedBookId) {
      // Use the provided bookId (from searchBooks tool)
      bookId = providedBookId;
      console.log(`[POST /api/books] Using provided bookId: ${bookId}`);
    } else {
      // Check if a book with this title already exists for this user
      const existingBook = await db.execute(
        sql`SELECT DISTINCT "bookId" FROM "Books" 
            WHERE "bookTitle" = ${bookTitle} 
            AND "userId" = ${session.user.id} 
            LIMIT 1`
      );

      // Generate or use existing bookId
      bookId = existingBook.length > 0 ? String(existingBook[0].bookId) : generateUUID();
      console.log(`[POST /api/books] ${existingBook.length > 0 ? 'Found existing' : 'Generated new'} bookId: ${bookId}`);
    }

    // Check if this specific chapter already exists (latest version)
    const existingChapter = await db.execute(
      sql`SELECT * FROM "Books" 
          WHERE "bookId" = ${bookId}
          AND "chapterNumber" = ${chapterNumber} 
          AND "userId" = ${session.user.id} 
          AND "is_latest" = true
          ORDER BY "createdAt" DESC
          LIMIT 1`
    );

    if (existingChapter.length > 0) {
      // Create new version of existing chapter
      const existingId = existingChapter[0].id;
      const currentVersion = parseInt(String(existingChapter[0].version || '1'));
      const nextVersion = (currentVersion + 1).toString();
      const newTimestamp = new Date();

      // Mark existing version as not latest
      await db.execute(
        sql`UPDATE "Books" 
            SET "is_latest" = false 
            WHERE "id" = ${existingId} 
            AND "is_latest" = true`
      );

      // Insert new version
      const newChapterId = generateUUID();
      const updatedChapter = await db.execute(
        sql`INSERT INTO "Books" ("id", "bookId", "bookTitle", "chapterNumber", "chapterTitle", "content", "userId", "createdAt", "updatedAt", "is_latest", "version") 
            VALUES (${newChapterId}, ${bookId}, ${bookTitle}, ${chapterNumber}, ${chapterTitle}, ${content}, ${session.user.id}, ${newTimestamp}, ${newTimestamp}, true, ${nextVersion}) 
            RETURNING *`
      );

      console.log(`[POST /api/books] Created new version of chapter:`, updatedChapter[0]);
      return NextResponse.json(updatedChapter[0]);
    } else {
      // Create new chapter
      const newChapterId = generateUUID();
      const newChapter = await db.execute(
        sql`INSERT INTO "Books" ("id", "bookId", "bookTitle", "chapterNumber", "chapterTitle", "content", "userId", "createdAt", "updatedAt", "is_latest", "version") 
            VALUES (${newChapterId}, ${bookId}, ${bookTitle}, ${chapterNumber}, ${chapterTitle}, ${content}, ${session.user.id}, now(), now(), true, '1') 
            RETURNING *`
      );

      console.log(`[POST /api/books] Created new chapter:`, newChapter[0]);
      return NextResponse.json(newChapter[0]);
    }
  } catch (error) {
    console.error('Error creating/updating book chapter:', error);
    return NextResponse.json(
      { error: 'Failed to save book chapter' },
      { status: 500 }
    );
  }
}
