import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/app/(auth)/auth';
import { getBookPropsByUserId, getBookPropsByUserIdAndType, createBookProp } from '@/lib/db/book-queries';

export async function GET(request: NextRequest) {
  try {
    const session = await auth();
    
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const type = searchParams.get('type');
    const bookId = searchParams.get('bookId');

    let props;
    if (type) {
      props = await getBookPropsByUserIdAndType(session.user.id, type);
    } else {
      props = await getBookPropsByUserId(session.user.id);
    }

    // Filter by bookId if provided
    if (bookId) {
      props = props.filter(prop => prop.bookId === bookId);
    }

    return NextResponse.json({ props });
  } catch (error) {
    console.error('Error fetching book props:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const session = await auth();
    
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await request.json();
    const { bookId, bookTitle, type, name, description, metadata, memoryId, imageUrl } = body;

    if (!bookId || !bookTitle || !type || !name) {
      return NextResponse.json({ 
        error: 'bookId, bookTitle, type, and name are required' 
      }, { status: 400 });
    }

    const prop = await createBookProp({
      bookId,
      bookTitle,
      type,
      name,
      description,
      metadata,
      memoryId,
      imageUrl,
      userId: session.user.id,
    });

    // Save to memory service if it's a character
    if (type === 'character') {
      try {
        const { createMemoryService } = await import('@/lib/ai/memory/service');
        const { ensurePaprUser } = await import('@/lib/ai/memory/middleware');
        const apiKey = process.env.PAPR_MEMORY_API_KEY;
        
        if (apiKey) {
          const memoryService = createMemoryService(apiKey);
          const paprUserId = await ensurePaprUser(session.user.id, apiKey);
          
          if (paprUserId) {
            // Save character bio to memory (matching addMemory tool pattern)
            const characterBioContent = `Character: ${name}\n\nRole: ${metadata?.role || 'Character'}\nPersonality: ${description || 'No description provided'}\nPhysical Description: ${metadata?.physicalDescription || 'To be determined'}\n${metadata?.backstory ? `Backstory: ${metadata.backstory}` : ''}`;
            
            // Create proper MemoryMetadata structure like addMemory tool
            const characterMemoryMetadata = {
              // Standard fields from the SDK
              sourceType: 'PaprBooks_Character',
              sourceUrl: `/characters`,
              user_id: paprUserId,
              external_user_id: session.user.id,
              'emoji tags': ['👤', '📚', '✍️'], // Character, Book, Writing
              topics: ['character', 'story', 'writing', bookTitle.toLowerCase().replace(/\s+/g, '_')],
              hierarchical_structures: `characters/${bookTitle.toLowerCase().replace(/\s+/g, '_')}/${name.toLowerCase().replace(/\s+/g, '_')}`,
              createdAt: new Date().toISOString(),
              
              // Custom fields flattened to top level for searchability
              customMetadata: {
                // Core metadata
                category: 'knowledge',
                app_user_id: session.user.id,
                tool: 'book-props-character-creation',
                content_type: 'text',
                
                // Character-specific fields (flattened for searchability)
                kind: 'character',
                book_id: bookId,
                book_title: bookTitle,
                character_name: name,
                character_role: metadata?.role || 'Character',
                step: 'character_creation',
                status: 'approved', // Characters created manually are pre-approved
                prop_id: prop.id,
                created_from: metadata?.createdFrom || 'characters-page',
                is_standalone: metadata?.isStandalone || false,
                
                // Additional searchable fields
                personality: description || 'No description provided',
                physical_description: metadata?.physicalDescription || 'To be determined',
                ...(metadata?.backstory && { backstory: metadata.backstory })
              }
            };
            
            const memoryResult = await memoryService.storeContent(
              paprUserId,
              characterBioContent,
              'text',
              characterMemoryMetadata,
              session.user.id
            );

            // If there's an image, save it as a separate document entry (like portrait creation)
            if (imageUrl) {
              const portraitMemoryMetadata = {
                // Standard fields from the SDK
                sourceType: 'PaprBooks_Character_Image',
                sourceUrl: `/characters`,
                user_id: paprUserId,
                external_user_id: session.user.id,
                'emoji tags': ['👤', '🎨', '📷'], // Character, Art, Photo
                topics: ['character', 'portrait', 'image', bookTitle.toLowerCase().replace(/\s+/g, '_')],
                hierarchical_structures: `characters/${bookTitle.toLowerCase().replace(/\s+/g, '_')}/${name.toLowerCase().replace(/\s+/g, '_')}/portrait`,
                createdAt: new Date().toISOString(),
                
                // Custom fields flattened to top level for searchability
                customMetadata: {
                  // Core metadata
                  category: 'knowledge',
                  app_user_id: session.user.id,
                  tool: 'book-props-character-creation',
                  content_type: 'document',
                  
                  // Image-specific fields
                  image_url: imageUrl,
                  image_description: `Character portrait of ${name}`,
                  
                  // Character-specific fields (flattened for searchability)
                  kind: 'character',
                  book_id: bookId,
                  book_title: bookTitle,
                  character_name: name,
                  portrait_url: imageUrl,
                  step: 'character_creation',
                  status: 'approved',
                  prop_id: prop.id,
                  created_from: metadata?.createdFrom || 'characters-page',
                  is_standalone: metadata?.isStandalone || false
                }
              };
              
              await memoryService.storeContent(
                paprUserId,
                `Character: ${name}\nImage: ${imageUrl}\nType: Character Portrait\nCreated from: ${metadata?.createdFrom || 'characters-page'}`,
                'document',
                portraitMemoryMetadata,
                session.user.id
              );
            }

            console.log('[book-props] Character saved to memory:', {
              propId: prop.id,
              memoryStored: memoryResult,
              characterName: name,
              hasImage: !!imageUrl
            });
          }
        }
      } catch (error) {
        console.error('[book-props] Error saving character to memory:', error);
        // Don't fail the request if memory storage fails
      }
    }

    return NextResponse.json({ prop }, { status: 201 });
  } catch (error) {
    console.error('Error creating book prop:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
