'use client';

import { startTransition, useMemo, useState, useEffect } from 'react';
import Link from 'next/link';
import { useCanUsePremiumModels } from '@/components/subscription/subscription-context';
import { useUpgradeModal } from '@/hooks/use-upgrade-modal';
import { UpgradeModal } from '@/components/subscription/upgrade-modal';

import { saveChatModelAsCookie } from '@/app/(chat)/actions';
import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
  DropdownMenuSeparator,
  DropdownMenuLabel,
} from '@/components/ui/dropdown-menu';
import { chatModels, modelSupportsReasoning, modelIsPremium, DEFAULT_CHAT_MODEL } from '@/lib/ai/models';
import { cn } from '@/lib/utils';

import { BrainIcon, CheckCircleFillIcon, ChevronDownIcon } from '../common/icons';

// Helper function to get cookie value
function getCookie(name: string): string | null {
  if (typeof document === 'undefined') return null;
  const value = `; ${document.cookie}`;
  const parts = value.split(`; ${name}=`);
  return parts.length === 2 ? parts.pop()?.split(';').shift() || null : null;
}

export function ModelSelector({
  selectedModelId,
  className,
}: {
  selectedModelId: string;
} & React.ComponentProps<typeof Button>) {
  const [open, setOpen] = useState(false);
  // Use local state instead of useOptimistic to avoid server/client sync issues
  const [currentModelId, setCurrentModelId] = useState(selectedModelId);

  // Initialize from cookie on client side on mount
  useEffect(() => {
    const cookieModel = getCookie('chat-model');
    const modelToUse = cookieModel || selectedModelId || DEFAULT_CHAT_MODEL;
    setCurrentModelId(modelToUse);
  }, []); // Only run on mount

  // Update when selectedModelId prop changes (from server)
  useEffect(() => {
    // Only update if we don't have a cookie (meaning server-side prop should take precedence)
    const cookieModel = getCookie('chat-model');
    if (!cookieModel && selectedModelId !== currentModelId) {
      setCurrentModelId(selectedModelId);
    }
  }, [selectedModelId, currentModelId]);
  const canUsePremiumModels = useCanUsePremiumModels();
  const upgradeModal = useUpgradeModal();

  const selectedChatModel = useMemo(
    () => chatModels.find((chatModel) => chatModel.id === currentModelId),
    [currentModelId],
  );

  const supportsReasoning = selectedChatModel?.supportsReasoning ?? false;

  // Group models by provider
  const modelGroups = useMemo(() => {
    const groups = chatModels.reduce((acc, model) => {
      if (!acc[model.group]) {
        acc[model.group] = [];
      }
      acc[model.group].push(model);
      return acc;
    }, {} as Record<string, typeof chatModels>);
    
    return groups;
  }, []);

  return (
    <>
      <DropdownMenu open={open} onOpenChange={setOpen}>
      <DropdownMenuTrigger
        asChild
        className={cn(
          'w-fit bg-transparent border-none data-[state=open]:bg-accent data-[state=open]:text-accent-foreground',
          className,
        )}
      >
        <Button
          data-testid="model-selector"
          variant="ghost"
          size="sm"
          className={cn(
            "h-8 w-fit px-2 text-xs flex items-center gap-1 rounded-full text-muted-foreground",
            className
          )}
        >
          <span className="text-xs">{selectedChatModel?.name}</span>
          <ChevronDownIcon size={12} />

        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="start" className="min-w-[180px]">
        {Object.entries(modelGroups).map(([group, models]) => (
          <div key={group}>
            <DropdownMenuLabel className="text-xs text-muted-foreground py-0.5 px-2 opacity-70">
              {group} Models
            </DropdownMenuLabel>
            
            {models.map((chatModel) => {
              const { id, supportsReasoning } = chatModel;
              const isPremiumModel = modelIsPremium(id);
              const hasAccess = !isPremiumModel || canUsePremiumModels;

              if (!hasAccess) {
                return (
                  <div key={id} className="py-1 px-2 opacity-50">
                    <div className="gap-2 group/item flex flex-row justify-between items-center w-full text-xs">
                      <div className="flex items-center">
                        {chatModel.name}
                        <span className="ml-1 text-blue-500 flex items-center">
                          <BrainIcon size={8} />
                        </span>
                        <span className="ml-2 text-xs text-orange-500 bg-orange-100 px-1 py-0.5 rounded">
                          Premium
                        </span>
                      </div>
                      <Link href="/subscription">
                        <Button 
                          type="button"
                          size="sm" 
                          variant="outline" 
                          className="text-xs h-6 px-2"
                          onClick={(e) => {
                            e.stopPropagation();
                            setOpen(false);
                          }}
                        >
                          Upgrade
                        </Button>
                      </Link>
                    </div>
                  </div>
                );
              }

              return (
                <DropdownMenuItem
                  data-testid={`model-selector-item-${id}`}
                  key={id}
                  onSelect={() => {
                    setOpen(false);

                    startTransition(() => {
                      setCurrentModelId(id);
                      saveChatModelAsCookie(id);
                    });
                  }}
                  data-active={id === currentModelId}
                  className="py-1 px-2 cursor-pointer hover:bg-accent hover:text-accent-foreground"
                  asChild
                >
                  <button
                    type="button"
                    className="gap-2 group/item flex flex-row justify-between items-center w-full text-xs"
                  >
                    <div className="flex items-center">
                      {chatModel.name}
                      {supportsReasoning && (
                        <span className="ml-1 text-blue-500 flex items-center">
                          <BrainIcon size={8} />
                        </span>
                      )}
                    </div>

                    {id === currentModelId && (
                      <div className="text-foreground">
                        <CheckCircleFillIcon size={12} />
                      </div>
                    )}
                  </button>
                </DropdownMenuItem>
              );
            })}
            
            {Object.keys(modelGroups).indexOf(group) < Object.keys(modelGroups).length - 1 && (
              <DropdownMenuSeparator className="my-0.5" />
            )}
          </div>
        ))}
        </DropdownMenuContent>
      </DropdownMenu>
      
      <UpgradeModal
        isOpen={upgradeModal.isOpen}
        onClose={upgradeModal.hideUpgradeModal}
        title={upgradeModal.title}
        message={upgradeModal.message}
        currentUsage={upgradeModal.currentUsage}
      />
    </>
  );
}
