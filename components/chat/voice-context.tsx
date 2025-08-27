'use client';

import React, { createContext, useContext, useState, ReactNode } from 'react';

interface VoiceContextState {
  isConnected: boolean;
  isRecording: boolean;
  isPlaying: boolean;
  isConnecting: boolean;
  error: string | null;
}

interface VoiceContextValue extends VoiceContextState {
  updateVoiceState: (state: Partial<VoiceContextState>) => void;
}

const VoiceContext = createContext<VoiceContextValue | undefined>(undefined);

export function VoiceProvider({ children }: { children: ReactNode }) {
  const [state, setState] = useState<VoiceContextState>({
    isConnected: false,
    isRecording: false,
    isPlaying: false,
    isConnecting: false,
    error: null,
  });

  const updateVoiceState = (newState: Partial<VoiceContextState>) => {
    setState(prev => ({ ...prev, ...newState }));
  };

  return (
    <VoiceContext.Provider value={{ ...state, updateVoiceState }}>
      {children}
    </VoiceContext.Provider>
  );
}

export function useVoiceContext() {
  const context = useContext(VoiceContext);
  if (context === undefined) {
    throw new Error('useVoiceContext must be used within a VoiceProvider');
  }
  return context;
}
