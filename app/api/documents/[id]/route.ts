import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/app/(auth)/auth';
import { getDocumentById } from '@/lib/db/queries';

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
): Promise<NextResponse> {
  try {
    const { id: documentId } = await params;

    const session = await auth();
    if (!session?.user?.id) {
      return new NextResponse('Unauthorized', { status: 401 });
    }

    if (!documentId) {
      return new NextResponse('Document ID is required', { status: 400 });
    }

    const document = await getDocumentById({ id: documentId });
    if (!document) {
      return new NextResponse('Document not found', { status: 404 });
    }
    if (document.userId !== session.user.id) {
      return new NextResponse('Unauthorized', { status: 401 });
    }

    return NextResponse.json({
      id: document.id,
      title: document.title || 'Untitled Document',
      content: document.content || '',
      kind: document.kind || 'document',
      createdAt: document.createdAt.toISOString(),
    });
  } catch (error) {
    console.error('Error fetching document:', error);
    return new NextResponse('Error fetching document', { status: 500 });
  }
}