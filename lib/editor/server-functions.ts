'use server';

import { documentSchema } from './config';
import { buildContentFromDocument } from './functions';

/**
 * Build ProseMirror document content from scene data (server-side only)
 */
export async function buildContentFromScenes(scenes: Array<{
  sceneId: string;
  sceneNumber: number;
  synopsis: string;
  content: string;
  environment: {
    location: string;
    timeOfDay: string;
    weather: string;
    mood: string;
    description: string;
  };
  requiredCharacters: string[];
  requiredProps?: string[];
  continuityNotes?: string;
}>): Promise<string> {
  const { createSceneNode } = await import('@/lib/ai/book-content-updater');
  
  // Create scene nodes
  const sceneNodes = scenes.map(scene => 
    createSceneNode(
      scene.sceneId,
      scene.sceneNumber,
      scene.synopsis,
      '', // No image URL initially - will be added when images are created
      scene.environment.location,
      scene.requiredCharacters,
      `${scene.environment.description} (${scene.environment.timeOfDay}, ${scene.environment.weather}, ${scene.environment.mood})`,
      scene.content
    )
  );
  
  // Create document with scene nodes
  const doc = documentSchema.nodes.doc.create({}, sceneNodes);
  
  // Serialize to content format
  return buildContentFromDocument(doc);
}
