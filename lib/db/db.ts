import { drizzle } from 'drizzle-orm/postgres-js';
import postgres from 'postgres';
import dotenv from 'dotenv';

// Load environment variables
dotenv.config({ path: '.env.local' });

if (!process.env.POSTGRES_URL) {
  throw new Error('POSTGRES_URL is not defined in environment variables');
}

// biome-ignore lint: Forbidden non-null assertion.
const client = postgres(process.env.POSTGRES_URL!);
export const db = drizzle(client);
