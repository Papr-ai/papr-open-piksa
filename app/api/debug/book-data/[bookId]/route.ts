import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/app/(auth)/auth';
import { getBookChaptersByBookId, getBookPropsByBookId } from '@/lib/db/book-queries';

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ bookId: string }> }
) {
  try {
    const session = await auth();
    
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { bookId } = await params;

    // Get chapters from Books table
    const chapters = await getBookChaptersByBookId(bookId, session.user.id);
    
    // Get props from book_props table
    const props = await getBookPropsByBookId(bookId);
    
    return NextResponse.json({
      bookId,
      userId: session.user.id,
      chapters: {
        count: chapters.length,
        data: chapters.map(ch => ({
          id: ch.id,
          bookId: ch.bookId,
          bookTitle: ch.bookTitle,
          chapterNumber: ch.chapterNumber,
          chapterTitle: ch.chapterTitle,
          contentLength: ch.content?.length || 0,
          createdAt: ch.createdAt,
          updatedAt: ch.updatedAt
        }))
      },
      props: {
        count: props.length,
        data: props.map(prop => ({
          id: prop.id,
          bookId: prop.bookId,
          bookTitle: prop.bookTitle,
          type: prop.type,
          name: prop.name,
          hasImage: !!prop.imageUrl,
          createdAt: prop.createdAt
        }))
      }
    });
  } catch (error) {
    console.error('Error fetching book debug data:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
