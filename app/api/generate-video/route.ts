import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/app/(auth)/auth';
import { put } from '@vercel/blob';
import { GoogleGenAI, type GenerateVideosOperation, type GenerateVideosResponse, type Video, type GeneratedVideo } from '@google/genai';
import { createMemoryService } from '@/lib/ai/memory/service';
import { optimizeVideoPrompt } from '@/lib/ai/video-prompt-optimizer';

export async function POST(request: NextRequest) {
  try {
    const session = await auth();
    
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Check video generation usage limits
    const { checkVideoGenerationLimit } = await import('@/lib/subscription/usage-middleware');
    const usageCheck = await checkVideoGenerationLimit(session.user.id);
    if (!usageCheck.allowed) {
      console.log('[generate-video] Video generation limit exceeded for user:', session.user.id);
      return NextResponse.json({ 
        error: usageCheck.reason,
        shouldShowUpgrade: usageCheck.shouldShowUpgrade,
        usage: usageCheck.usage
      }, { status: 429 });
    }

    const { imageUrl, prompt, storyContext, bookId, bookTitle } = await request.json();

    if (!imageUrl) {
      return NextResponse.json({ error: 'Image URL is required' }, { status: 400 });
    }

    // Check if we have the required API key
    // The @google/genai package looks for GOOGLE_API_KEY or GEMINI_API_KEY
    const geminiApiKey = process.env.GOOGLE_GENERATIVE_AI_API_KEY;
    if (!geminiApiKey) {
      return NextResponse.json({ 
        error: 'Google API key not configured. Please set GOOGLE_API_KEY, GEMINI_API_KEY, or GOOGLE_GENERATIVE_AI_API_KEY environment variable.' 
      }, { status: 500 });
    }

    console.log('[generate-video] Starting video generation for user:', session.user.id);
    
    // Step 1: Use GPT-5 mini to intelligently search memories and optimize prompt
    let optimizedPromptData = null;
    try {
      console.log('[generate-video] Using GPT-5 mini to search memories and optimize prompt...');
      
      // Let GPT-5 mini intelligently search for relevant memories and create optimized prompt
      optimizedPromptData = await optimizeVideoPrompt({
        storyContext,
        imageDescription: prompt,
        bookId,
        bookTitle
      }, session.user.id);
      
      console.log('[generate-video] Optimized prompt generated:', optimizedPromptData.prompt.length, 'chars');
      console.log('[generate-video] Reasoning:', optimizedPromptData.reasoning);
      
    } catch (error) {
      console.warn('[generate-video] Failed to optimize prompt:', error);
    }
    
    // Step 2: Download the source image
    const imageResponse = await fetch(imageUrl);
    if (!imageResponse.ok) {
      throw new Error('Failed to fetch source image');
    }
    
    const imageBuffer = await imageResponse.arrayBuffer();
    const imageBase64 = Buffer.from(imageBuffer).toString('base64');
    
    // Step 2: Call Gemini Veo API
    console.log('[generate-video] Calling Gemini Veo API...');
    
    // Use optimized prompt or fallback to basic prompt
    const finalPrompt = optimizedPromptData?.prompt || createVideoPrompt(prompt, storyContext);
    console.log('[generate-video] Using prompt:', finalPrompt);
    
    const videoResult = await callGeminiVeoAPI(imageBase64, finalPrompt, geminiApiKey);
    
    if (!videoResult.success) {
      throw new Error('Video generation failed');
    }

    // Step 3: Upload the generated video to Vercel Blob
    const timestamp = Date.now();
    const randomId = Math.random().toString(36).substring(2, 15);
    const filename = `videos/generated/${session.user.id}-${timestamp}-${randomId}.mp4`;

    const videoBlob = await put(filename, Buffer.from(videoResult.videoData), {
      access: 'public',
      contentType: 'video/mp4',
    });

    console.log('[generate-video] Video uploaded to:', videoBlob.url);

    // Track successful video generation usage
    const { trackVideoGeneration } = await import('@/lib/subscription/usage-middleware');
    await trackVideoGeneration(session.user.id);

    return NextResponse.json({
      success: true,
      videoUrl: videoBlob.url,
      message: 'Video generated successfully'
    });

  } catch (error) {
    console.error('[generate-video] Error:', error);
    return NextResponse.json(
      { 
        error: 'Failed to generate video',
        details: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 500 }
    );
  }
}

// Helper function to create enhanced video prompts with story context and metadata
function createVideoPrompt(basePrompt?: string, storyContext?: string, videoMetadata?: any): string {
  const baseDescription = basePrompt || 'Create a short, engaging video animation based on this image';
  
  if (storyContext && storyContext.trim()) {
    // Extract key story elements for video generation
    const contextLines = storyContext.split('\n').filter(line => line.trim()).slice(0, 3); // First few lines
    const storySnippet = contextLines.join(' ').substring(0, 200); // Limit context length
    
    // Build enhanced prompt with metadata
    const promptData: any = {
      scene: `${baseDescription}. Story context: ${storySnippet}`,
      style: videoMetadata?.artistic_style || "Cinematic, professional storytelling",
      camera: videoMetadata?.camera_suggestions || videoMetadata?.camera_movement || "Subtle camera movements that enhance the narrative - gentle push-in, slow pan, or rack focus",
      lighting: videoMetadata?.lighting_description || "Natural, story-appropriate lighting that matches the scene mood",
      motion: "Organic character movements and expressions that feel authentic to the story",
      atmosphere: "Environmental details that support the narrative - wind, particles, ambient effects",
      composition: "Well-framed shots that draw viewers into the story world",
      duration: "Short, impactful moment that brings the scene to life",
      quality: "High production value with smooth motion and realistic physics"
    };

    // Add character-specific details if available
    if (videoMetadata?.character_name) {
      promptData.character = {
        name: videoMetadata.character_name,
        description: videoMetadata.physical_description,
        movement: videoMetadata.movement_style,
        expressions: videoMetadata.typical_expressions || videoMetadata.facial_animation_cues,
        personality: videoMetadata.personality_keywords
      };
    }

    // Add scene-specific details if available
    if (videoMetadata?.scene_type) {
      promptData.environment = {
        type: videoMetadata.scene_type,
        mood: videoMetadata.scene_mood || videoMetadata.emotional_tone,
        weather: videoMetadata.weather_conditions,
        time: videoMetadata.time_of_day,
        colors: videoMetadata.color_palette,
        motion: videoMetadata.motion_elements || videoMetadata.movement_in_scene,
        effects: videoMetadata.atmospheric_effects
      };
    }

    // Add audio context if available
    if (videoMetadata?.ambient_sounds || videoMetadata?.sound_effects || videoMetadata?.dialogue_potential) {
      promptData.audio = {
        ambient: videoMetadata.ambient_sounds || videoMetadata.audio_atmosphere,
        effects: videoMetadata.sound_effects || videoMetadata.sound_design,
        dialogue: videoMetadata.dialogue_potential
      };
    }

    const structuredPrompt = JSON.stringify(promptData, null, 2);
    
    return `Generate a cinematic video based on this structured prompt:\n\n${structuredPrompt}`;
  } else {
    // Simplified JSON structure for images without story context
    const structuredPrompt = JSON.stringify({
      scene: baseDescription,
      style: "Cinematic, high-quality animation",
      camera: "Subtle camera movement - gentle zoom or pan",
      lighting: "Natural, atmospheric lighting",
      motion: "Smooth, realistic movements that bring the image to life",
      atmosphere: "Ambient effects like particles, wind, or gentle environmental motion",
      quality: "Professional production value with realistic physics"
    }, null, 2);
    
    return `Generate a cinematic video based on this structured prompt:\n\n${structuredPrompt}`;
  }
}

// Actual Gemini Veo API integration using the correct @google/genai package
async function callGeminiVeoAPI(imageBase64: string, prompt: string, apiKey: string) {
  try {
    console.log('[generate-video] Making request to Veo API with prompt:', prompt);
    console.log('[generate-video] Image data length:', imageBase64.length);
    console.log('[generate-video] API key prefix:', apiKey.substring(0, 10) + '...');

    // Initialize the Google GenAI client
    const ai = new GoogleGenAI({
      apiKey: apiKey
    });

    // Debug: Check if Veo model is available
    console.log('[generate-video] Attempting to use model: veo-3.0-generate-preview');

    console.log('[generate-video] Starting video generation with Veo 3...');

    // Generate video with Veo 3 using the SDK's generateVideos method
    console.log('[generate-video] Using SDK generateVideos method...');
    
    let operation: GenerateVideosOperation = await ai.models.generateVideos({
      model: "veo-3.0-fast-generate-preview",
      prompt: prompt,
      image: {
        imageBytes: imageBase64,
        mimeType: "image/jpeg",
      },
    });

    console.log('[generate-video] Video generation started, polling for completion...');

    // Poll the operation status until the video is ready
    const maxAttempts = 30; // 10 minutes max (20s * 30)
    let attempts = 0;

    while (!operation.done && attempts < maxAttempts) {
      console.log(`[generate-video] Polling attempt ${attempts + 1}/${maxAttempts}...`);
      await new Promise((resolve) => setTimeout(resolve, 20000)); // 20 seconds
      
      operation = await ai.operations.getVideosOperation({
        operation: operation,
      });
      
      attempts++;
    }

    if (!operation.done) {
      throw new Error('Video generation timed out after 10 minutes');
    }

    const response: GenerateVideosResponse | undefined = operation.response;
    if (!response || !response.generatedVideos || response.generatedVideos.length === 0) {
      throw new Error('No video generated in the response');
    }

    console.log('[generate-video] Video generation completed, downloading...');

    // Get the video file reference
    const generatedVideo: GeneratedVideo = response.generatedVideos[0];
    const videoFile: Video | undefined = generatedVideo.video;
    
    if (!videoFile) {
      throw new Error('No video file in the generated video response');
    }

    // The video file should have a URL or we need to use a different approach
    // Let's check if the video file has downloadable content or a URL
    console.log('[generate-video] Video file object:', videoFile);

    // Download the video using the working manual method
    let videoData: Uint8Array;

    if (videoFile.uri) {
      console.log('[generate-video] Downloading video from URI:', videoFile.uri);
      
      // Use API key as query parameter (this method works!)
      const uriWithKey = videoFile.uri.includes('?') 
        ? `${videoFile.uri}&key=${apiKey}`
        : `${videoFile.uri}?key=${apiKey}`;
      
      console.log('[generate-video] Downloading with API key parameter...');
      const videoResponse = await fetch(uriWithKey);
      
      if (!videoResponse.ok) {
        throw new Error(`Failed to download video from URI: ${videoResponse.status} ${videoResponse.statusText}`);
      }
      
      const arrayBuffer = await videoResponse.arrayBuffer();
      videoData = new Uint8Array(arrayBuffer);
    } else if (videoFile.videoBytes) {
      // If there's direct video bytes (base64 encoded), decode them
      console.log('[generate-video] Using direct video bytes');
      const videoBuffer = Buffer.from(videoFile.videoBytes, 'base64');
      videoData = new Uint8Array(videoBuffer);
    } else {
      throw new Error('No video data available - no URI or videoBytes found');
    }

    console.log('[generate-video] Video downloaded successfully, size:', videoData.length);

    return {
      success: true,
      videoData: videoData,
      format: 'mp4'
    };

  } catch (error) {
    console.error('[generate-video] Error calling Veo API:', error);
    
    // Provide more helpful error messages
    if (error instanceof Error && error.message.includes('PERMISSION_DENIED')) {
      throw new Error(`Veo API access denied. This might be because:
1. Veo is not available in your region
2. Veo requires special access/waitlist approval
3. Veo might only be available through Vertex AI, not the standard Gemini API
4. Your API key doesn't have access to video generation models

Original error: ${error.message}`);
    }
    
    throw error;
  }
}

// Helper function to search for relevant memories from memory
async function searchForVideoMemories(userId: string, context: { bookId?: string, bookTitle?: string, prompt?: string, storyContext?: string }): Promise<any[]> {
  const apiKey = process.env.PAPR_MEMORY_API_KEY;
  if (!apiKey) {
    console.log('[searchForVideoMemories] No Papr API key available');
    return [];
  }

  try {
    const memoryService = createMemoryService(apiKey);
    
    // Build search query based on available context
    const searchTerms = [];
    if (context.bookTitle) searchTerms.push(context.bookTitle);
    if (context.bookId) searchTerms.push(`book_id:${context.bookId}`);
    
    // Extract potential character names, objects, or scenes from prompt/context
    const allText = `${context.prompt || ''} ${context.storyContext || ''}`.toLowerCase();
    
    // Search for character names (common children's book names)
    const characterNames = ['jood', 'alex', 'sara', 'max', 'lily', 'emma', 'jack', 'mia'];
    const foundCharacter = characterNames.find(name => allText.includes(name));
    if (foundCharacter) searchTerms.push(`character_name:${foundCharacter}`);
    
    // Search for common props/objects
    const commonProps = ['compass', 'key', 'book', 'treasure', 'map', 'crystal', 'wand', 'sword'];
    const foundProp = commonProps.find(prop => allText.includes(prop));
    if (foundProp) searchTerms.push(`prop_type:${foundProp}`);
    
    // Search for scene types
    const sceneTypes = ['forest', 'castle', 'garden', 'beach', 'mountain', 'cave', 'village', 'clearing'];
    const foundScene = sceneTypes.find(scene => allText.includes(scene));
    if (foundScene) searchTerms.push(`scene_type:${foundScene}`);
    
    if (searchTerms.length === 0) {
      console.log('[searchForVideoMemories] No specific search terms found, searching with book context');
      // Fallback: search with just book title/ID if no specific terms found
      if (context.bookTitle) {
        searchTerms.push(context.bookTitle);
      }
      if (context.bookId) {
        searchTerms.push(`book_id:${context.bookId}`);
      }
      
      // If still no terms, return empty
      if (searchTerms.length === 0) {
        console.log('[searchForVideoMemories] No search terms available');
        return [];
      }
    }

    const searchQuery = `images and video metadata for ${searchTerms.join(' ')}`;
    console.log('[searchForVideoMemories] Searching with query:', searchQuery);

    const searchResult = await memoryService.searchMemories(
      userId,
      searchQuery,
      10 // Get more memories for the optimizer to choose from
    );

    if (searchResult && searchResult.length > 0) {
      console.log('[searchForVideoMemories] Found memories:', searchResult.length);
      return searchResult; // Return all memories for the optimizer to process
    }

    console.log('[searchForVideoMemories] No memories found');
    return [];
  } catch (error) {
    console.error('[searchForVideoMemories] Error searching memories:', error);
    return [];
  }
}
