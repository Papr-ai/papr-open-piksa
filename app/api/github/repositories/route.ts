import { auth } from '@/app/(auth)/auth';
import { GitHubClient } from '@/lib/github/client';
import { NextResponse } from 'next/server';

export async function GET() {
  const session = await auth();
  
  const githubToken = (session?.user as any)?.githubAccessToken;
  if (!githubToken) {
    return NextResponse.json({ error: 'GitHub not connected' }, { status: 401 });
  }

  try {
    const github = new GitHubClient(githubToken);
    const repos = await github.getRepositories();
    
    // Transform repository data to ensure all required fields are present
    const transformedRepos = repos.map(repo => ({
      id: repo.id,
      name: repo.name,
      full_name: repo.full_name,
      owner: {
        login: repo.owner.login
      },
      private: repo.private,
      description: repo.description,
      html_url: repo.html_url
    }));
    
    return NextResponse.json(transformedRepos);
  } catch (error) {
    console.error('Error fetching repositories:', error);
    return NextResponse.json({ error: 'Failed to fetch repositories' }, { status: 500 });
  }
}

export async function POST(request: Request) {
  const session = await auth();
  
  const githubToken = (session?.user as any)?.githubAccessToken;
  if (!githubToken) {
    return NextResponse.json({ error: 'GitHub not connected' }, { status: 401 });
  }

  try {
    const { name, description } = await request.json();
    
    const github = new GitHubClient(githubToken);
    const repo = await github.createRepository(name, description);
    
    return NextResponse.json(repo);
  } catch (error) {
    console.error('Error creating repository:', error);
    return NextResponse.json({ error: 'Failed to create repository' }, { status: 500 });
  }
} 