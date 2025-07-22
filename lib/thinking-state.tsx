'use client';

import React, { createContext, useContext, useState, ReactNode, useEffect } from 'react';

// Define the ThinkingState context
type ThinkingState = {
  state: string;
  setThinkingState: (state: string) => void;
};

const ThinkingStateContext = createContext<ThinkingState>({
  state: 'Thinking...',
  setThinkingState: () => {},
});

// Provider component
export function ThinkingStateProvider({ children }: { children: ReactNode }) {
  // Use a single consistent state value for thinking
  const [state, setState] = useState('Thinking...');
  
  // Reset to default state when unmounted (component cleanup)
  useEffect(() => {
    return () => {
      setState('Thinking...');
    };
  }, []);

  const setThinkingState = (newState: string) => {
    // We'll still let other components set this, but we want to normalize
    // the various thinking states to ensure consistency
    
    // Normalize "initializing" variations
    if (newState.toLowerCase().includes('initializing')) {
      setState('Thinking...');
      return;
    }
    
    // Normalize "processing" variations
    if (newState.toLowerCase().includes('processing')) {
      setState('Thinking...');
      return;
    }
    
    setState(newState);
  };

  return (
    <ThinkingStateContext.Provider value={{ state, setThinkingState }}>
      {children}
    </ThinkingStateContext.Provider>
  );
}

// Hook to use the thinking state
export function useThinkingState() {
  return useContext(ThinkingStateContext);
}

// Also export as default
export default ThinkingStateProvider; 