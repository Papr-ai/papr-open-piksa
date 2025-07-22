import { useState, useEffect } from 'react';
import { GitHubClient } from '@/lib/github/client';
import { toast } from 'sonner';

interface Repository {
  owner: string;
  name: string;
  defaultBranch?: string;
  branches?: Array<{ name: string; sha: string }>;
}

export function useGitBranch(repository: Repository | null, accessToken: string | null) {
  const [branchName, setBranchName] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const createStagingBranch = async () => {
    if (!repository) {
      const errorMsg = 'No repository selected';
      console.error(`[Git Branch] ${errorMsg}`);
      toast.error(errorMsg);
      setError(errorMsg);
      return null;
    }

    try {
      // Clear previous errors
      setError(null);
      
      console.log('[Git Branch] Creating staging branch for', {
        owner: repository.owner,
        name: repository.name,
        defaultBranch: repository.defaultBranch,
        hasBranches: Array.isArray(repository.branches) && repository.branches.length > 0
      });
      
      // Get the owner string safely
      let owner: string;
      if (typeof repository.owner === 'string') {
        owner = repository.owner;
      } else {
        // Handle object case
        const ownerObj = repository.owner as any;
        owner = ownerObj.login || String(repository.owner);
      }
      
      // Call the server-side API instead of using the client directly
      const response = await fetch('/api/github/branch', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          owner,
          repo: repository.name,
          defaultBranch: repository.defaultBranch
        }),
      });
      
      const result = await response.json();
      
      if (!response.ok || !result.success) {
        const errorMsg = result.error || 'Failed to create staging branch';
        console.error(`[Git Branch] ${errorMsg}`);
        toast.error(errorMsg);
        setError(errorMsg);
        return null;
      }

      const newBranch = result.branchName;
      console.log('[Git Branch] Created staging branch:', newBranch);
      setBranchName(newBranch);
      return newBranch;
    } catch (error: any) {
      const errorMsg = error.message || 'Unknown error creating staging branch';
      console.error('[Git Branch] Error creating staging branch:', error);
      toast.error(errorMsg);
      setError(errorMsg);
      return null;
    }
  };

  const stageChanges = async (files: Array<{ path: string; content: string }>) => {
    if (!repository || !branchName) {
      console.error('[Git Branch] Missing required data for staging changes');
      return false;
    }

    try {
      // Get the owner string safely
      let owner: string;
      if (typeof repository.owner === 'string') {
        owner = repository.owner;
      } else {
        // Handle object case
        const ownerObj = repository.owner as any;
        owner = ownerObj.login || String(repository.owner);
      }
      
      // Use client directly for now, but this could be moved to an API endpoint as well
      const client = new GitHubClient(accessToken || '');
      await client.stageChanges(owner, repository.name, branchName, files);
      return true;
    } catch (error: any) {
      console.error('[Git Branch] Error staging changes:', error);
      setError(error.message);
      return false;
    }
  };

  return {
    branchName,
    error,
    createStagingBranch,
    stageChanges
  };
} 