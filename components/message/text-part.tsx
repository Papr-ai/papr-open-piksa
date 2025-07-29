'use client';

import { ProcessedMessage } from './processed-message';
import { Button } from '../ui/button';
import { CopyIcon, PencilEditIcon } from '../common/icons';
import { Tooltip, TooltipContent, TooltipTrigger } from '../ui/tooltip';
import { Markdown } from '../common/markdown';

interface TextPartProps {
  content: string;
  isAssistant?: boolean;
  isReadonly?: boolean;
  onEdit?: () => void;
}

export function TextPart({ content, isAssistant, isReadonly, onEdit }: TextPartProps) {
  if (isAssistant) {
    return (
      <div className="w-full message-content">
        <ProcessedMessage content={content} isAssistantMessage={true} />
      </div>
    );
  }

  return (
    <div className="flex flex-col w-full gap-2">
      <div className="text-foreground py-1 rounded-xl message-content">
        <div className="pt-0 mt-0">
          <ProcessedMessage content={content} />
        </div>
      </div>
      {!isReadonly && (
        <div className="flex justify-start gap-2">
          <Tooltip>
            <TooltipTrigger asChild>
              <Button
                data-testid="message-copy-button"
                size="sm"
                variant="outline"
                className="py-1 px-2 h-fit text-muted-foreground"
                onClick={() => {
                  navigator.clipboard.writeText(content);
                }}
              >
                <CopyIcon />
              </Button>
            </TooltipTrigger>
            <TooltipContent>Copy message</TooltipContent>
          </Tooltip>

          <Tooltip>
            <TooltipTrigger asChild>
              <Button
                data-testid="message-edit-button"
                size="sm"
                variant="outline"
                className="py-1 px-2 h-fit text-muted-foreground"
                onClick={onEdit}
              >
                <PencilEditIcon />
              </Button>
            </TooltipTrigger>
            <TooltipContent>Edit message</TooltipContent>
          </Tooltip>
        </div>
      )}
    </div>
  );
} 