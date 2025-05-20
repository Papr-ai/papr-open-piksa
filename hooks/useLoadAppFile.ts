import { useState, useEffect } from 'react';

interface UseLoadAppFileResult {
  content: string | null;
  error: Error | null;
  loading: boolean;
}

export function useLoadAppFile(
  appId: number | null,
  filePath: string,
): UseLoadAppFileResult {
  const [content, setContent] = useState<string | null>(null);
  const [error, setError] = useState<Error | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function loadFile() {
      if (!appId) {
        setContent(null);
        setError(null);
        setLoading(false);
        return;
      }

      try {
        const response = await fetch(
          `/api/app/${appId}/file?path=${encodeURIComponent(filePath)}`,
        );
        if (!response.ok) throw new Error('Failed to load file');
        const data = await response.json();
        setContent(data.content);
        setError(null);
      } catch (err) {
        setError(err instanceof Error ? err : new Error(String(err)));
        setContent(null);
      } finally {
        setLoading(false);
      }
    }

    loadFile();
  }, [appId, filePath]);

  return { content, error, loading };
}
