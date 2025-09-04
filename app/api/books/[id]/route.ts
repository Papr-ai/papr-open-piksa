import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/app/(auth)/auth';
import { getBookWithDetails } from '@/lib/db/book-queries';

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await auth();
    
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { id } = await params;
    
    // Check if this is a request from the artifact system (for version control)
    const { searchParams } = new URL(request.url);
    const isVersionRequest = searchParams.get('versions') === 'true';
    
    if (isVersionRequest) {
      // Return chapter versions for version control
      const currentChapter = parseInt(searchParams.get('chapter') || '1');
      
      const { db } = await import('@/lib/db/db');
      const { Book } = await import('@/lib/db/schema');
      const { eq, and, desc } = await import('drizzle-orm');
      
      // Get all versions of the current chapter, ordered by newest first
      const chapterVersions = await db.select().from(Book)
        .where(and(
          eq(Book.bookId, id),
          eq(Book.chapterNumber, currentChapter),
          eq(Book.userId, session.user.id)
        ))
        .orderBy(desc(Book.createdAt));
      
      if (chapterVersions.length === 0) {
        return NextResponse.json([]);
      }
      
      // Convert chapter versions to document format for version control
      const documentVersions = chapterVersions.map((version, index) => ({
        id: version.id,
        content: version.content,
        title: `${version.chapterTitle || `Chapter ${version.chapterNumber}`} (v${version.version})`,
        kind: 'book',
        userId: session.user?.id,
        createdAt: version.createdAt || new Date().toISOString(),
        version: version.version,
        isLatest: version.is_latest,
      }));
      
      console.log(`[API] Returning ${documentVersions.length} versions for chapter ${currentChapter} of book ${id}`);
      return NextResponse.json(documentVersions);
    }
    
    // Regular book details request
    const book = await getBookWithDetails(id, session.user.id);
    
    if (!book) {
      return NextResponse.json({ error: 'Book not found' }, { status: 404 });
    }

    return NextResponse.json({ book });
  } catch (error) {
    console.error('Error fetching book:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

// TODO: Implement book update functionality
// export async function PUT(
//   request: NextRequest,
//   { params }: { params: Promise<{ id: string }> }
// ) {
//   // Implementation needed: updateBook function doesn't exist yet
// }

// TODO: Implement book deletion functionality  
// export async function DELETE(
//   request: NextRequest,
//   { params }: { params: Promise<{ id: string }> }
// ) {
//   // Implementation needed: deleteBook function doesn't exist yet
// }
