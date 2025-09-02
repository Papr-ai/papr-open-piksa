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

// Model-specific context limits (tokens per request)
// Using conservative limits for better performance and cost efficiency
export const MODEL_RATE_LIMITS: Record<string, number> = {
  'openai/gpt-oss-120b': 8000,
  'openai/gpt-oss-20b': 8000,
  'deepseek-r1-distill-llama-70b': 30000,
  'llama-3.3-70b-versatile': 30000,
  'gpt-5': 50000,  // Conservative limit ~15-20 recent messages
  'gpt-5-mini': 50000,  // Conservative limit ~15-20 recent messages
  'claude-3.5-sonnet': 50000,  // Conservative limit ~15-20 recent messages
  'claude-3.7-sonnet': 50000,  // Conservative limit ~15-20 recent messages
  'claude-4-opus': 50000,  // Conservative limit ~15-20 recent messages
  'gemini-2.5-flash': 50000,  // Conservative limit ~15-20 recent messages
  'gemini-2.5-pro': 50000,  // Conservative limit ~15-20 recent messages
  'gemini-2.5-flash-lite': 50000,  // Conservative limit ~15-20 recent messages
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
    errorString.includes('prompt is too long') ||
    errorString.includes('tokens >') ||
    errorString.includes('maximum') ||
    errorString.includes('context length') ||
    errorString.includes('token limit') ||
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
  let otherMessages = messages.filter(m => m.role !== 'system');
  
  // First pass: Remove very large tool messages (likely image generation results)
  const filteredMessages = otherMessages.filter(msg => {
    const msgSize = estimateMessageTokens(msg);
    if (msgSize > 50000) { // Messages over 50k tokens
      console.log(`[RATE LIMIT] Removing large tool message: ${msg.role}, ~${msgSize} tokens`);
      return false;
    }
    return true;
  });
  
  console.log(`[RATE LIMIT] Removed ${otherMessages.length - filteredMessages.length} large messages`);
  otherMessages = filteredMessages;
  
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
  
  // Try to extract numbers from different error formats:
  // "Limit 8000, Requested 8689"
  // "prompt is too long: 238129 tokens > 200000 maximum"
  const limitMatch = errorMessage.match(/limit\s*(\d+)/i) || errorMessage.match(/>\s*(\d+)\s*maximum/i);
  const requestedMatch = errorMessage.match(/requested\s*(\d+)/i) || errorMessage.match(/(\d+)\s*tokens\s*>/i);
  
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
  
  console.log(`[RATE LIMIT] Starting handleRateLimitWithRetry with ${messages.length} messages, estimated ${estimateConversationTokens(messages)} tokens`);
  console.log(`[RATE LIMIT] WARNING: Token estimation may be inaccurate due to message conversion - actual tokens could be much higher`);
  
  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    try {
      console.log(`[RATE LIMIT] Attempt ${attempt + 1} with ${currentMessages.length} messages`);
      return await apiCall(currentMessages);
    } catch (error) {
      lastError = error;
      
      console.log(`[RATE LIMIT] Attempt ${attempt + 1} failed with error:`, (error as Error).message);
      console.log(`[RATE LIMIT] Is rate limit error?`, isRateLimitError(error));
      
      if (!isRateLimitError(error) || attempt === maxRetries) {
        console.log(`[RATE LIMIT] Not retrying - isRateLimit: ${isRateLimitError(error)}, attempt: ${attempt}/${maxRetries}`);
        throw error;
      }
      
      console.log(`[RATE LIMIT] Attempt ${attempt + 1} failed, truncating messages...`);
      
      // Parse the actual limit from the error if available
      const { limit, requested } = parseRateLimitError(error);
      console.log(`[RATE LIMIT] Parsed from error - limit: ${limit}, requested: ${requested}`);
      
      const modelLimit = limit || getModelRateLimit(modelId);
      console.log(`[RATE LIMIT] Using limit: ${modelLimit} for model: ${modelId}`);
      
      // For very large token overages, be more aggressive with truncation
      const overage = requested ? (requested - modelLimit) / modelLimit : 1;
      const aggressiveFactor = overage > 1 ? 0.3 : 0.8; // More aggressive truncation for large overages
      
      const safeLimit = Math.floor(modelLimit * aggressiveFactor);
      console.log(`[RATE LIMIT] Overage factor: ${overage.toFixed(2)}, using ${aggressiveFactor} safety factor`);
      console.log(`[RATE LIMIT] Safe limit after reduction: ${safeLimit}`);
      
      // Truncate messages more aggressively
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
