export const DEFAULT_CHAT_MODEL: string = 'o4-mini';

interface ChatModel {
  id: string;
  name: string;
  description: string;
  supportsReasoning: boolean;
  group: 'OpenAI' | 'Groq' | 'Anthropic' | 'Google';
  isPremium?: boolean;
}

export const chatModels: Array<ChatModel> = [
  // OpenAI Models
  {
    id: 'gpt-4.1',
    name: 'ChatGPT 4.1',
    description: 'OpenAI\'s flagship model',
    supportsReasoning: false,
    group: 'OpenAI',
  },
  {
    id: 'gpt-4.1-mini',
    name: 'ChatGPT 4.1 Mini',
    description: 'Smaller, faster OpenAI model',
    supportsReasoning: false,
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
    supportsReasoning: false,
    group: 'Groq',
  },
  {
    id: 'llama-3.3-70b-versatile',
    name: 'Llama3 70B',
    description: 'Versatile large language model',
    supportsReasoning: false,
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
    group: 'Google',
  },
  {
    id: 'gemini-2.5-flash-lite',
    name: 'Gemini 2.5 Flash Lite',
    description: 'Lightweight version of Gemini Flash',
    supportsReasoning: false,
    group: 'Google',
  },
  {
    id: 'gemini-2.5-pro',
    name: 'Gemini 2.5 Pro',
    description: 'Advanced reasoning for complex tasks',
    supportsReasoning: true,
    isPremium: true,
    group: 'Google',
  },
];

export function modelSupportsReasoning(modelId: string): boolean {
  const model = chatModels.find(model => model.id === modelId);
  return model?.supportsReasoning || false;
}

export function modelIsPremium(modelId: string): boolean {
  const model = chatModels.find(model => model.id === modelId);
  return model?.isPremium || model?.supportsReasoning || false;
}
