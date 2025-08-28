import { memo } from 'react';
import { CrossIcon } from '@/components/common/icons';
import { Button } from '@/components/ui/button';
import { initialArtifactData, useArtifact } from '@/hooks/use-artifact';

interface ArtifactCloseButtonProps {
  chatId?: string;
}

function PureArtifactCloseButton({ chatId }: ArtifactCloseButtonProps) {
  const { setArtifact } = useArtifact(chatId);

  return (
    <Button
      data-testid="artifact-close-button"
      variant="outline"
      className="h-fit p-2 dark:hover:bg-zinc-700"
      onClick={() => {
        setArtifact((currentArtifact) =>
          currentArtifact.status === 'streaming'
            ? {
                ...currentArtifact,
                isVisible: false,
              }
            : { ...initialArtifactData, status: 'idle' },
        );
      }}
    >
      <CrossIcon size={18} />
    </Button>
  );
}

export const ArtifactCloseButton = memo(PureArtifactCloseButton, (prevProps, nextProps) => 
  prevProps.chatId === nextProps.chatId
);
