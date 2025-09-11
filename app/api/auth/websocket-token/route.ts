import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/app/(auth)/auth';
import jwt from 'jsonwebtoken';

// Simple in-memory rate limiter for WebSocket token requests
// In production, consider using Redis or a proper rate limiting service
const rateLimiter = new Map<string, { count: number; resetTime: number }>();

function isRateLimited(identifier: string, maxRequests = 10, windowMs = 60000): boolean {
  const now = Date.now();
  const userLimit = rateLimiter.get(identifier);
  
  if (!userLimit || now > userLimit.resetTime) {
    // Reset or create new limit window
    rateLimiter.set(identifier, { count: 1, resetTime: now + windowMs });
    return false;
  }
  
  if (userLimit.count >= maxRequests) {
    return true; // Rate limited
  }
  
  userLimit.count++;
  return false;
}

// Clean up old entries periodically
setInterval(() => {
  const now = Date.now();
  for (const [key, value] of rateLimiter.entries()) {
    if (now > value.resetTime) {
      rateLimiter.delete(key);
    }
  }
}, 60000); // Clean up every minute

/**
 * Generate short-lived JWT tokens for WebSocket authentication
 * Vercel serves these tokens, Fly.io WebSocket server validates them
 */
export async function GET(request: NextRequest) {
  try {
    // Verify user is authenticated
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const userId = session.user.id;
    
    // Rate limiting: 10 requests per minute per user
    // Use both IP and userId for more robust rate limiting
    const clientIp = request.headers.get('x-forwarded-for') || 
                    request.headers.get('x-real-ip') || 
                    'unknown';
    const rateLimitKey = `${userId}:${clientIp}`;
    
    if (isRateLimited(rateLimitKey, 10, 60000)) {
      console.warn(`[WebSocket Token] Rate limited user ${userId} from IP ${clientIp}`);
      return NextResponse.json(
        { error: 'Too many token requests. Please wait before trying again.' }, 
        { 
          status: 429,
          headers: {
            'Retry-After': '60',
            'X-RateLimit-Limit': '10',
            'X-RateLimit-Remaining': '0',
            'X-RateLimit-Reset': String(Math.ceil(Date.now() / 1000) + 60)
          }
        }
      );
    }
    
    // Create short-lived JWT token (30 minutes - security best practice)
    const secret = process.env.WEBSOCKET_JWT_SECRET;
    if (!secret) {
      console.error('[WebSocket Token] WEBSOCKET_JWT_SECRET not configured');
      return NextResponse.json({ error: 'Server configuration error' }, { status: 500 });
    }

    const token = jwt.sign(
      {
        userId,
        email: session.user.email,
        iat: Math.floor(Date.now() / 1000),
      },
      secret,
      {
        expiresIn: '30m', // 30 minutes for better security
        issuer: 'papr-app',
        audience: 'papr-realtime',
      }
    );

    console.log(`[WebSocket Token] Generated token for user: ${userId} (rate limit key: ${rateLimitKey})`);

    return NextResponse.json({ 
      token,
      expiresIn: 1800, // 30 minutes in seconds
      userId,
    });

  } catch (error) {
    console.error('[WebSocket Token] Error generating token:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
