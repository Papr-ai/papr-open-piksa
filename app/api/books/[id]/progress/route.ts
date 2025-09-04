import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/app/(auth)/auth';
import { getBookProgress } from '@/lib/db/book-queries';

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await auth();
    
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { id: bookId } = await params;
    const progress = await getBookProgress(bookId, session.user.id);
    
    return NextResponse.json(progress);
  } catch (error) {
    console.error('Error fetching book progress:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
