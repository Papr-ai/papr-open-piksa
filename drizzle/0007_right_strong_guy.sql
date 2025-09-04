CREATE TABLE IF NOT EXISTS "Book" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"title" varchar(255) NOT NULL,
	"description" text,
	"genre" varchar(100),
	"targetAge" varchar(50),
	"premise" text,
	"themes" jsonb DEFAULT '[]'::jsonb,
	"isPictureBook" boolean DEFAULT false,
	"status" varchar(50) DEFAULT 'draft',
	"wordCount" integer DEFAULT 0,
	"chapterCount" integer DEFAULT 0,
	"coverImageUrl" varchar(500),
	"userId" uuid NOT NULL,
	"createdAt" timestamp DEFAULT now() NOT NULL,
	"updatedAt" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "BookChapter" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"bookId" uuid NOT NULL,
	"chapterNumber" integer NOT NULL,
	"title" varchar(255) NOT NULL,
	"content" text,
	"wordCount" integer DEFAULT 0,
	"status" varchar(50) DEFAULT 'draft',
	"createdAt" timestamp DEFAULT now() NOT NULL,
	"updatedAt" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "BookChapter_bookId_chapterNumber_unique" UNIQUE("bookId","chapterNumber")
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "BookProp" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"bookId" uuid NOT NULL,
	"bookTitle" varchar(255) NOT NULL,
	"type" varchar(50) NOT NULL,
	"name" varchar(255) NOT NULL,
	"description" text,
	"metadata" jsonb DEFAULT '{}'::jsonb,
	"memoryId" varchar(255),
	"imageUrl" varchar(500),
	"userId" uuid NOT NULL,
	"createdAt" timestamp DEFAULT now() NOT NULL,
	"updatedAt" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "Book" ADD CONSTRAINT "Book_userId_User_id_fk" FOREIGN KEY ("userId") REFERENCES "public"."User"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "BookChapter" ADD CONSTRAINT "BookChapter_bookId_Book_id_fk" FOREIGN KEY ("bookId") REFERENCES "public"."Book"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "BookProp" ADD CONSTRAINT "BookProp_bookId_Book_id_fk" FOREIGN KEY ("bookId") REFERENCES "public"."Book"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "BookProp" ADD CONSTRAINT "BookProp_userId_User_id_fk" FOREIGN KEY ("userId") REFERENCES "public"."User"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
