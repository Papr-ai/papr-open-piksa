import { useState, useCallback } from 'react';
import { toast } from 'sonner';

interface Repository {
  owner: string | { login: string };
  name: string;
  defaultBranch?: string;
  branches?: Array<{ name: string; sha: string }>;
}

export function useGitBranch(
  repository: Repository | null,
  accessToken: string | null
) {
  const [branchName, setBranchName] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isCreating, setIsCreating] = useState(false);

  const createStagingBranch = useCallback(async () => {
    // Check if repository is selected
    if (!repository) {
      const errorMsg = 'No repository selected';
      console.error(`[Git Branch] ${errorMsg}`);
      toast.error(errorMsg);
      setError(errorMsg);
      return null;
    }

    // Validate repository object has required properties
    if (!repository.owner || !repository.name) {
      const errorMsg = 'Invalid repository object';
      console.error(`[Git Branch] ${errorMsg}`, repository);
      toast.error(errorMsg);
      setError(errorMsg);
      return null;
    }

    // Check if already creating a branch to prevent duplicate calls
    if (isCreating) {
      console.log('[Git Branch] Branch creation already in progress');
      return branchName;
    }

    // Check if we already have a branch name
    if (branchName) {
      console.log('[Git Branch] Using existing branch:', branchName);
      return branchName;
    }

    // Check if access token is available
    if (!accessToken) {
      const errorMsg = 'GitHub access token not available';
      console.error(`[Git Branch] ${errorMsg}`);
      toast.error(errorMsg);
      setError(errorMsg);
      return null;
    }

    setIsCreating(true);
    setError(null);

    try {
      console.log('[Git Branch] Creating staging branch for repository:', repository.name);
      
      // Extract owner string from repository object
      const owner = typeof repository.owner === 'string' ? repository.owner : repository.owner.login;
      
      // Call the API endpoint to create a branch
      const response = await fetch('/api/github/branch', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          owner: owner,
          repo: repository.name,
          defaultBranch: repository.defaultBranch
        }),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Failed to create branch');
      }

      const data = await response.json();
      console.log('[Git Branch] Branch created successfully:', data.branchName);
      
      setBranchName(data.branchName);
      return data.branchName;
    } catch (error: any) {
      const errorMsg = error.message || 'Failed to create staging branch';
      console.error('[Git Branch] Error:', errorMsg);
      toast.error(errorMsg);
      setError(errorMsg);
      return null;
    } finally {
      setIsCreating(false);
    }
  }, [repository, accessToken, branchName, isCreating]);

  const stageChanges = useCallback(async (filePath: string, content: string) => {
    if (!repository) {
      const errorMsg = 'No repository selected';
      console.error(`[Git Branch] ${errorMsg}`);
      toast.error(errorMsg);
      setError(errorMsg);
      return false;
    }

    if (!branchName) {
      const newBranch = await createStagingBranch();
      if (!newBranch) {
        return false;
      }
    }

    try {
      // Extract owner string from repository object
      const owner = typeof repository.owner === 'string' ? repository.owner : repository.owner.login;
      
      // Call API to stage changes (removed branch parameter, now uses branch-based storage)
      const response = await fetch('/api/github/stage', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          owner: owner,
          repo: repository.name,
          filePath,
          content
        }),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Failed to stage changes');
      }

      return true;
    } catch (error: any) {
      const errorMsg = error.message || 'Failed to stage changes';
      console.error('[Git Branch] Error staging changes:', errorMsg);
      toast.error(errorMsg);
      setError(errorMsg);
      return false;
    }
  }, [repository, branchName, createStagingBranch]);

  return {
    branchName,
    error,
    createStagingBranch,
    stageChanges,
    isCreating
  };
} 