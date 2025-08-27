ALTER TABLE "Chat" ADD COLUMN "oneSentenceSummary" text;--> statement-breakpoint
ALTER TABLE "Chat" ADD COLUMN "fullSummary" text;--> statement-breakpoint
ALTER TABLE "Chat" ADD COLUMN "insights" jsonb;--> statement-breakpoint
ALTER TABLE "Chat" ADD COLUMN "userContext" text;