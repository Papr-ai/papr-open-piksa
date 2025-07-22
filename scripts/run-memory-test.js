#!/usr/bin/env node

/**
 * Script to run the Papr Memory SDK integration tests
 * 
 * This script loads environment variables from .env.local and runs
 * the memory test suite.
 */

require('dotenv').config({ path: '.env.local' });
const { spawn } = require('child_process');

// Exit with error if no API key is set
if (!process.env.PAPR_MEMORY_API_KEY) {
  console.error('ERROR: PAPR_MEMORY_API_KEY environment variable is not set');
  console.error('Please add it to your .env.local file');
  process.exit(1);
}

console.log('Starting memory test runner...');
console.log(`API Key: ${process.env.PAPR_MEMORY_API_KEY ? '********' + process.env.PAPR_MEMORY_API_KEY.slice(-4) : 'Not set'}`);
console.log(`API URL: ${process.env.PAPR_MEMORY_API_URL || 'https://memory.papr.ai'}`);

// Run the test using npx tsx
const child = spawn('npx', ['tsx', './lib/ai/memory/memory-test.ts'], {
  stdio: 'inherit',
  shell: true
});

child.on('close', (code) => {
  console.log(`Memory test script completed with code ${code}`);
  process.exit(code);
});

child.on('error', (error) => {
  console.error('Error running memory test:', error);
  process.exit(1);
}); 