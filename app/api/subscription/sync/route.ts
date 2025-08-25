import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/app/(auth)/auth';
import { stripe } from '@/lib/subscription/stripe';
import { getUserSubscription, updateUserSubscription } from '@/lib/db/subscription-queries';
import { SERVER_SUBSCRIPTION_PLANS } from '@/lib/subscription/server-plans';

export async function POST(request: NextRequest) {
  try {
    const session = await auth();
    
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });
    }

    // Get current subscription from database
    const userSubscription = await getUserSubscription(session.user.id);
    
    if (!userSubscription?.stripeCustomerId) {
      return NextResponse.json({ error: 'No Stripe customer ID found' }, { status: 400 });
    }

    // Fetch current subscriptions from Stripe with expanded data
    const subscriptions = await stripe.subscriptions.list({
      customer: userSubscription.stripeCustomerId,
      status: 'active',
      limit: 1,
      expand: ['data.items.data.price'],
    });

    if (subscriptions.data.length === 0) {
      // No active subscription found, set to free
      await updateUserSubscription(session.user.id, {
        status: 'canceled',
        plan: 'free',
      });
      
      return NextResponse.json({
        message: 'No active subscription found, set to free plan',
        plan: 'free'
      });
    }

    const stripeSubscription = subscriptions.data[0];
    const priceId = stripeSubscription.items.data[0]?.price.id;
    
    console.log('Full Stripe subscription object keys:', Object.keys(stripeSubscription));
    console.log('Stripe subscription data:', {
      id: stripeSubscription.id,
      status: stripeSubscription.status,
      priceId,
      current_period_start: (stripeSubscription as any).current_period_start,
      current_period_end: (stripeSubscription as any).current_period_end,
      currentPeriodStart: (stripeSubscription as any).currentPeriodStart,
      currentPeriodEnd: (stripeSubscription as any).currentPeriodEnd,
    });
    
    // Find matching plan
    const plan = SERVER_SUBSCRIPTION_PLANS.find(p => p.stripePriceId === priceId);
    
    if (!plan) {
      return NextResponse.json({ 
        error: 'Plan not found for price ID', 
        priceId,
        availablePlans: SERVER_SUBSCRIPTION_PLANS.map(p => ({ id: p.id, name: p.name, stripePriceId: p.stripePriceId }))
      }, { status: 400 });
    }

    // If period dates are missing, fetch the subscription directly
    let detailedSubscription = stripeSubscription;
    const subscription = stripeSubscription as any;
    
    if (!subscription.current_period_start || !subscription.current_period_end) {
      console.log('Period dates missing, fetching subscription directly...');
      detailedSubscription = await stripe.subscriptions.retrieve(stripeSubscription.id);
    }
    
    // Safely convert timestamps to dates
    const detailedSub = detailedSubscription as any;
    const currentPeriodStart = detailedSub.current_period_start ? new Date(detailedSub.current_period_start * 1000) : undefined;
    const currentPeriodEnd = detailedSub.current_period_end ? new Date(detailedSub.current_period_end * 1000) : undefined;
    const trialStart = detailedSub.trial_start ? new Date(detailedSub.trial_start * 1000) : undefined;
    const trialEnd = detailedSub.trial_end ? new Date(detailedSub.trial_end * 1000) : undefined;

    // Update subscription in database
    await updateUserSubscription(session.user.id, {
      stripeSubscriptionId: stripeSubscription.id,
      status: stripeSubscription.status as any,
      plan: plan.id,
      currentPeriodStart,
      currentPeriodEnd,
      cancelAtPeriodEnd: detailedSub.cancel_at_period_end,
      trialStart,
      trialEnd,
    });

    return NextResponse.json({
      message: 'Subscription synced successfully',
      plan: plan.id,
      planName: plan.name,
      status: stripeSubscription.status,
      currentPeriodEnd: currentPeriodEnd,
    });
  } catch (error) {
    console.error('Subscription sync error:', error);
    return NextResponse.json(
      { error: 'Failed to sync subscription', details: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    );
  }
}
