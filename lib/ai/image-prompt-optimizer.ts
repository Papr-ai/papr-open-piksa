/**
 * Image Prompt Optimizer Service v2
 * 
 * Uses structured output and proper prompt templates following Gemini 2.5 Flash best practices.
 * Implements "Prompt Composer" for image creation and "Visual Editor" for image editing.
 */

import { generateObject } from 'ai';
import { myProvider } from '@/lib/ai/providers';
import { z } from 'zod';

interface ImagePromptContext {
  description: string;
  sceneContext?: string;
  priorScene?: string;
  style?: 'realistic' | 'artistic' | 'illustration' | 'sketch' | 'watercolor' | 'digital-art';
  aspectRatio?: '1:1' | '16:9' | '9:16' | '4:3' | '3:4';
  imageType?: 'photorealistic' | 'illustration' | 'sticker' | 'product' | 'minimalist' | 'comic';
  bookTitle?: string;
  bookId?: string;
  userId?: string;
  seedImages?: string[];
  seedImageTypes?: ('character' | 'environment' | 'prop' | 'other')[];
  isEditing?: boolean; // Flag to determine if this is for editing vs creation
  
  // Enhanced book context
  styleBible?: string; // Art style guidelines from book creation
  bookThemes?: string[]; // Main themes of the book
  bookGenre?: string; // Book genre for style context
  targetAge?: string; // Target age group for appropriate style
  conversationContext?: string; // Full conversation context with style details
  
  // Spatial enhancement context
  spatialViewType?: 'top-down' | 'isometric' | 'wide-angle' | 'birds-eye' | 'standard';
  spatialPromptAddition?: string; // Additional spatial layout requirements
  prescriptivePositioning?: boolean; // Whether to use prescriptive character positioning
  spatialInstructions?: string; // Detailed spatial positioning instructions
  environmentZones?: Array<{ zoneId: string; zoneName: string; description: string }>; // Defined zones for placement
}

// Schema for image creation prompts
const ImageCreationSchema = z.object({
  finalPrompt: z.string().describe('One cohesive paragraph describing the scene cinematically'),
  archetype: z.enum(['photorealistic', 'illustration', 'text/logo', 'product', 'minimalist', 'panel']).describe('The image archetype that best fits the request'),
  aspectRatio: z.string().describe('Aspect ratio like 16:9, 4:5, 1:1, 3:2'),
  background: z.string().describe('Background description - transparent, solid color, or environment'),
  assumptionsMade: z.string().describe('Short comma-separated list of assumptions made')
});

// Schema for image editing prompts
const ImageEditingSchema = z.object({
  editInstruction: z.string().describe('One cohesive paragraph describing the edit and integration'),
  mask: z.string().describe('Concise natural-language mask describing only what to change, or "none"'),
  mode: z.enum(['add/remove/modify', 'inpaint', 'style_transfer', 'composite', 'preserve_detail']).describe('The editing mode'),
  preserveDetails: z.boolean().default(true).describe('Whether to preserve important details'),
  assumptionsMade: z.string().describe('Assumptions made during editing instruction creation')
});

interface OptimizedPromptResult {
  optimizedPrompt: string;
  reasoning: string;
  imageType: string;
  photographicTerms?: string[];
  keyElements: string[];
}

/**
 * Optimizes image prompts using structured output and proper templates
 */
export async function optimizeImagePrompt(
  context: ImagePromptContext
): Promise<OptimizedPromptResult> {
  console.log('[ImagePromptOptimizer] Starting optimization with structured output:', {
    description: context.description?.substring(0, 100) + '...',
    hasSceneContext: !!context.sceneContext,
    style: context.style,
    hasSeedImages: (context.seedImages?.length || 0) > 0,
    isEditing: context.isEditing
  });

  try {
    if (context.isEditing || (context.seedImages && context.seedImages.length > 0)) {
      // Use Visual Editor template for editing
      return await optimizeEditingPrompt(context);
    } else {
      // Use Prompt Composer template for creation
      return await optimizeCreationPrompt(context);
    }
  } catch (error) {
    console.error('[ImagePromptOptimizer] Optimization failed:', error);
    
    // Log additional error details for debugging
    if (error instanceof Error) {
      console.error('[ImagePromptOptimizer] Error details:', {
        name: error.name,
        message: error.message,
        cause: (error as any).cause,
        finishReason: (error as any).finishReason
      });
    }
    
    // Fallback to simple enhancement
    const fallbackPrompt = enhanceDescriptionSimple(context);
    console.log('[ImagePromptOptimizer] Using fallback prompt:', {
      originalLength: context.description.length,
      fallbackLength: fallbackPrompt.length,
      isEditing: context.isEditing
    });
    
    return {
      optimizedPrompt: fallbackPrompt,
      reasoning: `Used fallback enhancement due to optimization error: ${error instanceof Error ? error.name : 'Unknown error'}`,
      imageType: context.imageType || 'photorealistic',
      photographicTerms: ['natural lighting', 'detailed'],
      keyElements: ['enhanced description']
    };
  }
}

/**
 * Uses the "Prompt Composer" template for image creation
 */
async function optimizeCreationPrompt(context: ImagePromptContext): Promise<OptimizedPromptResult> {
  const systemPrompt = `You are "Prompt Composer" for Gemini 2.5 Flash Image Generation.

GOAL
Turn any user request into ONE richly descriptive, cinematic paragraph that reads like a director's note (not a list of keywords), plus a compact PARAMS block. Follow Gemini's best practices: describe the scene, be hyper-specific, control the camera, and use semantic negatives (describe absences positively).

PROCESS
1) Pick an archetype that best fits the request (infer if not provided):
   - photorealistic • stylized illustration/sticker • accurate text/logo
   - product mockup/commercial • minimalist/negative space • comic panel/storyboard
2) Expand user intent into a single narrative paragraph:
   - Composition: [shot type] of [subject], [action/expression], in [environment].
   - Lighting & Mood: name the lighting setup and the emotional tone.
   - Camera & Optics (for photorealism): angle, lens/focal length, depth-of-field.
   - Style Cues (for illustration/sticker): art style, line/shading, palette, background transparency if needed.
   - Text Rendering (if applicable): exact text, typographic vibe (e.g., geometric sans, condensed serif), placement.
   - Product Mockups: background surface, studio setup (e.g., three-point softbox), angle to showcase a feature.
   - Minimalist: subject placement and explicit negative space.
   - Storyboard/Panel: foreground action, background setting, dialogue/caption text, panel ratio.
3) Add "semantic negative prompts" by describing what the scene DOES contain or how it is "empty/quiet/undisturbed," instead of listing "no X."
4) Defaults (only when the user is silent):
   - aspect_ratio: photorealistic 3:2; portrait 4:5; landscape/scene 16:9; sticker/icon 1:1; comic panel 3:2.
   - lighting: soft diffused key with gentle fill.
   - lens: 50mm standard (portraits), 85mm tight headshot, 24mm wide interior, 100mm macro close-ups.
   - angle: eye-level unless drama is desired (then low-angle/high-angle).
   - sticker/icon: background = transparent.
5) For complex scenes, compose stepwise in the paragraph ("first… then… finally…") but still output a single paragraph.
6) Do not ask questions; make tasteful best-guess assumptions and state them in assumptions_made.`;

  const userPrompt = buildCreationUserPrompt(context);

  console.log('[ImagePromptOptimizer] Using Prompt Composer template for creation');

  const result = await generateObject({
    model: myProvider.languageModel('gemini-2.5-flash'),
    system: systemPrompt,
    prompt: userPrompt,
    schema: ImageCreationSchema,
    temperature: 0.7,
    maxOutputTokens: 2000, // Increased token limit for structured output
    maxRetries: 2, // Add retries for reliability
  });

  console.log('[ImagePromptOptimizer] Creation optimization complete:', {
    archetype: result.object.archetype,
    aspectRatio: result.object.aspectRatio,
    promptLength: result.object.finalPrompt.length
  });

  return {
    optimizedPrompt: result.object.finalPrompt,
    reasoning: `Used Prompt Composer template. Archetype: ${result.object.archetype}. Assumptions: ${result.object.assumptionsMade}`,
    imageType: result.object.archetype,
    photographicTerms: extractPhotographicTerms(result.object.finalPrompt),
    keyElements: [result.object.archetype, result.object.background, result.object.aspectRatio]
  };
}

/**
 * Uses the "Visual Editor" template for image editing
 */
async function optimizeEditingPrompt(context: ImagePromptContext): Promise<OptimizedPromptResult> {
  const systemPrompt = `You are "Visual Editor" for Gemini 2.5 Flash Image Editing.

GOAL
Produce ONE precise edit instruction paragraph (and a MASK + PARAMS block) that uses Gemini's editing playbook: add/remove/modify elements, inpaint with semantic masking, transfer style, or combine multiple images—while matching original lighting, perspective, and grain. Preserve important, named details.

EDIT MODES (choose one or combine if needed)
	•	Add/Remove/Modify Element
	•	Inpainting (semantic mask)
	•	Style Transfer
	•	Multi-image Composite
	•	High-fidelity Preservation (faces, logos, text)

PROCESS
	1.	Identify the dominant edit mode(s) from the user request.
	2.	Write a single, specific instruction paragraph that:
	•	Names the source(s): "Using the provided image(s)…"
	•	Describes the change and how it should integrate (lighting, shadows, perspective, reflections).
	•	Explicitly preserves everything else: "Keep all other elements exactly the same."
	•	For composites: specify which element from which image, precise placement, scale, and overlap order.
	•	For inpainting: describe the target region as a semantic mask (e.g., "only the blue sofa").
	•	For style transfer: name the new style and what to preserve (composition, layout).
	•	For text/logos/faces: describe critical features in detail to prevent drift.
	3.	Use positive, semantic wording to avoid unintended removals.
	4.	If user is silent on key constraints, infer tasteful defaults and record them in assumptions_made.`;

  const userPrompt = buildEditingUserPrompt(context);

  console.log('[ImagePromptOptimizer] Using Visual Editor template for editing');

  const result = await generateObject({
    model: myProvider.languageModel('gemini-2.5-flash'),
    system: systemPrompt,
    prompt: userPrompt,
    schema: ImageEditingSchema,
    temperature: 0.7,
    maxOutputTokens: 10000, // Increased token limit for structured output
    maxRetries: 2, // Add retries for reliability
  });

  console.log('[ImagePromptOptimizer] Editing optimization complete:', {
    mode: result.object.mode,
    hasMask: result.object.mask !== 'none',
    instructionLength: result.object.editInstruction.length
  });

  return {
    optimizedPrompt: result.object.editInstruction,
    reasoning: `Used Visual Editor template. Mode: ${result.object.mode}. Mask: ${result.object.mask}. Assumptions: ${result.object.assumptionsMade}`,
    imageType: 'edit',
    photographicTerms: ['preserve lighting', 'match perspective', 'maintain grain'],
    keyElements: [result.object.mode, result.object.mask, 'preserve details']
  };
}

/**
 * Builds the user prompt for image creation
 */
function buildCreationUserPrompt(context: ImagePromptContext): string {
  let prompt = `REQUEST: ${context.description}`;

  // Enhanced book context for better style consistency
  if (context.bookTitle) {
    prompt += `\n\nBOOK: "${context.bookTitle}"`;
    
    if (context.bookGenre) {
      prompt += ` (${context.bookGenre})`;
    }
    
    if (context.targetAge) {
      prompt += ` for ages ${context.targetAge}`;
    }
  }

  // Style Bible is the most important for visual consistency
  if (context.styleBible) {
    prompt += `\n\nART STYLE REQUIREMENTS: ${context.styleBible}`;
  } else if (context.style) {
    prompt += `\n\nSTYLE PREFERENCE: ${context.style}`;
  }

  // Book themes provide emotional and visual context
  if (context.bookThemes && context.bookThemes.length > 0) {
    prompt += `\n\nBOOK THEMES: ${context.bookThemes.join(', ')} - ensure the image reflects these themes`;
  }

  if (context.sceneContext) {
    prompt += `\n\nSCENE CONTEXT: ${context.sceneContext}`;
  }
  
  // Enhanced spatial awareness for environments
  if (context.spatialViewType && context.spatialViewType !== 'standard') {
    prompt += `\n\n🗺️ SPATIAL VIEW REQUIREMENT: Use ${context.spatialViewType} perspective to show complete spatial relationships and layout`;
  }
  
  if (context.spatialPromptAddition) {
    prompt += `\n\n${context.spatialPromptAddition}`;
  }
  
  // Prescriptive positioning for scenes
  if (context.prescriptivePositioning && context.spatialInstructions) {
    prompt += `\n\n${context.spatialInstructions}`;
  }
  
  // Environment zones for reference
  if (context.environmentZones && context.environmentZones.length > 0) {
    prompt += `\n\nENVIRONMENT ZONES FOR REFERENCE:`;
    context.environmentZones.forEach(zone => {
      prompt += `\n- ${zone.zoneName}: ${zone.description}`;
    });
  }

  if (context.aspectRatio) {
    prompt += `\n\nASPECT RATIO: ${context.aspectRatio}`;
  }

  if (context.priorScene) {
    prompt += `\n\nPRIOR SCENE: ${context.priorScene}`;
  }

  // Add seed image guidance for editing
  if (context.seedImages && context.seedImages.length > 0) {
    prompt += `\n\nSEED IMAGES: ${context.seedImages.length} reference image(s) provided`;
    if (context.seedImageTypes && context.seedImageTypes.length > 0) {
      prompt += ` (${context.seedImageTypes.join(', ')})`;
    }
    prompt += ` - maintain consistency with these images while following the art style requirements`;
  }

  return prompt;
}

/**
 * Builds the user prompt for image editing
 */
function buildEditingUserPrompt(context: ImagePromptContext): string {
  let prompt = `EDIT REQUEST: ${context.description}`;

  if (context.seedImages && context.seedImages.length > 0) {
    prompt += `\n\nSOURCE IMAGES: ${context.seedImages.length} image(s) provided`;
    
    if (context.seedImageTypes && context.seedImageTypes.length > 0) {
      prompt += ` (Types: ${context.seedImageTypes.join(', ')})`;
    }
  }

  // Enhanced book context for editing consistency
  if (context.bookTitle) {
    prompt += `\n\nBOOK CONTEXT: "${context.bookTitle}"`;
    
    if (context.bookGenre && context.targetAge) {
      prompt += ` (${context.bookGenre} for ages ${context.targetAge})`;
    }
  }

  // Style Bible is critical for maintaining visual consistency when editing
  if (context.styleBible) {
    prompt += `\n\nMAINTAIN ART STYLE: ${context.styleBible}`;
  } else if (context.style) {
    prompt += `\n\nSTYLE PREFERENCE: ${context.style}`;
  }

  // Book themes should be preserved in edits
  if (context.bookThemes && context.bookThemes.length > 0) {
    prompt += `\n\nPRESERVE BOOK THEMES: ${context.bookThemes.join(', ')}`;
  }

  if (context.sceneContext) {
    prompt += `\n\nCONTEXT: ${context.sceneContext}`;
  }

  return prompt;
}

/**
 * Extracts photographic terms from a prompt
 */
function extractPhotographicTerms(prompt: string): string[] {
  const terms: string[] = [];
  const photographicKeywords = [
    'lighting', 'lens', 'focal length', 'aperture', 'depth of field', 'bokeh',
    'composition', 'framing', 'angle', 'perspective', 'exposure', 'contrast',
    'shadows', 'highlights', 'cinematic', 'studio', 'natural light', 'soft light'
  ];

  for (const keyword of photographicKeywords) {
    if (prompt.toLowerCase().includes(keyword)) {
      terms.push(keyword);
    }
  }

  return terms.length > 0 ? terms : ['natural lighting'];
}

/**
 * Simple fallback enhancement if structured output fails
 */
function enhanceDescriptionSimple(context: ImagePromptContext): string {
  let enhanced = context.description;

  // Handle editing scenarios
  if (context.isEditing || (context.seedImages && context.seedImages.length > 0)) {
    // For editing, make the prompt more action-oriented
    if (!enhanced.match(/\b(remove|add|change|modify|edit|place|adjust)\b/i)) {
      enhanced = `Edit the image: ${enhanced}`;
    }
    enhanced += '. Keep all other elements exactly the same.';
  } else {
    // For creation, add style cues
    if (context.style === 'realistic') {
      enhanced += ', photorealistic, detailed, high quality';
    } else if (context.style === 'illustration') {
      enhanced += ', illustration style, clean lines, artistic';
    }
  }

  // Add context if available
  if (context.sceneContext) {
    enhanced += ` Context: ${context.sceneContext}`;
  }

  return enhanced;
}
