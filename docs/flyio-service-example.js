/**
 * Fly.io WebSocket server for real-time database updates
 * Architecture: Neon DB → Fly.io (LISTEN + WebSocket Server) → Frontend Clients
 */

const postgres = require('postgres');
const WebSocket = require('ws');
const jwt = require('jsonwebtoken');
const http = require('http');

// Configuration
const config = {
  // Your Neon database connection string  
  databaseUrl: process.env.DATABASE_URL,
  
  // JWT secret for validating tokens from Vercel
  jwtSecret: process.env.WEBSOCKET_JWT_SECRET,
  
  // Port for WebSocket server
  port: process.env.PORT || 3000,
  
  // Allowed origins for WebSocket connections (security)
  allowedOrigins: process.env.ALLOWED_ORIGINS ? 
    process.env.ALLOWED_ORIGINS.split(',').map(origin => origin.trim()) : 
    ['https://your-app.vercel.app', 'https://your-domain.com', 'http://localhost:3000'],
};

// Create single database connection for LISTEN (not per-client!)
const sql = postgres(config.databaseUrl, {
  max: 1,
  idle_timeout: 0,
  max_lifetime: 0,
});

// Track WebSocket connections by userId
const userConnections = new Map();

/**
 * Broadcast update to user's WebSocket connections
 */
function broadcastToUser(userId, table, operation, data) {
  const connections = userConnections.get(userId);
  if (!connections || connections.size === 0) {
    console.log(`[WebSocket] No connections for user ${userId}`);
    return;
  }

  const message = JSON.stringify({
    type: 'realtime_update',
    data: {
      table,
      operation,
      data,
      timestamp: new Date().toISOString(),
    },
  });

  let sentCount = 0;
  let failedCount = 0;

  for (const ws of connections) {
    try {
      if (ws.readyState === WebSocket.OPEN) {
        ws.send(message);
        sentCount++;
      } else {
        // Remove dead connection
        connections.delete(ws);
        failedCount++;
      }
    } catch (error) {
      console.error(`[WebSocket] Error sending to user ${userId}:`, error);
      connections.delete(ws);
      failedCount++;
    }
  }

  console.log(`[WebSocket] Sent ${table} update to user ${userId}: ${sentCount} sent, ${failedCount} failed`);
}

/**
 * Handle database notification
 */
function handleNotification(table, userId, payload) {
  try {
    console.log(`[DB Listener] Received ${table} notification for user ${userId}`);
    
    const updateData = JSON.parse(payload);
    
    // Broadcast directly to user's WebSocket connections
    broadcastToUser(userId, table, updateData.operation, updateData.data);
    
  } catch (error) {
    console.error(`[DB Listener] Error processing ${table} notification:`, error);
  }
}

/**
 * Set up single database listener (not per-client!)
 */
async function setupDatabaseListeners() {
  try {
    console.log('[DB Listener] Setting up database listeners...');

    // Listen for all subscription and usage changes with a single connection
    // The database triggers will send notifications to user-specific channels
    
    // Set up listener for subscription changes
    sql.listen('user_subscription_*', (payload) => {
      // Extract userId from channel name: user_Subscription_${userId}
      const channelMatch = payload.channel.match(/user_Subscription_(.+)/);
      if (channelMatch) {
        const userId = channelMatch[1];
        handleNotification('subscription', userId, payload.payload);
      }
    });

    // Set up listener for usage changes
    sql.listen('user_usage_*', (payload) => {
      // Extract userId from channel name: user_Usage_${userId}
      const channelMatch = payload.channel.match(/user_Usage_(.+)/);
      if (channelMatch) {
        const userId = channelMatch[1];
        handleNotification('usage', userId, payload.payload);
      }
    });

    console.log('[DB Listener] Single database listener active for all users');

  } catch (error) {
    console.error('[DB Listener] Error setting up database listeners:', error);
    process.exit(1);
  }
}

/**
 * Validate JWT token from your app
 */
function validateToken(token) {
  try {
    const decoded = jwt.verify(token, config.jwtSecret, {
      issuer: 'papr-app',
      audience: 'papr-realtime',
    });
    return decoded;
  } catch (error) {
    console.error('[Auth] Invalid token:', error.message);
    return null;
  }
}

/**
 * Check if the origin is allowed for WebSocket connections
 */
function isOriginAllowed(origin) {
  if (!origin) {
    console.warn('[Security] WebSocket connection attempt without origin header');
    return false;
  }
  
  const isAllowed = config.allowedOrigins.includes(origin) || 
                   config.allowedOrigins.includes('*'); // Allow wildcard for development
  
  if (!isAllowed) {
    console.warn(`[Security] WebSocket connection blocked from unauthorized origin: ${origin}`);
  }
  
  return isAllowed;
}

/**
 * WebSocket server setup
 */
const server = http.createServer();
const wss = new WebSocket.Server({ 
  server,
  path: '/ws',
});

wss.on('connection', (ws, req) => {
  console.log('[WebSocket] New connection attempt');
  
  // Origin check for security
  const origin = req.headers.origin;
  if (!isOriginAllowed(origin)) {
    console.warn(`[Security] Rejecting WebSocket connection from unauthorized origin: ${origin}`);
    ws.close(1008, 'Unauthorized origin');
    return;
  }
  
  console.log(`[WebSocket] Origin check passed for: ${origin}`);
  
  let userId = null;
  let isAuthenticated = false;

  // Extract userId from query params
  const url = new URL(req.url, 'http://localhost');
  const queryUserId = url.searchParams.get('userId');

  ws.on('message', (data) => {
    try {
      const message = JSON.parse(data);
      
      if (message.type === 'auth') {
        // Validate JWT token from Vercel
        const decoded = validateToken(message.token);
        if (decoded && decoded.userId === message.userId && decoded.userId === queryUserId) {
          userId = decoded.userId;
          isAuthenticated = true;
          
          // Add to user connections
          if (!userConnections.has(userId)) {
            userConnections.set(userId, new Set());
          }
          userConnections.get(userId).add(ws);
          
          ws.send(JSON.stringify({ type: 'authenticated', userId }));
          console.log(`[WebSocket] User ${userId} authenticated and connected`);
        } else {
          ws.send(JSON.stringify({ type: 'auth_error', error: 'Invalid token' }));
          ws.close(1008, 'Invalid token');
        }
      } else if (message.type === 'ping') {
        ws.send(JSON.stringify({ type: 'pong', timestamp: new Date().toISOString() }));
      }
    } catch (error) {
      console.error('[WebSocket] Error processing message:', error);
    }
  });

  ws.on('close', () => {
    if (userId && userConnections.has(userId)) {
      userConnections.get(userId).delete(ws);
      if (userConnections.get(userId).size === 0) {
        userConnections.delete(userId);
      }
      console.log(`[WebSocket] User ${userId} disconnected`);
    }
  });

  ws.on('error', (error) => {
    console.error('[WebSocket] Connection error:', error);
  });

  // Request authentication
  ws.send(JSON.stringify({ type: 'auth_required' }));
});

// Health check endpoint
server.on('request', (req, res) => {
  if (req.url === '/health' && req.method === 'GET') {
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({
      status: 'healthy',
      timestamp: new Date().toISOString(),
      uptime: process.uptime(),
      connectedUsers: userConnections.size,
      totalConnections: Array.from(userConnections.values()).reduce((sum, set) => sum + set.size, 0),
    }));
  } else {
    res.writeHead(404);
    res.end('Not found');
  }
});

/**
 * Graceful shutdown
 */
async function shutdown() {
  console.log('[Service] Shutting down gracefully...');
  
  try {
    // Close all WebSocket connections
    wss.clients.forEach(ws => ws.close());
    
    // Stop listening to database
    await sql`UNLISTEN *`;
    await sql.end();
    
    // Close HTTP server
    server.close();
    
    console.log('[Service] Shutdown complete');
    process.exit(0);
  } catch (error) {
    console.error('[Service] Error during shutdown:', error);
    process.exit(1);
  }
}

// Handle shutdown signals
process.on('SIGTERM', shutdown);
process.on('SIGINT', shutdown);

/**
 * Start the service
 */
async function start() {
  try {
    console.log('[Service] Starting Fly.io WebSocket + Database Listener service...');
    
    // Validate configuration
    if (!config.databaseUrl) {
      throw new Error('DATABASE_URL environment variable is required');
    }
    if (!config.jwtSecret) {
      throw new Error('WEBSOCKET_JWT_SECRET environment variable is required');
    }

    // Start WebSocket + HTTP server
    server.listen(config.port, () => {
      console.log(`[Service] WebSocket server listening on port ${config.port}`);
      console.log(`[Service] Health check available at http://localhost:${config.port}/health`);
      console.log(`[Service] WebSocket endpoint: ws://localhost:${config.port}/ws`);
    });

    // Set up single database listener for all users
    await setupDatabaseListeners();
    
    console.log('[Service] ✅ Service started successfully');
    console.log('[Service] Architecture: Neon DB → Fly.io (LISTEN + WebSocket) → Frontend Clients');
    
  } catch (error) {
    console.error('[Service] Failed to start service:', error);
    process.exit(1);
  }
}

// Start the service
start();
