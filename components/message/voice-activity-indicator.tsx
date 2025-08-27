'use client';

import React from 'react';
import { Mic, Volume2, Loader2 } from 'lucide-react';
import { cn } from '@/lib/utils';

interface VoiceActivityIndicatorProps {
  type: 'recording' | 'responding' | 'connecting';
  className?: string;
}

export function VoiceActivityIndicator({ type, className }: VoiceActivityIndicatorProps) {
  if (type === 'recording') {
    return (
      <div className={cn(
        "flex items-center gap-3 p-4 mx-4 mb-4 bg-red-50 border border-red-200 rounded-lg",
        className
      )}>
        <div className="flex items-center gap-2">
          <div className="relative">
            <Mic className="h-4 w-4 text-red-500" />
            <div className="absolute -inset-1 bg-red-500 rounded-full opacity-20 animate-ping" />
          </div>
          <span className="text-sm font-medium text-red-700">AI is listening...</span>
        </div>
        
        {/* Audio waveform animation */}
        <div className="flex items-center gap-1 ml-2">
          {[...Array(5)].map((_, i) => (
            <div
              key={i}
              className="w-1 bg-red-400 rounded-full animate-pulse"
              style={{
                height: '8px',
                animationDelay: `${i * 0.1}s`,
                animationDuration: '0.6s'
              }}
            />
          ))}
        </div>
      </div>
    );
  }

  if (type === 'responding') {
    return (
      <div className={cn(
        "flex items-center gap-3 p-4 mx-4 mb-4 bg-blue-50 border border-blue-200 rounded-lg",
        className
      )}>
        <div className="flex items-center gap-2">
          <div className="relative">
            <Volume2 className="h-4 w-4 text-blue-500" />
            <div className="absolute -inset-1 bg-blue-500 rounded-full opacity-20 animate-ping" />
          </div>
          <span className="text-sm font-medium text-blue-700">AI is responding...</span>
        </div>
        
        {/* Speaking animation */}
        <div className="flex items-center gap-1 ml-2">
          {[...Array(4)].map((_, i) => (
            <div
              key={i}
              className="w-1.5 bg-blue-400 rounded-full"
              style={{
                height: `${Math.random() * 12 + 6}px`,
                animation: `pulse 0.8s ease-in-out ${i * 0.1}s infinite alternate`
              }}
            />
          ))}
        </div>
      </div>
    );
  }

  if (type === 'connecting') {
    return (
      <div className={cn(
        "flex items-center gap-3 p-4 mx-4 mb-4 bg-gray-50 border border-gray-200 rounded-lg",
        className
      )}>
        <div className="flex items-center gap-2">
          <Loader2 className="h-4 w-4 text-gray-500 animate-spin" />
          <span className="text-sm font-medium text-gray-700">Connecting to voice chat...</span>
        </div>
      </div>
    );
  }

  return null;
}

// Typing indicator for when user is speaking (before transcription)
export function VoiceTypingIndicator({ className }: { className?: string }) {
  return (
    <div className={cn(
      "flex items-center gap-2 p-3 mx-4 mb-2 bg-gray-50 border border-gray-200 rounded-lg text-sm text-gray-600",
      className
    )}>
      <div className="flex gap-1">
        {[...Array(3)].map((_, i) => (
          <div
            key={i}
            className="w-1.5 h-1.5 bg-gray-400 rounded-full animate-bounce"
            style={{
              animationDelay: `${i * 0.2}s`,
              animationDuration: '1s'
            }}
          />
        ))}
      </div>
      <span>Speaking...</span>
    </div>
  );
}
