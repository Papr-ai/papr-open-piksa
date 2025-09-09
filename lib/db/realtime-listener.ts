/**
 * Server-side real-time database listener using PostgreSQL LISTEN/NOTIFY
 * This matches the pattern from your existing app for consistency
 */

import postgres from 'postgres';

// biome-ignore lint: Forbidden non-null assertion.
const connectionString = process.env.POSTGRES_URL!;

export interface RealtimeUpdate {
  table: 'subscription' | 'usage';
  operation: 'INSERT' | 'UPDATE' | 'DELETE';
  userId: string;
  data: any;
  timestamp: string;
}

export type RealtimeCallback = (update: RealtimeUpdate) => void;

/**
 * Helper function to handle notification processing
 */
function handleNotification(
  table: 'subscription' | 'usage',
  userId: string,
  payload: string,
  callback: RealtimeCallback
): void {
  try {
    console.log(`[Realtime Listener] Received notification on ${table} channel for user: ${userId}`);
    console.log(`[Realtime Listener] Payload:`, payload);

    // Parse the payload
    const updateData = JSON.parse(payload);
    
    const update: RealtimeUpdate = {
      table,
      operation: updateData.operation,
      userId,
      data: updateData.data,
      timestamp: updateData.timestamp || new Date().toISOString(),
    };

    callback(update);
  } catch (error) {
    console.error('[Realtime Listener] Error processing notification:', error);
  }
}

/**
 * Create a database listener for real-time updates using Neon's LISTEN/NOTIFY
 * This matches your existing pattern exactly
 */
export async function createDatabaseListener(
  userId: string, 
  callback: RealtimeCallback
): Promise<() => void> {
  // Create a dedicated connection for LISTEN
  const client = postgres(connectionString, {
    max: 1,
    idle_timeout: 0,
    max_lifetime: 0,
  });

  console.log(`[Realtime Listener] Setting up listener for user: ${userId}`);

  try {
    // Set up LISTEN for user-specific channels (matching your existing trigger format)
    const subscriptionChannel = `user_Subscription_${userId}`;
    const usageChannel = `user_Usage_${userId}`;
    
    await client`LISTEN ${client(subscriptionChannel)}`;
    await client`LISTEN ${client(usageChannel)}`;

    console.log(`[Realtime Listener] Listening for updates on user channels: ${userId}`);

    // Set up notification handlers using postgres.js listen method
    client.listen(subscriptionChannel, (payload: string) => {
      handleNotification('subscription', userId, payload, callback);
    });
    
    client.listen(usageChannel, (payload: string) => {
      handleNotification('usage', userId, payload, callback);
    });

  } catch (error) {
    console.error('[Realtime Listener] Error setting up listener:', error);
    await client.end();
    throw error;
  }

  // Return cleanup function
  return async () => {
    try {
      console.log(`[Realtime Listener] Cleaning up listener for user: ${userId}`);
      await client`UNLISTEN *;`;
      await client.end();
    } catch (error) {
      console.error('[Realtime Listener] Error during cleanup:', error);
    }
  };
}

/**
 * Send a notification to a user-specific channel
 * This is used by database triggers or application code
 */
export async function notifyUserUpdate(
  userId: string,
  table: 'subscription' | 'usage',
  operation: 'INSERT' | 'UPDATE' | 'DELETE',
  data: any
): Promise<void> {
  const client = postgres(connectionString, { max: 1 });
  
  try {
    const channel = `user_${table === 'subscription' ? 'Subscription' : 'Usage'}_${userId}`;
    const payload = JSON.stringify({
      operation,
      data,
      timestamp: new Date().toISOString(),
    });

    await client`SELECT pg_notify(${channel}, ${payload});`;
    console.log(`[Realtime Listener] Sent notification to channel: ${channel}`);
  } catch (error) {
    console.error('[Realtime Listener] Error sending notification:', error);
  } finally {
    await client.end();
  }
}
