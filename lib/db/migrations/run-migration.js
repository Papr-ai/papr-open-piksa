// Plain JavaScript migration script that can run with Node.js without server-only restrictions
const { exec } = require('child_process');
require('dotenv').config();

if (!process.env.POSTGRES_URL) {
  console.error('POSTGRES_URL environment variable is not set');
  process.exit(1);
}

const POSTGRES_URL = process.env.POSTGRES_URL;

// SQL commands to execute
const sqlCommands = [
  `ALTER TABLE "Vote_v2" ADD COLUMN IF NOT EXISTS "isSaved" boolean NOT NULL DEFAULT false;`,
  `ALTER TABLE "Vote" ADD COLUMN IF NOT EXISTS "isSaved" boolean NOT NULL DEFAULT false;`
];

// Prepare the commands to run with psql
const commands = sqlCommands.map(cmd => {
  // Escape the SQL command for the shell
  const escapedCmd = cmd.replace(/'/g, "'\\''");
  return `psql "${POSTGRES_URL}" -c '${escapedCmd}'`;
});

console.log('Starting migration: Adding isSaved column to vote tables');

// Execute each command in sequence
async function runMigration() {
  for (const command of commands) {
    console.log(`Executing: ${command}`);
    try {
      await new Promise((resolve, reject) => {
        exec(command, (error, stdout, stderr) => {
          if (error) {
            console.error(`Error: ${error.message}`);
            reject(error);
            return;
          }
          if (stderr) {
            console.log(`stderr: ${stderr}`);
          }
          console.log(`stdout: ${stdout}`);
          resolve();
        });
      });
    } catch (error) {
      console.error('Migration failed:', error);
      process.exit(1);
    }
  }
  console.log('Migration completed successfully');
}

runMigration(); 