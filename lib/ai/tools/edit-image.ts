import { tool } from 'ai';
import { z } from 'zod';
import { generateUUID } from '@/lib/utils';
import { saveImageToBlob } from '@/lib/utils/blob-storage';
import type { Session } from 'next-auth';
import type { DataStreamWriter } from '@/lib/types';

interface EditImageProps {
  session: Session | null;
  dataStream: DataStreamWriter;
}

const editImageSchema = z.object({
  imageUrl: z.string().describe('The image to edit - can be a base64 data URL (data:image/...;base64,...) or an HTTP(S) URL to an image file'),
  prompt: z.string().describe('Detailed description of the changes to make to the image'),
  editType: z.enum(['modify', 'add', 'remove', 'replace', 'style-change']).default('modify').describe('Type of edit to perform'),
  preserveOriginal: z.boolean().default(true).describe('Whether to preserve the original style and composition'),
  context: z.string().optional().describe('Additional context about the image or desired changes'),
});

type EditImageInput = z.infer<typeof editImageSchema>;
type EditImageOutput = {
  id: string;
  originalImageUrl: string;
  editedImageUrl: string;
  prompt: string;
  editType: string;
  preserveOriginal: boolean;
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

// Helper function to convert URL to base64 with retry logic
async function urlToBase64(url: string, retries = 3): Promise<string> {
  for (let attempt = 1; attempt <= retries; attempt++) {
    try {
      console.log(`[Edit Image] Attempt ${attempt}/${retries}: Converting URL to base64: ${url}`);
      
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 30000); // 30 second timeout
      
      const response = await fetch(url, { 
        signal: controller.signal,
        headers: {
          'User-Agent': 'PaprChat/1.0'
        }
      });
      
      clearTimeout(timeoutId);
      
      if (!response.ok) {
        throw new Error(`Failed to fetch image: ${response.status} ${response.statusText}`);
      }
      
      const arrayBuffer = await response.arrayBuffer();
      const buffer = Buffer.from(arrayBuffer);
      const base64 = buffer.toString('base64');
      
      // Determine mime type from response headers or URL extension
      const contentType = response.headers.get('content-type') || 'image/png';
      
      console.log(`[Edit Image] Successfully converted URL to base64 on attempt ${attempt}`);
      return `data:${contentType};base64,${base64}`;
      
    } catch (error) {
      console.error(`[Edit Image] Attempt ${attempt}/${retries} failed:`, error);
      
      if (attempt === retries) {
        throw new Error(`Failed to convert image URL to base64 after ${retries} attempts: ${error instanceof Error ? error.message : 'Unknown error'}`);
      }
      
      // Wait before retrying (exponential backoff)
      await new Promise(resolve => setTimeout(resolve, Math.pow(2, attempt) * 1000));
    }
  }
  
  throw new Error('Unexpected error in urlToBase64');
}

// Function to edit image using Gemini 2.5 Flash Image Preview API
async function editImageWithGemini(
  imageBase64: string, 
  prompt: string, 
  editType: string,
  preserveOriginal: boolean
): Promise<string> {
  const apiKey = process.env.GOOGLE_GENERATIVE_AI_API_KEY;
  if (!apiKey) {
    throw new Error('Google Generative AI API key not found');
  }

  // Extract base64 data from data URL if needed
  let base64Data = imageBase64;
  let mimeType = 'image/png';
  
  if (imageBase64.startsWith('data:')) {
    const matches = imageBase64.match(/^data:([^;]+);base64,(.+)$/);
    if (matches) {
      mimeType = matches[1];
      base64Data = matches[2];
    }
  }

  // Create enhanced prompt based on edit type and preservation settings
  let enhancedPrompt = '';
  
  if (preserveOriginal) {
    const preservationInstructions = {
      modify: 'Using the provided image, please modify it as requested while keeping everything else exactly the same, preserving the original style, lighting, and composition.',
      add: 'Using the provided image, please add the requested elements to the scene. Ensure the additions integrate naturally with the existing style, lighting, and composition.',
      remove: 'Using the provided image, please remove the specified elements from the scene. Keep everything else exactly the same, preserving the original style and composition.',
      replace: 'Using the provided image, please replace the specified elements as requested. Ensure the replacements match the original style, lighting, and composition.',
      'style-change': 'Using the provided image as reference, please recreate it with the requested style changes while maintaining the same composition and subject matter.'
    };
    
    enhancedPrompt = `${preservationInstructions[editType as keyof typeof preservationInstructions]} ${prompt}`;
  } else {
    enhancedPrompt = `Create a new image based on the provided image with these changes: ${prompt}`;
  }

  // Use Gemini 2.5 Flash Image Preview for image-to-image generation
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
                text: enhancedPrompt
              },
              {
                inlineData: {
                  mimeType,
                  data: base64Data,
                },
              },
            ]
          }
        ],
        generationConfig: {
          temperature: 0.7,
          maxOutputTokens: 4096,
        }
      })
    }
  );

  if (!response.ok) {
    const errorText = await response.text();
    console.error('Gemini Image Edit API error:', errorText);
    throw new Error(`Gemini Image Edit API error: ${response.status} - ${errorText}`);
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



export const editImage = ({ session, dataStream }: EditImageProps) =>
  tool({
    description: 'Edit an existing image using Gemini 2.5 Flash Image Preview. Accepts both image URLs and base64 data URLs - URLs will be automatically converted to base64. This tool can modify, add elements to, remove elements from, replace parts of, or change the style of existing images while preserving the original composition and quality.',
    inputSchema: editImageSchema,
    execute: async (input: EditImageInput): Promise<EditImageOutput> => {
      const { imageUrl, prompt, editType, preserveOriginal, context } = input;
      const id = generateUUID();

      if (!session?.user?.id) {
        throw new Error('User must be authenticated to edit images');
      }

      // Enhance the prompt with context if provided
      let enhancedPrompt = prompt;
      if (context) {
        enhancedPrompt = `${prompt}\n\nAdditional context: ${context}`;
      }

      try {
        // Convert URL to base64 if needed
        let imageBase64: string;
        if (imageUrl.startsWith('data:')) {
          // Validate that it's a complete base64 data URL
          if (imageUrl === 'data:image' || !imageUrl.includes(';base64,')) {
            throw new Error('Invalid or incomplete base64 data URL. Expected format: data:image/[type];base64,[data]');
          }
          // Already base64 data URL
          imageBase64 = imageUrl;
        } else if (imageUrl.startsWith('http://') || imageUrl.startsWith('https://')) {
          // Convert URL to base64
          console.log('[Edit Image] Converting URL to base64:', imageUrl);
          imageBase64 = await urlToBase64(imageUrl);
        } else {
          throw new Error('Invalid image URL format. Must be a data URL or HTTP(S) URL.');
        }

        // Edit the image using direct Gemini API call
        const editedImageBase64 = await editImageWithGemini(
          imageBase64, 
          enhancedPrompt, 
          editType, 
          preserveOriginal
        );

        // Save the edited image to Vercel Blob storage
        const permanentEditedImageUrl = await saveImageToBlob(editedImageBase64, session.user.id, 'edited');

        // Stream the edited image data with permanent URLs
        dataStream.write?.({
          type: 'image-edited',
          content: {
            id,
            originalImageUrl: imageUrl,
            editedImageUrl: permanentEditedImageUrl,
            prompt,
            editType,
            preserveOriginal,
            context,
          },
        });

        return {
          id,
          originalImageUrl: imageUrl,
          editedImageUrl: permanentEditedImageUrl,
          prompt,
          editType,
          preserveOriginal,
          context,
        };
      } catch (error) {
        console.error('Error editing image:', error);
        throw new Error(`Failed to edit image: ${error instanceof Error ? error.message : 'Unknown error'}`);
      }
    },
  });