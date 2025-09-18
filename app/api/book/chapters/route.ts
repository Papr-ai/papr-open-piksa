import { NextResponse } from 'next/server';
import { auth } from '@/app/(auth)/auth';
import { createBookChapter } from '@/lib/db/book-queries';

export async function POST(request: Request) {
  try {
    const session = await auth();
    if (!session || !session.user || !session.user.id) {
      return new NextResponse('Unauthorized', { status: 401 });
    }

    const { bookId, chapterNumber, chapterTitle, content } = await request.json();
    if (!bookId || !chapterNumber || !chapterTitle) {
      return new NextResponse('Missing required fields: bookId, chapterNumber, chapterTitle', { status: 400 });
    }

    console.log('[BOOK CHAPTERS API] Creating new chapter:', {
      bookId,
      chapterNumber,
      chapterTitle,
      userId: session.user.id,
      contentLength: content?.length || 0
    });

    // Extract book title from the first existing chapter or use a default
    const bookTitle = `Book ${bookId.slice(0, 8)}`; // Default title, could be improved

    // Create the new chapter
    const newChapter = await createBookChapter({
      bookId,
      bookTitle,
      chapterNumber,
      chapterTitle,
      content: content || '',
      userId: session.user.id,
    });

    console.log('[BOOK CHAPTERS API] Chapter created successfully:', newChapter.id);

    return NextResponse.json({ 
      success: true, 
      chapter: newChapter 
    });
  } catch (error) {
    console.error('[BOOK CHAPTERS API] Error creating chapter:', error);
    return new NextResponse('Internal server error', { status: 500 });
  }
}
