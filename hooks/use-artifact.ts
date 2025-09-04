'use client';

import useSWR from 'swr';
import type { UIArtifact } from '@/components/artifact/artifact';
import { useCallback, useMemo, useEffect, useRef } from 'react';

export const initialArtifactData: UIArtifact = {
  documentId: 'init',
  content: '',
  kind: 'text',
  title: '',
  status: 'idle',
  isVisible: false,
  boundingBox: {
    top: 0,
    left: 0,
    width: 0,
    height: 0,
  },
};

type Selector<T> = (state: UIArtifact) => T;

export function useArtifactSelector<Selected>(selector: Selector<Selected>) {
  const { data: localArtifact } = useSWR<UIArtifact>('artifact', null, {
    fallbackData: initialArtifactData,
  });

  const selectedValue = useMemo(() => {
    if (!localArtifact) return selector(initialArtifactData);
    return selector(localArtifact);
  }, [localArtifact, selector]);

  return selectedValue;
}

export function useArtifact(chatId?: string) {
  // Use chat-specific key if chatId is provided
  const artifactKey = chatId ? `artifact-${chatId}` : 'artifact';
  
  const { data: localArtifact, mutate: setLocalArtifact } = useSWR<UIArtifact>(
    artifactKey,
    null,
    {
      fallbackData: initialArtifactData,
      revalidateOnFocus: false,
      errorRetryCount: 3,
    },
  );

  const artifact = useMemo(() => {
    if (!localArtifact) {
      console.log(
        `[ARTIFACT HOOK] No local artifact found for ${artifactKey}, using initial data`,
      );
      return initialArtifactData;
    }
    return localArtifact;
  }, [localArtifact, artifactKey]);

  const setArtifact = useCallback(
    (updaterFn: UIArtifact | ((currentArtifact: UIArtifact) => UIArtifact)) => {
      setLocalArtifact((currentArtifact) => {
        const artifactToUpdate = currentArtifact || initialArtifactData;

        if (typeof updaterFn === 'function') {
          const updated = updaterFn(artifactToUpdate);

          if (
            updated.documentId !== artifactToUpdate.documentId ||
            updated.status !== artifactToUpdate.status ||
            updated.isVisible !== artifactToUpdate.isVisible
          ) {
            console.log(`[ARTIFACT HOOK] Artifact state change for ${artifactKey}:`, {
              documentId: {
                from: artifactToUpdate.documentId,
                to: updated.documentId,
              },
              status: { from: artifactToUpdate.status, to: updated.status },
              isVisible: {
                from: artifactToUpdate.isVisible,
                to: updated.isVisible,
              },
              contentLength: updated.content?.length || 0,
            });
          }

          return updated;
        }

        return updaterFn;
      });
    },
    [setLocalArtifact, artifactKey],
  );

  const { data: localArtifactMetadata, mutate: setLocalArtifactMetadata } =
    useSWR<any>(
      () =>
        artifact.documentId ? `artifact-metadata-${chatId || 'global'}-${artifact.documentId}` : null,
      null,
      {
        fallbackData: null,
      },
    );

  // Ensure artifact metadata is stored in localStorage for persistent access
  // Add throttling to prevent excessive saves
  const lastSaveRef = useRef<{ time: number; data: string }>({ time: 0, data: '' });
  
  useEffect(() => {
    if (artifact.documentId && localArtifactMetadata) {
      const metadataKey = `artifact-metadata-${chatId || 'global'}-${artifact.documentId}`;
      const currentData = JSON.stringify(localArtifactMetadata);
      const now = Date.now();
      
      // Only save if data changed and it's been at least 100ms since last save
      if (currentData !== lastSaveRef.current.data && 
          now - lastSaveRef.current.time > 100) {
        try {
          localStorage.setItem(metadataKey, currentData);
          lastSaveRef.current = { time: now, data: currentData };
          
          // Reduce logging frequency - only log every 10th save or first save
          const saveCount = (window as any).__artifactSaveCount || 0;
          (window as any).__artifactSaveCount = saveCount + 1;
          
          if (saveCount % 10 === 0) {
            console.log(`[useArtifact] Saved artifact metadata to localStorage for chat ${chatId || 'global'} (save #${saveCount + 1})`);
          }
        } catch (error) {
          console.error('[useArtifact] Error saving artifact metadata to localStorage:', error);
        }
      }
    }
  }, [artifact.documentId, localArtifactMetadata, chatId]);

  return useMemo(
    () => ({
      artifact,
      setArtifact,
      metadata: localArtifactMetadata,
      setMetadata: setLocalArtifactMetadata,
    }),
    [artifact, setArtifact, localArtifactMetadata, setLocalArtifactMetadata],
  );
}
