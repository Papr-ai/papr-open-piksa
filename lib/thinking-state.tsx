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
    // Enhanced thinking state that shows specific progress for book creation
    console.log('[ThinkingState] Setting state:', newState);
    
    // Book creation specific states - show these as-is for better UX
    const bookCreationStates = [
      'Creating characters...',
      'Developing story plot...',
      'Writing chapter content...',
      'Designing environments...',
      'Composing scenes...',
      'Preparing final review...',
      'Generating character portraits...',
      'Creating book illustrations...',
      'Building story structure...',
      'Crafting dialogue...',
      'Setting up scenes...',
      'Polishing content...'
    ];
    
    // If it's a book creation specific state, show it as-is
    if (bookCreationStates.some(state => 
      newState.toLowerCase().includes(state.toLowerCase().replace('...', ''))
    )) {
      setState(newState);
      return;
    }
    
    // Memory and tool-specific states - show these as-is
    if (newState.toLowerCase().includes('searching memories') ||
        newState.toLowerCase().includes('creating image') ||
        newState.toLowerCase().includes('updating step') ||
        newState.toLowerCase().includes('working on')) {
      setState(newState);
      return;
    }
    
    // Normalize "initializing" variations
    if (newState.toLowerCase().includes('initializing')) {
      setState('Getting started...');
      return;
    }
    
    // Normalize "processing" variations but make them more specific
    if (newState.toLowerCase().includes('processing')) {
      setState('Processing your request...');
      return;
    }
    
    // Default fallback
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