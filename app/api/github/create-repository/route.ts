import { NextResponse } from 'next/server';
import { auth } from '@/app/(auth)/auth';
import { Octokit } from '@octokit/rest';

export async function POST(req: Request) {
  try {
    // Verify user is authenticated
    const session = await auth();
    if (!session || !session.user) {
      return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 });
    }

    // Get GitHub access token
    const githubAccessToken = (session.user as any)?.githubAccessToken;
    if (!githubAccessToken) {
      return NextResponse.json({ success: false, error: 'GitHub access token not found' }, { status: 401 });
    }

    // Parse request body
    const body = await req.json();
    const { name, description, isPrivate } = body;

    // Validate required parameters
    if (!name) {
      return NextResponse.json({ success: false, error: 'Repository name is required' }, { status: 400 });
    }

    // Create Octokit instance with user's token
    const octokit = new Octokit({ auth: githubAccessToken });

    // Create the repository
    const { data: newRepo } = await octokit.repos.createForAuthenticatedUser({
      name,
      description: description || '',
      private: isPrivate || false,
      auto_init: true
    });

    console.log(`[GitHub API] Repository created: ${newRepo.name} (${newRepo.html_url})`);

    // Return success with repository details
    return NextResponse.json({
      success: true,
      repository: {
        id: newRepo.id,
        name: newRepo.name,
        full_name: newRepo.full_name,
        owner: newRepo.owner.login,
        html_url: newRepo.html_url,
        description: newRepo.description,
        private: newRepo.private
      }
    });
  } catch (error: any) {
    console.error('[GitHub API] Repository creation error:', error);
    
    // Handle specific error cases
    if (error.status === 422) {
      return NextResponse.json({ 
        success: false, 
        error: 'Repository already exists or name is invalid'
      }, { status: 422 });
    }
    
    return NextResponse.json({ 
      success: false, 
      error: error.message || 'Failed to create repository'
    }, { status: 500 });
  }
} 