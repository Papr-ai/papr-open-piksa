import {
  customProvider,
  extractReasoningMiddleware,
  wrapLanguageModel,
} from 'ai';
import { xai } from '@ai-sdk/xai';
import { groq } from '@ai-sdk/groq';
import { isTestEnvironment } from '../constants';
import {
  artifactModel,
  chatModel,
  reasoningModel,
  titleModel,
} from './models.test';

export const myProvider = isTestEnvironment
  ? customProvider({
      languageModels: {
        'chat-model': chatModel,
        'chat-model-reasoning': reasoningModel,
        'title-model': titleModel,
        'artifact-model': artifactModel,
      },
    })
  : customProvider({
      languageModels: {
        'chat-model': groq('llama3-70b-8192'),
        'chat-model-reasoning': wrapLanguageModel({
          model: groq('llama3-70b-8192'),
          middleware: extractReasoningMiddleware({ tagName: 'think' }),
        }),
        'title-model': groq('llama3-70b-8192'),
        'artifact-model': groq('llama3-70b-8192'),
      },
      imageModels: {
        'small-model': xai.image('grok-2-image'),
      },
    });
