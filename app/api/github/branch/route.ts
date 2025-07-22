import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/app/(auth)/auth';
import { GitHubClient } from '@/lib/github/client';

export async function POST(request: NextRequest) {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Get GitHub access token from session
    const accessToken = (session.user as any)?.githubAccessToken;
    if (!accessToken) {
      return NextResponse.json({ error: 'No GitHub access token found' }, { status: 401 });
    }

    // Parse request body
    const { owner, repo, defaultBranch } = await request.json();
    
    if (!owner || !repo) {
      return NextResponse.json({ error: 'Owner and repo parameters are required' }, { status: 400 });
    }

    console.log(`[API] Creating staging branch for ${owner}/${repo}`);
    
    try {
      // Initialize GitHub client
      const client = new GitHubClient(accessToken);
      
      // Get repository info to fetch branches
      const repoInfo = await client.getRepository(owner, repo);
      const branches = await client.getBranches(owner, repo);
      
      // Map branches to the format expected by createStagingBranch
      const branchesData = branches.map(branch => ({
        name: branch.name,
        sha: branch.commit.sha
      }));
      
      // Create staging branch
      const branchName = await client.createStagingBranch(
        owner,
        repo,
        defaultBranch || repoInfo.default_branch,
        branchesData
      );
      
      if (!branchName) {
        throw new Error('Failed to create staging branch');
      }
      
      return NextResponse.json({ 
        success: true, 
        branchName,
        repository: {
          owner,
          name: repo,
          default_branch: repoInfo.default_branch
        }
      });
    } catch (error: any) {
      console.error('[API] Error creating staging branch:', error);
      return NextResponse.json({ 
        success: false, 
        error: error.message || 'Failed to create staging branch' 
      }, { status: 500 });
    }
  } catch (error: any) {
    console.error('Error in branch API:', error);
    return NextResponse.json({ 
      success: false, 
      error: 'Internal server error' 
    }, { status: 500 });
  }
} 