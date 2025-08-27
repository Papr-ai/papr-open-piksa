import { NextRequest } from 'next/server';
import { auth } from '@/app/(auth)/auth';
import { getUserById } from '@/lib/db/queries';

export async function POST(request: NextRequest) {
  try {
    const session = await auth();
    
    if (!session || !session.user || !session.user.id) {
      return new Response('Unauthorized', { status: 401 });
    }

    console.log('[Refresh Papr User] Current session user ID:', session.user.id);
    console.log('[Refresh Papr User] Current paprUserId in session:', (session.user as any).paprUserId);

    // Get the user from the database
    const dbUser = await getUserById(session.user.id);
    
    if (!dbUser) {
      return new Response('User not found in database', { status: 404 });
    }

    console.log('[Refresh Papr User] Database user paprUserId:', dbUser.paprUserId);

    // Return the current state
    return Response.json({
      success: true,
      sessionUserId: session.user.id,
      sessionPaprUserId: (session.user as any).paprUserId,
      databasePaprUserId: dbUser.paprUserId,
      message: dbUser.paprUserId ? 'User has paprUserId in database. Try signing out and back in to refresh your session.' : 'User does not have paprUserId in database.'
    });

  } catch (error) {
    console.error('[Refresh Papr User] Error:', error);
    return Response.json({ 
      success: false, 
      error: 'Internal server error' 
    }, { status: 500 });
  }
}
