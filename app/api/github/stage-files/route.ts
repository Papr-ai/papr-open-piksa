import { NextResponse } from 'next/server';
import { auth } from '@/app/(auth)/auth';
import { GitHubClient } from '@/lib/github/client';

// Helper function to get owner string
function getOwnerString(owner: string | { login: string }): string {
  return typeof owner === 'string' ? owner : owner.login;
}

export async function POST(request: Request) {
  try {
    // Get session and verify authentication
    const session = await auth();
    if (!session?.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Get GitHub access token
    const githubAccessToken = (session.user as any)?.githubAccessToken;
    if (!githubAccessToken) {
      return NextResponse.json({ error: 'GitHub access token not found' }, { status: 401 });
    }

    // Parse request body
    const { owner, repo, files } = await request.json();
    
    // Validate required fields
    if (!owner || !repo || !Array.isArray(files)) {
      return NextResponse.json({ 
        error: 'Owner, repo, and files array are required' 
      }, { status: 400 });
    }

    console.log('[API] Staging multiple files for', { 
      owner, 
      repo, 
      fileCount: files.length 
    });
    
    // Process owner to handle both string and object formats
    const ownerString = getOwnerString(owner);
    
    // Create GitHub client
    const client = new GitHubClient(githubAccessToken);
    
    // Stage all files
    for (const file of files) {
      if (!file.path || typeof file.content !== 'string') {
        console.warn('[API] Skipping invalid file:', file);
        continue;
      }
      
      await client.updateStagedFile(ownerString, repo, file.path, file.content);
    }
    
    // Return success response
    return NextResponse.json({ 
      success: true,
      stagedCount: files.length
    }, { 
      status: 200,
      headers: {
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
        'Access-Control-Allow-Headers': 'Content-Type, Authorization',
      }
    });
  } catch (error: any) {
    console.error('[API] Error staging files:', error);
    return NextResponse.json({ 
      error: error.message || 'An error occurred while staging files' 
    }, { 
      status: 500,
      headers: {
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
        'Access-Control-Allow-Headers': 'Content-Type, Authorization',
      }
    });
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