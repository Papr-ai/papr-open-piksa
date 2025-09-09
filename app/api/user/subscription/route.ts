import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/app/(auth)/auth';
import { getCombinedUserData } from '@/lib/db/user-data-cache';

/**
 * Optimized endpoint for user subscription data
 * Uses combined query instead of multiple separate database calls
 */
export async function GET(request: NextRequest) {
  try {
    const session = await auth();
    
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });
    }

    // Get all user data in a single optimized query
    const userData = await getCombinedUserData(session.user.id);
    
    // Format response to match existing subscription status API
    const response = {
      subscriptionStatus: userData.subscription?.status || 'free',
      subscriptionPlan: userData.subscription?.plan || 'free',
      hasActiveSubscription: userData.subscription?.status === 'active' || userData.subscription?.status === 'trialing',
      currentPeriodEnd: userData.subscription?.currentPeriodEnd,
      cancelAtPeriodEnd: userData.subscription?.cancelAtPeriodEnd,
    };

    return NextResponse.json(response);
  } catch (error) {
    console.error('[Subscription API] Error fetching subscription data:', error);
    return NextResponse.json(
      { error: 'Failed to fetch subscription data' },
      { status: 500 }
    );
  }
}
