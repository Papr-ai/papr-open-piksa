import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/app/(auth)/auth';
import { getBooksByUserId, createBookChapter, initializeBookTasks } from '@/lib/db/book-queries';
import { randomUUID } from 'crypto';

export async function GET(request: NextRequest) {
  try {
    const session = await auth();
    
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const bookId = searchParams.get('bookId');
    const bookTitle = searchParams.get('bookTitle');

    // If bookId or bookTitle is provided, return chapters for that specific book
    if (bookId || bookTitle) {
      const { getBookChaptersByBookId } = await import('@/lib/db/book-queries');
      
      if (bookId) {
        const chapters = await getBookChaptersByBookId(bookId, session.user.id);
        return NextResponse.json(chapters);
      } else if (bookTitle) {
        // For bookTitle, we need to find the bookId first, then get chapters
        const books = await getBooksByUserId(session.user.id);
        const matchingBook = books.find(book => book.bookTitle === bookTitle);
        if (matchingBook) {
          const chapters = await getBookChaptersByBookId(matchingBook.bookId, session.user.id);
          return NextResponse.json(chapters);
        } else {
          return NextResponse.json([]);
        }
      }
    }

    // Default behavior - return list of books
    const books = await getBooksByUserId(session.user.id);
    return NextResponse.json({ books });
  } catch (error) {
    console.error('Error fetching books:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const session = await auth();
    
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await request.json();
    const { title, isPictureBook = false } = body;

    if (!title) {
      return NextResponse.json({ error: 'Title is required' }, { status: 400 });
    }

    // Generate a new book ID and create the first chapter
    const bookId = randomUUID();
    const firstChapter = await createBookChapter({
      bookId,
      bookTitle: title,
      chapterNumber: 1,
      chapterTitle: 'Chapter 1',
      content: '',
      userId: session.user.id,
    });

    // Initialize workflow tasks for the book
    await initializeBookTasks(bookId, title, session.user.id, isPictureBook);

    return NextResponse.json({ 
      book: {
        bookId,
        bookTitle: title,
        chapterCount: 1,
        totalWordCount: 0,
        lastUpdated: firstChapter.createdAt,
        userId: session.user.id,
        isPictureBook,
      }
    }, { status: 201 });
  } catch (error) {
    console.error('Error creating book:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}