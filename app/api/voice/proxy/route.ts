import { NextRequest } from 'next/server';
import { auth } from '@/app/(auth)/auth';
import { checkModelAccess } from '@/lib/subscription/utils';

// This endpoint will serve as a proxy for WebSocket connections
// Since browsers can't send custom headers with WebSocket connections,
// we'll use this to validate auth and provide the necessary connection details

export async function POST(request: NextRequest) {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return new Response(JSON.stringify({
        error: 'Unauthorized',
        code: 'UNAUTHORIZED'
      }), { 
        status: 401,
        headers: { 'Content-Type': 'application/json' }
      });
    }

    const { chatId, selectedModel = 'gpt-4o-realtime-preview' } = await request.json();

    // Check model access
    const modelAccess = await checkModelAccess(session.user.id, selectedModel);
    if (!modelAccess.allowed) {
      return new Response(JSON.stringify({ 
        error: modelAccess.reason || 'Model access denied',
        code: 'MODEL_ACCESS_DENIED'
      }), { 
        status: 403,
        headers: { 'Content-Type': 'application/json' }
      });
    }

    // Get OpenAI API key from environment
    const apiKey = process.env.OPENAI_API_KEY;
    if (!apiKey) {
      return new Response(JSON.stringify({
        error: 'OpenAI API key not configured',
        code: 'API_KEY_MISSING'
      }), {
        status: 500,
        headers: { 'Content-Type': 'application/json' }
      });
    }

    // Since we can't directly proxy WebSocket in Next.js,
    // we'll need to use Server-Sent Events or create a custom WebSocket server
    // For now, let's return an error indicating this limitation
    
    return new Response(JSON.stringify({
      error: 'Direct WebSocket connection to OpenAI Realtime API is not supported from browsers due to CORS and authentication limitations. Consider using a dedicated WebSocket server or Server-Sent Events.',
      code: 'WEBSOCKET_NOT_SUPPORTED',
      suggestion: 'Use a dedicated Node.js WebSocket server or implement Server-Sent Events for real-time communication.'
    }), {
      status: 501,
      headers: { 'Content-Type': 'application/json' }
    });

  } catch (error) {
    console.error('[Voice Proxy] Error:', error);
    return new Response(JSON.stringify({
      error: 'Internal server error',
      code: 'INTERNAL_ERROR'
    }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' }
    });
  }
}
