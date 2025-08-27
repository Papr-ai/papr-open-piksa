'use client';

import { useState, useRef, useCallback, useEffect } from 'react';
import { useSession } from 'next-auth/react';
import { toast } from 'sonner';
import { saveVoiceConversationSummary } from '@/lib/ai/voice-summary';
import { useSWRConfig } from 'swr';
import type { ChatHistory } from '@/components/sidebar/sidebar-history';

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
  const { cache } = useSWRConfig();
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
      
      // Get recent chats from SWR cache - using the pagination key structure
      const PAGE_SIZE = 20; // Same as sidebar
      const firstPageKey = `/api/history?limit=${PAGE_SIZE}`;
      const firstPage: ChatHistory | undefined = cache.get(firstPageKey)?.data;
      let recentChats = firstPage?.chats || [];
      
      console.log('[Voice WebRTC] Cache debug:', {
        firstPageKey,
        cacheHit: !!cache.get(firstPageKey),
        cacheData: cache.get(firstPageKey),
        extractedChats: recentChats.length
      });
      
      // If cache is empty, try to fetch recent chats directly
      if (recentChats.length === 0) {
        try {
          console.log('[Voice WebRTC] Cache empty, fetching recent chats directly...');
          const historyResponse = await fetch('/api/history?limit=10');
          if (historyResponse.ok) {
            const historyData = await historyResponse.json();
            recentChats = historyData.chats || [];
            console.log('[Voice WebRTC] Fetched recent chats directly:', recentChats.length);
          }
        } catch (error) {
          console.warn('[Voice WebRTC] Failed to fetch recent chats directly:', error);
        }
      }
      
      // Get ephemeral token from our API with chat context
      console.log('[Voice WebRTC] Sending to API:', {
        chatId: config.chatId,
        messageCount: config.messages?.length || 0,
        recentChatsCount: recentChats.length,
        messages: config.messages?.slice(-3), // Log last 3 messages for debugging
        recentChatsPreview: recentChats.slice(0, 3).map(chat => ({
          id: chat.id,
          title: chat.title,
          oneSentenceSummary: chat.oneSentenceSummary,
          createdAt: chat.createdAt
        }))
      });
      
      console.log('[Voice WebRTC] Full recent chats data:', recentChats.slice(0, 5));
      
      const response = await fetch('/api/voice/realtime', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          chatId: config.chatId,
          selectedModel: config.selectedModel,
          messages: config.messages || [], // Pass chat history for context
          recentChats: recentChats.slice(0, 10), // Pass recent chats from cache
        }),
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        
        // Handle voice chat limit exceeded
        if (response.status === 429 && errorData.code === 'VOICE_CHAT_LIMIT_EXCEEDED') {
          console.log('[Voice WebRTC] Voice chat limit exceeded:', errorData.error);
          updateState({ 
            error: errorData.error || 'Voice chat limit exceeded',
            isConnected: false,
            isConnecting: false
          });
          
          // Show upgrade modal if needed
          if (errorData.shouldShowUpgrade) {
            console.log('[Voice WebRTC] Dispatching voice-limit-exceeded event');
            // Dispatch custom event for upgrade modal
            window.dispatchEvent(new CustomEvent('voice-limit-exceeded', {
              detail: { 
                usage: errorData.usage,
                message: errorData.error 
              }
            }));
          }
          return;
        }
        
        throw new Error(errorData.error || 'Failed to get session token');
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

      // Create data channel for OpenAI events (this is the key!)
      const eventsChannel = pc.createDataChannel('oai-events');
      const pendingFunctionCalls = new Map(); // call_id -> {buf: ""}
      
      eventsChannel.onopen = () => {
        console.log('[Voice WebRTC] ✅ OAI-EVENTS DATA CHANNEL OPENED');
        console.log('[Voice WebRTC] Ready to register tools and handle function calls...');
        
        // Register memory tools via data channel (always try since server configures them)
        console.log('[Voice WebRTC] 📝 REGISTERING MEMORY TOOLS VIA DATA CHANNEL');
          
          const sessionUpdate = {
            type: "session.update",
            session: {
              modalities: ["audio", "text"],
              tool_choice: "auto",
              tools: [
                {
                  type: "function",
                  name: "searchMemories",
                  description: "Search through user memories to find relevant information from past conversations",
                  parameters: {
                    type: "object",
                    properties: {
                      query: {
                        type: "string",
                        description: "A detailed search query describing exactly what to find in the user's memories"
                      }
                    },
                    required: ["query"]
                  }
                },
                {
                  type: "function", 
                  name: "addMemory",
                  description: "Add important information to user memories for future reference",
                  parameters: {
                    type: "object",
                    properties: {
                      content: {
                        type: "string",
                        description: "The content of the memory to add"
                      },
                      category: {
                        type: "string",
                        enum: ["preferences", "goals", "tasks", "knowledge"],
                        description: "The category of memory"
                      }
                    },
                    required: ["content", "category"]
                  }
                }
              ]
            }
          };
          
        eventsChannel.send(JSON.stringify(sessionUpdate));
        console.log('[Voice WebRTC] ✅ MEMORY TOOLS REGISTERED');
        
        // Ask the model to respond
        eventsChannel.send(JSON.stringify({ type: "response.create" }));
        console.log('[Voice WebRTC] ✅ RESPONSE CREATE SENT');
      };
      
      eventsChannel.onmessage = async (messageEvent) => {
        console.log('[Voice WebRTC] 📨 OAI-EVENTS MESSAGE:', messageEvent.data);
        
        try {
          const msg = JSON.parse(messageEvent.data);
          
          // Handle streaming function call arguments
          if (msg.type === "response.function_call_arguments.delta") {
            console.log('[Voice WebRTC] 🔄 FUNCTION CALL ARGS DELTA:', msg.call_id, msg.delta);
            const rec = pendingFunctionCalls.get(msg.call_id) || { buf: "" };
            rec.buf += msg.delta;
            pendingFunctionCalls.set(msg.call_id, rec);
          }
          
          // Handle completed function call arguments
          if (msg.type === "response.function_call_arguments.done") {
            console.log('[Voice WebRTC] ✅ FUNCTION CALL ARGS COMPLETE:', msg.call_id);
            
            const rec = pendingFunctionCalls.get(msg.call_id);
            if (!rec) {
              console.error('[Voice WebRTC] No pending function call found for:', msg.call_id);
              return;
            }
            
            try {
              const args = JSON.parse(rec.buf);
              console.log('[Voice WebRTC] 🚀 EXECUTING FUNCTION:', msg.name, 'with args:', args);
              
              // Call our API endpoint to execute the function
              const result = await fetch('/api/voice/tools', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                  functionName: msg.name,
                  arguments: args,
                }),
              });
              
              if (!result.ok) {
                throw new Error(`Function call API failed: ${result.status}`);
              }
              
              const functionResult = await result.json();
              console.log('[Voice WebRTC] 📤 FUNCTION RESULT:', functionResult);
              
              // Send function result back to OpenAI
              eventsChannel.send(JSON.stringify({
                type: "conversation.item.create",
                item: {
                  type: "function_call_output",
                  call_id: msg.call_id,
                  output: JSON.stringify(functionResult.result || functionResult)
                }
              }));
              
              // Continue the response
              eventsChannel.send(JSON.stringify({ type: "response.create" }));
              
              console.log('[Voice WebRTC] ✅ FUNCTION CALL COMPLETED');
              
            } catch (error) {
              console.error('[Voice WebRTC] ❌ FUNCTION EXECUTION ERROR:', error);
              
              // Send error result back to OpenAI
              const errorMessage = error instanceof Error ? error.message : String(error);
              eventsChannel.send(JSON.stringify({
                type: "conversation.item.create", 
                item: {
                  type: "function_call_output",
                  call_id: msg.call_id,
                  output: JSON.stringify({ error: errorMessage })
                }
              }));
              
              // Continue the response
              eventsChannel.send(JSON.stringify({ type: "response.create" }));
            }
            
            pendingFunctionCalls.delete(msg.call_id);
          }
          
        } catch (error) {
          console.error('[Voice WebRTC] Error parsing oai-events message:', error);
          console.error('[Voice WebRTC] Raw message data:', messageEvent.data);
        }
      };
      
      eventsChannel.onerror = (error) => {
        console.error('[Voice WebRTC] OAI-Events channel error:', error);
      };
      
      // Also handle incoming data channels from OpenAI (if any)
      pc.ondatachannel = (event) => {
        console.log('[Voice WebRTC] 📡 INCOMING DATA CHANNEL:', event.channel.label);
        // Handle any additional data channels OpenAI might create
      };

      // Handle connection state changes
      pc.onconnectionstatechange = () => {
        console.log('[Voice WebRTC] 🔗 CONNECTION STATE CHANGED');
        console.log('='.repeat(50));
        console.log('[Voice WebRTC] Connection State:', pc.connectionState);
        console.log('[Voice WebRTC] ICE Connection State:', pc.iceConnectionState);
        console.log('[Voice WebRTC] ICE Gathering State:', pc.iceGatheringState);
        console.log('[Voice WebRTC] Signaling State:', pc.signalingState);
        console.log('='.repeat(50));
        
        if (pc.connectionState === 'connected') {
          // Track session start time when successfully connected
          sessionStartTimeRef.current = new Date();
          hasGeneratedSummaryRef.current = false;
          updateState({ isConnected: true, isConnecting: false });
          toast.success('Voice chat connected');
          
          console.log('[Voice WebRTC] ✅ FULLY CONNECTED - Ready for voice and function calls');
        } else if (pc.connectionState === 'disconnected' || pc.connectionState === 'failed') {
          updateState({ isConnected: false, isConnecting: false, isRecording: false, isPlaying: false });
          if (pc.connectionState === 'failed') {
            updateState({ error: 'Connection failed' });
            console.error('[Voice WebRTC] ❌ CONNECTION FAILED');
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
