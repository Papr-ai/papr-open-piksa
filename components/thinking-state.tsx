import { atom, useAtom } from 'jotai';
import { useCallback } from 'react';

// Create atom for thinking state
export const thinkingStateAtom = atom<string>('Thinking...');

// Add logging to understand state changes
export function useThinkingState() {
  const [state, setState] = useAtom(thinkingStateAtom);

  const setThinkingState = useCallback((newState: string) => {
    console.log(`[THINKING] Setting thinking state to: "${newState}"`);
    setState(newState);
  }, [setState]);

  return { state, setThinkingState };
} 