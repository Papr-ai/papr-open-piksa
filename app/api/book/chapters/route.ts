import { NextResponse } from 'next/server';
import { auth } from '@/app/(auth)/auth';
import { createBookChapter } from '@/lib/db/book-queries';

export async function POST(request: Request) {
  try {
    const session = await auth();
    if (!session || !session.user || !session.user.id) {
      return new NextResponse('Unauthorized', { status: 401 });
    }

    const { bookId, chapterNumber, chapterTitle, content, bookTitle: providedBookTitle } = await request.json();
    if (!bookId || chapterNumber === undefined || !chapterTitle) {
      return new NextResponse('Missing required fields: bookId, chapterNumber, chapterTitle', { status: 400 });
    }

    console.log('[BOOK CHAPTERS API] Creating new chapter:', {
      bookId,
      chapterNumber,
      chapterTitle,
      providedBookTitle,
      userId: session.user.id,
      contentLength: content?.length || 0
    });

    // Use provided book title or try to get it from existing chapters, fallback to default
    let bookTitle = providedBookTitle;
    
    if (!bookTitle) {
      try {
        const { getBookChaptersByBookId } = await import('@/lib/db/book-queries');
        const existingChapters = await getBookChaptersByBookId(bookId, session.user.id);
        
        if (existingChapters.length > 0) {
          bookTitle = existingChapters[0].bookTitle;
          console.log('[BOOK CHAPTERS API] Using book title from existing chapters:', bookTitle);
        } else {
          bookTitle = `Book ${bookId.slice(0, 8)}`; // Fallback default
          console.log('[BOOK CHAPTERS API] Using fallback book title:', bookTitle);
        }
      } catch (error) {
        console.warn('[BOOK CHAPTERS API] Could not fetch existing chapters for title, using default');
        bookTitle = `Book ${bookId.slice(0, 8)}`;
      }
    } else {
      console.log('[BOOK CHAPTERS API] Using provided book title:', bookTitle);
    }

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
