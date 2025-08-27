'use client';

import { useState, useRef, useCallback, useEffect } from 'react';
import { useSession } from 'next-auth/react';
import { toast } from 'sonner';
import { saveVoiceConversationSummary } from '@/lib/ai/voice-summary';

export interface VoiceMessage {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  audioUrl?: string;
  timestamp: Date;
}

export interface VoiceChatState {
  isConnected: boolean;
  isRecording: boolean;
  isPlaying: boolean;
  isMuted: boolean;
  isConnecting: boolean;
  messages: VoiceMessage[];
  error: string | null;
}

export interface VoiceChatConfig {
  chatId: string;
  selectedModel: string;
  isMemoryEnabled: boolean;
  isWebSearchEnabled: boolean;
  onTranscription?: (text: string) => void;
  onResponse?: (text: string) => void;
  onStateChange?: (state: Partial<VoiceChatState>) => void;
  messages?: any[]; // Messages for summary generation
  userId?: string; // User ID for memory storage
}

export function useVoiceChatWebRTC(config: VoiceChatConfig) {
  const { data: session } = useSession();
  const [state, setState] = useState<VoiceChatState>({
    isConnected: false,
    isRecording: false,
    isPlaying: false,
    isMuted: false,
    isConnecting: false,
    messages: [],
    error: null,
  });

  const peerConnectionRef = useRef<RTCPeerConnection | null>(null);
  const audioElementRef = useRef<HTMLAudioElement | null>(null);
  const localStreamRef = useRef<MediaStream | null>(null);
  const audioContextRef = useRef<AudioContext | null>(null);
  const analyserRef = useRef<AnalyserNode | null>(null);
  const voiceDetectionRef = useRef<boolean>(false);
  const sessionStartTimeRef = useRef<Date | null>(null);
  const hasGeneratedSummaryRef = useRef<boolean>(false);

  // Helper to update state and notify parent
  const updateState = useCallback((newState: Partial<VoiceChatState>) => {
    setState(prev => ({ ...prev, ...newState }));
  }, []);

  // Notify parent of state changes via useEffect to avoid setState during render
  useEffect(() => {
    console.log('[Voice Hook] State changed:', state);
    config.onStateChange?.(state);
  }, [state, config.onStateChange]); // Only depend on the callback, not the entire config

  // Voice activity detection setup
  const setupVoiceActivityDetection = useCallback((stream: MediaStream) => {
    try {
      const audioContext = new (window.AudioContext || (window as any).webkitAudioContext)();
      const source = audioContext.createMediaStreamSource(stream);
      const analyser = audioContext.createAnalyser();
      
      analyser.fftSize = 256;
      analyser.minDecibels = -90;
      analyser.maxDecibels = -10;
      analyser.smoothingTimeConstant = 0.85;
      
      source.connect(analyser);
      
      audioContextRef.current = audioContext;
      analyserRef.current = analyser;
      
      // Start monitoring voice activity
      monitorVoiceActivity();
    } catch (error) {
      console.error('[Voice Activity] Setup failed:', error);
    }
  }, []);

  // Monitor voice activity
  const monitorVoiceActivity = useCallback(() => {
    if (!analyserRef.current) return;

    const bufferLength = analyserRef.current.frequencyBinCount;
    const dataArray = new Uint8Array(bufferLength);
    
    const checkVoiceActivity = () => {
      if (!analyserRef.current) return;
      
      analyserRef.current.getByteFrequencyData(dataArray);
      
      // Calculate average volume
      let sum = 0;
      for (let i = 0; i < bufferLength; i++) {
        sum += dataArray[i];
      }
      const average = sum / bufferLength;
      
      // Voice activity threshold (adjust as needed)
      const threshold = 20;
      const isVoiceActive = average > threshold;
      
      // Update recording state based on voice activity
      if (isVoiceActive !== voiceDetectionRef.current) {
        voiceDetectionRef.current = isVoiceActive;
        
        // Use setState with function to avoid dependency on state
        setState(currentState => {
          // Only update if microphone is enabled and connected
          if (currentState.isConnected && !currentState.isMuted) {
            return { ...currentState, isRecording: isVoiceActive };
          }
          return currentState;
        });
      }
      
      // Continue monitoring - use a ref to check connection state
      if (peerConnectionRef.current && peerConnectionRef.current.connectionState === 'connected') {
        requestAnimationFrame(checkVoiceActivity);
      }
    };
    
    checkVoiceActivity();
  }, []); // Empty dependency array since we're using refs and setState function

  // Connect to voice chat using WebRTC
  const connect = useCallback(async () => {
    if (!session?.user?.id) {
      toast.error('Please log in to use voice chat');
      return;
    }

    try {
      updateState({ error: null, isConnecting: true });
      
      // Get ephemeral token from our API
      const response = await fetch('/api/voice/realtime', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          chatId: config.chatId,
          selectedModel: config.selectedModel,
        }),
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || 'Failed to get session token');
      }

      const { client_secret, session_id } = await response.json();
      
      // Create RTCPeerConnection
      const pc = new RTCPeerConnection({
        iceServers: [{ urls: 'stun:stun.l.google.com:19302' }]
      });
      peerConnectionRef.current = pc;

      // Set up audio element for remote audio (AI responses)
      if (!audioElementRef.current) {
        audioElementRef.current = document.createElement('audio');
        audioElementRef.current.autoplay = true;
        (audioElementRef.current as any).playsInline = true; // TypeScript workaround for playsInline
      }

      // Handle remote audio stream (AI responses)
      pc.ontrack = (event) => {
        console.log('[Voice WebRTC] Received remote audio track');
        if (audioElementRef.current && event.streams[0]) {
          audioElementRef.current.srcObject = event.streams[0];
          updateState({ isPlaying: true });
        }
      };

      // Handle connection state changes
      pc.onconnectionstatechange = () => {
        console.log('[Voice WebRTC] Connection state:', pc.connectionState);
        
        if (pc.connectionState === 'connected') {
          // Track session start time when successfully connected
          sessionStartTimeRef.current = new Date();
          hasGeneratedSummaryRef.current = false;
          updateState({ isConnected: true, isConnecting: false });
          toast.success('Voice chat connected');
        } else if (pc.connectionState === 'disconnected' || pc.connectionState === 'failed') {
          updateState({ isConnected: false, isConnecting: false, isRecording: false, isPlaying: false });
          if (pc.connectionState === 'failed') {
            updateState({ error: 'Connection failed' });
          }
        }
      };

      // Get user's microphone
      const stream = await navigator.mediaDevices.getUserMedia({ 
        audio: {
          echoCancellation: true,
          noiseSuppression: true,
          sampleRate: 24000,
        }
      });
      localStreamRef.current = stream;

      // Set up voice activity detection
      // setupVoiceActivityDetection(stream); // Temporarily disabled

      // Add local audio track to peer connection
      stream.getTracks().forEach(track => {
        pc.addTrack(track, stream);
      });

      // Create offer
      const offer = await pc.createOffer();
      await pc.setLocalDescription(offer);

      console.log('[Voice WebRTC] Sending offer to OpenAI');

      // Send offer to OpenAI Realtime API
      const realtimeResponse = await fetch('https://api.openai.com/v1/realtime', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${client_secret}`,
          'Content-Type': 'application/sdp',
        },
        body: offer.sdp,
      });

      if (!realtimeResponse.ok) {
        throw new Error(`OpenAI Realtime API error: ${realtimeResponse.status}`);
      }

      // Get answer from OpenAI and set as remote description
      const answerSdp = await realtimeResponse.text();
      await pc.setRemoteDescription({
        type: 'answer',
        sdp: answerSdp,
      });

      console.log('[Voice WebRTC] WebRTC connection established');

    } catch (error) {
      console.error('[Voice WebRTC] Connection error:', error);
      updateState({ 
        error: error instanceof Error ? error.message : 'Failed to connect to voice chat',
        isConnected: false,
        isConnecting: false
      });
      throw error;
    }
  }, [session, config]);

  // Disconnect from voice chat
  const disconnect = useCallback(() => {
    // Generate summary before disconnecting if we have a session and haven't already generated one
    if (sessionStartTimeRef.current && 
        !hasGeneratedSummaryRef.current && 
        config.messages && 
        config.messages.length > 1 &&
        config.userId) {
      
      hasGeneratedSummaryRef.current = true; // Prevent duplicate summaries
      const sessionEndTime = new Date();
      
      console.log('[Voice WebRTC] Generating session summary before disconnect');
      
      // Generate summary in the background (don't block disconnect)
      saveVoiceConversationSummary({
        userId: config.userId,
        chatId: config.chatId,
        messages: config.messages,
        sessionStartTime: sessionStartTimeRef.current,
        sessionEndTime,
      }).catch(error => {
        console.error('[Voice WebRTC] Failed to generate session summary:', error);
      });
    }

    // Clean up WebRTC connection
    if (peerConnectionRef.current) {
      peerConnectionRef.current.close();
      peerConnectionRef.current = null;
    }
    
    if (localStreamRef.current) {
      localStreamRef.current.getTracks().forEach(track => track.stop());
      localStreamRef.current = null;
    }
    
    if (audioElementRef.current) {
      audioElementRef.current.srcObject = null;
    }
    
    // Clean up audio context
    if (audioContextRef.current) {
      audioContextRef.current.close();
      audioContextRef.current = null;
    }
    
    analyserRef.current = null;
    voiceDetectionRef.current = false;
    
    // Reset session tracking
    sessionStartTimeRef.current = null;
    hasGeneratedSummaryRef.current = false;
    
    updateState({
      isConnected: false,
      isConnecting: false,
      isRecording: false,
      isPlaying: false,
    });
  }, [updateState, config]);

  // Start recording (enable microphone)
  const startRecording = useCallback(() => {
    if (localStreamRef.current) {
      localStreamRef.current.getAudioTracks().forEach(track => {
        track.enabled = true;
      });
      updateState({ isMuted: false });
      // Voice activity detection will handle isRecording state
    }
  }, [updateState]);

  // Stop recording (mute microphone)
  const stopRecording = useCallback(() => {
    if (localStreamRef.current) {
      localStreamRef.current.getAudioTracks().forEach(track => {
        track.enabled = false;
      });
      updateState({ isRecording: false, isMuted: true });
    }
  }, [updateState]);

  // Toggle mute
  const toggleMute = useCallback(() => {
    if (audioElementRef.current) {
      const newMuted = !audioElementRef.current.muted;
      audioElementRef.current.muted = newMuted;
      updateState({ isMuted: newMuted });
    }
  }, [updateState]);

  // Clear messages
  const clearMessages = useCallback(() => {
    updateState({ messages: [] });
  }, [updateState]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      disconnect();
    };
  }, [disconnect]);

  return {
    ...state,
    connect,
    disconnect,
    startRecording,
    stopRecording,
    toggleMute,
    clearMessages,
  };
}
