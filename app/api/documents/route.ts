import { NextResponse } from 'next/server';
import { auth } from '@/app/(auth)/auth';
import { getSavedDocumentsByUserId } from '@/lib/db/queries';
import { checkOnboardingStatus } from '@/lib/auth/onboarding-middleware';

export async function GET() {
  try {
    // Check onboarding status first
    const onboardingResult = await checkOnboardingStatus();
    if (!onboardingResult.isCompleted) {
      return onboardingResult.response!;
    }

    const session = await auth();
    
    if (!session || !session.user || !session.user.id) {
      return new Response('Unauthorized', { status: 401 });
    }
    
    const documents = await getSavedDocumentsByUserId({ userId: session.user.id });
    
    // Transform documents to the format needed by the frontend
    const formattedDocuments = documents.map((doc) => ({
      id: doc.id,
      title: doc.title || 'Untitled Document',
      kind: doc.kind || 'document',
      createdAt: doc.createdAt.toISOString(),
    }));
    
    return NextResponse.json(formattedDocuments);
  } catch (error) {
    console.error('Error fetching documents:', error);
    return new Response('Error fetching documents', { status: 500 });
  }
} 