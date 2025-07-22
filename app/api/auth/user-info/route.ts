import { NextResponse } from 'next/server';
import { auth } from '@/app/(auth)/auth';
import { getUser } from '@/lib/db/queries';

export async function GET() {
  try {
    const session = await auth();
    
    if (!session?.user?.email) {
      return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });
    }

    // Get user info from database
    const users = await getUser(session.user.email);
    
    if (users.length === 0) {
      return NextResponse.json({ error: 'User not found in database' }, { status: 404 });
    }
    
    const user = users[0];
    
    return NextResponse.json({
      status: 'ok',
      user: {
        id: user.id,
        email: user.email,
        paprUserId: user.paprUserId,
        hasPaprUserId: !!user.paprUserId,
      },
      session: {
        id: session.user.id,
        email: session.user.email,
        paprUserId: (session.user as any).paprUserId,
      },
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    console.error('User info check error:', error);
    return NextResponse.json(
      { 
        error: 'Failed to get user info', 
        message: error instanceof Error ? error.message : 'Unknown error' 
      },
      { status: 500 }
    );
  }
} 