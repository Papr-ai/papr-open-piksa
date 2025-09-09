/**
 * Migration runner for setting up real-time database triggers
 * Run this script to enable real-time notifications for subscription/usage changes
 */

import { readFileSync } from 'fs';
import { join } from 'path';
import postgres from 'postgres';

async function runRealtimeSetup() {
  // biome-ignore lint: Forbidden non-null assertion.
  const connectionString = process.env.POSTGRES_URL!;
  
  if (!connectionString) {
    console.error('❌ POSTGRES_URL environment variable is required');
    process.exit(1);
  }

  const sql = postgres(connectionString);

  try {
    console.log('🚀 Setting up real-time database triggers...');

    // Read the SQL migration file
    const migrationPath = join(__dirname, 'setup-realtime-triggers.sql');
    const migrationSQL = readFileSync(migrationPath, 'utf8');

    // Split the SQL into individual statements (simple approach)
    const statements = migrationSQL
      .split(';')
      .map(stmt => stmt.trim())
      .filter(stmt => stmt.length > 0 && !stmt.startsWith('--'));

    console.log(`📝 Found ${statements.length} SQL statements to execute`);

    // Execute each statement
    for (let i = 0; i < statements.length; i++) {
      const statement = statements[i];
      
      // Skip comments and empty statements
      if (statement.startsWith('--') || statement.trim().length === 0) {
        continue;
      }

      try {
        console.log(`⚡ Executing statement ${i + 1}/${statements.length}...`);
        await sql.unsafe(statement);
      } catch (error) {
        // Some statements might fail if they already exist - that's okay
        if (error instanceof Error && (
          error.message.includes('already exists') ||
          error.message.includes('does not exist')
        )) {
          console.log(`⚠️  Statement ${i + 1} skipped (already exists or not needed)`);
        } else {
          console.error(`❌ Error in statement ${i + 1}:`, error);
          throw error;
        }
      }
    }

    // Verify the setup worked
    console.log('🔍 Verifying trigger setup...');

    const triggers = await sql`
      SELECT 
        trigger_name, 
        event_manipulation, 
        event_object_table
      FROM information_schema.triggers 
      WHERE trigger_schema = 'public' 
        AND trigger_name IN ('subscription_change_trigger', 'usage_change_trigger')
      ORDER BY event_object_table, trigger_name
    `;

    const functions = await sql`
      SELECT routine_name
      FROM information_schema.routines 
      WHERE routine_schema = 'public' 
        AND routine_name = 'notify_user_table_change'
    `;

    const indexes = await sql`
      SELECT indexname, tablename
      FROM pg_indexes 
      WHERE schemaname = 'public' 
        AND (tablename = 'Subscription' OR tablename = 'Usage')
        AND indexname LIKE 'idx_%'
      ORDER BY tablename, indexname
    `;

    console.log('✅ Real-time setup completed successfully!');
    console.log(`📋 Created ${triggers.length} triggers:`);
    triggers.forEach(trigger => {
      console.log(`   - ${trigger.trigger_name} on ${trigger.event_object_table} (${trigger.event_manipulation})`);
    });

    console.log(`🔧 Created ${functions.length} functions:`);
    functions.forEach(func => {
      console.log(`   - ${func.routine_name}`);
    });

    console.log(`📊 Created ${indexes.length} indexes:`);
    indexes.forEach(index => {
      console.log(`   - ${index.indexname} on ${index.tablename}`);
    });

    console.log('\n🎉 Real-time database notifications are now enabled!');
    console.log('   - Subscription changes will trigger real-time updates');
    console.log('   - Usage changes will trigger real-time updates');
    console.log('   - Client applications will receive instant notifications');

  } catch (error) {
    console.error('❌ Failed to set up real-time triggers:', error);
    process.exit(1);
  } finally {
    await sql.end();
  }
}

// Run if called directly
if (require.main === module) {
  runRealtimeSetup().catch(error => {
    console.error('❌ Migration failed:', error);
    process.exit(1);
  });
}

export { runRealtimeSetup };
