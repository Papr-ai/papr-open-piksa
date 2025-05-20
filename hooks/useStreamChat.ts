import { useCallback } from 'react';
import type { UseStreamChatReturn } from '@/types/app';

export function useStreamChat(): UseStreamChatReturn {
  const streamMessage = useCallback(
    async ({ prompt, chatId }: { prompt: string; chatId: string }) => {
      try {
        const response = await fetch(`/api/chat/${chatId}/stream`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ prompt }),
        });

        if (!response.ok) {
          throw new Error('Failed to stream message');
        }
      } catch (error) {
        console.error('Error streaming message:', error);
        throw error;
      }
    },
    [],
  );

  return { streamMessage };
}
