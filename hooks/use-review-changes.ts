import { useState, useCallback } from 'react';
import { toast } from 'sonner';

interface Repository {
  owner: string;
  name: string;
}

interface StagedFile {
  path: string;
  content: string;
  isStaged: boolean;
}

export function useReviewChanges(
  repository: Repository | null,
  accessToken: string | null
) {
  const [isOpen, setIsOpen] = useState(false);
  const [stagedFiles, setStagedFiles] = useState<StagedFile[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchStagedFiles = useCallback(async () => {
    if (!repository || !accessToken) {
      return [];
    }

    setLoading(true);
    setError(null);

    try {
      // Use the correct REST-style API path
      const response = await fetch(`/api/github/staged-files/${repository.owner}/${repository.name}`);

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Failed to fetch staged files');
      }

      const data = await response.json();
      const files = Array.isArray(data) ? data : [];
      setStagedFiles(files);
      return files;
    } catch (error: any) {
      const errorMsg = error.message || 'Failed to fetch staged files';
      console.error('[Review Changes] Error:', errorMsg);
      toast.error(errorMsg);
      setError(errorMsg);
      return [];
    } finally {
      setLoading(false);
    }
  }, [repository, accessToken]);

  const openReview = useCallback(async (files: StagedFile[] = []) => {
    if (files.length > 0) {
      setStagedFiles(files);
      setIsOpen(true);
      return;
    }

    // If no files provided, fetch them
    const fetchedFiles = await fetchStagedFiles();
    if (fetchedFiles.length > 0) {
      setIsOpen(true);
    } else {
      toast.info('No staged changes to review');
    }
  }, [fetchStagedFiles]);

  const closeReview = useCallback(() => {
    setIsOpen(false);
  }, []);

  return {
    isOpen,
    stagedFiles,
    loading,
    error,
    openReview,
    closeReview,
    fetchStagedFiles
  };
} 