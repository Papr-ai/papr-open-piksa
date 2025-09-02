'use client';

import React, { useState } from 'react';
import { PageContext } from '@/types/app';
import { Button } from '@/components/ui/button';
import { XIcon } from '@/components/common/icons';
import { ContextSelector } from './context-selector';
import { Plus as PlusIcon } from 'lucide-react';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';

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

  const handleRemoveContext = (contextToRemove: PageContext) => {
    onContextsChange(
      selectedContexts.filter((context) => context.id !== contextToRemove.id)
    );
  };

  return (
    <div className="flex flex-wrap items-center gap-2">
      <DropdownMenu open={isOpen} onOpenChange={setIsOpen}>
        <DropdownMenuTrigger asChild>
          <Button
            type="button"
            variant="ghost"
            size="sm"
            className="h-8 px-3 text-sm border border-dashed border-muted-foreground/30 rounded-full text-muted-foreground data-[state=open]:bg-accent data-[state=open]:text-accent-foreground"
          >
            <PlusIcon className="mr-1 h-3.5 w-3.5" />
            Add context
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent 
          align="start" 
          side="top"
          className="w-80 p-0"
          sideOffset={8}
        >
          <ContextSelector
            selectedPages={selectedContexts}
            onPagesChange={onContextsChange}
            onClose={() => setIsOpen(false)}
          />
        </DropdownMenuContent>
      </DropdownMenu>

      {selectedContexts.map((context) => (
        <ContextChip
          key={context.id}
          context={context}
          onRemove={handleRemoveContext}
        />
      ))}
    </div>
  );
} 