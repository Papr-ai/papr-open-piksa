#!/usr/bin/env node

/**
 * Simple setup script for real-time database triggers
 * Usage: node scripts/setup-realtime.js
 */

const { execSync } = require('child_process');
const path = require('path');

console.log('🚀 Setting up real-time database notifications...\n');

try {
  // Run the TypeScript migration
  const migrationPath = path.join(__dirname, '..', 'lib', 'db', 'migrations', 'run-realtime-setup.ts');
  
  console.log('📦 Compiling and running migration...');
  execSync(`npx tsx "${migrationPath}"`, { 
    stdio: 'inherit',
    cwd: path.join(__dirname, '..')
  });

  console.log('\n✅ Real-time setup completed successfully!');
  console.log('\n📋 What was set up:');
  console.log('   ✓ Database triggers for Subscription table');
  console.log('   ✓ Database triggers for Usage table');
  console.log('   ✓ PostgreSQL notification function');
  console.log('   ✓ Performance indexes');
  console.log('\n🎯 Next steps:');
  console.log('   1. Update your React components to use the new real-time hooks');
  console.log('   2. Replace polling with real-time subscriptions');
  console.log('   3. Test real-time updates by changing subscription/usage data');
  console.log('\n📖 See the optimization guide for implementation details.');

} catch (error) {
  console.error('\n❌ Setup failed:', error.message);
  console.error('\n🔧 Troubleshooting:');
  console.error('   1. Make sure POSTGRES_URL environment variable is set');
  console.error('   2. Ensure your database user has CREATE permissions');
  console.error('   3. Check that your database is accessible');
  console.error('   4. Verify you have tsx installed: npm install -g tsx');
  process.exit(1);
}
