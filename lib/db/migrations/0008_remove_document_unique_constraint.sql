-- Drop the unique constraint that's preventing document versioning
ALTER TABLE "Document" DROP CONSTRAINT IF EXISTS "idx_document_latest_unique"; 