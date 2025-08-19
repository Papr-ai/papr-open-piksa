import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/app/(auth)/auth';
import { getUsageWarnings } from '@/lib/subscription/usage-middleware';

export async function GET(request: NextRequest) {
  try {
    const session = await auth();
    
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });
    }

    const warnings = await getUsageWarnings(session.user.id);
    
    return NextResponse.json(warnings);
  } catch (error) {
    console.error('Error getting usage warnings:', error);
    return NextResponse.json(
      { error: 'Failed to get usage warnings' },
      { status: 500 }
    );
  }
}
