'use client';

import { useChat } from '@ai-sdk/react';
import { useEffect, useRef } from 'react';
import { artifactDefinitions, type ArtifactKind } from './artifact';
import type { Suggestion } from '@/lib/db/schema';
import { initialArtifactData, useArtifact } from '@/hooks/use-artifact';

export type DataStreamDelta = {
  type:
    | 'text-delta'
    | 'code-delta'
    | 'sheet-delta'
    | 'image-delta'
    | 'title'
    | 'id'
    | 'suggestion'
    | 'clear'
    | 'finish'
    | 'kind'
    | 'status';
  content: string | Suggestion;
  language?: string;
};

export function DataStreamHandler({ id }: { id: string }) {
  const { data: dataStream } = useChat({ id });
  const { artifact, setArtifact, setMetadata } = useArtifact();
  const lastProcessedIndex = useRef(-1);

  useEffect(() => {
    if (!dataStream?.length) return;

    const newDeltas = dataStream.slice(lastProcessedIndex.current + 1);
    lastProcessedIndex.current = dataStream.length - 1;

    // Log all new deltas with safer access to properties
    console.log(
      '[DATA STREAM] All new deltas:',
      newDeltas.map((d) => {
        if (d && typeof d === 'object' && 'type' in d && 'content' in d) {
          const content = d.content;
          return {
            type: d.type,
            contentPreview:
              typeof content === 'string' ? content : 'not a string',
            timestamp: new Date().toISOString(),
          };
        }
        return 'unknown delta format';
      }),
    );

    // Handle errors first
    const errorDelta = newDeltas.find(
      (d) => d && typeof d === 'object' && 'type' in d && d.type === 'error',
    );

    if (errorDelta) {
      console.error('[DATA STREAM] Error delta received:', errorDelta);
      setArtifact((draftArtifact) => ({
        ...draftArtifact,
        status: 'idle',
        isVisible: true,
      }));
      return;
    }

    // Process each delta in sequence
    newDeltas.forEach((value) => {
      const delta = value as DataStreamDelta;
      if (!delta || typeof delta !== 'object') return;

      switch (delta.type) {
        case 'id':
          setArtifact((draftArtifact) => ({
            ...draftArtifact,
            documentId: delta.content as string,
            status: 'streaming',
          }));
          break;

        case 'title':
          setArtifact((draftArtifact) => ({
            ...draftArtifact,
            title: delta.content as string,
            status: 'streaming',
          }));
          break;

        case 'kind':
          setArtifact((draftArtifact) => ({
            ...draftArtifact,
            kind: delta.content as ArtifactKind,
            status: 'streaming',
          }));
          break;

        case 'clear':
          setArtifact((draftArtifact) => ({
            ...draftArtifact,
            content: '',
            status: 'streaming',
          }));
          break;

        case 'status':
          setArtifact((draftArtifact) => ({
            ...draftArtifact,
            status: delta.content as 'streaming' | 'idle',
          }));
          break;

        case 'text-delta':
          setArtifact((draftArtifact) => ({
            ...draftArtifact,
            content: draftArtifact.content + (delta.content as string),
            status: 'streaming',
          }));
          break;

        case 'finish':
          // Don't read from artifact here, as that creates a dependency
          console.log('[DATA STREAM] Finishing document generation');
          setArtifact((draftArtifact) => ({
            ...draftArtifact,
            status: 'idle',
          }));
          break;

        default:
          // Log unhandled delta types
          console.log('[DATA STREAM] Unhandled delta type:', {
            type: delta.type,
            timestamp: new Date().toISOString(),
          });
          break;
      }
    });

    // Clean up when stream is complete
    const lastDelta = dataStream[dataStream.length - 1];
    if (
      lastDelta &&
      typeof lastDelta === 'object' &&
      'type' in lastDelta &&
      (lastDelta.type === 'finish' || lastDelta.type === 'error')
    ) {
      console.log('[DATA STREAM] Stream complete or errored, cleaning up');
      lastProcessedIndex.current = -1; // Reset for next stream

      // Ensure we're in idle state but don't change visibility
      setArtifact((draftArtifact) => ({
        ...draftArtifact,
        status: 'idle',
      }));
    }
  }, [dataStream, setArtifact, setMetadata]);

  return null;
}
