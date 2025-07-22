import { auth } from '@/app/(auth)/auth';
import { GitHubClient } from '@/lib/github/client';
import { NextResponse } from 'next/server';

export async function GET(
  request: Request,
  { params }: { params: Promise<{ owner: string; repo: string }> }
) {
  const session = await auth();
  
  const githubToken = (session?.user as any)?.githubAccessToken;
  if (!githubToken) {
    return NextResponse.json({ error: 'GitHub not connected' }, { status: 401 });
  }

  try {
    const { searchParams } = new URL(request.url);
    const path = searchParams.get('path');
    
    if (!path) {
      return NextResponse.json({ error: 'Path required' }, { status: 400 });
    }

    // Await params before using them
    const { owner, repo } = await params;

    const github = new GitHubClient(githubToken);
    const file = await github.getFile(owner, repo, path);
    
    return NextResponse.json(file);
  } catch (error) {
    console.error('Error fetching file:', error);
    return NextResponse.json({ error: 'Failed to fetch file' }, { status: 500 });
  }
}

export async function PUT(
  request: Request,
  { params }: { params: Promise<{ owner: string; repo: string }> }
) {
  const session = await auth();
  
  const githubToken = (session?.user as any)?.githubAccessToken;
  if (!githubToken) {
    return NextResponse.json({ error: 'GitHub not connected' }, { status: 401 });
  }

  try {
    const { path, content, message, sha } = await request.json();

    if (!path || content === undefined) {
      return NextResponse.json({ error: 'Path and content required' }, { status: 400 });
    }

    // Await params before using them
    const { owner, repo } = await params;

    const github = new GitHubClient(githubToken);
    const result = await github.createOrUpdateFile(
      owner,
      repo,
      path,
      content,
      message || 'Update from PaprChat',
      sha
    );
    
    return NextResponse.json(result);
  } catch (error) {
    console.error('Error updating file:', error);
    return NextResponse.json({ error: 'Failed to update file' }, { status: 500 });
  }
}

