/**
 * Video Prompt Optimizer Service
 * 
 * Uses GPT-5 mini via the AI SDK to analyze context and generate
 * optimized prompts for Gemini Veo video generation.
 */

import { streamText } from 'ai';
import { myProvider } from '@/lib/ai/providers';
import { searchMemories } from '@/lib/ai/tools/search-memories';

interface VideoContext {
  storyContext?: string; // Prior page content from book
  imageDescription?: string; // Description of the seed image
  bookId?: string;
  bookTitle?: string;
  metadata?: any; // Relevant memories/metadata
}

interface OptimizedPrompt {
  prompt: string;
  reasoning: string;
}

/**
 * Analyzes context and generates an optimized Veo prompt
 */
export async function optimizeVideoPrompt(context: VideoContext, userId: string): Promise<OptimizedPrompt> {
  console.log('[VideoPromptOptimizer] Input context:', {
    hasStoryContext: !!context.storyContext,
    storyContextLength: context.storyContext?.length || 0,
    storyContextPreview: context.storyContext?.substring(0, 100) + '...',
    imageDescription: context.imageDescription,
    bookId: context.bookId,
    bookTitle: context.bookTitle,
    memoriesCount: Array.isArray(context.metadata) ? context.metadata.length : 0
  });
  
  const systemPrompt = `You are a video prompt optimization specialist for Gemini Veo. Your job is to analyze story context, search for relevant memories, and create structured video generation prompts.

WORKFLOW:
1. ANALYZE the story context and image description to identify key elements (characters, objects, locations)
2. USE searchMemories tool strategically to find relevant details:
   - Search for character names mentioned in the story
   - Search for specific objects, props, or locations
   - Search for the book title for general context
3. SYNTHESIZE findings into a Veo-optimized prompt that includes:
   - Character descriptions (appearance, clothing, expressions)
   - Scene setting (lighting, atmosphere, environment)
   - Camera movements (push-in, pan, tilt, etc.)
   - Motion elements (character actions, environmental effects)
   - Audio atmosphere (if relevant)

VEO PROMPT STRUCTURE:
- Subject: Who/what is the main focus
- Action: What movements or actions are happening
- Setting: Environment, lighting, mood
- Camera: Movement style (cinematic, smooth, dynamic)
- Details: Specific visual elements that make it compelling

SEARCH STRATEGY:
- Make 2-3 targeted searches based on story analysis
- Look for character physical descriptions
- Find scene/location atmosphere details
- Search for prop/object specific features

VEOOPTIMIZATION GUIDELINES:
- Focus on: Subject, Action, Style, Camera movement, Lighting, Atmosphere
- Include: Specific character movements, environmental effects, mood
- Avoid: Overly complex descriptions, contradictory instructions
- Prioritize: Cinematic quality, story coherence, emotional impact

OUTPUT FORMAT:
Return a JSON object with:
- "prompt": The optimized Veo prompt (under 200 words)
- "reasoning": Brief explanation of key decisions (under 100 words)

EXAMPLE OUTPUT:
{
  "prompt": "Create a cinematic video of Captain Cardboard awakening in Emma's sunny craft room. He stretches his cardboard arms wide, his blue fabric cape flowing as golden morning sunlight streams through lace curtains. Gentle camera push-in captures his painted eyes blinking to life while magical sparkles swirl around him. Starlight Sparkle and Max the Mighty stir beside him on the wooden shelf. Dust particles dance in the warm sunbeams as the heroes begin their daily adventure. Soft ambient craft room sounds with subtle magical tinkling.",
  "reasoning": "Searched for 'Captain Cardboard' and found detailed character description (blue cape, cardboard construction). Searched for 'Emma craft room' and found scene details (sunny room, wooden shelf, morning light). Combined story context about awakening with specific visual elements from memories to create structured Veo prompt."
}`;

  const userPrompt = `Analyze this video generation context and create an optimized Veo prompt:

STORY CONTEXT (most important):
${context.storyContext || 'No story context provided'}

SEED IMAGE DESCRIPTION:
${context.imageDescription || 'No image description provided'}

BOOK CONTEXT:
- Title: ${context.bookTitle || 'Unknown'}
- Book ID: ${context.bookId || 'Unknown'}

INSTRUCTIONS:
1. First, use the searchMemories tool to find relevant information about characters, scenes, props, or other elements mentioned in the story context
2. Then create an optimized Veo prompt that combines the story context with the relevant details you found
3. You MUST return your response as valid JSON with exactly this format:

{
  "prompt": "Your optimized Veo prompt here (under 200 words)",
  "reasoning": "Brief explanation of what memories you found and how you used them"
}

Do not include any text before or after the JSON. The entire response must be valid JSON.`;

  try {
    // Use AI SDK directly with timeout
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 30000); // 30 second timeout
    
    // Create mock session for search tool
    const mockSession = { user: { id: userId } };
    
    // Set up search memories tool with sanitized naming
    const tools = {
      searchMemories: searchMemories({ session: mockSession as any })
    };

    let result;
    try {
      result = await streamText({
        model: myProvider.languageModel('gpt-5-mini'),
        system: systemPrompt,
        prompt: userPrompt,
        tools: tools,
        temperature: 0.7,
        maxOutputTokens: 800,
        abortSignal: controller.signal,
      });
    } catch (reasoningError: any) {
      console.error('[VideoPromptOptimizer] Error with AI call:', reasoningError);
      
      // Check if this is a reasoning error
      if (reasoningError.message?.includes('reasoning') || reasoningError.message?.includes('required following item')) {
        console.log('[VideoPromptOptimizer] Detected reasoning chain error, retrying without reasoning...');
        
        // Retry without reasoning-specific features
        result = await streamText({
          model: myProvider.languageModel('gpt-5-mini'),
          system: systemPrompt,
          prompt: userPrompt,
          tools: tools,
          temperature: 0.7,
          maxOutputTokens: 800,
          abortSignal: controller.signal,
        });
      } else {
        throw reasoningError;
      }
    }
    
    clearTimeout(timeoutId);
    
    // Wait for the full response including tool calls
    const finalResult = await result;
    const text = await finalResult.text;
    const toolCalls = await finalResult.toolCalls;
    const toolResults = await finalResult.toolResults;
    
    console.log('[VideoPromptOptimizer] Full response text:', text);
    console.log('[VideoPromptOptimizer] Tool calls:', toolCalls?.length || 0);
    console.log('[VideoPromptOptimizer] Tool results:', toolResults?.length || 0);

    // Try to parse JSON response from the final text
    try {
      const parsed = JSON.parse(text);
      if (parsed.prompt && parsed.reasoning) {
        console.log('[VideoPromptOptimizer] Successfully parsed JSON response');
        return parsed;
      }
    } catch (parseError) {
      const errorMessage = parseError instanceof Error ? parseError.message : String(parseError);
      console.warn('[VideoPromptOptimizer] Could not parse JSON response:', errorMessage);
      console.log('[VideoPromptOptimizer] Raw response text:', text.substring(0, 200) + '...');
    }

    // Fallback: basic prompt without memory analysis (GPT-5 mini should handle this properly)
    let enhancedPrompt = 'Create a cinematic video based on the provided image with smooth, natural movements.';
    
    if (context.storyContext && context.storyContext.trim()) {
      const storySnippet = context.storyContext.substring(0, 150);
      enhancedPrompt = `Create a cinematic video based on this image. Story context: ${storySnippet} Use smooth camera movements, natural lighting, and bring the scene to life with character movements and atmospheric effects that match the story.`;
    }
    
    if (context.imageDescription) {
      enhancedPrompt += ` The image shows: ${context.imageDescription}`;
    }
    
    return {
      prompt: enhancedPrompt,
      reasoning: `Used basic fallback due to JSON parsing issues. GPT-5 mini should be fixed to return proper JSON format with memory analysis.`
    };

  } catch (error) {
    console.error('[VideoPromptOptimizer] Error:', error);
    
    // Check if it's an overload or timeout error
    const errorMessage = error instanceof Error ? error.message : String(error);
    const isOverloadError = errorMessage.includes('overloaded') || errorMessage.includes('Overloaded');
    const isTimeoutError = errorMessage.includes('aborted') || errorMessage.includes('timeout');
    
    if (isOverloadError || isTimeoutError) {
      console.warn(`[VideoPromptOptimizer] ${isTimeoutError ? 'Request timeout' : 'Model overloaded'}, using enhanced fallback with story context`);
      
      // Enhanced fallback that incorporates story context intelligently
      let enhancedPrompt = 'Create a cinematic video animation based on this image.';
      
      if (context.storyContext && context.storyContext.trim()) {
        // Extract key elements from story context
        const storySnippet = context.storyContext.substring(0, 150);
        enhancedPrompt += ` Story context: ${storySnippet}`;
      }
      
      if (context.imageDescription) {
        enhancedPrompt += ` The image shows: ${context.imageDescription}`;
      }
      
      enhancedPrompt += ' Use smooth camera movements, natural lighting, and bring the scene to life with subtle character movements and atmospheric effects.';
      
      return {
        prompt: enhancedPrompt,
        reasoning: `Used enhanced fallback due to ${isTimeoutError ? 'timeout' : 'model overload'} - incorporated story context and basic cinematic direction.`
      };
    }
    
    // Ultimate fallback for other errors
    return {
      prompt: `Create a cinematic video animation based on this image. ${context.storyContext ? `Story context: ${context.storyContext.substring(0, 100)}...` : ''} Use smooth camera movements and natural lighting to bring the scene to life.`,
      reasoning: 'Used basic fallback due to optimization service error.'
    };
  }
}


