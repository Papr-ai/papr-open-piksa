'use client';

import type { FileUIPart, UIMessage } from 'ai';
import { DefaultChatTransport } from 'ai';

import { useChat } from '@ai-sdk/react';
import React, { useEffect, useState, useCallback, useRef } from 'react';
import useSWR, { useSWRConfig } from 'swr';
import type { Vote } from '@/lib/db/schema';
import { fetcher, generateUUID } from '@/lib/utils';
import { Artifact } from '../artifact/artifact';
import { MultimodalInput } from './multimodal-input';
import { Messages } from './messages';
import type { VisibilityType } from './visibility-selector';
import { useArtifact, useArtifactSelector } from '@/hooks/use-artifact';
import { toast } from 'sonner';
import { unstable_serialize } from 'swr/infinite';
import { getChatHistoryPaginationKey } from '../sidebar/sidebar-history';
import { DocumentOpener } from '../document/document-opener';
import { useStreamChat } from '@/hooks/useStreamChat';
import { useSession } from 'next-auth/react';
import { useBreadcrumb } from '@/components/layout/breadcrumb-context';
import { useLocalStorage } from 'usehooks-ts';
import { UsageWarning } from '@/components/subscription/usage-warning';

// Define types for the artifacts
interface CodeArtifact {
  kind: string;
  title?: string;
  documentId: string;
}

interface Message {
  chatId?: string;
  timestamp?: string;
  artifacts?: CodeArtifact[];
}

interface ProjectFile {
  path: string;
  documentId: string;
  name: string;
  timestamp: string;
}

interface ProjectGroup {
  projectName: string;
  files: ProjectFile[];
  chatId?: string;
  timestamp: string;
}


export function Chat({
  id,
  initialMessages,
  selectedChatModel,
  selectedVisibilityType,
  isReadonly,
  documentId,
}: {
  id: string;
  initialMessages: Array<UIMessage>;
  selectedChatModel: string;
  selectedVisibilityType: VisibilityType;
  isReadonly: boolean;
  documentId?: string;
}) {
  // Track memory enabled state
  const [isMemoryEnabled, setIsMemoryEnabled] = useState(false);
  const memoryEnabledRef = useRef(false);
  
  const [isWebSearchEnabled, setIsWebSearchEnabled] = useState(false);
  const webSearchEnabledRef = useRef(false);

  // Track voice chat state for visual indicators
  const [voiceState, setVoiceState] = useState({
    isConnected: false,
    isRecording: false,
    isPlaying: false,
    isConnecting: false,
    isMuted: false,
    messages: [] as any[],
    error: null as string | null,
  });

  useEffect(() => {
    const handleMemoryToggle = (event: CustomEvent) => {
      console.log('[Chat] Memory toggle event received:', event.detail.enabled);
      setIsMemoryEnabled(event.detail.enabled);
      memoryEnabledRef.current = event.detail.enabled; // Keep ref in sync
    };

    const handleWebSearchToggle = (event: CustomEvent) => {
      console.log('[Chat] Web search toggle event received:', event.detail.enabled);
      setIsWebSearchEnabled(event.detail.enabled);
      webSearchEnabledRef.current = event.detail.enabled; // Keep ref in sync
    };

    // Try to get initial states from localStorage
    const initialMemoryState = localStorage.getItem('memory-enabled') === 'true';
    const initialWebSearchState = localStorage.getItem('web-search-enabled') === 'true';
    console.log('[Chat] Initial memory state:', initialMemoryState);
    console.log('[Chat] Initial web search state:', initialWebSearchState);
    
    setIsMemoryEnabled(initialMemoryState);
    memoryEnabledRef.current = initialMemoryState; // Keep ref in sync
    
    setIsWebSearchEnabled(initialWebSearchState);
    webSearchEnabledRef.current = initialWebSearchState; // Keep ref in sync

    window.addEventListener('memory-toggle-changed', handleMemoryToggle as EventListener);
    window.addEventListener('web-search-toggle-changed', handleWebSearchToggle as EventListener);
    return () => {
      window.removeEventListener('memory-toggle-changed', handleMemoryToggle as EventListener);
      window.removeEventListener('web-search-toggle-changed', handleWebSearchToggle as EventListener);
    };
  }, []);
  const { mutate } = useSWRConfig();
  const [isClient, setIsClient] = useState(false);
  // Breadcrumb title updater: update once when assistant starts responding
  const { setTitle } = useBreadcrumb();
  const fetchedTitleRef = useRef(false);
  const { reasoningSteps } = useStreamChat();
  const { data: session, update: updateSession } = useSession();
  const [showLoginModal, setShowLoginModal] = useState(false);
  
  // Debug session state in development
  useEffect(() => {
    if (process.env.NODE_ENV === 'development' && session?.user?.id) {
      console.log('[Chat] Session state:', {
        hasUser: !!session.user,
        userId: session.user.id,
        userImage: session.user.image,
        userEmail: session.user.email,
        userName: session.user.name
      });
    }
  }, [session?.user?.id, session?.user?.image]);
  
  // Access artifact state and setter with chat-specific ID
  const { artifact, setArtifact } = useArtifact(id);

  // Use effect to mark when client-side rendering is active
  useEffect(() => {
    setIsClient(true);
  }, []);

  // Create a ref to store the current selected model to avoid recreating transport
  const selectedChatModelRef = useRef(selectedChatModel);
  
  // Update the ref when the model changes
  useEffect(() => {
    selectedChatModelRef.current = selectedChatModel;
  }, [selectedChatModel]);

  const {
    messages,
    setMessages,
    sendMessage,
    status,
    stop,
    regenerate,
  } = useChat({
    id,
    messages: initialMessages,
    experimental_throttle: 100,
    generateId: generateUUID,
    transport: new DefaultChatTransport({
      api: '/api/chat-simple',
      body: () => ({
        selectedChatModel: selectedChatModelRef.current, // Use ref to get current model dynamically
      }),
      headers: async () => {
        // Use refs to get current values, avoiding closure issues
        const currentMemoryState = memoryEnabledRef.current;
        const currentWebSearchState = webSearchEnabledRef.current;
        console.log('[Chat] Sending headers with memory enabled:', currentMemoryState);
        console.log('[Chat] Sending headers with web search enabled:', currentWebSearchState);
        return {
          'X-Memory-Enabled': currentMemoryState ? 'true' : 'false',
          'X-Web-Search-Enabled': currentWebSearchState ? 'true' : 'false',
          'X-Context': '',
          'X-Interaction-Mode': 'chat',
        };
      },
    }),

    onFinish: () => {
      // Refresh chat list
      mutate(unstable_serialize(getChatHistoryPaginationKey));
      // Fetch chat title once and update breadcrumb
      fetch(`/api/chats?id=${id}`, { credentials: 'same-origin' })
        .then((res) => (res.ok ? res.json() : null))
        .then((data) => {
          if (data?.title) setTitle(data.title);
        })
        .catch(() => {});
    },
    onError: (error) => {
      console.error('Chat error:', error);
      
      // Check if it's an onboarding error
      if (error.message && error.message.includes('ONBOARDING_REQUIRED')) {
        // Redirect to onboarding
        window.location.href = '/onboarding';
        return;
      }
      
      toast.error('An error occurred, please try again!');
    },
  });

  // Log the selected model for debugging
  useEffect(() => {
    console.log('[Chat] Selected model:', selectedChatModel);
  }, [selectedChatModel]);

  // Handle input state separately in AI SDK 5.0
  const [input, setInput] = useState('');
  
  // Create handleSubmit function
  const handleSubmit = useCallback((e?: React.FormEvent) => {
    e?.preventDefault();
    if (input.trim()) {
      sendMessage({ role: 'user', parts: [{ type: 'text', text: input }] });
      setInput('');
    }
  }, [input, sendMessage]);

  // Create append function for compatibility
  const append = useCallback(async (message: any) => {
    await sendMessage(message);
  }, [sendMessage]);

  // Create reload function for compatibility  
  const reload = useCallback(async (options?: any) => {
    return await regenerate(options);
  }, [regenerate]);

  // Voice state change handler
  const handleVoiceStateChange = useCallback((state: any) => {
    setVoiceState(state);
  }, []);
  // Fetch and set the chat title once when assistant's first message arrives
  useEffect(() => {
    if (messages.length >= 2 && !fetchedTitleRef.current) {
      fetchedTitleRef.current = true;
      fetch(`/api/chats?id=${id}`, { credentials: 'same-origin' })
        .then((res) => (res.ok ? res.json() : null))
        .then((data) => {
          if (data?.title) setTitle(data.title);
        })
        .catch(() => {});
    }
  }, [messages.length, id, setTitle]);

  const { data: votes } = useSWR<Array<Vote>>(
    messages.length >= 2 ? `/api/vote?chatId=${id}` : null,
    fetcher,
  );

  const [attachments, setAttachments] = useState<Array<FileUIPart>>([]);
  const isArtifactVisible = useArtifactSelector((state) => state.isVisible);

  // Track message sending to apply reasoning steps
  const onSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    
    // Check if user is authenticated before proceeding
    if (!session) {
      setShowLoginModal(true);
      return;
    }
    
    // Check if input is empty or just whitespace
    if (!input || input.trim().length === 0) {
      console.log('[Chat] Preventing empty message submission');
      return;
    }
    
    // If we have a valid input, store that we're starting a new message
    console.log('[Chat] Submitting message with reasoning steps tracking');
    
    // Call the original handler
    await handleSubmit(e);
  };

  return (
    <>
      {isClient && documentId && <DocumentOpener documentId={documentId} />}
      

      <div className="flex flex-col h-full w-full">

        
        <div className="flex-1 overflow-y-auto w-full">
          <Messages
            chatId={id}
            status={status}
            votes={votes}
            messages={messages}
            setMessages={setMessages}
            reload={reload}
            isReadonly={isReadonly}
            isArtifactVisible={isArtifactVisible}
            reasoningSteps={reasoningSteps}
            selectedModelId={selectedChatModel}
            enableUniversalReasoning={true}
            voiceState={voiceState}
          />
        </div>

        {/* Voice Activity Indicators - Above chat input */}
        {voiceState.isConnecting && (
          <div className="mx-auto px-4 w-[70%] mb-2">
            <div className="flex items-center justify-center p-4 bg-gray-50 border border-gray-200 rounded-lg">
              <div className="flex items-center gap-3">
                <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-gray-500"></div>
                <span className="text-sm font-medium text-gray-700">Connecting to voice chat...</span>
              </div>
            </div>
          </div>
        )}
        
        {voiceState.isRecording && !voiceState.isMuted && (
          <div className="mx-auto px-4 w-[70%] mb-2">
            <div className="flex items-center justify-center p-4 bg-red-50 border border-red-200 rounded-lg">
              <div className="flex items-center gap-3">
                <div className="relative">
                  <svg className="h-5 w-5 text-red-500" fill="currentColor" viewBox="0 0 20 20">
                    <path fillRule="evenodd" d="M7 4a3 3 0 016 0v4a3 3 0 11-6 0V4zm4 10.93A7.001 7.001 0 0017 8a1 1 0 10-2 0A5 5 0 715 8a1 1 0 00-2 0 7.001 7.001 0 006 6.93V17H6a1 1 0 100 2h8a1 1 0 100-2h-3v-2.07z" clipRule="evenodd" />
                  </svg>
                  <div className="absolute -inset-1 bg-red-500 rounded-full opacity-20 animate-ping" />
                </div>
                <span className="text-sm font-medium text-red-700">AI is listening...</span>
              </div>
              
              {/* Audio waveform animation */}
              <div className="flex items-center gap-1 ml-3">
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
          </div>
        )}
        
        {voiceState.isPlaying && (
          <div className="mx-auto px-4 w-[70%] mb-2">
            <div className="flex items-center justify-center p-4 bg-blue-50 border border-blue-200 rounded-lg">
              <div className="flex items-center gap-3">
                <div className="relative">
                  <svg className="h-5 w-5 text-blue-500" fill="currentColor" viewBox="0 0 20 20">
                    <path fillRule="evenodd" d="M9.383 3.076A1 1 0 0110 4v12a1 1 0 01-1.617.816l-4.375-3.5a1 1 0 01-.383-.816v-2a1 1 0 01.383-.816l4.375-3.5a1 1 0 011.617.816zM15 8a2 2 0 11-4 0 2 2 0 014 0z" clipRule="evenodd" />
                  </svg>
                  <div className="absolute -inset-1 bg-blue-500 rounded-full opacity-20 animate-ping" />
                </div>
                <span className="text-sm font-medium text-blue-700">AI is responding...</span>
              </div>
              
              {/* Speaking animation */}
              <div className="flex items-center gap-1 ml-3">
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
          </div>
        )}

        {/* Usage Warning positioned right above the input */}
        <div className="mx-auto px-7 w-[70%]">
          <UsageWarning />
        </div>

        <form 
          className="flex mx-auto px-4 bg-background pb-4 md:pb-6 gap-2 w-[70%]"
          onSubmit={onSubmit}
        >
          {!isReadonly && (
            <MultimodalInput
              chatId={id}
              input={input}
              setInput={setInput}
              handleSubmit={handleSubmit}
              status={status}
              stop={stop}
              attachments={attachments}
              setAttachments={setAttachments}
              messages={messages}
              setMessages={setMessages}
              append={append}
              selectedModelId={selectedChatModel}
              selectedVisibilityType={selectedVisibilityType}
              onVoiceStateChange={handleVoiceStateChange}
            />
          )}
        </form>
      </div>

      <Artifact
        chatId={id}
        input={input}
        setInput={setInput}
        handleSubmit={handleSubmit}
        status={status}
        stop={stop}
        attachments={attachments}
        setAttachments={setAttachments}
        append={append}
        messages={messages}
        setMessages={setMessages}
        reload={reload}
        votes={votes}
        isReadonly={isReadonly}
        selectedModelId={selectedChatModel}
        selectedVisibilityType={selectedVisibilityType}
      />
    </>
  );
}
