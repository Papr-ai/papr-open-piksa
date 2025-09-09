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
    console.log(`[Webhook] Received event: ${event.type} (id: ${event.id})`);
  } catch (err) {
    console.error('[Webhook] Signature verification failed:', err);
    return NextResponse.json({ error: 'Invalid signature' }, { status: 400 });
  }

  try {
    switch (event.type) {
      case 'customer.subscription.created':
      case 'customer.subscription.updated': {
        const subscription = event.data.object as Stripe.Subscription;
        
        // First, check if this subscription is for our app by checking the price IDs
        const priceId = subscription.items.data[0]?.price.id;
        const plan = SERVER_SUBSCRIPTION_PLANS.find(p => p.stripePriceId === priceId);
        
        if (!plan) {
          // This subscription is for a different app - silently ignore it
          console.log(`[Webhook] Ignoring subscription event for unrelated price ID: ${priceId} (not for this app)`);
          console.log(`[Webhook] Available price IDs for this app:`, SERVER_SUBSCRIPTION_PLANS.map(p => p.stripePriceId));
          break;
        }
        
        // Only process if we found a matching plan for this app
        const userSubscription = await getUserByStripeCustomerId(subscription.customer as string);
        
        if (userSubscription) {
          await updateUserSubscription(userSubscription.userId, {
            stripeSubscriptionId: subscription.id,
            status: subscription.status as any,
            plan: plan.id,
            currentPeriodStart: new Date((subscription as any).current_period_start * 1000),
            currentPeriodEnd: new Date((subscription as any).current_period_end * 1000),
            cancelAtPeriodEnd: subscription.cancel_at_period_end,
            trialStart: subscription.trial_start ? new Date(subscription.trial_start * 1000) : undefined, 
            trialEnd: subscription.trial_end ? new Date(subscription.trial_end * 1000) : undefined,
          });
          
          console.log(`[Webhook] Updated subscription for user ${userSubscription.userId} to plan ${plan.id}`);
        } else {
          console.log(`[Webhook] Customer ${subscription.customer} not found in this app (subscription for plan ${plan.id})`);
        }
        break;
      }

      case 'customer.subscription.deleted': {
        const subscription = event.data.object as Stripe.Subscription;
        
        // Check if this is a subscription for our app
        const priceId = subscription.items.data[0]?.price.id;
        const plan = SERVER_SUBSCRIPTION_PLANS.find(p => p.stripePriceId === priceId);
        
        if (!plan) {
          // This subscription deletion is for a different app - ignore it
          console.log(`[Webhook] Ignoring subscription deletion for unrelated price ID: ${priceId} (not for this app)`);
          break;
        }
        
        const userSubscription = await getUserByStripeCustomerId(subscription.customer as string);
        
        if (userSubscription) {
          await updateUserSubscription(userSubscription.userId, {
            status: 'canceled',
            plan: 'free',
          });
          
          console.log(`[Webhook] Canceled subscription for user ${userSubscription.userId}`);
        } else {
          console.log(`[Webhook] Customer ${subscription.customer} not found in this app (cancellation for plan ${plan.id})`);
        }
        break;
      }

      case 'invoice.payment_failed': {
        const invoice = event.data.object as Stripe.Invoice;
        if ((invoice as any).subscription) {
          // Check if this invoice is for our app by checking if the customer exists in our system
          const userSubscription = await getUserByStripeCustomerId(invoice.customer as string);
          
          if (userSubscription) {
            // Only update if this customer belongs to our app
            await updateUserSubscription(userSubscription.userId, {
              status: 'past_due',
            });
            
            console.log(`[Webhook] Payment failed for user ${userSubscription.userId}, status set to past_due`);
          } else {
            console.log(`[Webhook] Ignoring payment failure for customer ${invoice.customer} (not in this app)`);
          }
        }
        break;
      }

      case 'invoice.payment_succeeded': {
        const invoice = event.data.object as Stripe.Invoice;
        if ((invoice as any).subscription) {
          // Check if this invoice is for our app by checking if the customer exists in our system
          const userSubscription = await getUserByStripeCustomerId(invoice.customer as string);
          
          if (userSubscription) {
            // If subscription was past_due, reactivate it
            if (userSubscription.subscriptionStatus === 'past_due') {
              await updateUserSubscription(userSubscription.userId, {
                status: 'active',
              });
              
              console.log(`[Webhook] Payment succeeded for user ${userSubscription.userId}, status reactivated`);
            }
          } else {
            console.log(`[Webhook] Ignoring payment success for customer ${invoice.customer} (not in this app)`);
          }
        }
        break;
      }

      default:
        console.log(`[Webhook] Unhandled event type: ${event.type}`);
    }

    console.log(`[Webhook] Successfully processed event: ${event.type} (id: ${event.id})`);
    return NextResponse.json({ received: true });
  } catch (error) {
    console.error(`[Webhook] Error processing event ${event?.type} (id: ${event?.id}):`, error);
    // Still return 200 to prevent Stripe from retrying if it's just an app-specific issue
    return NextResponse.json({ 
      received: true, 
      error: 'Processing failed but acknowledged',
      eventType: event?.type,
      eventId: event?.id 
    });
  }
}
