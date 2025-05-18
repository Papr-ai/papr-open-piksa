-- Create Collection table
CREATE TABLE IF NOT EXISTS "Collection" (
  "id" UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  "title" TEXT NOT NULL,
  "description" TEXT,
  "userId" UUID NOT NULL REFERENCES "User"("id"),
  "createdAt" TIMESTAMP NOT NULL DEFAULT NOW(),
  "updatedAt" TIMESTAMP NOT NULL DEFAULT NOW(),
  "isSystem" BOOLEAN NOT NULL DEFAULT FALSE,
  "systemType" VARCHAR(32)
);

-- Create ChatCollection association table
CREATE TABLE IF NOT EXISTS "ChatCollection" (
  "chatId" UUID NOT NULL REFERENCES "Chat"("id"),
  "collectionId" UUID NOT NULL REFERENCES "Collection"("id"),
  "addedAt" TIMESTAMP NOT NULL DEFAULT NOW(),
  PRIMARY KEY ("chatId", "collectionId")
);

-- Create index for quick lookups
CREATE INDEX IF NOT EXISTS "idx_collection_userId" ON "Collection"("userId");
CREATE INDEX IF NOT EXISTS "idx_chatcollection_collectionId" ON "ChatCollection"("collectionId");
CREATE INDEX IF NOT EXISTS "idx_chatcollection_chatId" ON "ChatCollection"("chatId"); 