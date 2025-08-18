import { NextRequest, NextResponse } from 'next/server';
import Stripe from 'stripe';
import { stripe } from '@/lib/subscription/stripe';
import { getUserByStripeCustomerId, updateUserSubscription } from '@/lib/db/subscription-queries';
import { SERVER_SUBSCRIPTION_PLANS } from '@/lib/subscription/server-plans';

export async function POST(request: NextRequest) {
  const body = await request.text();
  const signature = request.headers.get('stripe-signature') || '';

  let event;

  try {
    event = stripe.webhooks.constructEvent(
      body,
      signature,
      process.env.STRIPE_WEBHOOK_SECRET || ''
    );
  } catch (err) {
    console.error('Webhook signature verification failed:', err);
    return NextResponse.json({ error: 'Invalid signature' }, { status: 400 });
  }

  try {
    switch (event.type) {
      case 'customer.subscription.created':
      case 'customer.subscription.updated': {
        const subscription = event.data.object as Stripe.Subscription;
        const userSubscription = await getUserByStripeCustomerId(subscription.customer as string);
        
        if (userSubscription) {
          // Determine plan from price ID
          const priceId = subscription.items.data[0]?.price.id;
          const plan = SERVER_SUBSCRIPTION_PLANS.find(p => p.stripePriceId === priceId);
          
          await updateUserSubscription(userSubscription.userId, {
            stripeSubscriptionId: subscription.id,
            status: subscription.status as any,
            plan: plan?.id || 'free',

            cancelAtPeriodEnd: subscription.cancel_at_period_end,
            trialStart: subscription.trial_start ? new Date(subscription.trial_start * 1000) : undefined, 
            trialEnd: subscription.trial_end ? new Date(subscription.trial_end * 1000) : undefined,
          });
        }
        break;
      }

      case 'customer.subscription.deleted': {
        const subscription = event.data.object as Stripe.Subscription;
        const userSubscription = await getUserByStripeCustomerId(subscription.customer as string);
        
        if (userSubscription) {
          await updateUserSubscription(userSubscription.userId, {
            status: 'canceled',
            plan: 'free',
          });
        }
        break;
      }

      case 'invoice.payment_failed': {
        const invoice = event.data.object as Stripe.Invoice;
        if (invoice.parent?.subscription_details?.subscription) {
          const userSubscription = await getUserByStripeCustomerId(invoice.customer as string);
          
          if (userSubscription) {
            await updateUserSubscription(userSubscription.userId, {
              status: 'past_due',
            });
          }
        }
        break;
      }

      default:
        console.log(`Unhandled event type: ${event.type}`);
    }

    return NextResponse.json({ received: true });
  } catch (error) {
    console.error('Error processing webhook:', error);
    return NextResponse.json({ error: 'Webhook processing failed' }, { status: 500 });
  }
}
