import { NextResponse } from 'next/server';
import { auth } from '@/app/(auth)/auth';
import { getUserContext } from '@/lib/ai/memory/user-context';

export async function GET() {
  try {
    const session = await auth();
    
    if (!session?.user?.id) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      );
    }

    const apiKey = process.env.PAPR_MEMORY_API_KEY;
    
    if (!apiKey) {
      console.log('[User Context API] No memory API key configured');
      return NextResponse.json({
        success: true,
        userContext: {
          preferences: [],
          insights: [],
          goals: [],
          patterns: [],
          context: ''
        }
      });
    }

    console.log('[User Context API] Fetching user context for:', session.user.id);
    const startTime = Date.now();
    
    const userContext = await getUserContext(session.user.id, apiKey);
    
    const duration = Date.now() - startTime;
    console.log(`[User Context API] ✅ User context fetched in ${duration}ms`);

    return NextResponse.json({
      success: true,
      userContext,
      fetchTime: duration
    });

  } catch (error) {
    console.error('[User Context API] Error fetching user context:', error);
    return NextResponse.json(
      { 
        error: 'Failed to fetch user context',
        details: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 500 }
    );
  }
}

// Optional: Allow manual refresh via POST
export async function POST() {
  return GET(); // Same logic for manual refresh
}

