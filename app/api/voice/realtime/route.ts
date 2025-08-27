import { NextRequest } from 'next/server';
import { auth } from '@/app/(auth)/auth';
import { checkModelAccess } from '@/lib/subscription/utils';

// Generate ephemeral token for OpenAI Realtime API WebRTC connection
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

    // Check model access for realtime API
    const modelAccess = await checkModelAccess(session.user.id, 'gpt-4o-realtime-preview');
    if (!modelAccess.allowed) {
      return new Response(JSON.stringify({ 
        error: modelAccess.reason || 'Realtime API access denied',
        code: 'MODEL_ACCESS_DENIED'
      }), { 
        status: 403,
        headers: { 'Content-Type': 'application/json' }
      });
    }

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

    // Generate ephemeral token for WebRTC connection
    const response = await fetch('https://api.openai.com/v1/realtime/sessions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'gpt-4o-realtime-preview-2024-12-17',
        voice: 'alloy',
        instructions: 'You are a helpful AI assistant. Respond naturally and conversationally.',
        input_audio_format: 'pcm16',
        output_audio_format: 'pcm16',
        turn_detection: {
          type: 'server_vad',
          threshold: 0.5,
          prefix_padding_ms: 300,
          silence_duration_ms: 200
        },
        tools: [], // Add tools later if needed
        tool_choice: 'auto',
        temperature: 0.8,
        max_response_output_tokens: 4096
      }),
    });

    if (!response.ok) {
      const error = await response.text();
      console.error('[Voice API] OpenAI error:', error);
      return new Response(JSON.stringify({
        error: 'Failed to create realtime session',
        code: 'OPENAI_ERROR',
        details: error
      }), {
        status: response.status,
        headers: { 'Content-Type': 'application/json' }
      });
    }

    const data = await response.json();
    
    return new Response(JSON.stringify({
      success: true,
      client_secret: data.client_secret.value,
      session_id: data.id,
      expires_at: data.expires_at
    }), {
      headers: { 'Content-Type': 'application/json' }
    });

  } catch (error) {
    console.error('[Voice API] Error:', error);
    return new Response(JSON.stringify({
      error: 'Internal server error',
      code: 'INTERNAL_ERROR'
    }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' }
    });
  }
}
