export const DEFAULT_CHAT_MODEL: string = 'auto';

interface ChatModel {
  id: string;
  name: string;
  description: string;
  supportsReasoning: boolean;
  group: 'Auto' | 'OpenAI' | 'Groq' | 'Anthropic' | 'Google';
  isPremium?: boolean;
  supportsWebSearch?: boolean;
}

export const chatModels: Array<ChatModel> = [
  // Auto Selection
  {
    id: 'auto',
    name: 'Auto',
    description: 'Automatically selects the best model for your request',
    supportsReasoning: true,
    isPremium: false,
    group: 'Auto',
  },
  
  // OpenAI Models
  {
    id: 'gpt-5',
    name: 'GPT 5',
    description: 'OpenAI\'s flagship model',
    supportsReasoning: true,
    isPremium: false, // Keep GPT-5 free
    group: 'OpenAI',
  },
  {
    id: 'gpt-5-mini',
    name: 'GPT 5 Mini',
    description: 'Smaller, faster OpenAI model',
    supportsReasoning: true,
    isPremium: false, // Keep GPT-5-mini free
    group: 'OpenAI',
  },

  {
    id: 'o4-mini',
    name: 'OpenAI o4-mini',
    description: 'Optimized reasoning model',
    supportsReasoning: true,
    isPremium: true,
    group: 'OpenAI',
  },
  
  // Groq Models
  {
    id: 'deepseek-r1-distill-llama-70b',
    name: 'DeepSeek 70B',
    description: 'High-performance DeepSeek model',
    supportsReasoning: true,
    isPremium: false, // Keep free
    group: 'Groq',
  },
  {
    id: 'llama-3.3-70b-versatile',
    name: 'Llama3 70B',
    description: 'Versatile large language model',
    supportsReasoning: false,
    isPremium: false, // Keep free
    group: 'Groq',
  },
  {
    id: 'openai/gpt-oss-20b',
    name: 'GPT OSS 20B',
    description: 'Open source model with large context window',
    supportsReasoning: false,
    isPremium: false, // Keep free
    group: 'Groq',
  },
  {
    id: 'openai/gpt-oss-120b',
    name: 'GPT OSS 120B',
    description: 'Large open source model with extensive context',
    supportsReasoning: false,
    isPremium: false, // Keep free
    group: 'Groq',
  },
  
  // Anthropic Models
  {
    id: 'claude-sonnet-4-20250514',
    name: 'Claude Sonnet 4',
    description: 'Balanced performance and reasoning',
    supportsReasoning: true,
    isPremium: true,
    group: 'Anthropic',
  },
  {
    id: 'claude-3-7-sonnet-20250219',
    name: 'Claude 3.7',
    description: 'Anthropic\'s powerful reasoning model',
    supportsReasoning: true,
    isPremium: true,
    group: 'Anthropic',
  },
  {
    id: 'claude-4-opus-20250514',
    name: 'Claude 4 Opus',
    description: 'Most advanced model for complex reasoning',
    supportsReasoning: true,
    isPremium: true,
    group: 'Anthropic',
  },
  
  // Google Models
  {
    id: 'gemini-2.5-flash',
    name: 'Gemini 2.5 Flash',
    description: 'Fast responses for general-purpose tasks',
    supportsReasoning: false,
    isPremium: false, // Keep free
    group: 'Google',
    supportsWebSearch: true,
  },
  {
    id: 'gemini-2.5-flash-lite',
    name: 'Gemini 2.5 Flash Lite',
    description: 'Lightweight version of Gemini Flash',
    supportsReasoning: false,
    isPremium: false, // Keep free
    group: 'Google',
    supportsWebSearch: true,
  },
  {
    id: 'gemini-2.5-pro',
    name: 'Gemini 2.5 Pro',
    description: 'Advanced reasoning for complex tasks',
    supportsReasoning: true,
    isPremium: true,
    group: 'Google',
    supportsWebSearch: true,
  },
];

export function modelSupportsReasoning(modelId: string): boolean {
  const model = chatModels.find(model => model.id === modelId);
  return model?.supportsReasoning || false;
}

export function modelIsPremium(modelId: string): boolean {
  const model = chatModels.find(model => model.id === modelId);
  return model?.isPremium || false;
}

export function modelSupportsWebSearch(modelId: string): boolean {
  const model = chatModels.find(model => model.id === modelId);
  return model?.supportsWebSearch || false;
}

// Get the best web search model based on user preferences and access
export function getWebSearchModel(preferredModel?: string): string {
  // If a specific model is preferred and it supports web search, use it
  if (preferredModel && modelSupportsWebSearch(preferredModel)) {
    return preferredModel;
  }
  
  // Otherwise, default to Gemini 2.5 Flash (free and supports web search)
  return 'gemini-2.5-flash';
}
