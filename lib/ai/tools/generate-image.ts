import { tool } from 'ai';
import { z } from 'zod';
import { generateUUID } from '@/lib/utils';
import { saveImageToBlob } from '@/lib/utils/blob-storage';
import type { Session } from 'next-auth';
import type { DataStreamWriter } from '@/lib/types';
import { optimizeImagePrompt } from '@/lib/ai/image-prompt-optimizer';

interface GenerateImageProps {
  session: Session | null;
  dataStream: DataStreamWriter;
}

const generateImageSchema = z.object({
  prompt: z.string().describe('Detailed description of the image to generate'),
  context: z.string().optional().describe('Additional context or background information'),
  style: z.enum(['realistic', 'artistic', 'illustration', 'sketch', 'watercolor', 'digital-art']).default('illustration').describe('Art style for the image'),
  title: z.string().optional().describe('Title or name for context (e.g., book title, project name)'),
  subtitle: z.string().optional().describe('Subtitle for additional context (e.g., chapter title, section name)'),
});

type GenerateImageInput = z.infer<typeof generateImageSchema>;
type GenerateImageOutput = {
  id: string;
  imageUrl: string;
  prompt: string;
  style: string;
  context?: string;
};

// Type definitions for Gemini API response
interface GeminiResponsePart {
  text?: string;
  inlineData?: {
    mimeType: string;
    data: string;
  };
}

// Function to generate image using Gemini 2.5 Flash Image (Nano Banana) API directly
async function generateImageWithGemini(prompt: string): Promise<string> {
  const apiKey = process.env.GOOGLE_GENERATIVE_AI_API_KEY;
  if (!apiKey) {
    throw new Error('Google Generative AI API key not found');
  }

  // Use Gemini 2.5 Flash Image Preview (Nano Banana) for actual image generation
  // This uses the correct model and endpoint for Gemini's image generation capabilities
  const response = await fetch(
    `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash-image-preview:generateContent?key=${apiKey}`,
    {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        contents: [
          {
            parts: [
              {
                text: prompt
              }
            ]
          }
        ],
        generationConfig: {
          temperature: 1,
          maxOutputTokens: 8192,
          topP: 0.95,  
        }
      })
    }
  );

  if (!response.ok) {
    const errorText = await response.text();
    console.error('Gemini Image API error:', errorText);
    throw new Error(`Gemini Image API error: ${response.status} - ${errorText}`);
  }

  const data = await response.json();
  
  // Look for image data in the response parts
  const parts: GeminiResponsePart[] = data.candidates?.[0]?.content?.parts || [];
  
  if (parts.length === 0) {
    throw new Error('No response parts generated from Gemini 2.5 Flash Image');
  }

  // Check each part for inline image data
  for (const part of parts) {
    if (part.inlineData && part.inlineData.data) {
      // Found image data - return it as base64 data URL
      return `data:image/png;base64,${part.inlineData.data}`;
    }
  }

  // If no image data found, throw an error to get the actual image
  throw new Error('No image data generated from Gemini 2.5 Flash Image. The API should return actual image data, not text descriptions.');
}





export const generateImage = ({ session, dataStream }: GenerateImageProps) =>
  tool({
    description: 'Generate an image from a text description using Gemini 2.5 Flash Image Preview (Nano Banana). This creates high-quality visual content from detailed prompts in various artistic styles.',
    inputSchema: generateImageSchema,
    execute: async (input: GenerateImageInput): Promise<GenerateImageOutput> => {
      const { prompt, context, style, title, subtitle } = input;
      const id = generateUUID();

      if (!session?.user?.id) {
        throw new Error('User must be authenticated to generate images');
      }

      // Optimize the prompt using Gemini best practices
      let optimizedPrompt = prompt;
      try {
        console.log('[Generate Image] Optimizing prompt using Gemini best practices...');
        
        // Build context for optimization
        let fullContext = context || '';
        if (title) fullContext += ` Title: ${title}.`;
        if (subtitle) fullContext += ` Subtitle: ${subtitle}.`;
        
        const promptOptimization = await optimizeImagePrompt({
          description: prompt,
          sceneContext: fullContext || undefined,
          style: style,
          imageType: style === 'realistic' ? 'photorealistic' : 'illustration',
          userId: session.user.id
        });
        
        optimizedPrompt = promptOptimization.optimizedPrompt;
        console.log('[Generate Image] Prompt optimized successfully:', {
          originalLength: prompt.length,
          optimizedLength: optimizedPrompt.length,
          reasoning: promptOptimization.reasoning.substring(0, 100) + '...'
        });
      } catch (promptError) {
        console.warn('[Generate Image] Prompt optimization failed, using enhanced fallback:', promptError);
        
        // Fallback: Basic enhancement with context and style
        let enhancedPrompt = prompt;
        
        if (context) {
          enhancedPrompt = `${prompt}\n\nAdditional context: ${context}`;
        }
        
        if (title) {
          enhancedPrompt = `Image for "${title}": ${enhancedPrompt}`;
        }
        
        if (subtitle) {
          enhancedPrompt = `${subtitle}: ${enhancedPrompt}`;
        }

        // Add style guidance
        const stylePrompts = {
          realistic: 'photorealistic, detailed, high quality',
          artistic: 'artistic, creative, expressive',
          illustration: 'book illustration style, clean lines, suitable for reading',
          sketch: 'pencil sketch, hand-drawn, artistic sketch style',
          watercolor: 'watercolor painting, soft colors, artistic brush strokes',
          'digital-art': 'digital art, modern, clean, professional illustration'
        };

        optimizedPrompt = enhancedPrompt + `. Style: ${stylePrompts[style]}.`;
      }

      try {
        // Log the final prompt being sent to Gemini
        console.log('🎨 [FINAL IMAGE PROMPT] Sending to Gemini 2.5 Flash Image Preview:');
        console.log('=' .repeat(80));
        console.log(optimizedPrompt);
        console.log('=' .repeat(80));
        
        // Generate the image using direct Gemini API call
        const imageBase64 = await generateImageWithGemini(optimizedPrompt);

        // Save the image to Vercel Blob storage
        const permanentImageUrl = await saveImageToBlob(imageBase64, session.user.id, 'generated');

        // Stream the image data with the permanent URL
        dataStream.write?.({
          type: 'image-generated',
          content: {
            id,
            imageUrl: permanentImageUrl,
            prompt,
            style,
            context,
            title,
            subtitle,
          },
        });

        return {
          id,
          imageUrl: permanentImageUrl,
          prompt,
          style,
          context,
        };
      } catch (error) {
        console.error('Error generating book image:', error);
        throw new Error(`Failed to generate image: ${error instanceof Error ? error.message : 'Unknown error'}`);
      }
    },
  });
