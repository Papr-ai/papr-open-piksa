import { GitHubClient } from './client';
import { auth } from '@/app/(auth)/auth';

// Get GitHub client instance using the access token from session or environment
export async function getGitHubClient(): Promise<GitHubClient> {
  // First try to get the token from the NextAuth session (preferred method)
  try {
    const session = await auth();
    const githubAccessToken = (session?.user as any)?.githubAccessToken;
    
    if (githubAccessToken) {
      console.log(`[GitHub Utils] Using GitHub token from session`);
      return new GitHubClient(githubAccessToken);
    }
  } catch (error) {
    console.error(`[GitHub Utils] Error getting session:`, error);
    // Continue to try other methods
  }
  
  // If no token in session, try environment variable (for development/testing)
  const envToken = process.env.GITHUB_TOKEN;
  if (envToken) {
    console.log(`[GitHub Utils] Using GitHub token from environment`);
    return new GitHubClient(envToken);
  }
  
  // If we still don't have a token, throw an error
  console.error(`[GitHub Utils] No GitHub token available`);
  throw new Error('GitHub token not found. Please log in or set GITHUB_TOKEN environment variable.');
} 