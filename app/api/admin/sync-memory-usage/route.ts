import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/app/(auth)/auth';
import { syncMemoryUsageForUser } from '@/lib/db/sync-memory-usage';

export async function POST(request: NextRequest) {
  try {
    const session = await auth();
    
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });
    }

    // Sync memory usage for the current user
    await syncMemoryUsageForUser(session.user.id);
    
    return NextResponse.json({ 
      success: true, 
      message: 'Memory usage synced successfully' 
    });
  } catch (error) {
    console.error('Error syncing memory usage:', error);
    return NextResponse.json(
      { error: 'Failed to sync memory usage' },
      { status: 500 }
    );
  }
}

