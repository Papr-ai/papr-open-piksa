import { useState, useEffect, useCallback } from 'react';
import { GitHubClient } from '@/lib/github/client';
import { toast } from 'sonner';

interface GitTreeState {
  files: Array<{
    name: string;
    path: string;
    type: 'file' | 'dir';
    sha: string;
    content?: string;
  }>;
  isLoading: boolean;
  error: string | null;
}

interface TreeChange {
  path: string;
  content: string;
  message?: string;
}

export function useGitTree(
  repository: { owner: string; name: string } | null,
  branch: string | null,
  githubToken: string | null,
  path: string = ''
) {
  const [state, setState] = useState<GitTreeState>({
    files: [],
    isLoading: false,
    error: null,
  });

  // Initialize GitHub client when token is available
  const githubClient = githubToken ? new GitHubClient(githubToken) : null;

  // Load files from the specified path
  const loadFiles = useCallback(async () => {
    if (!repository || !githubClient) {
      setState(prev => ({ ...prev, error: 'Repository or GitHub token not available' }));
      return;
    }

    setState(prev => ({ ...prev, isLoading: true, error: null }));

    try {
      const files = await githubClient.getFileTree(repository.owner, repository.name, path);
      setState(prev => ({
        ...prev,
        files: files.map(file => ({
          name: file.name,
          path: file.path,
          type: file.type === 'dir' ? 'dir' : 'file',
          sha: file.sha,
          content: 'content' in file ? file.content : undefined,
        })),
        isLoading: false,
      }));
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Failed to load files';
      setState(prev => ({ ...prev, isLoading: false, error: message }));
      toast.error(message);
    }
  }, [repository, githubClient, path]);

  // Load file content
  const loadFileContent = useCallback(async (filePath: string) => {
    if (!repository || !githubClient) {
      setState(prev => ({ ...prev, error: 'Repository or GitHub token not available' }));
      return null;
    }

    setState(prev => ({ ...prev, isLoading: true, error: null }));

    try {
      const file = await githubClient.getFile(repository.owner, repository.name, filePath);
      
      // Update the file in state
      setState(prev => ({
        ...prev,
        files: prev.files.map(f => 
          f.path === filePath ? { ...f, content: file.content } : f
        ),
        isLoading: false,
      }));

      return file.content;
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Failed to load file content';
      setState(prev => ({ ...prev, isLoading: false, error: message }));
      toast.error(message);
      return null;
    }
  }, [repository, githubClient]);

  // Update files in the tree
  const updateFiles = useCallback(async (changes: TreeChange[]) => {
    if (!repository || !githubClient || !branch) {
      setState(prev => ({ ...prev, error: 'Repository, GitHub token, or branch not available' }));
      return false;
    }

    setState(prev => ({ ...prev, isLoading: true, error: null }));

    try {
      for (const change of changes) {
        // Get current file SHA if it exists
        let sha: string | undefined;
        try {
          const file = await githubClient.getFile(repository.owner, repository.name, change.path);
          sha = file.sha;
        } catch {
          // File doesn't exist yet
        }

        await githubClient.createOrUpdateFile(
          repository.owner,
          repository.name,
          change.path,
          change.content,
          change.message || `Update ${change.path}`,
          sha
        );
      }

      // Reload files to get updated tree
      await loadFiles();

      toast.success(`Updated ${changes.length} file(s)`);
      return true;
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Failed to update files';
      setState(prev => ({ ...prev, isLoading: false, error: message }));
      toast.error(message);
      return false;
    }
  }, [repository, githubClient, branch, loadFiles]);

  // Load files when repository, branch, or path changes
  useEffect(() => {
    if (repository && branch) {
      loadFiles();
    }
  }, [repository, branch, loadFiles]);

  return {
    ...state,
    loadFileContent,
    updateFiles,
    refresh: loadFiles,
  };
} 