import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/app/(auth)/auth';
import { createCustomerPortalSession } from '@/lib/subscription/stripe';
import { getUserSubscription } from '@/lib/db/subscription-queries';

export async function POST(request: NextRequest) {
  try {
    const session = await auth();
    
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });
    }

    // Get user subscription info
    const userSubscription = await getUserSubscription(session.user.id);
    
    if (!userSubscription?.stripeCustomerId) {
      return NextResponse.json({ error: 'No Stripe customer found' }, { status: 404 });
    }

    // Create customer portal session
    const portalSession = await createCustomerPortalSession(
      userSubscription.stripeCustomerId,
      `${process.env.NEXT_PUBLIC_BASE_URL || 'http://localhost:3000'}/subscription`
    );

    return NextResponse.json({ url: portalSession.url });
  } catch (error) {
    console.error('Error creating customer portal session:', error);
    return NextResponse.json(
      { error: 'Failed to create customer portal session' },
      { status: 500 }
    );
  }
}
