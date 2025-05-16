/**
 * Minimal version of queries.ts
 *
 * This file provides a minimal subset of database functionality
 * for use in memory middleware to avoid circular dependencies.
 */

import 'server-only';
import { eq } from 'drizzle-orm';
import { drizzle } from 'drizzle-orm/postgres-js';
import postgres from 'postgres';
import { user } from './schema';

// Initialize DB connection
// biome-ignore lint: Forbidden non-null assertion.
const client = postgres(process.env.POSTGRES_URL!);
const db = drizzle(client);

// Export minimal functionality
export { db, user, eq };
