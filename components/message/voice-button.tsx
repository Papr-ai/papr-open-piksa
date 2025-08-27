'use client';

import React, { useState, useCallback, useRef, useEffect, useMemo } from 'react';
import { Button } from '@/components/ui/button';
import { Mic, MicOff, Loader2, PhoneOff, Phone } from 'lucide-react';
import { cn } from '@/lib/utils';
import { toast } from 'sonner';
import { useVoiceChatWebRTC, type VoiceChatConfig } from '@/hooks/use-voice-chat-webrtc';
import { useSession } from 'next-auth/react';
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip';

interface VoiceButtonProps {
  chatId: string;
  selectedModel: string;
  isMemoryEnabled: boolean;
  isWebSearchEnabled: boolean;
  onVoiceMessage?: (message: string) => void;
  onVoiceStateChange?: (state: any) => void;
  disabled?: boolean;
  className?: string;
  messages?: any[]; // Messages for summary generation
}

export function VoiceButton({
  chatId,
  selectedModel,
  isMemoryEnabled,
  isWebSearchEnabled,
  onVoiceMessage,
  onVoiceStateChange,
  disabled = false,
  className,
  messages = []
}: VoiceButtonProps) {
  const { data: session } = useSession();
  const [isVoiceMode, setIsVoiceMode] = useState(false);
  const connectionAttemptedRef = useRef(false);
  
  const config: VoiceChatConfig = useMemo(() => {
    console.log('[VoiceButton] Creating config with messages:', {
      chatId,
      messageCount: messages?.length || 0,
      messages: messages?.slice(-2) // Log last 2 messages for debugging
    });
    
    return {
      chatId,
      selectedModel: selectedModel.includes('realtime') ? selectedModel : 'gpt-4o-realtime-preview',
      isMemoryEnabled,
      isWebSearchEnabled,
      onStateChange: onVoiceStateChange,
      messages,
      userId: session?.user?.id,
    };
  }, [chatId, selectedModel, isMemoryEnabled, isWebSearchEnabled, onVoiceStateChange, messages, session?.user?.id]);

  const {
    isConnected,
    isRecording,
    isPlaying,
    isConnecting,
    error,
    connect,
    disconnect,
    startRecording,
    stopRecording,
  } = useVoiceChatWebRTC(config);

  const handleVoiceToggle = useCallback(async () => {
    if (disabled) return;

    if (!isVoiceMode) {
      // Entering voice mode - connect AND start recording
      try {
        setIsVoiceMode(true);
        connectionAttemptedRef.current = true;
        await connect();
        // Automatically start recording after connection
        setTimeout(() => {
          startRecording();
        }, 500); // Small delay to ensure connection is stable
        toast.success('Voice chat connected - speak now!');
      } catch (error) {
        console.error('Failed to connect to voice chat:', error);
        toast.error('Voice chat setup required');
        setIsVoiceMode(false);
        connectionAttemptedRef.current = false;
      }
    } else {
      // Exiting voice mode - stop recording and disconnect
      if (isRecording) {
        stopRecording();
      }
      disconnect();
      setIsVoiceMode(false);
      connectionAttemptedRef.current = false;
      toast.info('Voice chat disconnected');
    }
  }, [disabled, isVoiceMode, connect, disconnect, startRecording, stopRecording, isRecording]);

  const handleRecordingToggle = useCallback(() => {
    if (!isConnected || disabled) return;

    if (isRecording) {
      stopRecording();
    } else {
      startRecording();
    }
  }, [isConnected, isRecording, startRecording, stopRecording, disabled]);

  // Listen for disconnect events from the stop button
  useEffect(() => {
    const handleVoiceDisconnect = () => {
      if (isConnected) {
        disconnect();
        setIsVoiceMode(false);
        connectionAttemptedRef.current = false;
        toast.info('Voice chat disconnected');
      }
    };

    window.addEventListener('voice-disconnect', handleVoiceDisconnect);
    return () => {
      window.removeEventListener('voice-disconnect', handleVoiceDisconnect);
    };
  }, [isConnected, disconnect]);

  // Show error state
  if (error && connectionAttemptedRef.current) {
    return (
      <TooltipProvider>
        <Tooltip>
          <TooltipTrigger asChild>
            <Button
              variant="ghost"
              size="sm"
              className={cn(
                "rounded-full p-1.5 h-8 w-8 text-red-500 hover:text-red-600",
                className
              )}
              onClick={handleVoiceToggle}
              disabled={disabled}
            >
              <MicOff size={16} />
            </Button>
          </TooltipTrigger>
          <TooltipContent>
            <p>Voice chat error: {error}</p>
          </TooltipContent>
        </Tooltip>
      </TooltipProvider>
    );
  }

  // Show connecting state
  if (isConnecting || (isVoiceMode && !isConnected && connectionAttemptedRef.current)) {
    return (
      <TooltipProvider>
        <Tooltip>
          <TooltipTrigger asChild>
            <Button
              variant="ghost"
              size="sm"
              className={cn(
                "rounded-full p-1.5 h-8 w-8 text-blue-500",
                className
              )}
              disabled={true}
            >
              <Loader2 size={16} className="animate-spin" />
            </Button>
          </TooltipTrigger>
          <TooltipContent>
            <p>Connecting to voice chat...</p>
          </TooltipContent>
        </Tooltip>
      </TooltipProvider>
    );
  }

  // Show connected state - voice chat active
  if (isVoiceMode && isConnected) {
    return (
      <TooltipProvider>
        <Tooltip>
          <TooltipTrigger asChild>
            <Button
              variant="ghost"
              size="sm"
              className={cn(
                "rounded-full p-1.5 h-8 w-8 transition-colors",
                isRecording 
                  ? "text-red-500 hover:text-red-600 bg-red-50 hover:bg-red-100" 
                  : isPlaying
                  ? "text-blue-500 hover:text-blue-600 bg-blue-50 hover:bg-blue-100"
                  : "text-green-500 hover:text-green-600 bg-green-50 hover:bg-green-100",
                className
              )}
              onClick={handleVoiceToggle}
              disabled={disabled}
            >
              {isRecording ? (
                <MicOff size={16} className="animate-pulse" />
              ) : isPlaying ? (
                <Mic size={16} className="animate-pulse" />
              ) : (
                <Mic size={16} />
              )}
            </Button>
          </TooltipTrigger>
          <TooltipContent>
            <p>
              {isRecording 
                ? "Click to stop voice chat" 
                : isPlaying
                ? "AI is responding - click to stop"
                : "Voice chat active - click to disconnect"
              }
            </p>
          </TooltipContent>
        </Tooltip>
      </TooltipProvider>
    );
  }

  // Default state - not connected
  return (
    <TooltipProvider>
      <Tooltip>
        <TooltipTrigger asChild>
          <Button
            variant="ghost"
            size="sm"
            className={cn(
              "rounded-full p-1.5 h-8 w-8 text-muted-foreground hover:text-foreground",
              className
            )}
            onClick={handleVoiceToggle}
            onContextMenu={(e) => {
              e.preventDefault();
              if (isVoiceMode) {
                handleVoiceToggle();
              }
            }}
            disabled={disabled}
          >
            <Mic size={16} />
          </Button>
        </TooltipTrigger>
        <TooltipContent>
          <p>Start voice chat</p>
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );
}
