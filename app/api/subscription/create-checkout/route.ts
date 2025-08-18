import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/app/(auth)/auth';
import { createCheckoutSession, createCustomer } from '@/lib/subscription/stripe';
import { getUserSubscription, createStripeCustomerForUser } from '@/lib/db/subscription-queries';
import { getUser } from '@/lib/db/queries';
import { getServerPlanById } from '@/lib/subscription/server-plans';

export async function POST(request: NextRequest) {
  try {
    const session = await auth();
    
    if (!session?.user?.email || !session.user.id) {
      return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });
    }

    const { planId } = await request.json();

    if (!planId) {
      return NextResponse.json({ error: 'Plan ID is required' }, { status: 400 });
    }

    // Get the plan and its price ID
    const plan = getServerPlanById(planId);
    console.log('Plan lookup:', { planId, plan, stripePriceId: plan?.stripePriceId });
    
    if (!plan || !plan.stripePriceId) {
      return NextResponse.json({ 
        error: 'Invalid plan selected', 
        debug: { planId, planFound: !!plan, stripePriceId: plan?.stripePriceId }
      }, { status: 400 });
    }

    // Get user subscription info
    let userSubscription = await getUserSubscription(session.user.id);
    let stripeCustomerId = userSubscription?.stripeCustomerId;

    // Create Stripe customer if doesn't exist
    if (!stripeCustomerId) {
      const users = await getUser(session.user.email);
      const user = users[0];
      
      if (!user) {
        return NextResponse.json({ error: 'User not found' }, { status: 404 });
      }

      const customer = await createCustomer(session.user.email, user.name || undefined);
      
      if (!customer.id) {
        return NextResponse.json({ error: 'Failed to create Stripe customer' }, { status: 500 });
      }
      
      stripeCustomerId = customer.id;
      
      // Save customer ID to database
      await createStripeCustomerForUser(session.user.id, stripeCustomerId!);
    }

    // Ensure stripeCustomerId is defined
    if (!stripeCustomerId) {
      return NextResponse.json({ error: 'Failed to get or create Stripe customer' }, { status: 500 });
    }

    // Create checkout session
    const checkoutSession = await createCheckoutSession({
      customerId: stripeCustomerId,
      priceId: plan.stripePriceId,
      successUrl: `${process.env.NEXT_PUBLIC_BASE_URL || 'http://localhost:3000'}/?success=true`,
      cancelUrl: `${process.env.NEXT_PUBLIC_BASE_URL || 'http://localhost:3000'}/subscription`,
    });

    return NextResponse.json({ url: checkoutSession.url });
  } catch (error) {
    console.error('Error creating checkout session:', error);
    return NextResponse.json(
      { error: 'Failed to create checkout session' },
      { status: 500 }
    );
  }
}
