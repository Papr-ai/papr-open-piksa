import type { Config } from 'drizzle-kit';
import dotenv from 'dotenv';

// Load environment variables
dotenv.config({ path: '.env.local' });

if (!process.env.POSTGRES_URL) {
  throw new Error('POSTGRES_URL is not defined in environment variables');
}

export default {
  schema: './lib/db/schema.ts',
  out: './drizzle',
  dialect: 'postgresql',
  dbCredentials: {
    url: process.env.POSTGRES_URL,
  },
} as Config; 