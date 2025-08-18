CREATE TABLE IF NOT EXISTS "Subscription" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"userId" uuid NOT NULL,
	"stripeSubscriptionId" varchar(255),
	"status" varchar(50) DEFAULT 'free' NOT NULL,
	"plan" varchar(50) DEFAULT 'free' NOT NULL,
	"currentPeriodStart" timestamp,
	"currentPeriodEnd" timestamp,
	"cancelAtPeriodEnd" boolean DEFAULT false,
	"trialStart" timestamp,
	"trialEnd" timestamp,
	"createdAt" timestamp DEFAULT now() NOT NULL,
	"updatedAt" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "Subscription" ADD CONSTRAINT "Subscription_userId_User_id_fk" FOREIGN KEY ("userId") REFERENCES "public"."User"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
ALTER TABLE "User" DROP COLUMN IF EXISTS "subscriptionStatus";--> statement-breakpoint
ALTER TABLE "User" DROP COLUMN IF EXISTS "subscriptionPlan";--> statement-breakpoint
ALTER TABLE "User" DROP COLUMN IF EXISTS "subscriptionId";--> statement-breakpoint
ALTER TABLE "User" DROP COLUMN IF EXISTS "subscriptionCurrentPeriodEnd";--> statement-breakpoint
ALTER TABLE "User" DROP COLUMN IF EXISTS "subscriptionCreatedAt";--> statement-breakpoint
ALTER TABLE "User" DROP COLUMN IF EXISTS "subscriptionUpdatedAt";