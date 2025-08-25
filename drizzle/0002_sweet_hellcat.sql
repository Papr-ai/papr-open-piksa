CREATE TABLE IF NOT EXISTS "Usage" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"userId" uuid NOT NULL,
	"month" varchar(7) NOT NULL,
	"basicInteractions" integer DEFAULT 0 NOT NULL,
	"premiumInteractions" integer DEFAULT 0 NOT NULL,
	"memoriesAdded" integer DEFAULT 0 NOT NULL,
	"memoriesSearched" integer DEFAULT 0 NOT NULL,
	"createdAt" timestamp DEFAULT now() NOT NULL,
	"updatedAt" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "Usage_userId_month_pk" PRIMARY KEY("userId","month")
);
--> statement-breakpoint
ALTER TABLE "Message_v2" ADD COLUMN "sources" jsonb DEFAULT 'null'::jsonb;--> statement-breakpoint
ALTER TABLE "User" ADD COLUMN "referredBy" varchar(255);--> statement-breakpoint
ALTER TABLE "User" ADD COLUMN "useCase" text;--> statement-breakpoint
ALTER TABLE "User" ADD COLUMN "onboardingCompleted" boolean DEFAULT false;--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "Usage" ADD CONSTRAINT "Usage_userId_User_id_fk" FOREIGN KEY ("userId") REFERENCES "public"."User"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
