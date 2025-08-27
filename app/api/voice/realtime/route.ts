import { NextRequest } from 'next/server';
import { auth } from '@/app/(auth)/auth';
import { checkModelAccess } from '@/lib/subscription/utils';
import { generateVoiceSessionInstructions } from '@/lib/ai/voice-context';
import { getOrCreateChatContext } from '@/lib/ai/memory/chat-context';
import { checkVoiceChatLimit, trackVoiceChat } from '@/lib/subscription/usage-middleware';


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

    // Check voice chat usage limits
    console.log('[Voice API] Checking voice chat usage limits for user:', session.user.id);
    const usageCheck = await checkVoiceChatLimit(session.user.id);
    
    if (!usageCheck.allowed) {
      console.log('[Voice API] Voice chat limit exceeded:', usageCheck.reason);
      return new Response(JSON.stringify({
        error: usageCheck.reason,
        code: 'VOICE_CHAT_LIMIT_EXCEEDED',
        usage: usageCheck.usage,
        shouldShowUpgrade: usageCheck.shouldShowUpgrade
      }), {
        status: 429, // Too Many Requests
        headers: { 'Content-Type': 'application/json' }
      });
    }

    console.log('[Voice API] Voice chat usage check passed:', 
      `${usageCheck.usage?.current}/${usageCheck.usage?.limit} (${usageCheck.usage?.percentage.toFixed(1)}%)`);
    
    if (usageCheck.shouldShowUpgrade) {
      console.log('[Voice API] User approaching voice chat limit - should show upgrade prompt');
    }

    // Parse request body for chat context
    const body = await request.json();
    const { chatId, selectedModel, messages = [], recentChats = [] } = body;

    console.log('[Voice API] Request body received:', {
      chatId,
      selectedModel,
      messageCount: messages.length,
      recentChatsCount: recentChats.length,
      recentChatsPreview: recentChats.slice(0, 3).map((chat: any) => ({
        id: chat.id,
        title: chat.title,
        oneSentenceSummary: chat.oneSentenceSummary,
        hasTitle: !!chat.title,
        hasSummary: !!chat.oneSentenceSummary
      }))
    });

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

    // Ensure chat exists with user context (like text API does)
    console.log('[Voice API] Ensuring chat context exists for chat:', chatId);
    const { contextString } = await getOrCreateChatContext(
      chatId || 'unknown',
      session.user.id,
      messages
    );
    
    console.log('[Voice API] User context retrieved:', {
      hasContext: !!contextString,
      contextLength: contextString.length,
      contextPreview: contextString.substring(0, 200) + '...'
    });
    
    // Generate context-aware instructions with recent chat history and cached user context
    const contextInstructions = await generateVoiceSessionInstructions(
      messages, 
      chatId || 'unknown',
      recentChats // Pass recent chats from client-side cache
    );
    
    console.log('[Voice API] Creating session with context for chat:', chatId);
    console.log('[Voice API] Message count for context:', messages.length);
    console.log('[Voice API] Recent chats count for context:', recentChats.length);

    // Tools will be registered via WebRTC data channel on client side
    const voiceTools: any[] = [];
    
    console.log('[Voice API] 🛠️ VOICE TOOLS CONFIGURATION');
    console.log('='.repeat(60));
    console.log('[Voice API] Tools will be registered via WebRTC data channel');
    console.log('[Voice API] Server-side tools count:', voiceTools.length);
    console.log('='.repeat(60));

    // Prepare session configuration
    const sessionConfig = {
      model: 'gpt-4o-realtime-preview-2024-12-17',
      voice: 'alloy',
      instructions: contextInstructions,
      input_audio_format: 'pcm16',
      output_audio_format: 'pcm16',
      turn_detection: {
        type: 'server_vad',
        threshold: 0.5,
        prefix_padding_ms: 300,
        silence_duration_ms: 200
      },
      tools: voiceTools,
      tool_choice: 'auto',
      temperature: 0.8,
      max_response_output_tokens: 4096
    };

    console.log('[Voice API] 📤 SENDING SESSION CONFIG TO OPENAI');
    console.log('='.repeat(60));
    console.log('[Voice API] Model:', sessionConfig.model);
    console.log('[Voice API] Tools Count:', sessionConfig.tools.length);
    console.log('[Voice API] Tool Choice:', sessionConfig.tool_choice);
    console.log('[Voice API] Full Session Config:');
    console.log(JSON.stringify(sessionConfig, null, 2));
    console.log('='.repeat(60));

    // Generate ephemeral token for WebRTC connection
    const response = await fetch('https://api.openai.com/v1/realtime/sessions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(sessionConfig),
    });

    if (!response.ok) {
      const error = await response.text();
      console.error('[Voice API] ❌ OPENAI SESSION CREATION FAILED');
      console.error('='.repeat(60));
      console.error('[Voice API] Status:', response.status);
      console.error('[Voice API] Status Text:', response.statusText);
      console.error('[Voice API] Error Response:', error);
      console.error('='.repeat(60));
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
    
    console.log('[Voice API] ✅ OPENAI SESSION CREATED SUCCESSFULLY');
    console.log('='.repeat(60));
    console.log('[Voice API] Session ID:', data.id);
    console.log('[Voice API] Expires At:', data.expires_at);
    console.log('[Voice API] Has Client Secret:', !!data.client_secret?.value);
    console.log('[Voice API] Session Response:');
    console.log(JSON.stringify(data, null, 2));
    console.log('='.repeat(60));
    
    // Track voice chat usage
    try {
      await trackVoiceChat(session.user.id);
      console.log('[Voice API] ✅ Voice chat usage tracked successfully');
    } catch (error) {
      console.error('[Voice API] ❌ Failed to track voice chat usage:', error);
      // Don't fail the request if usage tracking fails
    }
    
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