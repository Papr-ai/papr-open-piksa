/**
 * Memory Hook for Book Props
 * Automatically saves book-related memories to the book_props database table
 */

import { db } from '@/lib/db/db';
import { bookProp } from '@/lib/db/schema';
import { eq, and } from 'drizzle-orm';

export interface MemoryHookContext {
  userId: string;
  content: string;
  type: string;
  metadata?: Record<string, any>;
  memoryId?: string;
}

/**
 * Hook that runs after memory is saved to automatically save book props to database
 */
export async function onMemorySaved(context: MemoryHookContext): Promise<void> {
  try {
    const { userId, content, type, metadata, memoryId } = context;

    // Only process book-related memories
    if (!metadata || !isBookPropMemory(metadata)) {
      return;
    }

    console.log(`[BookPropsHook] Processing book prop memory: ${metadata.kind || 'unknown'}`);
    console.log(`[BookPropsHook] Memory metadata:`, {
      kind: metadata.kind,
      book_id: metadata.book_id,
      book_title: metadata.book_title,
      character_name: metadata.character_name,
      memoryId
    });

    // Extract book prop data from metadata
    const bookPropData = extractBookPropData(metadata, content, userId, memoryId);
    
    if (!bookPropData) {
      console.warn('[BookPropsHook] Could not extract book prop data from memory metadata');
      return;
    }

    console.log(`[BookPropsHook] Extracted book prop data:`, {
      bookId: bookPropData.bookId,
      type: bookPropData.type,
      name: bookPropData.name,
      userId: bookPropData.userId
    });

    // Check if this book prop already exists
    const existingProp = await db
      .select()
      .from(bookProp)
      .where(
        and(
          eq(bookProp.bookId, bookPropData.bookId),
          eq(bookProp.type, bookPropData.type),
          eq(bookProp.name, bookPropData.name),
          eq(bookProp.userId, bookPropData.userId)
        )
      )
      .limit(1);

    if (existingProp.length > 0) {
      // Update existing prop with new memory reference
      await db
        .update(bookProp)
        .set({
          memoryId: bookPropData.memoryId,
          description: bookPropData.description,
          metadata: bookPropData.metadata,
          updatedAt: new Date()
        })
        .where(eq(bookProp.id, existingProp[0].id));

      console.log(`[BookPropsHook] ✅ Updated existing book prop: ${bookPropData.name}`);
    } else {
      // Create new book prop
      const newProp = await db
        .insert(bookProp)
        .values(bookPropData)
        .returning();

      console.log(`[BookPropsHook] ✅ Created new book prop: ${bookPropData.name} (ID: ${newProp[0]?.id})`);
    }

  } catch (error) {
    console.error('[BookPropsHook] Error saving book prop to database:', error);
    // Don't throw - this is a background process and shouldn't break memory saving
  }
}

/**
 * Check if a memory metadata indicates it's a book prop
 */
function isBookPropMemory(metadata: Record<string, any>): boolean {
  return !!(
    metadata.kind && 
    ['character', 'environment', 'prop', 'object', 'illustration'].includes(metadata.kind) &&
    metadata.book_id &&
    metadata.book_title
  );
}

/**
 * Extract book prop data from memory metadata and content
 */
function extractBookPropData(
  metadata: Record<string, any>,
  content: string,
  userId: string,
  memoryId?: string
): any | null {
  try {
    const { kind, book_id, book_title, character_name, prop_name } = metadata;

    // Validate that book_id is a proper UUID
    const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
    if (!uuidRegex.test(book_id)) {
      console.error(`[BookPropsHook] Invalid UUID format for book_id: ${book_id}`);
      return null;
    }

    // Determine the prop name based on type
    let propName = '';
    if (kind === 'character' && character_name) {
      propName = character_name;
    } else if (kind === 'prop' && prop_name) {
      propName = prop_name;
    } else if (kind === 'environment' && metadata.environment_name) {
      propName = metadata.environment_name;
    } else if (kind === 'object' && metadata.object_name) {
      propName = metadata.object_name;
    } else {
      // Try to extract name from content
      const nameMatch = content.match(/(?:Character|Prop|Environment|Object):\s*([^\n]+)/i);
      propName = nameMatch ? nameMatch[1].trim() : 'Unknown';
    }

    // Extract description from content (first few lines after the name)
    const description = extractDescriptionFromContent(content);

    // Prepare metadata for database storage
    const dbMetadata: Record<string, any> = {
      source: 'memory_hook',
      original_metadata: metadata,
      extracted_at: new Date().toISOString()
    };

    // Add type-specific metadata
    if (kind === 'character') {
      dbMetadata.role = metadata.character_role;
      dbMetadata.physical_description = extractPhysicalDescription(content);
      dbMetadata.personality = extractPersonality(content);
    } else if (kind === 'prop') {
      dbMetadata.material = metadata.material;
      dbMetadata.size = metadata.size;
      dbMetadata.must_present = metadata.must_present;
    } else if (kind === 'environment') {
      dbMetadata.scene_type = metadata.scene_type;
      dbMetadata.mood = metadata.scene_mood;
      dbMetadata.lighting = metadata.lighting_description;
    }

    return {
      bookId: book_id,
      bookTitle: book_title,
      type: kind,
      name: propName,
      description,
      metadata: dbMetadata,
      memoryId: memoryId || null,
      imageUrl: metadata.image_url || null,
      userId
    };

  } catch (error) {
    console.error('[BookPropsHook] Error extracting book prop data:', error);
    return null;
  }
}

/**
 * Extract description from memory content
 */
function extractDescriptionFromContent(content: string): string {
  // Try to get everything after the first line (which usually contains the name)
  const lines = content.split('\n').filter(line => line.trim());
  if (lines.length > 1) {
    return lines.slice(1).join('\n').trim().substring(0, 500); // Limit to 500 chars
  }
  return content.substring(0, 500);
}

/**
 * Extract physical description from character content
 */
function extractPhysicalDescription(content: string): string | null {
  const match = content.match(/Physical Description:\s*([^\n]+)/i);
  return match ? match[1].trim() : null;
}

/**
 * Extract personality from character content
 */
function extractPersonality(content: string): string | null {
  const match = content.match(/Personality:\s*([^\n]+)/i);
  return match ? match[1].trim() : null;
}
