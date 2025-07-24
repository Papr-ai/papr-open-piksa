// This file is not used in the project, but is kept here for reference

/*import { NextResponse } from 'next/server';
import { auth } from '@/app/(auth)/auth';
import { Papr } from '@papr/memory';

// Initialize the Papr client
const getPaprClient = () => {
  const apiKey = process.env.PAPR_MEMORY_API_KEY;
  if (!apiKey) {
    throw new Error('PAPR_MEMORY_API_KEY is not defined');
  }

  const baseURL = process.env.PAPR_MEMORY_API_URL || 'https://memory.papr.ai';
  const secureBaseURL = baseURL.startsWith('https://') ? baseURL : `https://${baseURL.replace('http://', '')}`;

  return new Papr({
    xAPIKey: apiKey,
    baseURL: secureBaseURL,
  });
};

// Add a document (as a memory item with type 'document')
export async function POST(request: Request) {
  try {
    const session = await auth();
    if (!session || !session.user || !session.user.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { content, filename, metadata = {} } = await request.json();
    if (!content) {
      return NextResponse.json({ error: 'Content is required' }, { status: 400 });
    }

    const client = getPaprClient();
    const memoryParams: Papr.MemoryAddParams = {
      content,
      type: 'document',
      metadata: {
        ...metadata,
        filename: filename || `document_${Date.now()}.txt`,
        user_id: session.user.id,
        created_at: new Date().toISOString(),
        sourceType: 'PaprChat',
      },
    };
    // Add document as memory using the SDK
    const response: Papr.AddMemoryResponse = await client.memory.add(memoryParams);

    return NextResponse.json({
      success: true,
      data: response.data,
    });
  } catch (error) {
    console.error('Error adding document:', error);
    return NextResponse.json(
      { error: 'Failed to add document' },
      { status: 500 },
    );
  }
}

// Get document by ID
export async function GET(request: Request) {
  try {
    const session = await auth();
    if (!session || !session.user || !session.user.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const url = new URL(request.url);
    const documentId = url.searchParams.get('id');
    
    if (!documentId) {
      return NextResponse.json({ error: 'Document ID is required' }, { status: 400 });
    }

    const client = getPaprClient();
    
    try {
      const searchParams: Papr.MemorySearchParams = {
        query: `Get document with ID: ${documentId}`,
        max_memories: 1,
        user_id: session.user.id,
      };
      // Search for documents using metadata to find the specific document
      const response: Papr.SearchResponse = await client.memory.search(searchParams);
      
      if (response.data && 
          response.data.memories && 
          response.data.memories.length > 0) {
        return NextResponse.json({
          success: true,
          data: response.data.memories[0],
        });
      }
    } catch (searchError) {
      console.error('Search error:', searchError);
      // We don't have a direct get method for memory in the SDK
    }
    
    return NextResponse.json({
      success: false,
      error: 'Document not found',
    }, { status: 404 });
  } catch (error) {
    console.error('Error getting document:', error);
    return NextResponse.json(
      { error: 'Failed to get document' },
      { status: 500 },
    );
  }
}

// Delete a document
export async function DELETE(request: Request) {
  try {
    const session = await auth();
    if (!session || !session.user || !session.user.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const url = new URL(request.url);
    const documentId = url.searchParams.get('id');
    
    if (!documentId) {
      return NextResponse.json({ error: 'Document ID is required' }, { status: 400 });
    }

    const client = getPaprClient();
    
    // Delete memory item
    const response: Papr.MemoryDeleteResponse = await client.memory.delete(documentId);

    return NextResponse.json({
      success: true,
      data: response,
    });
  } catch (error) {
    console.error('Error deleting document:', error);
    return NextResponse.json(
      { error: 'Failed to delete document' },
      { status: 500 },
    );
  }
} */