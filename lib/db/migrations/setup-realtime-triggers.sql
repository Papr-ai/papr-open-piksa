-- Setup real-time triggers for subscription and usage table changes
-- This enables live updates when user subscription or usage data changes

-- Function to notify user-specific channels
CREATE OR REPLACE FUNCTION notify_user_table_change()
RETURNS TRIGGER AS $$
DECLARE
    channel_name TEXT;
    payload JSON;
    user_id TEXT;
BEGIN
    -- Determine the user ID based on table structure
    IF TG_TABLE_NAME = 'User' THEN
        user_id := COALESCE(NEW."id", OLD."id");
    ELSE
        user_id := COALESCE(NEW."userId", OLD."userId");
    END IF;
    
    -- Determine the channel name based on table and user
    channel_name := 'user_' || LOWER(TG_TABLE_NAME) || '_' || user_id;
    
    -- Create payload with operation type and data
    IF TG_OP = 'DELETE' THEN
        payload := json_build_object(
            'operation', TG_OP,
            'data', row_to_json(OLD),
            'timestamp', EXTRACT(EPOCH FROM NOW()) * 1000
        );
    ELSE
        payload := json_build_object(
            'operation', TG_OP,
            'data', row_to_json(NEW),
            'timestamp', EXTRACT(EPOCH FROM NOW()) * 1000
        );
    END IF;
    
    -- Send notification
    PERFORM pg_notify(channel_name, payload::text);
    
    -- Return appropriate row
    IF TG_OP = 'DELETE' THEN
        RETURN OLD;
    ELSE
        RETURN NEW;
    END IF;
END;
$$ LANGUAGE plpgsql;

-- Create triggers for Subscription table
DROP TRIGGER IF EXISTS subscription_change_trigger ON "Subscription";
CREATE TRIGGER subscription_change_trigger
    AFTER INSERT OR UPDATE OR DELETE ON "Subscription"
    FOR EACH ROW
    EXECUTE FUNCTION notify_user_table_change();

-- Create triggers for Usage table  
DROP TRIGGER IF EXISTS usage_change_trigger ON "Usage";
CREATE TRIGGER usage_change_trigger
    AFTER INSERT OR UPDATE OR DELETE ON "Usage"
    FOR EACH ROW
    EXECUTE FUNCTION notify_user_table_change();

-- Optional: Create trigger for User table changes (for onboarding status, etc.)
DROP TRIGGER IF EXISTS user_change_trigger ON "User";
CREATE TRIGGER user_change_trigger
    AFTER UPDATE ON "User"
    FOR EACH ROW
    WHEN (OLD."onboardingCompleted" IS DISTINCT FROM NEW."onboardingCompleted")
    EXECUTE FUNCTION notify_user_table_change();

-- Create indexes for better performance on notification queries
CREATE INDEX IF NOT EXISTS idx_subscription_userId ON "Subscription"("userId");
CREATE INDEX IF NOT EXISTS idx_subscription_userId_status ON "Subscription"("userId", "status");
CREATE INDEX IF NOT EXISTS idx_usage_userId ON "Usage"("userId");
CREATE INDEX IF NOT EXISTS idx_usage_userId_month ON "Usage"("userId", "month");

-- Grant necessary permissions (adjust as needed for your database user)
-- GRANT USAGE ON SCHEMA public TO your_app_user;
-- GRANT SELECT, INSERT, UPDATE, DELETE ON ALL TABLES IN SCHEMA public TO your_app_user;

-- Test the triggers (optional - remove in production)
-- You can uncomment these to test that notifications are working:

-- Test subscription trigger
-- INSERT INTO "Subscription" ("id", "userId", "status", "plan") 
-- VALUES ('test-sub-123', 'test-user-123', 'active', 'pro');

-- Test usage trigger  
-- INSERT INTO "Usage" ("userId", "month", "basicInteractions") 
-- VALUES ('test-user-123', '2024-01', 5);

-- Clean up test data (uncomment if you ran the test inserts above)
-- DELETE FROM "Subscription" WHERE "id" = 'test-sub-123';
-- DELETE FROM "Usage" WHERE "userId" = 'test-user-123' AND "month" = '2024-01';

-- Verify triggers exist
SELECT 
    trigger_name, 
    event_manipulation, 
    event_object_table,
    action_statement
FROM information_schema.triggers 
WHERE trigger_schema = 'public' 
  AND trigger_name IN ('subscription_change_trigger', 'usage_change_trigger')
ORDER BY event_object_table, trigger_name;

-- Verify function exists
SELECT 
    routine_name,
    routine_type,
    data_type
FROM information_schema.routines 
WHERE routine_schema = 'public' 
  AND routine_name = 'notify_user_table_change';

-- Show current indexes
SELECT 
    indexname,
    tablename,
    indexdef
FROM pg_indexes 
WHERE schemaname = 'public' 
  AND (tablename = 'Subscription' OR tablename = 'Usage')
  AND indexname LIKE 'idx_%'
ORDER BY tablename, indexname;
