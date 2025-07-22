'use client';

import React, { useState } from 'react';
import { PageContext } from '@/types/app';
import { Button } from '@/components/ui/button';
import { XIcon } from '@/components/icons';
import { ContextSelector } from './context-selector';
import { Plus as PlusIcon } from 'lucide-react';

interface ContextChipProps {
  context: PageContext;
  onRemove: (context: PageContext) => void;
}

export function ContextChip({ context, onRemove }: ContextChipProps) {
  return (
    <div className="inline-flex items-center gap-1 bg-muted px-2 py-0.5 rounded-md text-xs">
      <span className="truncate max-w-[150px]">{context.title}</span>
      <button
        onClick={() => onRemove(context)}
        className="text-muted-foreground hover:text-foreground"
      >
        <XIcon size={12} />
      </button>
    </div>
  );
}

interface AddContextButtonProps {
  selectedContexts: PageContext[];
  onContextsChange: (contexts: PageContext[]) => void;
}

export function AddContextButton({
  selectedContexts,
  onContextsChange,
}: AddContextButtonProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [anchorEl, setAnchorEl] = useState<HTMLElement | null>(null);

  const handleClick = (event: React.MouseEvent<HTMLButtonElement>) => {
    setAnchorEl(event.currentTarget);
    setIsOpen(!isOpen);
  };

  const handleClose = () => {
    setIsOpen(false);
  };

  const handleRemoveContext = (contextToRemove: PageContext) => {
    onContextsChange(
      selectedContexts.filter((context) => context.id !== contextToRemove.id)
    );
  };

  return (
    <div className="flex flex-wrap items-center gap-2">
      <Button
        variant="ghost"
        size="sm"
        className="h-8 px-3 text-sm border border-dashed border-muted-foreground/30 rounded-full text-muted-foreground"
        onClick={handleClick}
      >
        <PlusIcon className="mr-1 h-3.5 w-3.5" />
        Add context
      </Button>

      {selectedContexts.map((context) => (
        <ContextChip
          key={context.id}
          context={context}
          onRemove={handleRemoveContext}
        />
      ))}

      <ContextSelector
        isOpen={isOpen}
        onClose={handleClose}
        anchorEl={anchorEl}
        selectedPages={selectedContexts}
        onPagesChange={onContextsChange}
      />
    </div>
  );
} 