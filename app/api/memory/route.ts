import { NextResponse } from 'next/server';
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

// Add a memory
export async function POST(request: Request) {
  try {
    const session = await auth();
    if (!session || !session.user || !session.user.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { content, type = 'text', metadata = {} } = await request.json();
    if (!content) {
      return NextResponse.json({ error: 'Content is required' }, { status: 400 });
    }

    const client = getPaprClient();
    
    // Add memory using the SDK
    const response = await client.memory.add({
      content,
      type,
      metadata: {
        ...metadata,
        user_id: session.user.id,
        created_at: new Date().toISOString(),
        source: 'PaprChat',
      },
    });

    return NextResponse.json({
      success: true,
      data: response.data,
    });
  } catch (error) {
    console.error('Error adding memory:', error);
    return NextResponse.json(
      { error: 'Failed to add memory' },
      { status: 500 },
    );
  }
}

// Search memories
export async function GET(request: Request) {
  try {
    const session = await auth();
    if (!session || !session.user || !session.user.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const url = new URL(request.url);
    const query = url.searchParams.get('query');
    const maxMemories = url.searchParams.get('max_memories') || '25';
    
    if (!query) {
      return NextResponse.json({ error: 'Query parameter is required' }, { status: 400 });
    }

    const client = getPaprClient();
    
    // Search memories using the SDK
    const response = await client.memory.search({
      query,
      user_id: session.user.id,
    }, {
      query: {
        max_memories: 25
      }
    });

    return NextResponse.json({
      success: true,
      data: response.data,
    });
  } catch (error) {
    console.error('Error searching memories:', error);
    return NextResponse.json(
      { error: 'Failed to search memories' },
      { status: 500 },
    );
  }
}

// Delete a memory
export async function DELETE(request: Request) {
  try {
    const session = await auth();
    if (!session || !session.user || !session.user.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const url = new URL(request.url);
    const memoryId = url.searchParams.get('id');
    
    if (!memoryId) {
      return NextResponse.json({ error: 'Memory ID is required' }, { status: 400 });
    }

    const client = getPaprClient();
    
    // Delete memory using the SDK
    const response = await client.memory.delete(memoryId);

    return NextResponse.json({
      success: true,
      data: response,
    });
  } catch (error) {
    console.error('Error deleting memory:', error);
    return NextResponse.json(
      { error: 'Failed to delete memory' },
      { status: 500 },
    );
  }
}

// Update a memory
export async function PUT(request: Request) {
  try {
    const session = await auth();
    if (!session || !session.user || !session.user.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { memory_id, content, metadata, type } = await request.json();
    
    if (!memory_id) {
      return NextResponse.json({ error: 'Memory ID is required' }, { status: 400 });
    }

    const client = getPaprClient();
    
    // Update memory using the SDK
    const response = await client.memory.update(memory_id, {
      content,
      metadata,
      type,
    });

    return NextResponse.json({
      success: true,
      data: response,
    });
  } catch (error) {
    console.error('Error updating memory:', error);
    return NextResponse.json(
      { error: 'Failed to update memory' },
      { status: 500 },
    );
  }
} 