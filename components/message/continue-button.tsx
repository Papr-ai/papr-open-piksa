'use client';

import { Button } from '@/components/ui/button';
import { ArrowRightIcon, PlayIcon } from 'lucide-react';
import { useState } from 'react';

interface ContinueButtonProps {
  onContinue: () => void;
  isReadonly?: boolean;
}

export function ContinueButton({ onContinue, isReadonly = false }: ContinueButtonProps) {
  const [isClicked, setIsClicked] = useState(false);

  if (isReadonly) {
    return null;
  }

  const handleContinue = () => {
    setIsClicked(true);
    onContinue();
    // Reset after a delay to allow for new messages
    setTimeout(() => setIsClicked(false), 3000);
  };

  return (
    <div className="flex justify-center my-4">
      <Button
        onClick={handleContinue}
        disabled={isClicked}
        className="bg-blue-600 hover:bg-blue-700 text-white px-6 py-2 rounded-full shadow-md transition-all duration-200 hover:shadow-lg disabled:opacity-50"
      >
        {isClicked ? (
          <>
            <div className="animate-spin w-4 h-4 mr-2 border-2 border-white border-t-transparent rounded-full" />
            Continuing...
          </>
        ) : (
          <>
            <PlayIcon className="w-4 h-4 mr-2" />
            Continue
            <ArrowRightIcon className="w-4 h-4 ml-2" />
          </>
        )}
      </Button>
    </div>
  );
}

// Helper function to detect if we've hit the max tool calls limit
export function shouldShowContinueButton(message: any, status: string): boolean {
  // Don't show if still streaming or readonly
  if (status === 'streaming' || status === 'submitted') {
    return false;
  }

  // Check if this is an assistant message
  if (message?.role !== 'assistant') {
    return false;
  }

  // Count tool invocations in this message
  const toolCallCount = (message.parts?.filter((part: any) => 
    part.type === 'tool-invocation' || part.type?.startsWith('tool-')
  )?.length || 0) + (message.toolInvocations?.length || 0);

  // Show continue button if we have the maximum number of tool calls (typically 5-10)
  // This suggests we may have hit the limit and there might be more work to do
  return toolCallCount >= 5; // Adjust this number based on your model's tool call limit
}
