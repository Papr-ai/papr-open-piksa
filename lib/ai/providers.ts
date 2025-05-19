import {
  customProvider,
  extractReasoningMiddleware,
  wrapLanguageModel,
} from 'ai';
import { xai } from '@ai-sdk/xai';
import { groq } from '@ai-sdk/groq';
import { openai } from '@ai-sdk/openai';
import { anthropic } from '@ai-sdk/anthropic';
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
        'chat-model-reasoning': (() => {
          try {
            //console.log('Initializing reasoning model with openai');
            const model = openai('o4-mini');
            //console.log('Model initialized successfully:', model);
            //console.log('Setting up middleware with tag: think');
            const middleware = extractReasoningMiddleware({ tagName: 'think' });
            //console.log('Middleware set up successfully');
            const wrappedModel = wrapLanguageModel({
              model,
              middleware,
            });
            //console.log('Model wrapped successfully');
            return wrappedModel;
          } catch (error) {
            console.error('Error initializing reasoning model:', error);
            // Fallback to regular model in case of error
            return groq('llama3-70b-8192');
          }
        })(),
        'title-model': groq('llama3-70b-8192'),
        'artifact-model': anthropic('claude-3-5-sonnet-20240620'),
      },
      imageModels: {
        'small-model': xai.image('grok-2-image'),
      },
    });
