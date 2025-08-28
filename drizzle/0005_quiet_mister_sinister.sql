ALTER TABLE "Document" ADD COLUMN "chapterNumber" integer;--> statement-breakpoint
ALTER TABLE "Document" ADD COLUMN "bookTitle" text;--> statement-breakpoint
ALTER TABLE "Usage" ADD COLUMN "voiceChats" integer DEFAULT 0 NOT NULL;