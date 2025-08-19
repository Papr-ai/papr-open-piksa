# Subscription System Setup

This document explains how to set up the subscription system for PaprChat.

## Overview

The subscription system includes:
- **Free Plan**: Basic AI models, limited usage
- **Basic Plan ($20/month)**: Premium models + enhanced limits
- **Pro Plan ($200/month)**: Highest limits

## Environment Variables

Add these to your `.env.local` file:

```env
# Stripe Configuration
STRIPE_SECRET_KEY=sk_test_...
STRIPE_PUBLISHABLE_KEY=pk_test_...
STRIPE_WEBHOOK_SECRET=whsec_...

# Stripe Price IDs for subscription plans
STRIPE_BASIC_PRICE_ID=price_...  # Starter plan price ID
STRIPE_PRO_PRICE_ID=price_...

# Base URL for redirects (IMPORTANT: No trailing slash)
NEXT_PUBLIC_BASE_URL=http://localhost:3000
```

## Stripe Setup

1. **Create Products and Prices**:
   - Starter Plan: $20/month
   - Pro Plan: $200/month

2. **Configure Webhooks**:
   - Endpoint: `https://yourdomain.com/api/subscription/webhook`
   - Events to listen for:
     - `customer.subscription.created`
     - `customer.subscription.updated`
     - `customer.subscription.deleted`
     - `invoice.payment_failed`

3. **Set up Customer Portal**:
   - Enable customer portal in Stripe dashboard
   - Configure allowed features (cancel subscription, update payment method, etc.)

## Database Migration

Run the subscription migration:

```bash
# Apply the migration
psql $POSTGRES_URL -f lib/db/migrations/0009_add_subscription_fields.sql
```

## Features

### Premium Model Access
- Reasoning models (o4-mini, Claude Sonnet 4, etc.) require premium subscription
- Free users see "Premium" badge and upgrade button
- API enforces access control

### Subscription Management
- `/subscription` page for plan selection and management
- Customer portal integration for billing management
- Automatic webhook handling for subscription updates

### Usage Limits
Each plan includes configurable limits for:
- Basic interactions per month
- Memories added per month
- Memory searches per month

## Testing

1. Use Stripe test mode for development
2. Test webhook events using Stripe CLI:
   ```bash
   stripe listen --forward-to localhost:3000/api/subscription/webhook
   ```
3. Test subscription flows with test payment methods

## Architecture

### Components
- `PricingCard`: Individual plan display
- `ModelSelector`: Shows premium badges and upgrade buttons
- Subscription page: Plan selection and management

### API Routes
- `/api/subscription/create-checkout`: Creates Stripe checkout session
- `/api/subscription/customer-portal`: Creates customer portal session
- `/api/subscription/webhook`: Handles Stripe webhooks
- `/api/subscription/status`: Returns user subscription status

### Database Schema
New fields in `User` table:
- `stripeCustomerId`: Stripe customer ID
- `subscriptionStatus`: Current subscription status
- `subscriptionPlan`: Plan ID (free, basic, pro)
- `subscriptionId`: Stripe subscription ID
- `subscriptionCurrentPeriodEnd`: Subscription end date
- `subscriptionCreatedAt`/`subscriptionUpdatedAt`: Timestamps
