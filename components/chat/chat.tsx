'use client';

import type { FileUIPart, UIMessage } from 'ai';
import { DefaultChatTransport } from 'ai';
import { useChat } from '@ai-sdk/react';
import React, { useEffect, useState, useCallback, useRef } from 'react';
import useSWR, { useSWRConfig } from 'swr';
import type { Vote } from '@/lib/db/schema';
import { fetcher, generateUUID } from '@/lib/utils';
import { Artifact, artifactDefinitions } from '@/components/artifact/artifact';
import { MultimodalInput } from '@/components/message/multimodal-input';
import { Messages } from '@/components/message/messages';
import type { VisibilityType } from '@/components/message/visibility-selector';
import { useArtifact, useArtifactSelector } from '@/hooks/use-artifact';
import { toast } from 'sonner';
import { unstable_serialize } from 'swr/infinite';
import { getChatHistoryPaginationKey } from '@/components/sidebar/sidebar-history';
import { DocumentOpener } from '@/components/document/document-opener';
import { useStreamChat } from '@/hooks/useStreamChat';
import { useSession } from 'next-auth/react';
import { useBreadcrumb } from '@/components/layout/breadcrumb-context';
import { useLocalStorage } from 'usehooks-ts';
import { UsageWarning } from '@/components/subscription/usage-warning';
import { VoiceActivityIndicator } from '@/components/message/voice-activity-indicator';
import { useContext } from '@/hooks/use-context';

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
    error: null as string | null,
  });

  // Debug voice state changes
  useEffect(() => {
    console.log('[Chat] Voice state updated:', voiceState);
  }, [voiceState]);

  const { mutate } = useSWRConfig();
  const [isClient, setIsClient] = useState(false);
  // Breadcrumb title updater: update once when assistant starts responding
  const { setTitle } = useBreadcrumb();
  const fetchedTitleRef = useRef(false);
  const { reasoningSteps } = useStreamChat();
  const { data: session } = useSession();
  const [showLoginModal, setShowLoginModal] = useState(false);
  
  // Access artifact state and setter with chat-specific ID
  const { artifact, setArtifact, metadata, setMetadata } = useArtifact(id);

  // Use the custom context hook
  const { selectedContexts } = useContext();
  
  // Create a ref for selectedContexts to avoid closure issues
  const selectedContextsRef = useRef(selectedContexts);
  useEffect(() => {
    selectedContextsRef.current = selectedContexts;
  }, [selectedContexts]);

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
    // Removed experimental_throttle for real-time streaming
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
          'X-Context': selectedContextsRef.current.length > 0 ? JSON.stringify(selectedContextsRef.current) : '',
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
    onError: (error: any) => {
      console.error('Chat error:', error);
      // Check if this is a usage limit error
      if ((error as any)?.body?.code === 'USAGE_LIMIT_EXCEEDED' || error.message?.includes('USAGE_LIMIT_EXCEEDED')) {
        toast.error('You\'ve reached your monthly usage limit. Please upgrade your plan to continue.');
      } else {
        toast.error('An error occurred, please try again!');
      }
    },
  });

  // Handle input state separately in AI SDK 5.0
  const [input, setInput] = useState('');

  // Create append function for compatibility
  const append = useCallback(async (message: any) => {
    await sendMessage(message);
  }, [sendMessage]);

  // Create reload function for compatibility  
  const reload = useCallback(async (options?: any) => {
    return await regenerate(options);
  }, [regenerate]);
  // Debug: Log messages state changes
  useEffect(() => {
    console.log('[Chat] Messages state updated:', messages);
    console.log('[Chat] Number of messages:', messages.length);
    messages.forEach((msg, idx) => {
      console.log(`[Chat] Message ${idx}:`, {
        role: msg.role,
        parts: msg.parts?.length || 0,
        partsDetails: msg.parts?.map(p => ({ type: (p as any).type, hasText: !!(p as any).text }))
      });
    });
  }, [messages]);

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

  // Create handleSubmit function
  const handleSubmit = useCallback((e: React.FormEvent) => {
    e.preventDefault();
    if (input.trim() || attachments.length > 0 || selectedContexts.length > 0) {
      // Create message parts array
      const parts: any[] = [];
      
      console.log('[CHAT SUBMIT] Creating message with:', {
        inputLength: input.length,
        attachmentsCount: attachments.length,
        selectedContextsCount: selectedContexts.length,
        attachments: attachments
      });
      
      // Add text part if there's input
      if (input.trim()) {
        let messageText = input;
        
        // Add context document information to text
        const contextDocs = selectedContexts.filter(context => context.type === 'document');
        if (contextDocs.length > 0) {
          messageText += '\n\n**Context Documents:**\n';
          contextDocs.forEach((doc, index) => {
            messageText += `${index + 1}. ${doc.title}\n`;
          });
        }
        
        // Add context image information to text
        const contextImages = selectedContexts.filter(context => context.type === 'image' && context.file?.url);
        if (contextImages.length > 0) {
          messageText += '\n\n**Context Images:**\n';
          contextImages.forEach((img, index) => {
            messageText += `${index + 1}. ${img.title} (${img.file?.url})\n`;
          });
        }

        // Add attachment image URLs to text so AI can reference them in tool calls
        const imageAttachments = attachments.filter(attachment => 
          attachment.mediaType && attachment.mediaType.startsWith('image/')
        );
        if (imageAttachments.length > 0) {
          messageText += '\n\n**Attached Images:**\n';
          imageAttachments.forEach((img, index) => {
            messageText += `${index + 1}. [${img.filename || 'Image'}](${img.url})\n`;
          });
        }
        
        parts.push({ type: 'text', text: messageText });
        console.log('[CHAT SUBMIT] Added text part');
      }
      
      // Add regular attachments as file parts (AI SDK v5 format)
      attachments.forEach((attachment, index) => {
        console.log('[CHAT SUBMIT] Processing attachment:', index, attachment);
        const filePart = {
          type: 'file',
          mediaType: attachment.mediaType,
          url: attachment.url,
        };
        parts.push(filePart);
        console.log('[CHAT SUBMIT] Added file part:', filePart);
      });
      
      // Add context images as file parts (AI SDK v5 format)
      const contextImages = selectedContexts.filter(context => context.type === 'image' && context.file?.url);
      contextImages.forEach((img, index) => {
        console.log('[CHAT SUBMIT] Processing context image:', index, img);
        // Determine mediaType from file extension
        const filename = img.file!.name;
        let mediaType = 'image/jpeg';
        if (filename.toLowerCase().endsWith('.png')) mediaType = 'image/png';
        else if (filename.toLowerCase().endsWith('.webp')) mediaType = 'image/webp';
        else if (filename.toLowerCase().endsWith('.gif')) mediaType = 'image/gif';
        
        const contextImagePart = {
          type: 'file',
          mediaType,
          url: img.file!.url,
        };
        parts.push(contextImagePart);
        console.log('[CHAT SUBMIT] Added context image part:', contextImagePart);
      });
      
      console.log('[CHAT SUBMIT] Final parts:', parts);
      sendMessage({ role: 'user', parts });
      setInput('');
    }
  }, [input, sendMessage, selectedContexts, attachments]);

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
        {/* Always visible test component at top of chat */}
        <div className="bg-blue-100 border-b border-blue-200 p-2 text-center text-sm">
          <strong>🎤 VOICE STATUS:</strong> 
          Connected: {voiceState.isConnected ? '✅' : '❌'} | 
          Recording: {voiceState.isRecording ? '🎙️' : '⭕'} | 
          Playing: {voiceState.isPlaying ? '🔊' : '🔇'}
        </div>
        
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
        <div className="mx-auto px-4 w-[70%]">
          <UsageWarning />
        </div>

        {!isArtifactVisible && (
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
                onVoiceStateChange={setVoiceState}
              />
            )}
          </form>
        )}
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
