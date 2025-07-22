import { NextRequest, NextResponse } from 'next/server';
import { getGitHubClient } from '@/lib/github/utils';

export async function POST(request: NextRequest) {
  try {
    // Parse request body
    const { owner, repo, filePath, content } = await request.json();
    
    // Validate required fields
    if (!owner || !repo || !filePath || content === undefined) {
      return NextResponse.json({ 
        error: 'Owner, repo, filePath, and content are required' 
      }, { status: 400 });
    }

    console.log('[API] Staging file changes for', { owner, repo, filePath });
    
    // Create GitHub client using our utility function
    const client = await getGitHubClient();
    
    // Stage the file using our updateStagedFile method for branch-based storage
    await client.updateStagedFile(owner, repo, filePath, content);
    
    // Return success response
    return NextResponse.json({ success: true });
  } catch (error: any) {
    console.error('[API] Error staging changes:', error);
    return NextResponse.json({ 
      error: error.message || 'An error occurred while staging changes' 
    }, { status: 500 });
  }
}

// Handle OPTIONS requests for CORS
export async function OPTIONS() {
  return NextResponse.json({}, {
    headers: {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type, Authorization',
    }
  });
} 