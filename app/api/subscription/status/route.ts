import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/app/(auth)/auth';
import { getUserSubscription } from '@/lib/db/subscription-queries';
import { getPlanById } from '@/lib/subscription/plans';

export async function GET(request: NextRequest) {
  try {
    const session = await auth();
    
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });
    }

    // Get user subscription info
    const userSubscription = await getUserSubscription(session.user.id);
    
    if (!userSubscription) {
      return NextResponse.json({
        subscriptionStatus: 'free',
        subscriptionPlan: 'free',
        hasActiveSubscription: false,
        plan: getPlanById('free'),
      });
    }

    const plan = getPlanById(userSubscription.subscriptionPlan);
    const hasActiveSubscription = ['active', 'trialing'].includes(userSubscription.subscriptionStatus);

    return NextResponse.json({
      subscriptionStatus: userSubscription.subscriptionStatus,
      subscriptionPlan: userSubscription.subscriptionPlan,
      hasActiveSubscription,
      plan,
      subscriptionCurrentPeriodEnd: userSubscription.subscriptionCurrentPeriodEnd,
    });
  } catch (error) {
    console.error('Error getting subscription status:', error);
    return NextResponse.json(
      { error: 'Failed to get subscription status' },
      { status: 500 }
    );
  }
}
