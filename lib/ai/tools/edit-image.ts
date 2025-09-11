import { tool } from 'ai';
import { z } from 'zod';
import { generateUUID } from '@/lib/utils';
import { saveImageToBlob } from '@/lib/utils/blob-storage';
import type { Session } from 'next-auth';
import type { DataStreamWriter } from '@/lib/types';
import { optimizeImagePrompt } from '@/lib/ai/image-prompt-optimizer';

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
  optimizedPrompt: string, 
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

  // Use the optimized prompt directly - the Visual Editor template handles all the formatting
  const finalPrompt = optimizedPrompt;

  // Log the final prompt being sent to Gemini
  console.log('✏️ [FINAL IMAGE PROMPT] Sending to Gemini 2.5 Flash Image Preview (Edit):');
  console.log('=' .repeat(80));
  console.log(finalPrompt);
  console.log('=' .repeat(80));

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
                text: finalPrompt
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
          temperature: 1,
          maxOutputTokens: 8192,
          topP: 0.95,  
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
    description: `Edit an existing image using Gemini 2.5 Flash Image Preview. 

**WHEN TO USE THIS TOOL:**
- User wants to modify an EXISTING image (e.g., "make the boy taller", "change the hair color", "add a hat")
- User refers to "the image", "this picture", "the character in the image"
- User wants targeted edits to specific elements while preserving the rest
- User provides an image URL or the conversation shows a recently created image

**CRITICAL: Use this tool instead of createImage when:**
- Editing height, size, or proportions of existing characters
- Changing colors, clothing, or accessories on existing images  
- Adding or removing specific elements from existing compositions
- Making style adjustments to existing artwork

Accepts both image URLs and base64 data URLs - URLs will be automatically converted to base64. This tool can modify, add elements to, remove elements from, replace parts of, or change the style of existing images while preserving the original composition and quality.`,
    inputSchema: editImageSchema,
    execute: async (input: EditImageInput): Promise<EditImageOutput> => {
      const { imageUrl, prompt, editType, preserveOriginal, context } = input;
      const id = generateUUID();

      if (!session?.user?.id) {
        throw new Error('User must be authenticated to edit images');
      }

      // Optimize the prompt using Gemini best practices for image editing
      let optimizedPrompt = prompt;
      try {
        console.log('[Edit Image] Optimizing prompt using Gemini best practices...');
        
        const promptOptimization = await optimizeImagePrompt({
          description: prompt,
          sceneContext: context,
          style: 'realistic', // Default to realistic for editing
          imageType: 'photorealistic', // Most edits are on realistic images
          userId: session.user.id,
          isEditing: true, // Flag to use Visual Editor template
          seedImages: [imageUrl] // Pass the source image as seed
        });
        
        optimizedPrompt = promptOptimization.optimizedPrompt;
        console.log('[Edit Image] Prompt optimized successfully:', {
          originalLength: prompt.length,
          optimizedLength: optimizedPrompt.length,
          reasoning: promptOptimization.reasoning.substring(0, 100) + '...'
        });
      } catch (promptError) {
        console.warn('[Edit Image] Prompt optimization failed, using enhanced fallback:', promptError);
        
        // Fallback: Basic enhancement with context
        optimizedPrompt = prompt;
        if (context) {
          optimizedPrompt = `${prompt}\n\nAdditional context: ${context}`;
        }
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
          optimizedPrompt, 
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