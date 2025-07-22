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
    const { owner, repo, defaultBranch } = await request.json();
    
    // Validate required fields
    if (!owner || !repo) {
      return NextResponse.json({ error: 'Owner and repo are required' }, { status: 400 });
    }

    console.log('[API] Creating branch for', { owner, repo, defaultBranch });
    
    // Process owner to handle both string and object formats
    const ownerString = getOwnerString(owner);
    
    // Create GitHub client
    const client = new GitHubClient(githubAccessToken);
    
    // Check if a staging branch already exists
    try {
      const branches = await client.getBranches(ownerString, repo);
      console.log('[API] Existing branches:', branches.map(b => b.name));
      
      // Find all staging branches and sort by timestamp (newest first)
      const stagingBranches = branches
        .filter(branch => branch.name.startsWith('papr-staging-'))
        .sort((a, b) => {
          // Extract timestamps from branch names and compare
          const timestampA = parseInt(a.name.split('-').pop() || '0', 10);
          const timestampB = parseInt(b.name.split('-').pop() || '0', 10);
          return timestampB - timestampA;  // Sort newest first
        });
      
      if (stagingBranches.length > 0) {
        // Use the newest staging branch
        const newestStagingBranch = stagingBranches[0];
        console.log('[API] Found existing staging branch:', newestStagingBranch.name);
        
        return NextResponse.json({ 
          success: true, 
          branchName: newestStagingBranch.name,
          message: 'Using existing staging branch'
        }, { 
          status: 200,
          headers: {
            'Access-Control-Allow-Origin': '*',
            'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
            'Access-Control-Allow-Headers': 'Content-Type, Authorization',
          }
        });
      } else {
        console.log('[API] No existing staging branches found, creating a new one');
      }
    } catch (error) {
      console.error('[API] Error checking for existing branches:', error);
      // Continue with branch creation even if checking fails
    }
    
    // Create staging branch
    try {
      const branchName = await client.createStagingBranch(ownerString, repo, defaultBranch);
      
      if (!branchName) {
        return NextResponse.json({ error: 'Failed to create branch' }, { status: 500 });
      }
      
      // Return success response
      return NextResponse.json({ 
        success: true, 
        branchName 
      }, { 
        status: 200,
        headers: {
          'Access-Control-Allow-Origin': '*',
          'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
          'Access-Control-Allow-Headers': 'Content-Type, Authorization',
        }
      });
    } catch (error: any) {
      console.error('[API] Error creating branch:', error);
      return NextResponse.json({ 
        error: error.message || 'An error occurred while creating the branch' 
      }, { 
        status: 500,
        headers: {
          'Access-Control-Allow-Origin': '*',
          'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
          'Access-Control-Allow-Headers': 'Content-Type, Authorization',
        }
      });
    }
  } catch (error: any) {
    console.error('[API] Error in branch API:', error);
    return NextResponse.json({ 
      error: error.message || 'An error occurred while creating the branch' 
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