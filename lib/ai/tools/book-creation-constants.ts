/**
 * Constants for the unified book creation workflow
 * This file contains only constants and types, no server-side dependencies
 */

import { z } from 'zod';

// Step definitions for the unified workflow
export const BOOK_CREATION_STEPS = [
  { number: 1, name: 'Story Planning', description: 'Define story concept, themes, and structure' },
  { number: 2, name: 'Character Creation', description: 'Create main characters with portraits' },
  { number: 3, name: 'Chapter Writing', description: 'Write chapter content and scene breakdown' },
  { number: 4, name: 'Environment Design', description: 'Create environment master plates' },
  { number: 5, name: 'Scene Composition', description: 'Compose and render individual scenes' },
  { number: 6, name: 'Final Review', description: 'Review and finalize the complete book' }
];

// Flexible schemas that allow backward compatibility with existing data structures
// Using .passthrough() to allow additional properties and making most fields optional

export const StoryPlanningDataSchema = z.object({
  bookTitle: z.string().optional().describe('Title of the book being created'), // Optional since it might come from elsewhere
  premise: z.string().describe('Main story premise'), // REQUIRED - core story concept needed
  themes: z.array(z.string()).optional().describe('Story themes'),
  narrativeVoice: z.string().optional().describe('Narrative voice and style'),
  styleBible: z.string().optional().describe('Visual style guide'),
  isPictureBook: z.boolean().optional().describe('Whether this is a picture book (true) or chapter book (false)'),
  characters: z.array(z.object({
    name: z.string(), // REQUIRED - character needs a name
    age: z.union([z.number(), z.string()]).optional(),
    role: z.string().optional(),
    physicalDescription: z.string().optional(),
    notes: z.string().optional()
  }).passthrough()).optional().describe('Character outlines'),
  proposedStructure: z.array(z.object({
    spread: z.number().optional(),
    title: z.string().optional(),
    description: z.string().optional()
  }).passthrough()).optional().describe('Book structure outline'),
  conversationContext: z.string().optional(),
  // Allow legacy fields
  content: z.string().optional()
}).passthrough();

export const CharacterCreationDataSchema = z.object({
  characters: z.array(z.object({
    name: z.string(), // REQUIRED - character needs a name
    age: z.union([z.number(), z.string()]).optional(),
    role: z.string().optional(),
    physicalDescription: z.string().optional(),
    personality: z.string().optional(),
    emotionalArc: z.string().optional(),
    movementStyle: z.string().optional(),
    strengths: z.string().optional(),
    weaknesses: z.string().optional(),
    sampleLines: z.array(z.string()).optional(),
    visualNotes: z.string().optional(),
    importance: z.string().optional(),
    imageUrl: z.string().optional().describe('Direct URL to character portrait image'),
    portraitUrl: z.string().nullable().optional(), // Keep for backward compatibility
    artStyle: z.string().optional(),
    notes: z.string().optional()
  }).passthrough()).describe('Character details with direct image URLs'), // REQUIRED - must have characters array
  questions: z.array(z.string()).optional().describe('Questions for user confirmation'),
  conversationContext: z.string().optional()
}).passthrough();

// Simple scene schema - let LLM express rich content through markdown
const SceneSchema = z.object({
  sceneNumber: z.number().optional().describe('Scene number for ordering'),
  title: z.string().optional().describe('Scene title'),
  text: z.string().describe('Scene content in markdown - can include story structure, dialogue, action, etc.'),
  characters: z.array(z.string()).optional().describe('Characters present in this scene'),
  illustrationNotes: z.string().optional().describe('Notes for illustrations in this scene')
}).passthrough();

const ChapterSchema = z.object({
  chapterNumber: z.number(),          // REQUIRED - UI needs this for ordering
  title: z.string(),                  // REQUIRED - UI needs this for display
  scenes: z.array(SceneSchema),       // REQUIRED - UI needs scenes array (can be empty for outline-only)
  summary: z.string().optional().describe('Brief summary of the chapter'),
  approxWords: z.number().optional().describe('Approximate word count for the chapter')
}).passthrough();

// Simple Chapter Writing Data Schema
export const ChapterWritingDataSchema = z.object({
  chapters: z.array(ChapterSchema).describe('Array of chapters with scenes'),
  
  // Optional metadata
  title: z.string().optional().describe('Book title'),
  summary: z.string().optional().describe('Overall book summary'),
  conversationContext: z.string().optional()
}).passthrough();

export const EnvironmentDesignDataSchema = z.object({
  environments: z.array(z.object({
    name: z.string().optional(),
    description: z.string().optional(),
    imageUrl: z.string().optional(),
    artStyle: z.string().optional()
  }).passthrough()).optional().describe('Environment designs'),
  conversationContext: z.string().optional(),
  // Allow legacy fields
  illustratorStyleGuide: z.string().optional()
}).passthrough();

export const SceneCompositionDataSchema = z.object({
  // Final chapters with complete content (same structure as Step 3, but expanded)
  chapters: z.array(ChapterSchema).describe('Final chapters with complete, expanded scenes'),
  
  // Optional metadata
  title: z.string().optional().describe('Book title'),
  summary: z.string().optional().describe('Overall book summary'),
  conversationContext: z.string().optional(),
  
  // Allow legacy fields for backward compatibility
  scenes: z.array(z.object({}).passthrough()).optional().describe('Legacy scenes array for backward compatibility'),
  expandedChapters: z.array(z.object({}).passthrough()).optional().describe('Legacy expanded chapters for backward compatibility'),
  scenesToCompose: z.array(z.object({}).passthrough()).optional().describe('Legacy scenes to compose for backward compatibility'),
  stepTitle: z.string().optional(),
  nextSteps: z.array(z.string()).optional(),
  seedsAndAssets: z.any().optional()
}).passthrough();

export const FinalReviewDataSchema = z.object({
  bookPreview: z.object({
    pages: z.array(z.object({
      pageNumber: z.number().optional(),
      content: z.string().optional(),
      imageUrl: z.string().optional()
    }).passthrough()).optional()
  }).optional(),
  summary: z.string().optional().describe('Final book summary'),
  downloadUrl: z.string().optional().describe('PDF download URL'),
  conversationContext: z.string().optional(),
  // Allow legacy fields
  status: z.string().optional(),
  bookTitle: z.string().optional(),
  totalSteps: z.number().optional(),
  completedSteps: z.number().optional(),
  bookSummary: z.string().optional(),
  bookConcept: z.string().optional(),
  totalCharacters: z.any().optional(),
  totalEnvironments: z.any().optional(),
  totalScenes: z.any().optional(),
  totalPages: z.number().optional(),
  finalizedAt: z.string().optional()
}).passthrough();

// Union type for all step data schemas - now more flexible
export const StepDataSchema = z.union([
  StoryPlanningDataSchema,
  CharacterCreationDataSchema,
  ChapterWritingDataSchema,
  EnvironmentDesignDataSchema,
  SceneCompositionDataSchema,
  FinalReviewDataSchema,
  z.object({}).passthrough() // Fallback for any object
]);

export interface BookCreationStep {
  stepNumber: number;
  stepName: string;
  status: 'pending' | 'in_progress' | 'completed' | 'approved' | 'needs_revision';
  data?: any; // Keep flexible for backward compatibility
  errors?: string[];
}

export interface BookArtifactState {
  bookId: string;
  bookTitle: string;
  bookConcept: string;
  targetAge: string;
  isPictureBook?: boolean;
  currentStep: number;
  steps: BookCreationStep[];
  createdAt: Date;
  updatedAt: Date;
}
