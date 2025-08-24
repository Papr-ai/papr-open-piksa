import { NextResponse } from 'next/server';
import { auth } from '@/app/(auth)/auth';
import { Papr } from '@papr/memory';
import type { MemoryMetadata } from '@papr/memory/resources/memory';

// Initialize Papr client
const getPaprClient = () => {
  const apiKey = process.env.PAPR_MEMORY_API_KEY;
  
  if (!apiKey) {
    throw new Error('Missing PAPR_MEMORY_API_KEY environment variable');
  }

  const secureBaseURL = process.env.PAPR_MEMORY_BASE_URL || 'https://api.paprpump.io';

  return new Papr({
    xAPIKey: apiKey,
    baseURL: secureBaseURL,
  });
};

/**
 * POST /api/documents/batch
 * Bulk upload documents to memory
 */
export async function POST(request: Request) {
  try {
    const session = await auth();
    if (!session || !session.user || !session.user.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Extract batch of documents from request
    const { documents } = await request.json();
    
    if (!documents || !Array.isArray(documents) || documents.length === 0) {
      return NextResponse.json({ error: 'Documents array is required' }, { status: 400 });
    }

    const client = getPaprClient();
    const results = [];
    const errors = [];

    // Process each document
    for (const doc of documents) {
      const { content, title, type = 'document', metadata = {} } = doc;
      
      if (!content) {
        errors.push({ title, error: 'Content is required' });
        continue;
      }

      // Ensure we have customMetadata for custom fields
      if (!metadata.customMetadata) {
        metadata.customMetadata = {};
      }
      
      // Create properly typed metadata
      const memoryMetadata: any = {
        // Standard fields
        sourceType: metadata.sourceType || 'DocumentShelf',
        user_id: session.user.id,
        external_user_id: session.user.id,
        createdAt: metadata.createdAt || new Date().toISOString(),
        title: title || 'Untitled Document',
        
        // Copy standard fields if provided
        sourceUrl: metadata.sourceUrl || '/memories/shelf',
        topics: metadata.topics || ['document', 'shelf'],
        'emoji tags': metadata['emoji tags'] || ['📄', '📚'],
        hierarchical_structures: metadata.hierarchical_structures || 'shelf/documents',
        
        // Custom metadata
        customMetadata: {
          ...metadata.customMetadata,
          api_source: 'documents_batch_route',
          app_user_id: session.user.id,
          title: title || 'Untitled Document',
        }
      };
      
      const memoryParams = {
        content,
        type: type || 'document',
        metadata: memoryMetadata,
      };
      
      try {
        // Add memory using the SDK
        const response = await client.memory.add(memoryParams);
        
        if (response && response.data && response.data[0]) {
          results.push({
            title,
            memoryId: response.data[0].memoryId,
            success: true
          });
          
          // BULK TRACKING: Track each successful memory addition
          try {
            const { trackMemoryAdd } = await import('@/lib/subscription/usage-middleware');
            await trackMemoryAdd(session.user.id);
            console.log(`[Bulk Memory] Tracked memory addition for user: ${session.user.id} (document: ${title})`);
          } catch (trackingError) {
            console.error('[Bulk Memory] Failed to track memory usage:', trackingError);
            // Continue processing even if tracking fails
          }
        } else {
          errors.push({ title, error: 'Invalid response from memory service' });
        }
      } catch (error: any) {
        console.error('Error adding document to memory:', error);
        errors.push({ 
          title, 
          error: error.message || 'Failed to add document to memory'
        });
      }
    }

    return NextResponse.json({
      success: results.length > 0,
      results,
      errors,
      totalProcessed: documents.length,
      successCount: results.length,
      errorCount: errors.length
    });
  } catch (error: any) {
    console.error('Error processing documents batch:', error);
    return NextResponse.json(
      { error: error.message || 'Failed to process documents batch' },
      { status: 500 },
    );
  }
} 