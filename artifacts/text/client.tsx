import { Artifact } from '@/components/artifact/create-artifact';
import { DiffView } from '@/components/editor/diffview';
import { DocumentSkeleton } from '@/components/document/document-skeleton';
import { Editor } from '@/components/editor/text-editor';
import {
  ClockRewind,
  CopyIcon,
  MessageIcon,
  PenIcon,
  RedoIcon,
  UndoIcon,
  SaveIcon,
} from '@/components/common/icons';
import type { Suggestion } from '@/lib/db/schema';
import { toast } from 'sonner';
import { getSuggestions } from '../actions';

interface TextArtifactMetadata {
  suggestions: Array<Suggestion>;
}

export const textArtifact = new Artifact<'text', TextArtifactMetadata>({
  kind: 'text',
  description: 'Useful for text content, like drafting essays and emails.',
  initialize: async ({ documentId, setMetadata }) => {
    const suggestions = await getSuggestions({ documentId });

    setMetadata({
      suggestions,
    });
  },
  onStreamPart: ({ streamPart, setMetadata, setArtifact }) => {
    console.log('[TextArtifact] 📝 TEXT ARTIFACT - Stream event received:', streamPart.type, streamPart.content);
    
    if (streamPart.type === 'suggestion') {
      try {
        setMetadata((metadata) => {
          const existingSuggestions = metadata?.suggestions || [];
          const newSuggestion = streamPart.content as Suggestion;

          // Check if this suggestion already exists by ID to prevent duplicates
          const suggestionExists = existingSuggestions.some(
            (suggestion) => suggestion.id === newSuggestion.id,
          );

          if (suggestionExists) {
            return metadata;
          }

          return {
            suggestions: [...existingSuggestions, newSuggestion],
          };
        });
      } catch (error) {
        console.error('Error handling suggestion:', error);
      }
    }

    if (streamPart.type === 'text-delta') {
      try {
        setArtifact((draftArtifact) => {
          if (!draftArtifact) return draftArtifact;

          const newContent =
            draftArtifact.content + (streamPart.content as string);

          return {
            ...draftArtifact,
            content: newContent,
            isVisible:
              draftArtifact.status === 'streaming' &&
              newContent.length > 400 &&
              newContent.length < 450
                ? true
                : draftArtifact.isVisible,
            status: 'streaming',
          };
        });
      } catch (error) {
        console.error('Error handling text delta:', error);
      }
    }
  },
  content: ({
    mode,
    status,
    content,
    isCurrentVersion,
    currentVersionIndex,
    onSaveContent,
    getDocumentContentById,
    isLoading,
    metadata,
  }) => {
    if (isLoading) {
      return <DocumentSkeleton artifactKind="text" />;
    }

    if (mode === 'diff') {
      const oldContent = getDocumentContentById(currentVersionIndex - 1);
      const newContent = getDocumentContentById(currentVersionIndex);

      return <DiffView oldContent={oldContent} newContent={newContent} />;
    }

    return (
      <>
        <div className="flex flex-row py-8 md:p-20 px-4">
          <Editor
            content={content || ''}
            suggestions={metadata?.suggestions || []}
            isCurrentVersion={isCurrentVersion}
            currentVersionIndex={currentVersionIndex}
            status={status}
            onSaveContent={onSaveContent}
          />

          {metadata?.suggestions?.length > 0 ? (
            <div className="md:hidden h-dvh w-12 shrink-0" />
          ) : null}
        </div>
      </>
    );
  },
  actions: [
    {
      icon: <ClockRewind size={18} />,
      description: 'View changes',
      onClick: ({ handleVersionChange }) => {
        handleVersionChange('toggle');
      },
      isDisabled: ({ currentVersionIndex, setMetadata }) => {
        if (currentVersionIndex === 0) {
          return true;
        }

        return false;
      },
    },
    {
      icon: <UndoIcon size={18} />,
      description: 'View Previous version',
      onClick: ({ handleVersionChange }) => {
        handleVersionChange('prev');
      },
      isDisabled: ({ currentVersionIndex }) => {
        if (currentVersionIndex === 0) {
          return true;
        }

        return false;
      },
    },
    {
      icon: <RedoIcon size={18} />,
      description: 'View Next version',
      onClick: ({ handleVersionChange }) => {
        handleVersionChange('next');
      },
      isDisabled: ({ isCurrentVersion }) => {
        if (isCurrentVersion) {
          return true;
        }

        return false;
      },
    },
    {
      icon: <SaveIcon size={18} />,
      description: 'Save to memory',
      onClick: async ({ content }) => {
        try {
          const response = await fetch('/api/memory/save', {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
            },
            body: JSON.stringify({
              content,
              type: 'document',
              metadata: {
                kind: 'text',
              },
            }),
          });

          if (!response.ok) {
            throw new Error('Failed to save to memory');
          }

          // Use DOM to find and update the save button's icon
          const saveButtons = document.querySelectorAll(
            '[data-tooltip-content="Save to memory"]',
          );
          saveButtons.forEach((btn) => {
            // Find the SaveIcon within this button
            const svgElement = btn.querySelector('svg');
            if (svgElement) {
              // Update a data attribute that can be used in CSS to show filled state
              svgElement.setAttribute('data-saved', 'true');
              // Try to find the path element to directly update fill
              const pathElement = svgElement.querySelector('path');
              if (pathElement) {
                const gradientId =
                  svgElement.querySelector('linearGradient')?.id;
                if (gradientId) {
                  pathElement.setAttribute('fill', `url(#${gradientId})`);
                }
              }
            }

            // Update tooltip content
            const tooltipContent = btn
              .closest('[role="tooltip"]')
              ?.querySelector('[data-tooltip-content="Save to memory"]');
            if (tooltipContent) {
              tooltipContent.setAttribute(
                'data-tooltip-content',
                'Already saved to memory',
              );
            }

            // Find parent TooltipProvider and update content
            const tooltipTrigger = btn.closest('[role="button"]');
            if (tooltipTrigger) {
              const tooltipPopup = tooltipTrigger.nextElementSibling;
              if (
                tooltipPopup &&
                tooltipPopup.textContent === 'Save to memory'
              ) {
                tooltipPopup.textContent = 'Already saved to memory';
              }
            }
          });

          toast.success('Saved to memory!');
        } catch (error) {
          console.error('Error saving to memory:', error);
          toast.error('Failed to save to memory');
        }
      },
    },
    {
      icon: <CopyIcon size={18} />,
      description: 'Copy to clipboard',
      onClick: ({ content }) => {
        navigator.clipboard.writeText(content);
        toast.success('Copied to clipboard!');
      },
    },
  ],
  toolbar: [
    {
      icon: <PenIcon />,
      description: 'Add final polish',
      onClick: ({ appendMessage }) => {
        appendMessage({
          role: 'user',
          parts: [{ type: 'text', text: 'Please add final polish and check for grammar, add section titles for better structure, and ensure everything reads smoothly.' }],
        });
      },
    },
    {
      icon: <MessageIcon />,
      description: 'Request suggestions',
      onClick: ({ appendMessage }) => {
        appendMessage({
          role: 'user',
          parts: [{ type: 'text', text: 'Please add suggestions you have that could improve the writing.' }],
        });
      },
    },
  ],
});
