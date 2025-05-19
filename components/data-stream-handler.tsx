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
    | 'kind';
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

    (newDeltas as DataStreamDelta[]).forEach((delta: DataStreamDelta) => {
      console.log('[DATA STREAM] Processing delta:', {
        type: delta.type,
        contentType: typeof delta.content,
        contentLength:
          typeof delta.content === 'string' ? delta.content.length : 0,
        content:
          typeof delta.content === 'string' ? delta.content : 'not a string',
        timestamp: new Date().toISOString(),
      });

      const artifactDefinition = artifactDefinitions.find(
        (artifactDefinition) => artifactDefinition.kind === artifact.kind,
      );

      if (artifactDefinition?.onStreamPart) {
        console.log(
          `[DATA STREAM] Passing to ${artifact.kind} artifact handler:`,
          {
            deltaType: delta.type,
            contentLength:
              typeof delta.content === 'string' ? delta.content.length : 0,
            timestamp: new Date().toISOString(),
          },
        );

        // Special handling: If we receive text-delta and we're in a code artifact,
        // also send it as a code-delta to ensure code content is processed
        if (delta.type === 'text-delta' && artifact.kind === 'code') {
          console.log(
            '[DATA STREAM] Converting text-delta to code-delta for code artifact:',
            {
              originalContent: delta.content,
              timestamp: new Date().toISOString(),
            },
          );
          const codeDelta = {
            ...delta,
            type: 'code-delta' as const,
          };

          artifactDefinition.onStreamPart({
            streamPart: codeDelta,
            setArtifact,
            setMetadata,
          });
        } else {
          artifactDefinition.onStreamPart({
            streamPart: delta,
            setArtifact,
            setMetadata,
          });
        }
      }

      setArtifact((draftArtifact) => {
        if (!draftArtifact) {
          console.log('[DATA STREAM] Creating initial artifact state');
          return { ...initialArtifactData, status: 'streaming' };
        }

        console.log('[DATA STREAM] Current artifact state:', {
          kind: draftArtifact.kind,
          contentLength: draftArtifact.content?.length || 0,
          content: draftArtifact.content,
          status: draftArtifact.status,
          timestamp: new Date().toISOString(),
        });

        switch (delta.type) {
          case 'id':
            return {
              ...draftArtifact,
              documentId: delta.content as string,
              status: 'streaming',
            };

          case 'title':
            return {
              ...draftArtifact,
              title: delta.content as string,
              status: 'streaming',
            };

          case 'kind':
            return {
              ...draftArtifact,
              kind: delta.content as ArtifactKind,
              status: 'streaming',
            };

          case 'clear':
            return {
              ...draftArtifact,
              content: '',
              status: 'streaming',
            };

          // Handle code content directly in DataStreamHandler to ensure it's applied
          case 'code-delta': {
            console.log('[DATA STREAM] Direct code delta handling:', {
              contentLength:
                typeof delta.content === 'string' ? delta.content.length : 0,
              content:
                typeof delta.content === 'string'
                  ? delta.content
                  : 'not a string',
              timestamp: new Date().toISOString(),
            });

            const currentContent = draftArtifact.content || '';
            const deltaContent =
              typeof delta.content === 'string' ? delta.content : '';

            // Use full replacement if content already starts with the current content
            // This ensures we handle both delta updates and full content replacements
            const newContent = deltaContent.startsWith(currentContent)
              ? deltaContent // Full replacement with updated content
              : currentContent + deltaContent; // Append delta to existing content

            console.log('[DATA STREAM] Code content update calculation:', {
              currentContentLength: currentContent.length,
              deltaContentLength: deltaContent.length,
              newContentLength: newContent.length,
              isFullReplacement: deltaContent.startsWith(currentContent),
              timestamp: new Date().toISOString(),
            });

            return {
              ...draftArtifact,
              content: newContent,
              isVisible: true,
              status: 'streaming',
            };
          }

          // Also handle text-delta for code artifacts
          case 'text-delta': {
            // If we're in a code artifact, also handle text-delta as code content
            if (draftArtifact.kind === 'code') {
              console.log('[DATA STREAM] Using text-delta as code content:', {
                contentLength:
                  typeof delta.content === 'string' ? delta.content.length : 0,
                content:
                  typeof delta.content === 'string'
                    ? delta.content
                    : 'not a string',
                timestamp: new Date().toISOString(),
              });

              const currentContent = draftArtifact.content || '';
              const deltaContent =
                typeof delta.content === 'string' ? delta.content : '';

              // Use full replacement if content already starts with the current content
              // This ensures we handle both delta updates and full content replacements
              const newContent = deltaContent.startsWith(currentContent)
                ? deltaContent // Full replacement with updated content
                : currentContent + deltaContent; // Append delta to existing content

              console.log(
                '[DATA STREAM] Text-delta content update calculation:',
                {
                  currentContentLength: currentContent.length,
                  deltaContentLength: deltaContent.length,
                  newContentLength: newContent.length,
                  isFullReplacement: deltaContent.startsWith(currentContent),
                  timestamp: new Date().toISOString(),
                },
              );

              return {
                ...draftArtifact,
                content: newContent,
                isVisible: true,
                status: 'streaming',
              };
            }
            return draftArtifact;
          }

          case 'finish':
            console.log('[DATA STREAM] Finishing with content:', {
              contentLength: draftArtifact.content?.length || 0,
              content: draftArtifact.content,
              timestamp: new Date().toISOString(),
            });
            return {
              ...draftArtifact,
              status: 'idle',
            };

          default:
            // Log unhandled delta types
            console.log('[DATA STREAM] Unhandled delta type:', {
              type: delta.type,
              timestamp: new Date().toISOString(),
            });
            return draftArtifact;
        }
      });
    });
  }, [dataStream, setArtifact, setMetadata, artifact]);

  return null;
}
