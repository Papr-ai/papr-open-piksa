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

  useEffect(() => {
    const handleMemoryToggle = (event: CustomEvent) => {
      console.log('[Chat] Memory toggle event received:', event.detail.enabled);
      setIsMemoryEnabled(event.detail.enabled);
      memoryEnabledRef.current = event.detail.enabled; // Keep ref in sync
    };

    // Try to get initial memory state from localStorage or other source
    const initialMemoryState = localStorage.getItem('memory-enabled') === 'true';
    console.log('[Chat] Initial memory state:', initialMemoryState);
    setIsMemoryEnabled(initialMemoryState);
    memoryEnabledRef.current = initialMemoryState; // Keep ref in sync

    window.addEventListener('memory-toggle-changed', handleMemoryToggle as EventListener);
    return () => {
      window.removeEventListener('memory-toggle-changed', handleMemoryToggle as EventListener);
    };
  }, []);
  const { mutate } = useSWRConfig();
  const [isClient, setIsClient] = useState(false);
  // Breadcrumb title updater: update once when assistant starts responding
  const { setTitle } = useBreadcrumb();
  const fetchedTitleRef = useRef(false);
  const { reasoningSteps } = useStreamChat();
  const { data: session } = useSession();
  const [showLoginModal, setShowLoginModal] = useState(false);
  
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
        // Use ref to get current value, avoiding closure issues
        const currentMemoryState = memoryEnabledRef.current;
        console.log('[Chat] Sending headers with memory enabled:', currentMemoryState);
        return {
          'X-Memory-Enabled': currentMemoryState ? 'true' : 'false',
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
          />
        </div>

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
