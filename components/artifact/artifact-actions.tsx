import { Button } from '../ui/button';
import { Tooltip, TooltipContent, TooltipTrigger } from '../ui/tooltip';
import { artifactDefinitions } from './artifact';
import type { UIArtifact } from './artifact';
import { memo, useState } from 'react';
import type { Dispatch, SetStateAction } from 'react';
import type { ArtifactActionContext } from './create-artifact';
import { cn } from '@/lib/utils';
import { toast } from 'sonner';
import type { UseChatHelpers } from '@ai-sdk/react';

// Import the detectLanguage function from code artifact
function detectLanguage(
  code: string,
): 'python' | 'html' | 'jsx' | 'svg' | 'javascript' | 'unknown' {
  if (
    code.includes('import React') ||
    code.includes('export default') ||
    code.includes('React.') ||
    code.includes('<div') ||
    code.includes('</div>') ||
    code.includes('function Component')
  ) {
    return 'jsx';
  }
  if (
    code.includes('<!DOCTYPE html') ||
    code.includes('<html') ||
    code.includes('</html>')
  ) {
    return 'html';
  }
  if (code.includes('<svg') || code.includes('</svg>')) {
    return 'svg';
  }
  if (
    code.includes('document.getElementById') ||
    code.includes('function(') ||
    code.includes('() =>') ||
    code.includes('addEventListener') ||
    (code.includes('const ') && !code.includes('import '))
  ) {
    return 'javascript';
  }
  if (
    code.includes('import matplotlib') ||
    code.includes('def ') ||
    code.includes('print(') ||
    code.includes('if __name__')
  ) {
    return 'python';
  }
  return 'unknown';
}

interface ArtifactActionsProps {
  artifact: UIArtifact;
  handleVersionChange: (type: 'next' | 'prev' | 'toggle' | 'latest') => void;
  currentVersionIndex: number;
  isCurrentVersion: boolean;
  mode: 'edit' | 'diff';
  metadata: any;
  setMetadata: Dispatch<SetStateAction<any>>;
  appendMessage?: UseChatHelpers['append'];
}

function PureArtifactActions({
  artifact,
  handleVersionChange,
  currentVersionIndex,
  isCurrentVersion,
  mode,
  metadata,
  setMetadata,
  appendMessage,
}: ArtifactActionsProps) {
  const [isLoading, setIsLoading] = useState(false);

  const artifactDefinition = artifactDefinitions.find(
    (definition) => definition.kind === artifact.kind,
  );

  if (!artifactDefinition) {
    throw new Error('Artifact definition not found!');
  }

  const actionContext: ArtifactActionContext = {
    content: artifact.content || '',
    handleVersionChange,
    currentVersionIndex,
    isCurrentVersion,
    mode,
    metadata,
    setMetadata,
    appendMessage,
  };

  return (
    <div className="flex flex-row gap-1">
      {artifactDefinition.actions.map((action) => {
        // Determine if this is the Run/Preview button
        const isRunButton = action.description === 'Execute or preview code';
        let buttonLabel = action.label;
        let tooltipContent = action.description;

        // Update label for Run/Preview button based on language and state
        if (isRunButton) {
          const language = detectLanguage(artifact.content || '');
          const isPreviewable = ['html', 'svg', 'javascript', 'jsx'].includes(
            language,
          );

          if (isPreviewable) {
            buttonLabel = metadata?.previewMode ? 'Show Code' : 'Show Preview';
            tooltipContent = metadata?.previewMode
              ? 'Switch to code editor'
              : 'Switch to preview mode';
          } else if (language === 'python') {
            buttonLabel = 'Run Code';
            tooltipContent = 'Execute Python code';
          } else {
            buttonLabel = 'Run Code';
            tooltipContent = 'Execute code';
          }
        }

        return (
          <Tooltip key={action.description}>
            <TooltipTrigger asChild>
              <Button
                variant="outline"
                className={cn('h-fit dark:hover:bg-zinc-700', {
                  'p-2': !buttonLabel,
                  'py-1.5 px-2': buttonLabel,
                })}
                onClick={async () => {
                  setIsLoading(true);

                  try {
                    await Promise.resolve(action.onClick(actionContext));
                  } catch (error) {
                    toast.error('Failed to execute action');
                  } finally {
                    setIsLoading(false);
                  }
                }}
                disabled={
                  isLoading || artifact.status === 'streaming'
                    ? true
                    : action.isDisabled
                      ? action.isDisabled(actionContext)
                      : false
                }
                data-tooltip-content={action.description}
                data-artifact-action={action.label}
              >
                {action.icon}
                {buttonLabel}
              </Button>
            </TooltipTrigger>
            <TooltipContent>{tooltipContent}</TooltipContent>
          </Tooltip>
        );
      })}
    </div>
  );
}

export const ArtifactActions = memo(
  PureArtifactActions,
  (prevProps, nextProps) => {
    if (prevProps.artifact.status !== nextProps.artifact.status) return false;
    if (prevProps.currentVersionIndex !== nextProps.currentVersionIndex)
      return false;
    if (prevProps.isCurrentVersion !== nextProps.isCurrentVersion) return false;
    if (prevProps.artifact.content !== nextProps.artifact.content) return false;
    if (prevProps.metadata?.previewMode !== nextProps.metadata?.previewMode)
      return false;

    return true;
  },
);
