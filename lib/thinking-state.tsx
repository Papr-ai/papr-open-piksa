'use client';

import { createContext, useContext, useState, ReactNode } from 'react';

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
  const [state, setState] = useState('Thinking...');

  const setThinkingState = (newState: string) => {
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