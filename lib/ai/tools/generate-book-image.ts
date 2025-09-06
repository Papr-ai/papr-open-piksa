import { tool } from 'ai';
import { z } from 'zod';
import { generateUUID } from '@/lib/utils';
import { saveBookImageToBlob } from '@/lib/utils/blob-storage';
import type { Session } from 'next-auth';
import type { DataStreamWriter } from '@/lib/types';

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
  bookId: z.string().optional().describe('Book/document ID for organizing images'),
  chapterNumber: z.number().optional().describe('Chapter number for organizing images'),
});

type GenerateImageInput = z.infer<typeof generateImageSchema>;
type GenerateImageOutput = {
  id: string;
  imageUrl: string;
  prompt: string;
  style: string;
  context?: string;
};

// Function to generate image using Gemini 2.5 Flash Image (Nano Banana) API directly
async function generateImageWithGemini(prompt: string): Promise<string> {
  const apiKey = process.env.GOOGLE_GENERATIVE_AI_API_KEY;
  if (!apiKey) {
    throw new Error('Google Generative AI API key not found');
  }

  // Use Gemini 2.5 Flash Image (Nano Banana) for actual image generation
  // This is the correct endpoint for Gemini's image generation capabilities
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
          temperature: 0.8,
          maxOutputTokens: 4096,
          responseMimeType: 'image/png'
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
  
  // Extract the generated image from the response
  const imageData = data.candidates?.[0]?.content?.parts?.[0]?.inlineData?.data;
  
  if (!imageData) {
    throw new Error('No image data generated from Gemini 2.5 Flash Image');
  }

  // Return the base64 image data with proper data URL format
  return `data:image/png;base64,${imageData}`;
}



export const generateImage = ({ session, dataStream }: GenerateImageProps) =>
  tool({
    description: 'Generate an image from a text description using Gemini 2.5 Flash Image (Nano Banana). This creates high-quality visual content from detailed prompts in various artistic styles.',
    inputSchema: generateImageSchema,
    execute: async (input: GenerateImageInput): Promise<GenerateImageOutput> => {
      const { prompt, context, style, title, subtitle, bookId, chapterNumber } = input;
      const id = generateUUID();

      if (!session?.user?.id) {
        throw new Error('User must be authenticated to generate images');
      }

      // Enhance the prompt with context and style guidance
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

      enhancedPrompt += `. Style: ${stylePrompts[style]}.`;

      try {
        // Generate the image using direct Gemini API call
        const imageBase64 = await generateImageWithGemini(enhancedPrompt);

        // Save the image to Vercel Blob storage with book context
        const permanentImageUrl = bookId 
          ? await saveBookImageToBlob(imageBase64, session.user.id, bookId, chapterNumber)
          : await saveBookImageToBlob(imageBase64, session.user.id, 'default-book');

        // Stream the image data with permanent URL
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
