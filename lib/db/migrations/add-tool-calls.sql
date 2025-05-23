-- Add tool_calls column to Message_v2 table
ALTER TABLE "Message_v2" ADD COLUMN IF NOT EXISTS "tool_calls" json; 