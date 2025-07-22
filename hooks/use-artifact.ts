'use client';

import useSWR from 'swr';
import type { UIArtifact } from '@/components/artifact';
import { useCallback, useMemo, useEffect } from 'react';

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
  useEffect(() => {
    if (artifact.documentId && localArtifactMetadata) {
      // Store metadata in localStorage for persistent access between messages
      const metadataKey = `artifact-metadata-${chatId || 'global'}-${artifact.documentId}`;
      try {
        localStorage.setItem(metadataKey, JSON.stringify(localArtifactMetadata));
        console.log(`[useArtifact] Saved artifact metadata to localStorage for chat ${chatId || 'global'}`);
      } catch (error) {
        console.error('[useArtifact] Error saving artifact metadata to localStorage:', error);
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
