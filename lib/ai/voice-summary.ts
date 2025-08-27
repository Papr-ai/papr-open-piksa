import type { UIMessage } from 'ai';
import { toast } from 'sonner';

/**
 * Helper function to extract message content from UIMessage
 */
function extractMessageContent(message: UIMessage): string {
  let content = '';
  if ('content' in message && message.content) {
    content = String(message.content);
  } else if (message.parts) {
    content = message.parts
      .map((part) => {
        if (typeof part === 'string') return part;
        if (typeof part === 'object') {
          if ('text' in part) return part.text;
          if ('content' in part) return part.content;
          return JSON.stringify(part);
        }
        return '';
      })
      .join(' ')
      .trim();
  }
  return content;
}

export interface VoiceSummaryOptions {
  userId: string;
  chatId: string;
  messages: UIMessage[];
  sessionStartTime?: Date;
  sessionEndTime?: Date;
}

/**
 * Generate and save a summary of a voice conversation session to memory
 */
export async function saveVoiceConversationSummary({
  userId,
  chatId,
  messages,
  sessionStartTime,
  sessionEndTime,
}: VoiceSummaryOptions): Promise<boolean> {
  try {
    console.log('[Voice Summary] Starting summary generation for chat:', chatId);

    // Filter messages to only include those from the voice session
    let sessionMessages = messages;
    if (sessionStartTime) {
      sessionMessages = messages.filter(msg => {
        // Check if message has createdAt property, otherwise use current time
        const msgTime = new Date((msg as any).createdAt || Date.now());
        return msgTime >= sessionStartTime;
      });
    }

    // Need at least 2 messages (user + assistant) to summarize
    if (sessionMessages.length < 2) {
      console.log('[Voice Summary] Not enough messages to summarize');
      return false;
    }

    // Create conversation text for summarization
    const conversationText = sessionMessages.map(msg => {
      const content = extractMessageContent(msg);
      return `${msg.role}: ${content}`;
    }).join('\n\n');

    console.log('[Voice Summary] Generating summary for conversation:', {
      messageCount: sessionMessages.length,
      conversationLength: conversationText.length
    });

    // Generate summary using the chat-simple API
    const summaryResponse = await fetch('/api/chat-simple', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        messages: [
          {
            id: 'voice-summary-request',
            role: 'user',
            content: `Please create a concise summary of this voice conversation session. Focus on:
- Main topics discussed
- Key decisions or conclusions reached
- Important information shared
- Action items or next steps mentioned
- Any preferences or goals discussed

Keep the summary concise but comprehensive. Here's the voice conversation:

${conversationText}`,
          }
        ],
        selectedModel: 'gpt-5-nano',
        isMemoryEnabled: false, // Don't store the summary request itself
        isWebSearchEnabled: false,
      }),
    });

    if (!summaryResponse.ok) {
      throw new Error(`Summary generation failed: ${summaryResponse.status}`);
    }

    // Read the streaming response
    const reader = summaryResponse.body?.getReader();
    if (!reader) throw new Error('No response body');

    let summary = '';
    const decoder = new TextDecoder();

    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      
      const chunk = decoder.decode(value);
      const lines = chunk.split('\n');
      
      for (const line of lines) {
        if (line.startsWith('0:')) {
          try {
            const data = JSON.parse(line.slice(2));
            if (data.type === 'text-delta') {
              summary += data.textDelta;
            }
          } catch (e) {
            // Ignore parsing errors for streaming chunks
          }
        }
      }
    }

    if (!summary.trim()) {
      throw new Error('Empty summary generated');
    }

    console.log('[Voice Summary] Generated summary:', {
      summaryLength: summary.length,
      preview: summary.substring(0, 100) + '...'
    });

    // Determine the session duration
    const sessionDuration = sessionStartTime && sessionEndTime 
      ? Math.round((sessionEndTime.getTime() - sessionStartTime.getTime()) / 1000 / 60) // minutes
      : null;

    // Create session metadata
    const sessionInfo = sessionDuration 
      ? ` (${sessionDuration} min voice session)`
      : ' (voice session)';

    // Save the summary to memory using the memory API
    const memoryResponse = await fetch('/api/memory', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        content: `Voice Conversation Summary${sessionInfo}: ${summary.trim()}`,
        category: 'knowledge',
        type: 'text',
        emoji_tags: ['🎙️', '💬', '📝', '🔍'],
        topics: ['voice conversation', 'summary', 'discussion', 'session'],
        hierarchical_structure: `knowledge/voice-sessions/${chatId}/${new Date().toISOString().split('T')[0]}`,
      }),
    });

    if (!memoryResponse.ok) {
      const errorData = await memoryResponse.json().catch(() => ({}));
      throw new Error(`Memory save failed: ${memoryResponse.status} - ${errorData.error || 'Unknown error'}`);
    }

    const memoryResult = await memoryResponse.json();
    console.log('[Voice Summary] Successfully saved to memory:', memoryResult);

    // Show success notification
    toast.success('Voice conversation summary saved to memory!', {
      description: 'Your conversation has been summarized and stored for future reference.',
    });

    return true;
  } catch (error) {
    console.error('[Voice Summary] Error generating/saving summary:', error);
    
    // Show error notification
    toast.error('Failed to save conversation summary', {
      description: 'There was an issue saving your voice conversation summary.',
    });
    
    return false;
  }
}
