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
    const path = searchParams.get('path') || '';
    
    // Await params before using them
    const { owner, repo } = await params;

    const github = new GitHubClient(githubToken);
    const files = await github.getFileTree(owner, repo, path);
    
    return NextResponse.json(files);
  } catch (error) {
    console.error('Error fetching files:', error);
    return NextResponse.json({ error: 'Failed to fetch files' }, { status: 500 });
  }
} 