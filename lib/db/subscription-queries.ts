import { eq } from 'drizzle-orm';
import { drizzle } from 'drizzle-orm/postgres-js';
import postgres from 'postgres';
import { user, subscription } from './schema';
import type { UserSubscription } from '../subscription/types';

// biome-ignore lint: Forbidden non-null assertion.
const client = postgres(process.env.POSTGRES_URL!);
const db = drizzle(client);

export async function getUserSubscription(userId: string): Promise<UserSubscription | null> {
  // Join user and subscription tables
  const result = await db
    .select({
      userId: user.id,
      stripeCustomerId: user.stripeCustomerId,
      subscriptionId: subscription.id,
      stripeSubscriptionId: subscription.stripeSubscriptionId,
      status: subscription.status,
      plan: subscription.plan,
      currentPeriodStart: subscription.currentPeriodStart,
      currentPeriodEnd: subscription.currentPeriodEnd,
      cancelAtPeriodEnd: subscription.cancelAtPeriodEnd,
      trialStart: subscription.trialStart,
      trialEnd: subscription.trialEnd,
      createdAt: subscription.createdAt,
      updatedAt: subscription.updatedAt,
    })
    .from(user)
    .leftJoin(subscription, eq(user.id, subscription.userId))
    .where(eq(user.id, userId))
    .limit(1);
  
  if (result.length === 0) return null;
  
  const data = result[0];
  
  // If no subscription exists, return default free subscription
  if (!data.subscriptionId) {
    return {
      id: 'free',
      userId: data.userId,
      stripeCustomerId: data.stripeCustomerId || undefined,
      subscriptionStatus: 'free',
      subscriptionPlan: 'free',
      subscriptionId: undefined,
      subscriptionCurrentPeriodEnd: undefined,
      subscriptionCreatedAt: undefined,
      subscriptionUpdatedAt: undefined,
    };
  }
  
  return {
    id: data.subscriptionId,
    userId: data.userId,
    stripeCustomerId: data.stripeCustomerId || undefined,
    subscriptionStatus: (data.status as any) || 'free',
    subscriptionPlan: data.plan || 'free',
    subscriptionId: data.stripeSubscriptionId || undefined,
    subscriptionCurrentPeriodEnd: data.currentPeriodEnd || undefined,
    subscriptionCreatedAt: data.createdAt || undefined,
    subscriptionUpdatedAt: data.updatedAt || undefined,
  };
}

export async function updateUserSubscription(
  userId: string,
  updates: Partial<{
    stripeSubscriptionId: string;
    status: string;
    plan: string;
    currentPeriodStart: Date;
    currentPeriodEnd: Date;
    cancelAtPeriodEnd: boolean;
    trialStart: Date;
    trialEnd: Date;
  }>
): Promise<void> {
  // Check if subscription exists
  const existingSubscription = await db
    .select({ id: subscription.id })
    .from(subscription)
    .where(eq(subscription.userId, userId))
    .limit(1);

  if (existingSubscription.length === 0) {
    // Create new subscription
    await db.insert(subscription).values({
      userId,
      ...updates,
      updatedAt: new Date(),
    });
  } else {
    // Update existing subscription
    await db
      .update(subscription)
      .set({
        ...updates,
        updatedAt: new Date(),
      })
      .where(eq(subscription.userId, userId));
  }
}

export async function createStripeCustomerForUser(userId: string, stripeCustomerId: string): Promise<void> {
  await db
    .update(user)
    .set({
      stripeCustomerId,
    })
    .where(eq(user.id, userId));
}

export async function getUserByStripeCustomerId(stripeCustomerId: string): Promise<UserSubscription | null> {
  // Join user and subscription tables
  const result = await db
    .select({
      userId: user.id,
      stripeCustomerId: user.stripeCustomerId,
      subscriptionId: subscription.id,
      stripeSubscriptionId: subscription.stripeSubscriptionId,
      status: subscription.status,
      plan: subscription.plan,
      currentPeriodStart: subscription.currentPeriodStart,
      currentPeriodEnd: subscription.currentPeriodEnd,
      cancelAtPeriodEnd: subscription.cancelAtPeriodEnd,
      trialStart: subscription.trialStart,
      trialEnd: subscription.trialEnd,
      createdAt: subscription.createdAt,
      updatedAt: subscription.updatedAt,
    })
    .from(user)
    .leftJoin(subscription, eq(user.id, subscription.userId))
    .where(eq(user.stripeCustomerId, stripeCustomerId))
    .limit(1);
  
  if (result.length === 0) return null;
  
  const data = result[0];
  
  // If no subscription exists, return default free subscription
  if (!data.subscriptionId) {
    return {
      id: 'free',
      userId: data.userId,
      stripeCustomerId: data.stripeCustomerId || undefined,
      subscriptionStatus: 'free',
      subscriptionPlan: 'free',
      subscriptionId: undefined,
      subscriptionCurrentPeriodEnd: undefined,
      subscriptionCreatedAt: undefined,
      subscriptionUpdatedAt: undefined,
    };
  }
  
  return {
    id: data.subscriptionId,
    userId: data.userId,
    stripeCustomerId: data.stripeCustomerId || undefined,
    subscriptionStatus: (data.status as any) || 'free',
    subscriptionPlan: data.plan || 'free',
    subscriptionId: data.stripeSubscriptionId || undefined,
    subscriptionCurrentPeriodEnd: data.currentPeriodEnd || undefined,
    subscriptionCreatedAt: data.createdAt || undefined,
    subscriptionUpdatedAt: data.updatedAt || undefined,
  };
}
