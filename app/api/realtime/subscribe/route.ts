import { NextRequest } from 'next/server';
import { auth } from '@/app/(auth)/auth';
import { createDatabaseListener } from '@/lib/db/realtime-listener';

/**
 * Server-Sent Events endpoint for real-time database updates
 * This replaces polling with instant notifications when subscription/usage data changes
 */
export async function GET(request: NextRequest) {
  try {
    // Verify authentication
    const session = await auth();
    if (!session?.user?.id) {
      return new Response('Unauthorized', { status: 401 });
    }

    const userId = session.user.id;
    const searchParams = request.nextUrl.searchParams;
    const requestedUserId = searchParams.get('userId');

    // Ensure user can only subscribe to their own updates
    if (requestedUserId !== userId) {
      return new Response('Forbidden', { status: 403 });
    }

    console.log(`[Realtime SSE] Starting real-time subscription for user: ${userId}`);

    // Create readable stream for SSE
    const encoder = new TextEncoder();
    let isConnected = true;
    let cleanup: (() => Promise<void>) | (() => void) | null = null;

    const stream = new ReadableStream({
      async start(controller) {
        console.log(`[Realtime SSE] SSE connection established for user: ${userId}`);

        // Send initial connection confirmation
        const connectData = encoder.encode(`data: ${JSON.stringify({ 
          type: 'connected', 
          userId,
          timestamp: new Date().toISOString() 
        })}\n\n`);
        controller.enqueue(connectData);

        try {
          // Create database listener for this user
          cleanup = await createDatabaseListener(userId, (update) => {
            if (!isConnected) return;

            try {
              const eventData = encoder.encode(`data: ${JSON.stringify({
                type: 'update',
                table: update.table,
                operation: update.operation,
                data: update.data,
                timestamp: update.timestamp
              })}\n\n`);
              
              controller.enqueue(eventData);
              console.log(`[Realtime SSE] Sent ${update.table} update to user ${userId}`);
            } catch (error) {
              console.error('[Realtime SSE] Error sending update:', error);
            }
          });

        } catch (error) {
          console.error('[Realtime SSE] Error creating database listener:', error);
          controller.error(error);
          return;
        }

        // Set up heartbeat to keep connection alive
        const heartbeat = setInterval(() => {
          if (!isConnected) {
            clearInterval(heartbeat);
            return;
          }

          try {
            // Check if controller is still open before writing
            if (controller.desiredSize === null) {
              console.log('[Realtime SSE] Controller closed, stopping heartbeat');
              clearInterval(heartbeat);
              isConnected = false;
              return;
            }
            
            const heartbeatData = encoder.encode(`data: ${JSON.stringify({ 
              type: 'heartbeat', 
              timestamp: new Date().toISOString() 
            })}\n\n`);
            controller.enqueue(heartbeatData);
          } catch (error) {
            console.error('[Realtime SSE] Heartbeat error:', error);
            clearInterval(heartbeat);
            isConnected = false;
          }
        }, 30000); // 30 second heartbeat

        // Handle cleanup when connection closes
        request.signal.addEventListener('abort', async () => {
          console.log(`[Realtime SSE] Connection aborted for user: ${userId}`);
          isConnected = false;
          clearInterval(heartbeat);
          
          try {
            if (cleanup) {
              await cleanup();
            }
            controller.close();
          } catch (error) {
            console.error('[Realtime SSE] Error during cleanup:', error);
          }
        });
      },

      async cancel() {
        console.log(`[Realtime SSE] Stream cancelled for user: ${userId}`);
        isConnected = false;
        if (cleanup) {
          await cleanup();
        }
      }
    });

    // Return SSE response with proper headers
    return new Response(stream, {
      headers: {
        'Content-Type': 'text/event-stream',
        'Cache-Control': 'no-cache',
        'Connection': 'keep-alive',
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Headers': 'Cache-Control',
      },
    });

  } catch (error) {
    console.error('[Realtime SSE] Error setting up SSE connection:', error);
    return new Response('Internal Server Error', { status: 500 });
  }
}

// Handle preflight requests
export async function OPTIONS() {
  return new Response(null, {
    status: 200,
    headers: {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'GET, OPTIONS',
      'Access-Control-Allow-Headers': 'Cache-Control',
    },
  });
}
