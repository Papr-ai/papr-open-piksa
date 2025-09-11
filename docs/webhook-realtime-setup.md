# Fly.io WebSocket Realtime Architecture

This document describes the new Fly.io-based realtime architecture that replaces the expensive Server-Sent Events (SSE) system.

## Problem with Previous Architecture

The previous architecture used Server-Sent Events (SSE) with persistent HTTP connections:
- Each user session opened a long-lived HTTP connection to `/api/realtime/subscribe`
- **Each SSE connection created a dedicated PostgreSQL connection** using `LISTEN/NOTIFY`
- Connections stayed open indefinitely, causing thousands of connection hours on Vercel
- **Cost impact**: Thousands of dollars in Vercel usage fees

## New Fly.io Architecture

The new architecture uses a single database listener + WebSocket server on Fly.io:

```
Neon/Postgres DB → Fly.io (Single LISTEN + WebSocket Server) → Frontend Clients
```

**Key improvements:**
- ✅ **One database connection** on Fly.io (not per client!)
- ✅ **WebSocket server on Fly.io** (not Vercel)
- ✅ **Vercel only serves pages/auth** and initial snapshots
- ✅ **No persistent connections on Vercel** = massive cost savings

### Components

1. **Fly.io Service**: Single database listener + WebSocket server
2. **Vercel Token Endpoint**: Issues short-lived JWT tokens for WebSocket auth
3. **WebSocket Client**: Connects directly to Fly.io WebSocket server
4. **React Context**: Updated subscription and usage data

## Setup Instructions

### 1. Environment Variables

**Vercel (`.env.local`):**
```bash
# JWT secret for WebSocket authentication (same on both services)
WEBSOCKET_JWT_SECRET=your-secure-jwt-secret-here

# Your Fly.io WebSocket server URL  
NEXT_PUBLIC_WEBSOCKET_URL=wss://papr-realtime.fly.dev
```

**Fly.io service:**
```bash
# Your Neon database connection
DATABASE_URL=postgresql://username:password@host/database

# JWT secret for validating tokens (same as above)
WEBSOCKET_JWT_SECRET=your-secure-jwt-secret-here

# Port for WebSocket server
PORT=3000

# Allowed origins for WebSocket connections (comma-separated)
ALLOWED_ORIGINS=https://your-app.vercel.app,https://your-domain.com,http://localhost:3000
```

### 2. Fly.io Service

Your Fly.io service runs:

1. **Single PostgreSQL LISTEN connection** (not per client!)
2. **WebSocket server** for real-time communication
3. **JWT validation** for secure authentication

The service listens for changes on these channels:
- `user_Subscription_{userId}`
- `user_Usage_{userId}`

### 3. Authentication Flow

1. Frontend requests token from your app: `GET /api/auth/websocket-token`
2. Your app issues JWT token (1 hour) with:
   ```javascript
   jwt.sign({ userId }, secret, {
     issuer: 'papr-app',
     audience: 'papr-realtime',
     expiresIn: '1h'
   })
   ```
3. Frontend connects to Fly.io WebSocket: `wss://papr-realtime.fly.dev/ws`
4. Fly.io validates JWT and establishes connection

### 4. Frontend Integration

The frontend automatically uses the new WebSocket client:

```typescript
import { useWebSocketUpdates } from '@/lib/websocket/client';

// Drop-in replacement for the old useRealtimeUpdates
const { isConnected } = useWebSocketUpdates((update) => {
  if (update.table === 'subscription') {
    // Handle subscription updates
  }
});
```

## Migration Notes

### What Changed

- ✅ **Removed**: Expensive SSE endpoint (`/api/realtime/subscribe`)
- ✅ **Removed**: Per-client database connections (the expensive part!)
- ✅ **Added**: Single database listener on Fly.io
- ✅ **Added**: WebSocket server on Fly.io (not Vercel)
- ✅ **Added**: JWT token endpoint for WebSocket auth
- ✅ **Updated**: WebSocket client connects directly to Fly.io

### Backward Compatibility

The new `useWebSocketUpdates` hook provides the same interface as the old `useRealtimeUpdates` hook, so existing components continue to work without changes.

## Architecture Benefits

### Cost Impact

**Before**: 
- Thousands of persistent HTTP connections on Vercel
- Each connection = dedicated PostgreSQL connection
- Connection hours × $$$ = expensive!

**After**:
- **Single PostgreSQL connection** on Fly.io
- WebSocket server on Fly.io (cheaper than Vercel)
- Vercel only serves pages + auth tokens

**Expected savings: 90%+ reduction** in realtime infrastructure costs!

### Performance Impact

- **Faster**: Direct WebSocket connection (no HTTP overhead)
- **More reliable**: Single database connection is more stable
- **Scalable**: One database connection handles all users

## Monitoring

### Fly.io Health Check

```bash
curl https://your-app.fly.dev/health
```

Returns:
```json
{
  "status": "healthy",
  "timestamp": "2024-01-01T00:00:00.000Z",
  "uptime": 3600,
  "connectedUsers": 25,
  "totalConnections": 42
}
```

### Connection Status

The WebSocket client provides connection status:

```typescript
const { isConnected, subscriberCount } = useWebSocketUpdates(callback);
console.log(`Connected: ${isConnected}, Subscribers: ${subscriberCount}`);
```

## Troubleshooting

### Common Issues

1. **WebSocket connection fails**: Check `NEXT_PUBLIC_WEBSOCKET_URL` and Fly.io deployment
2. **Authentication errors**: Verify `WEBSOCKET_JWT_SECRET` matches between Vercel and Fly.io
3. **Database notifications not working**: Check PostgreSQL triggers are still active

### Debug Endpoints

- `GET https://your-app.fly.dev/health` - Fly.io service health
- `GET /api/auth/websocket-token` - Get JWT token for testing

## Next Steps

1. **Deploy Fly.io service** using the provided example
2. **Configure JWT secrets** in both Vercel and Fly.io
3. **Set WebSocket URL** in `NEXT_PUBLIC_WEBSOCKET_URL`
4. **Test connection** and monitor cost reduction
5. **Celebrate** your 90% cost savings! 🎉
