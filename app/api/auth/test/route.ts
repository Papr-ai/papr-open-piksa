import { NextResponse } from 'next/server';

export async function GET() {
  try {
    // Check if environment variables are available
    const hasGitHubId = !!process.env.GITHUB_CLIENT_ID;
    const hasGitHubSecret = !!process.env.GITHUB_CLIENT_SECRET;
    const hasAuthSecret = !!process.env.AUTH_SECRET;
    const nextAuthUrl = process.env.NEXTAUTH_URL;
    
    return NextResponse.json({
      status: 'ok',
      environment: {
        hasGitHubId,
        hasGitHubSecret,
        hasAuthSecret,
        nextAuthUrl,
        githubClientIdLength: process.env.GITHUB_CLIENT_ID?.length || 0,
      },
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    console.error('Auth test error:', error);
    return NextResponse.json(
      { 
        error: 'Test failed', 
        message: error instanceof Error ? error.message : 'Unknown error' 
      },
      { status: 500 }
    );
  }
} 