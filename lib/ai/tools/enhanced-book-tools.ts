import type { Session } from 'next-auth';
import type { DataStreamWriter } from '@/lib/types';

// Enhanced Book Creation Tools - Complete Workflow Integration
// This file provides a unified interface for all enhanced book creation tools

import { 
  createBookPlan, 
  draftChapter, 
  segmentChapterIntoScenes, 
  createCharacterPortraits,
  type BookPlanInput,
  type ChapterDraftInput,
  type SceneSegmentationInput,
  type CharacterPortraitInput
} from './enhanced-book-creation';

import {
  createEnvironments,
  createSceneManifest,
  renderScene,
  completeBook,
  type EnvironmentCreationInput,
  type SceneCompositionInput,
  type SceneManifestInput
} from './enhanced-book-creation-part2';

// Enhanced Book Creation Workflow Tools
export function createEnhancedBookTools(session: Session, dataStream: DataStreamWriter) {
  return {
    // Step 1: High-level Story + Character Planning
    createBookPlan: createBookPlan({ session, dataStream }),
    
    // Step 2: Chapter Text Drafting
    draftChapter: draftChapter({ session, dataStream }),
    
    // Step 3: Scene Segmentation (Picture Books Only)
    segmentChapterIntoScenes: segmentChapterIntoScenes({ session, dataStream }),
    
    // Step 4: Character Portraits + Props Creation
    createCharacterPortraits: createCharacterPortraits({ session, dataStream }),
    
    // Step 5: Environment Creation
    createEnvironments: createEnvironments({ session, dataStream }),
    
    // Step 6A: Scene Manifest + Continuity Check
    createSceneManifest: createSceneManifest({ session, dataStream }),
    
    // Step 6B: Scene Composition + Rendering
    renderScene: renderScene({ session, dataStream }),
    
    // Step 7: Book Completion + Publishing Prep
    completeBook: completeBook({ session, dataStream })
  };
}

// Workflow State Management
export interface BookWorkflowState {
  bookId: string;
  currentStep: number;
  stepName: string;
  status: 'in_progress' | 'pending_approval' | 'approved' | 'completed';
  isPictureBook: boolean;
  completedSteps: number[];
  pendingApprovals: string[];
  errors?: string[];
}

// Workflow Step Definitions
export const WORKFLOW_STEPS = {
  1: {
    name: 'Story Planning',
    tool: 'createBookPlan',
    description: 'Create high-level story, themes, and character personalities',
    approvalGate: 'Approval Gate 1: User approves story and character bios',
    requiredFor: 'all'
  },
  2: {
    name: 'Chapter Drafting',
    tool: 'draftChapter',
    description: 'Draft full chapter text content',
    approvalGate: 'Approval Gate 2: User approves raw chapter text',
    requiredFor: 'all'
  },
  3: {
    name: 'Scene Segmentation',
    tool: 'segmentChapterIntoScenes',
    description: 'Break chapter into scenes with environment mapping',
    approvalGate: 'Approval Gate 3: User approves scene list and environment mapping',
    requiredFor: 'picture_books_only'
  },
  4: {
    name: 'Character Creation',
    tool: 'createCharacterPortraits',
    description: 'Create character portraits and props',
    approvalGate: 'Approval Gate 4: User approves canon portraits and props',
    requiredFor: 'picture_books_only'
  },
  5: {
    name: 'Environment Creation',
    tool: 'createEnvironments',
    description: 'Generate master plates for environments',
    approvalGate: 'Approval Gate 5: User approves environment plates',
    requiredFor: 'picture_books_only'
  },
  6: {
    name: 'Scene Creation',
    tool: 'createSceneManifest',
    description: 'Create scene manifests and render scenes',
    approvalGate: 'Approval Gate 6 & 7: User approves scene manifest and final renders',
    requiredFor: 'picture_books_only'
  },
  7: {
    name: 'Book Completion',
    tool: 'completeBook',
    description: 'Compile final book and prepare for publishing',
    approvalGate: 'Final Review: User approves complete book for publishing',
    requiredFor: 'all'
  }
} as const;

// Memory Search Helpers for Each Step
export const MEMORY_SEARCH_PATTERNS = {
  beforeCharacterCreation: (bookId: string, characterName: string) => 
    `character ${characterName} portrait ${bookId}`,
  
  beforeEnvironmentCreation: (bookId: string, location: string, timeOfDay: string, weather: string) =>
    `environment ${location} ${timeOfDay} ${weather} ${bookId}`,
    
  beforeSceneRendering: (bookId: string, sceneId: string) =>
    `scene ${sceneId} manifest environment characters props ${bookId}`,
    
  beforePublishing: (bookId: string) =>
    `book ${bookId} approved versions assets complete`,
    
  getBookBrief: (bookId: string) =>
    `book brief ${bookId} story premise themes characters`,
    
  getCharacterBio: (bookId: string, characterName: string) =>
    `character ${characterName} personality description ${bookId}`,
    
  getChapterDraft: (bookId: string, chapterNumber: number) =>
    `chapter ${chapterNumber} draft text ${bookId}`,
    
  getScenesByEnvironment: (bookId: string, environmentId: string) =>
    `scenes environment ${environmentId} ${bookId}`,
    
  getApprovedAssets: (bookId: string) =>
    `${bookId} approved final assets ready`
};

// Memory Storage Patterns for Each Asset Type
export const MEMORY_STORAGE_PATTERNS = {
  bookBrief: {
    kind: 'book_brief',
    requiredMetadata: ['book_id', 'book_title', 'genre', 'target_age', 'is_picture_book']
  },
  
  character: {
    kind: 'character',
    requiredMetadata: ['book_id', 'character_name', 'character_role', 'portrait_url', 'base_outfit', 'transparent_background']
  },
  
  chapterDraft: {
    kind: 'chapter_draft',
    requiredMetadata: ['book_id', 'chapter_number', 'chapter_title', 'word_count']
  },
  
  scene: {
    kind: 'scene',
    requiredMetadata: ['book_id', 'scene_id', 'chapter_number', 'environment_id']
  },
  
  environment: {
    kind: 'environment',
    requiredMetadata: ['book_id', 'environment_id', 'location', 'time_of_day', 'weather']
  },
  
  prop: {
    kind: 'prop',
    requiredMetadata: ['book_id', 'prop_name', 'character_name', 'must_present']
  },
  
  sceneRender: {
    kind: 'scene_render',
    requiredMetadata: ['book_id', 'scene_id', 'environment_id', 'final_image_url']
  },
  
  renderManifest: {
    kind: 'render_manifest',
    requiredMetadata: ['book_id', 'scene_id', 'seed_images', 'final_image_url', 'checksums']
  }
};

// Workflow Validation Helpers
export function validateWorkflowStep(step: number, isPictureBook: boolean): boolean {
  const stepInfo = WORKFLOW_STEPS[step as keyof typeof WORKFLOW_STEPS];
  if (!stepInfo) return false;
  
  if (stepInfo.requiredFor === 'all') return true;
  if (stepInfo.requiredFor === 'picture_books_only') return isPictureBook;
  
  return false;
}

export function getNextWorkflowStep(currentStep: number, isPictureBook: boolean): number | null {
  for (let step = currentStep + 1; step <= 7; step++) {
    if (validateWorkflowStep(step, isPictureBook)) {
      return step;
    }
  }
  return null;
}

export function getWorkflowProgress(completedSteps: number[], isPictureBook: boolean): {
  totalSteps: number;
  completedSteps: number;
  percentage: number;
  nextStep: number | null;
} {
  const allSteps = Object.keys(WORKFLOW_STEPS).map(Number);
  const applicableSteps = allSteps.filter(step => validateWorkflowStep(step, isPictureBook));
  
  const completed = completedSteps.filter(step => applicableSteps.includes(step));
  const nextStep = completed.length < applicableSteps.length 
    ? applicableSteps[completed.length] 
    : null;
  
  return {
    totalSteps: applicableSteps.length,
    completedSteps: completed.length,
    percentage: Math.round((completed.length / applicableSteps.length) * 100),
    nextStep
  };
}

// Export all types for external use
export type {
  BookPlanInput,
  ChapterDraftInput,
  SceneSegmentationInput,
  CharacterPortraitInput,
  EnvironmentCreationInput,
  SceneCompositionInput,
  SceneManifestInput
};

// Workflow guidance prompts
export const WORKFLOW_PROMPTS = {
  stepGuidance: (step: number, isPictureBook: boolean) => {
    const stepInfo = WORKFLOW_STEPS[step as keyof typeof WORKFLOW_STEPS];
    if (!stepInfo || !validateWorkflowStep(step, isPictureBook)) return '';
    
    return `
**Step ${step}: ${stepInfo.name}**
${stepInfo.description}

${stepInfo.approvalGate}

Use the \`${stepInfo.tool}\` tool to proceed with this step.
    `.trim();
  },
  
  approvalPrompt: (step: number) => {
    const stepInfo = WORKFLOW_STEPS[step as keyof typeof WORKFLOW_STEPS];
    return stepInfo ? stepInfo.approvalGate : '';
  },
  
  workflowOverview: (isPictureBook: boolean) => {
    const applicableSteps = Object.entries(WORKFLOW_STEPS)
      .filter(([step]) => validateWorkflowStep(Number(step), isPictureBook))
      .map(([step, info]) => `${step}. ${info.name}: ${info.description}`)
      .join('\n');
    
    return `
**Enhanced Book Creation Workflow${isPictureBook ? ' (Picture Book)' : ''}:**

${applicableSteps}

Each step requires user approval before proceeding to the next step.
    `.trim();
  }
};
