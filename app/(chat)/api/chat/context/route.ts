import { auth } from '@/app/(auth)/auth';
import { searchUserMemories } from '@/lib/ai/memory/middleware';
import { NextResponse } from 'next/server';
import { checkOnboardingStatus } from '@/lib/auth/onboarding-middleware';

/**
 * Route handler to get memories relevant to the current chat context
 */
export async function POST(request: Request) {
  try {
    // Check onboarding status first - this includes auth check
    const onboardingResult = await checkOnboardingStatus();
    if (!onboardingResult.isCompleted) {
      return onboardingResult.response!;
    }

    // Authenticate the user
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json(
        { error: 'Authentication required' },
        { status: 401 },
      );
    }

    // Get the user ID and API key
    const userId = session.user.id;
    const PAPR_MEMORY_API_KEY = process.env.PAPR_MEMORY_API_KEY;

    // If no API key, return empty memories
    if (!PAPR_MEMORY_API_KEY) {
      console.log('[Memory] No API key available for memory context');
      return NextResponse.json({ memories: [] });
    }

    // Parse the request body
    const body = await request.json();
    const { query, maxResults = 10 } = body;

    // Validate inputs
    if (!query || typeof query !== 'string') {
      return NextResponse.json(
        { error: 'Query must be a non-empty string' },
        { status: 400 },
      );
    }

    // Log the request
    console.log(`[Memory] Received search request with query: "${query}"`);
    console.log(`[Memory] User ID: ${userId}`);
    console.log(`[Memory] Max results: ${maxResults}`);

    // Search for memories using the actual query
    const memories = await searchUserMemories({
      userId,
      query,
      maxResults,
      apiKey: PAPR_MEMORY_API_KEY,
    });

    // Process and return memories
    console.log(`[Memory] Found ${memories.length} memories`);
    if (memories.length > 0) {
      console.log(
        '[Memory] Memory sample:',
        memories[0].content?.substring(0, 100),
      );
    }

    return NextResponse.json({ memories });
  } catch (error) {
    console.error('[Memory] Error retrieving memory context:', error);
    return NextResponse.json(
      { error: 'Failed to retrieve memory context' },
      { status: 500 },
    );
  }
}
