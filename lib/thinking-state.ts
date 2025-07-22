import { useCallback, useState } from 'react';

// Thinking state history for debugging
const stateHistory: {timestamp: string, state: string, trigger: string}[] = [];

// Add logging to understand state changes
export function useThinkingState() {
  const [state, setState] = useState<{ message: string }>({ message: 'Thinking...' });

  const setThinkingState = useCallback((newState: string, trigger: string = 'unknown') => {
    const timestamp = new Date().toISOString();
    console.log(`[THINKING] ${timestamp} Setting thinking state to: "${newState}" (triggered by: ${trigger})`);
    
    // Store in history
    stateHistory.push({timestamp, state: newState, trigger});
    
    // Only show last 10 entries to avoid memory leaks
    if (stateHistory.length > 10) {
      stateHistory.shift();
    }
    
    // Log current history
    console.log('[THINKING] State history:', stateHistory);
    
    setState({ message: newState });
  }, []);

  return { state, setThinkingState };
} 