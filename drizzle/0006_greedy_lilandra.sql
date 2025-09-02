CREATE TABLE IF NOT EXISTS "Books" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"bookId" uuid NOT NULL,
	"bookTitle" text NOT NULL,
	"chapterNumber" integer NOT NULL,
	"chapterTitle" text NOT NULL,
	"content" text NOT NULL,
	"userId" uuid NOT NULL,
	"createdAt" timestamp DEFAULT now() NOT NULL,
	"updatedAt" timestamp DEFAULT now() NOT NULL,
	"version" text DEFAULT '1' NOT NULL,
	"is_latest" boolean DEFAULT true NOT NULL
);
--> statement-breakpoint
ALTER TABLE "Usage" ADD COLUMN "videosGenerated" integer DEFAULT 0 NOT NULL;--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "Books" ADD CONSTRAINT "Books_userId_User_id_fk" FOREIGN KEY ("userId") REFERENCES "public"."User"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
