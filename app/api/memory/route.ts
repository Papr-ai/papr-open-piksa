import { NextResponse } from 'next/server';
import { auth } from '@/app/(auth)/auth';
import { storeContentInMemory } from '@/lib/ai/memory/middleware';
import type { MemoryMetadata } from '@papr/memory/resources/memory';
import { checkOnboardingStatus } from '@/lib/auth/onboarding-middleware';

// Add a memory
export async function POST(request: Request) {
  try {
    // Check onboarding status first
    const onboardingResult = await checkOnboardingStatus();
    if (!onboardingResult.isCompleted) {
      return onboardingResult.response!;
    }

    const session = await auth();
    if (!session || !session.user || !session.user.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { content, type = 'text', metadata = {} } = await request.json();
    if (!content) {
      return NextResponse.json({ error: 'Content is required' }, { status: 400 });
    }

    // Get the API key for Papr memory
    const apiKey = process.env.PAPR_MEMORY_API_KEY;
    if (!apiKey) {
      return NextResponse.json({ error: 'Memory service not configured' }, { status: 500 });
    }
    
    // Ensure we have customMetadata for custom fields
    if (!metadata.customMetadata) {
      metadata.customMetadata = {};
    }
    
    // Create properly typed metadata with standard fields at the top level
    const memoryMetadata: MemoryMetadata = {
      // Standard fields
      sourceType: metadata.sourceType || 'PaprChat',
      external_user_id: session.user.id,
      createdAt: metadata.createdAt || new Date().toISOString(),
      
      // Copy standard fields if provided
      sourceUrl: metadata.sourceUrl,
      conversationId: metadata.conversationId,
      topics: metadata.topics || [],
      'emoji tags': metadata['emoji tags'] || [],
      hierarchical_structures: metadata.hierarchical_structures,
      workspace_id: metadata.workspace_id,
      
      // Custom metadata
      customMetadata: {
        ...metadata.customMetadata,
        api_source: 'memory_route',
        app_user_id: session.user.id
      }
    };
    
    console.log('[Memory API] Adding memory:', {
      type,
      contentLength: content.length,
      metadata: {
        sourceType: memoryMetadata.sourceType,
        createdAt: memoryMetadata.createdAt,
        topics: memoryMetadata.topics,
        hierarchical_structures: memoryMetadata.hierarchical_structures,
        customMetadata: memoryMetadata.customMetadata
      }
    });
    
    // Use centralized memory service (includes tracking)
    const success = await storeContentInMemory({
      userId: session.user.id,
      content,
      type,
      metadata: memoryMetadata,
      apiKey,
    });

    if (!success) {
      return NextResponse.json(
        { error: 'Failed to add memory' },
        { status: 500 },
      );
    }

    return NextResponse.json({
      success: true,
      message: 'Memory added successfully',
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
    // Check onboarding status first
    const onboardingResult = await checkOnboardingStatus();
    if (!onboardingResult.isCompleted) {
      return onboardingResult.response!;
    }

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

    // Get the API key for Papr memory
    const apiKey = process.env.PAPR_MEMORY_API_KEY;
    if (!apiKey) {
      return NextResponse.json({ error: 'Memory service not configured' }, { status: 500 });
    }

    // Use centralized memory search from middleware
    const { searchUserMemories } = await import('@/lib/ai/memory/middleware');
    const memories = await searchUserMemories({
      userId: session.user.id,
      query,
      maxResults: parseInt(maxMemories),
      apiKey,
    });

    return NextResponse.json({
      success: true,
      data: { memories },
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
    // Check onboarding status first
    const onboardingResult = await checkOnboardingStatus();
    if (!onboardingResult.isCompleted) {
      return onboardingResult.response!;
    }

    const session = await auth();
    if (!session || !session.user || !session.user.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const url = new URL(request.url);
    const memoryId = url.searchParams.get('id');
    
    if (!memoryId) {
      return NextResponse.json({ error: 'Memory ID is required' }, { status: 400 });
    }

    // Get the API key for Papr memory
    const apiKey = process.env.PAPR_MEMORY_API_KEY;
    if (!apiKey) {
      return NextResponse.json({ error: 'Memory service not configured' }, { status: 500 });
    }

    // Use Papr SDK for delete operations (no tracking needed for deletions)
    const { Papr } = await import('@papr/memory');
    const client = new Papr({
      xAPIKey: apiKey,
      baseURL: process.env.PAPR_MEMORY_API_URL || 'https://memory.papr.ai',
    });
    
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

    // Get the API key for Papr memory
    const apiKey = process.env.PAPR_MEMORY_API_KEY;
    if (!apiKey) {
      return NextResponse.json({ error: 'Memory service not configured' }, { status: 500 });
    }

    // Use Papr SDK for update operations (no tracking needed for updates)
    const { Papr } = await import('@papr/memory');
    const client = new Papr({
      xAPIKey: apiKey,
      baseURL: process.env.PAPR_MEMORY_API_URL || 'https://memory.papr.ai',
    });
    
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