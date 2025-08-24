import type { UIMessage } from 'ai';

// Token estimation - rough approximation (1 token ≈ 4 characters)
function estimateTokens(text: string): number {
  return Math.ceil(text.length / 4);
}

// Estimate tokens for a message
function estimateMessageTokens(message: UIMessage): number {
  let totalTokens = 0;
  
  if (message.parts) {
    for (const part of message.parts) {
      if (part.type === 'text' && 'text' in part) {
        totalTokens += estimateTokens(part.text);
      }
    }
  }
  
  // Add some overhead for message metadata
  return totalTokens + 10;
}

// Estimate total tokens for conversation
export function estimateConversationTokens(messages: UIMessage[]): number {
  return messages.reduce((total, message) => total + estimateMessageTokens(message), 0);
}

// Model-specific rate limits (tokens per minute)
export const MODEL_RATE_LIMITS: Record<string, number> = {
  'openai/gpt-oss-120b': 8000,
  'openai/gpt-oss-20b': 8000,
  'deepseek-r1-distill-llama-70b': 30000,
  'llama-3.3-70b-versatile': 30000,
  'gpt-5': 50000,
  'gpt-5-mini': 50000,
  // Add more models as needed
};

// Get rate limit for a model (default to conservative 8000)
export function getModelRateLimit(modelId: string): number {
  return MODEL_RATE_LIMITS[modelId] || 8000;
}

// Check if error is a rate limit error
export function isRateLimitError(error: any): boolean {
  if (!error) return false;
  
  const errorMessage = error.message || error.toString() || '';
  const errorString = errorMessage.toLowerCase();
  
  return (
    errorString.includes('request too large') ||
    errorString.includes('rate limit') ||
    errorString.includes('tokens per minute') ||
    errorString.includes('tpm') ||
    errorString.includes('limit 8000') ||
    (error.status === 429)
  );
}

// Truncate conversation to fit within token limit
export function truncateConversation(
  messages: UIMessage[], 
  maxTokens: number,
  preserveLastUserMessage: boolean = true
): UIMessage[] {
  if (messages.length === 0) return messages;
  
  // Always preserve system message if it exists
  const systemMessage = messages.find(m => m.role === 'system');
  const otherMessages = messages.filter(m => m.role !== 'system');
  
  // If preserving last user message, separate it
  let lastUserMessage: UIMessage | undefined;
  let messagesToTruncate = otherMessages;
  
  if (preserveLastUserMessage) {
    // Find the last user message
    for (let i = otherMessages.length - 1; i >= 0; i--) {
      if (otherMessages[i].role === 'user') {
        lastUserMessage = otherMessages[i];
        messagesToTruncate = [
          ...otherMessages.slice(0, i),
          ...otherMessages.slice(i + 1)
        ];
        break;
      }
    }
  }
  
  // Calculate tokens for preserved messages
  let reservedTokens = 0;
  if (systemMessage) reservedTokens += estimateMessageTokens(systemMessage);
  if (lastUserMessage) reservedTokens += estimateMessageTokens(lastUserMessage);
  
  const availableTokens = maxTokens - reservedTokens;
  
  // Truncate from the beginning, keeping recent messages
  const truncatedMessages: UIMessage[] = [];
  let currentTokens = 0;
  
  // Add messages from most recent backwards until we hit the limit
  for (let i = messagesToTruncate.length - 1; i >= 0; i--) {
    const message = messagesToTruncate[i];
    const messageTokens = estimateMessageTokens(message);
    
    if (currentTokens + messageTokens <= availableTokens) {
      truncatedMessages.unshift(message);
      currentTokens += messageTokens;
    } else {
      break;
    }
  }
  
  // Rebuild the final message array
  const result: UIMessage[] = [];
  if (systemMessage) result.push(systemMessage);
  result.push(...truncatedMessages);
  if (lastUserMessage) result.push(lastUserMessage);
  
  console.log(`[RATE LIMIT] Truncated conversation from ${messages.length} to ${result.length} messages`);
  console.log(`[RATE LIMIT] Estimated tokens: ${estimateConversationTokens(result)}/${maxTokens}`);
  
  return result;
}

// Parse rate limit error to extract actual limit
export function parseRateLimitError(error: any): { limit?: number; requested?: number } {
  const errorMessage = error.message || error.toString() || '';
  
  // Try to extract numbers from error message like "Limit 8000, Requested 8689"
  const limitMatch = errorMessage.match(/limit\s*(\d+)/i);
  const requestedMatch = errorMessage.match(/requested\s*(\d+)/i);
  
  return {
    limit: limitMatch ? parseInt(limitMatch[1]) : undefined,
    requested: requestedMatch ? parseInt(requestedMatch[1]) : undefined,
  };
}

// Main handler for rate limit errors with automatic retry
export async function handleRateLimitWithRetry<T>(
  messages: UIMessage[],
  modelId: string,
  apiCall: (messages: UIMessage[]) => Promise<T>,
  maxRetries: number = 2
): Promise<T> {
  let currentMessages = messages;
  let lastError: any;
  
  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    try {
      return await apiCall(currentMessages);
    } catch (error) {
      lastError = error;
      
      if (!isRateLimitError(error) || attempt === maxRetries) {
        throw error;
      }
      
      console.log(`[RATE LIMIT] Attempt ${attempt + 1} failed, truncating messages...`);
      
      // Parse the actual limit from the error if available
      const { limit } = parseRateLimitError(error);
      const modelLimit = limit || getModelRateLimit(modelId);
      
      // Reduce limit by 20% for safety margin
      const safeLimit = Math.floor(modelLimit * 0.8);
      
      // Truncate messages
      currentMessages = truncateConversation(currentMessages, safeLimit);
      
      // If we can't truncate further, give up
      if (currentMessages.length <= 1) {
        console.log('[RATE LIMIT] Cannot truncate further, giving up');
        throw error;
      }
    }
  }
  
  throw lastError;
}
