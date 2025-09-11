import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/app/(auth)/auth';
import { db } from '@/lib/db/db';
import { bookProp } from '@/lib/db/schema';
import { eq, and } from 'drizzle-orm';

export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await auth();
    
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { id } = await params;
    const body = await request.json();
    const { name, description, metadata, imageUrl } = body;

    if (!name) {
      return NextResponse.json({ 
        error: 'Name is required' 
      }, { status: 400 });
    }

    // Update the book prop
    const updatedProps = await db
      .update(bookProp)
      .set({
        name,
        description,
        metadata,
        imageUrl,
        updatedAt: new Date(),
      })
      .where(
        and(
          eq(bookProp.id, id),
          eq(bookProp.userId, session.user.id)
        )
      )
      .returning();

    if (updatedProps.length === 0) {
      return NextResponse.json({ 
        error: 'Book prop not found or no permission' 
      }, { status: 404 });
    }

    const updatedProp = updatedProps[0];

    // Update memory service if it's a character
    if (updatedProp.type === 'character') {
      try {
        const { createMemoryService } = await import('@/lib/ai/memory/service');
        const { ensurePaprUser } = await import('@/lib/ai/memory/middleware');
        const apiKey = process.env.PAPR_MEMORY_API_KEY;
        
        if (apiKey) {
          const memoryService = createMemoryService(apiKey);
          const paprUserId = await ensurePaprUser(session.user.id, apiKey);
          
          if (paprUserId && updatedProp.memoryId) {
            // Update character bio in memory
            const characterBioContent = `Character: ${name}\n\nRole: ${metadata?.role || 'Character'}\nPersonality: ${description || 'No description provided'}\nPhysical Description: ${metadata?.physicalDescription || 'To be determined'}\n${metadata?.backstory ? `Backstory: ${metadata.backstory}` : ''}`;
            
            await memoryService.updateMemory(updatedProp.memoryId, {
              content: characterBioContent,
              metadata: {
                customMetadata: {
                  character_name: name,
                  book_id: updatedProp.bookId,
                  book_title: updatedProp.bookTitle,
                  character_role: metadata?.role,
                  physical_description: metadata?.physicalDescription,
                  personality: description,
                  backstory: metadata?.backstory,
                  portrait_url: imageUrl,
                  category: 'Character Bio',
                  app_user_id: session.user.id,
                  tool: 'characterManagement',
                  content_type: 'character_bio',
                  updated_at: new Date().toISOString(),
                }
              }
            });
          }
        }
      } catch (error) {
        console.error('[book-props] Error updating character in memory:', error);
        // Don't fail the request if memory storage fails
      }
    }

    return NextResponse.json({ prop: updatedProp });
  } catch (error) {
    console.error('Error updating book prop:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
