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
    const { owner, repo } = await request.json();
    
    // Validate required fields
    if (!owner || !repo) {
      return NextResponse.json({ 
        error: 'Owner and repo are required' 
      }, { status: 400 });
    }

    console.log('[API] Fetching staged files for', { owner, repo });
    
    // Process owner to handle both string and object formats
    const ownerString = getOwnerString(owner);
    
    // Create GitHub client
    const client = new GitHubClient(githubAccessToken);
    
    // Get staged files
    const files = await client.getStagedFiles(ownerString, repo);
    
    // Return success response
    return NextResponse.json({ 
      success: true,
      files
    }, { 
      status: 200,
      headers: {
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
        'Access-Control-Allow-Headers': 'Content-Type, Authorization',
      }
    });
  } catch (error: any) {
    console.error('[API] Error fetching staged files:', error);
    return NextResponse.json({ 
      error: error.message || 'An error occurred while fetching staged files',
      files: [] // Return empty array on error
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

export async function GET(request: Request) {
  try {
    // Get the session
    const session = await auth();
    
    // Check authentication
    if (!session?.user) {
      return NextResponse.json({ error: 'Authentication required' }, { status: 401 });
    }
    
    // Extract GitHub token
    const githubToken = (session.user as any).githubAccessToken;
    if (!githubToken) {
      return NextResponse.json({ error: 'GitHub authentication required' }, { status: 401 });
    }
    
    // Get the URL params
    const url = new URL(request.url);
    const pathParts = url.pathname.split('/');
    
    // Expected format: /api/github/staged-files/:owner/:repo
    if (pathParts.length < 6) {
      return NextResponse.json({ error: 'Invalid request format' }, { status: 400 });
    }
    
    const owner = pathParts[4];
    const repo = pathParts[5];
    
    if (!owner || !repo) {
      return NextResponse.json({ error: 'Owner and repo are required' }, { status: 400 });
    }
    
    console.log(`[API] Retrieving staged files for ${owner}/${repo}`);
    
    // Get staged files
    const client = new GitHubClient(githubToken);
    const stagedFiles = await client.getStagedFiles(owner, repo);
    
    console.log(`[API] Found ${stagedFiles.length} staged files`);
    
    return NextResponse.json(stagedFiles);
  } catch (error) {
    console.error('[API] Error getting staged files:', error);
    return NextResponse.json({ error: 'Failed to get staged files' }, { status: 500 });
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