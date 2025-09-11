import { EditorState } from 'prosemirror-state';
import { documentSchema } from '@/lib/editor/config';
import { buildDocumentFromContent, buildContentFromDocument } from '@/lib/editor/functions';

interface SceneImageInsertionParams {
  bookId: string;
  chapterNumber: number;
  sceneId: string;
  imageUrl: string;
  synopsis: string;
  storyContext?: string;
  userId: string;
}

interface SceneImageInsertionResult {
  success: boolean;
  updatedContent: string;
  error?: string;
}

/**
 * Insert or update an image in a scene nodeview
 */
export async function insertSceneImageIntoBook({
  bookId,
  chapterNumber,
  sceneId,
  imageUrl,
  synopsis,
  storyContext,
  userId
}: SceneImageInsertionParams): Promise<SceneImageInsertionResult> {
  try {
    // Get current book content from database
    const book = await getBookChapter(bookId, chapterNumber, userId);
    if (!book) {
      return { 
        success: false, 
        updatedContent: '', 
        error: `Chapter ${chapterNumber} not found for book ${bookId}` 
      };
    }

    console.log(`[insertSceneImageIntoBook] Processing scene ${sceneId} for chapter ${chapterNumber}`);

    // Parse content with ProseMirror
    const doc = buildDocumentFromContent(book.content);
    
    // Find the scene node
    const sceneNodeResult = findSceneNode(doc, sceneId);
    
    if (sceneNodeResult) {
      // Update existing scene with image
      const updatedDoc = updateSceneImage(doc, sceneId, imageUrl, synopsis, storyContext);
      const newContent = buildContentFromDocument(updatedDoc);
      
      // Save updated content to database
      await updateBookContent(book.id, newContent);
      
      console.log(`[insertSceneImageIntoBook] ✅ Updated existing scene ${sceneId} with image`);
      return { success: true, updatedContent: newContent };
      
    } else {
      console.warn(`[insertSceneImageIntoBook] Scene ${sceneId} not found in chapter content`);
      // For now, we'll return the original content unchanged
      // In the future, we could add logic to create a new scene node
      return { 
        success: false, 
        updatedContent: book.content,
        error: `Scene ${sceneId} not found in chapter content`
      };
    }

  } catch (error) {
    console.error('[insertSceneImageIntoBook] Error:', error);
    return { 
      success: false, 
      updatedContent: '', 
      error: error instanceof Error ? error.message : 'Unknown error'
    };
  }
}

/**
 * Find a scene node in the document by sceneId
 */
function findSceneNode(doc: any, sceneId: string): { node: any; pos: number } | null {
  let result: { node: any; pos: number } | null = null;
  
  doc.descendants((node: any, pos: number) => {
    if (node.type.name === 'scene' && node.attrs.sceneId === sceneId) {
      result = { node, pos };
      return false; // Stop traversal
    }
  });
  
  return result;
}

/**
 * Update a scene node with a new image URL
 */
function updateSceneImage(
  doc: any, 
  sceneId: string, 
  imageUrl: string, 
  synopsis: string,
  storyContext?: string
): any {
  const tr = EditorState.create({ doc }).tr;
  let updated = false;
  
  doc.descendants((node: any, pos: number) => {
    if (node.type.name === 'scene' && node.attrs.sceneId === sceneId) {
      // Update scene node attributes with new image URL
      const newAttrs = {
        ...node.attrs,
        imageUrl,
        synopsis,
        storyContext
      };
      
      tr.setNodeMarkup(pos, undefined, newAttrs);
      updated = true;
      return false; // Stop traversal
    }
  });
  
  if (!updated) {
    console.warn(`[updateSceneImage] Scene ${sceneId} not found for image update`);
    return doc;
  }
  
  return tr.doc;
}

/**
 * Create a new scene node with content and image
 */
export function createSceneNode(
  sceneId: string,
  sceneNumber: number,
  synopsis: string,
  imageUrl: string,
  environment?: string,
  characters: string[] = [],
  storyContext?: string,
  initialContent?: string
): any {
  // Create initial paragraph content
  const paragraphContent = initialContent || `Scene ${sceneNumber}: ${synopsis}`;
  const paragraphNode = documentSchema.nodes.paragraph.create({}, [
    documentSchema.text(paragraphContent)
  ]);
  
  // Create scene node with attributes and content
  return documentSchema.nodes.scene.create({
    sceneId,
    sceneNumber,
    synopsis,
    imageUrl,
    environment,
    characters,
    storyContext
  }, [paragraphNode]);
}

/**
 * Helper function to get book chapter from database
 */
async function getBookChapter(bookId: string, chapterNumber: number, userId: string) {
  try {
    const { getBookChaptersByBookId } = await import('@/lib/db/book-queries');
    const chapters = await getBookChaptersByBookId(bookId, userId);
    return chapters.find((chapter: any) => chapter.chapterNumber === chapterNumber);
  } catch (error) {
    console.error('[getBookChapter] Error:', error);
    return null;
  }
}

/**
 * Helper function to update book content in database
 */
async function updateBookContent(bookRecordId: string, newContent: string) {
  try {
    const { updateBookChapter } = await import('@/lib/db/book-queries');
    await updateBookChapter(bookRecordId, 'user-id-placeholder', { content: newContent });
    console.log(`[updateBookContent] ✅ Updated book record ${bookRecordId}`);
  } catch (error) {
    console.error('[updateBookContent] Error:', error);
    throw error;
  }
}

/**
 * Extract scene information from scene ID
 */
export function extractSceneInfo(sceneId: string): { chapterNumber?: number; sceneNumber?: number } {
  // Expected format: scene-1-chapter-title or similar
  const match = sceneId.match(/scene-(\d+)/);
  return {
    sceneNumber: match ? parseInt(match[1]) : undefined
  };
}

/**
 * Generate scene ID from chapter and scene info
 */
export function generateSceneId(chapterNumber: number, sceneNumber: number, chapterTitle?: string): string {
  const titleSlug = chapterTitle ? chapterTitle.toLowerCase().replace(/\s+/g, '-') : `chapter-${chapterNumber}`;
  return `scene-${sceneNumber}-${titleSlug}`;
}
