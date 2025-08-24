import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/app/(auth)/auth';
import { checkUsageThresholds } from '@/lib/db/usage-queries';

export async function GET(request: NextRequest) {
  try {
    const session = await auth();
    
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });
    }

    const usage = await checkUsageThresholds(session.user.id);
    
    return NextResponse.json(usage);
  } catch (error) {
    console.error('Error getting usage overview:', error);
    return NextResponse.json(
      { error: 'Failed to get usage overview' },
      { status: 500 }
    );
  }
}

