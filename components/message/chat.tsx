'use client';

import type { FileUIPart, UIMessage } from 'ai';
import { DefaultChatTransport, TextStreamChatTransport } from 'ai';

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
import { useIsMobile } from '@/hooks/use-mobile';
import { useContext } from '@/hooks/use-context';

// Simple analytics hook (no-op for now)
const useAnalytics = () => ({
  trackChatEvent: (event: string, properties: any) => {
    console.log('Analytics event:', event, properties);
  },
  trackFeatureUsage: (feature: string, properties: any) => {
    console.log('Analytics feature usage:', feature, properties);
  }
});

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
  bookId,
}: {
  id: string;
  initialMessages: Array<UIMessage>;
  selectedChatModel: string;
  selectedVisibilityType: VisibilityType;
  isReadonly: boolean;
  documentId?: string;
  bookId?: string;
}) {
  // Debug initial messages for artifact restoration
  console.log('[Chat] Initializing with messages:', {
    messageCount: initialMessages?.length || 0,
    hasToolCalls: initialMessages?.some((msg: any) => (msg.toolCalls?.length > 0) || (msg.tool_calls?.length > 0)),
    toolCallTypes: initialMessages?.flatMap((msg: any) => 
      (msg.toolCalls?.map((tc: any) => tc.toolName || tc.function?.name) || [])
        .concat(msg.tool_calls?.map((tc: any) => tc.toolName || tc.function?.name) || [])
    ),
    bookId,
    documentId
  });

  // Debug tool call structure
  const messagesWithToolCalls = initialMessages?.filter((msg: any) => 
    (msg.toolCalls?.length > 0) || (msg.tool_calls?.length > 0)
  ) || [];
  
  if (messagesWithToolCalls.length > 0) {
    const firstMsg = messagesWithToolCalls[0] as any;
    console.log('[Chat] Sample tool call structures:', {
      firstMessageWithToolCalls: {
        id: firstMsg?.id,
        role: firstMsg?.role,
        toolCalls: firstMsg?.toolCalls,
        tool_calls: firstMsg?.tool_calls,
        parts: firstMsg?.parts?.slice(0, 2) // First 2 parts for brevity
      }
    });

    // Look for createBookArtifact parts specifically
    const createBookMessages = messagesWithToolCalls.filter((msg: any) => 
      msg.tool_calls?.some((tc: any) => tc.function?.name === 'createBookArtifact')
    );
    
    if (createBookMessages.length > 0) {
      const bookMsg = createBookMessages[0] as any;
      console.log('[Chat] createBookArtifact message parts:', {
        messageId: bookMsg.id,
        partsCount: bookMsg.parts?.length,
        partTypes: bookMsg.parts?.map((p: any) => ({ type: p.type, state: p.state })),
        toolResultParts: bookMsg.parts?.filter((p: any) => p.type?.includes('createBookArtifact'))
      });
    }
  }

  // Mobile detection hook
  const isMobile = useIsMobile();
  
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

  // Track picture book state from sessionStorage
  const [isPictureBook, setIsPictureBook] = useState(false);
  const isPictureBookRef = useRef(false);

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
  
  // Analytics tracking
  const { trackChatEvent, trackFeatureUsage } = useAnalytics();
  
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

  // Read picture book flag from sessionStorage on mount
  useEffect(() => {
    const pictureBookFlag = sessionStorage.getItem(`is-picture-book-${id}`);
    if (pictureBookFlag !== null) {
      const isPictureBookValue = pictureBookFlag === 'true';
      setIsPictureBook(isPictureBookValue);
      isPictureBookRef.current = isPictureBookValue;
      console.log('[Chat] Picture book flag loaded from sessionStorage:', isPictureBookValue);
      // Clean up sessionStorage after reading
      sessionStorage.removeItem(`is-picture-book-${id}`);
    }
  }, [id]);

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
    experimental_throttle: 50, // Add throttle to accumulate deltas into larger chunks (50ms)
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
        const currentPictureBookState = isPictureBookRef.current;
        console.log('[Chat] Sending headers with memory enabled:', currentMemoryState);
        console.log('[Chat] Sending headers with web search enabled:', currentWebSearchState);
        console.log('[Chat] Sending headers with picture book mode:', currentPictureBookState);
        console.log('[Chat] Sending headers with bookId:', bookId);
        return {
          'X-Memory-Enabled': currentMemoryState ? 'true' : 'false',
          'X-Web-Search-Enabled': currentWebSearchState ? 'true' : 'false',
          'X-Is-Picture-Book': currentPictureBookState ? 'true' : 'false',
          'X-Context': selectedContextsRef.current.length > 0 ? JSON.stringify(selectedContextsRef.current) : '',
          'X-Interaction-Mode': 'chat',
          'X-Book-Id': bookId || '',
        };
      },
    }),

    onFinish: (finishInfo) => {
      console.log('[Chat] useChat onFinish called with:', finishInfo);
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
    onData: (data) => {
      console.log('[Chat] 📊 onData called with:', data);
    },
    onToolCall: (toolCall) => {
      console.log('[Chat] 🔧 onToolCall called with:', toolCall);
    },
    onError: (error: any) => {
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

  // Track status changes for debugging
  const prevStatusRef = useRef(status);
  useEffect(() => {
    if (prevStatusRef.current !== status) {
      console.log(`[Chat] 🚦 STATUS CHANGE: ${prevStatusRef.current} -> ${status}`);
      prevStatusRef.current = status;
    }
  }, [status]);

  // Log the selected model for debugging
  useEffect(() => {
    console.log('[Chat] Selected model:', selectedChatModel);
  }, [selectedChatModel]);

  // Handle input state separately in AI SDK 5.0
  const [input, setInput] = useState('');

  // Auto-submit initial prompt from book wizard if available
  useEffect(() => {
    const initialPrompt = sessionStorage.getItem(`initial-prompt-${id}`);
    if (initialPrompt && messages.length === 0) {
      // Clear the stored prompt
      sessionStorage.removeItem(`initial-prompt-${id}`);
      
      // Set the input and submit the message
      setInput(initialPrompt);
      
      // Submit after a brief delay to ensure the input is set
      setTimeout(() => {
        sendMessage({ 
          role: 'user', 
          parts: [{ type: 'text', text: initialPrompt }] 
        });
        setInput(''); // Clear input after sending
      }, 100);
    }
  }, [id, messages.length, sendMessage, setInput]);

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

  // Auto-open book workflow artifact when bookId is provided
  useEffect(() => {
    console.log('[Chat] useEffect triggered with:', { 
      bookId, 
      hasSession: !!session, 
      userId: session?.user?.id,
      willRun: !!(bookId && session?.user?.id)
    });
    
    if (bookId && session?.user?.id) {
      console.log('[Chat] Auto-opening book workflow artifact for bookId:', bookId);
      
      // Directly open the book creation artifact without sending a message
      const openBookArtifact = async () => {
        try {
          // Call the API to get the workflow state (since getWorkflowFromDatabase needs server-side access)
          console.log('[Chat] Loading workflow state for bookId:', bookId);
          
          // Add timeout to prevent infinite loading
          const controller = new AbortController();
          const timeoutId = setTimeout(() => controller.abort(), 10000); // 10 second timeout
          
          const response = await fetch(`/api/books/${bookId}/workflow-progress`, {
            signal: controller.signal
          });
          
          clearTimeout(timeoutId);
          console.log('[Chat] Workflow progress response status:', response.status);
          
          if (response.ok) {
            const data = await response.json();
            console.log('[Chat] Workflow progress data:', data);
            
            if (data.workflowState) {
              console.log('[Chat] Found workflow state, creating artifact:', {
                bookTitle: data.workflowState.bookTitle,
                stepsCount: data.workflowState.steps?.length,
                steps: data.workflowState.steps?.map((s: any) => ({ 
                  stepNumber: s.stepNumber, 
                  stepName: s.stepName, 
                  status: s.status, 
                  hasData: !!s.data 
                }))
              });
              
              // Create the artifact directly
              setArtifact({
                documentId: bookId,
                kind: 'book-creation',
                content: JSON.stringify(data.workflowState),
                title: `📖 ${data.workflowState.bookTitle || 'Book Creation Workflow'}`,
                isVisible: true,
                status: 'idle',
                boundingBox: {
                  top: 100,
                  left: 100,
                  width: 800,
                  height: 600,
                },
              });
              
              // Store book context for system prompt enhancement (no visible message)
              // The book context will be sent via headers and processed by the API
              console.log('[Chat] Book context will be provided via system prompt enhancement');
            } else {
              console.log('[Chat] No workflow state found, checking for old book format...');
              await migrateOldBookToWorkflow(bookId);
            }
          } else {
            console.log('[Chat] Workflow progress API failed, checking for old book format...');
            await migrateOldBookToWorkflow(bookId);
          }
        } catch (error) {
          console.error('[Chat] Error loading book workflow:', error);
          
          // Check if it was a timeout
          if (error instanceof Error && error.name === 'AbortError') {
            console.error('[Chat] Request timed out after 10 seconds');
          }
          
          // Try to migrate as fallback
          await migrateOldBookToWorkflow(bookId);
        }
      };
      
      const migrateOldBookToWorkflow = async (bookId: string) => {
        try {
          console.log('[Chat] Attempting to migrate old book to workflow format...');
          
          // Check if book has chapters but no Chapter 0 (workflow metadata)
          const chaptersResponse = await fetch(`/api/books?bookId=${encodeURIComponent(bookId)}`);
          console.log('[Chat] Chapters API response:', chaptersResponse.status, chaptersResponse.statusText);
          
          if (!chaptersResponse.ok) {
            console.error('[Chat] Failed to fetch chapters for migration:', chaptersResponse.statusText);
            return;
          }
          
          const chapters = await chaptersResponse.json();
          console.log('[Chat] Found chapters for migration:', chapters.length);
          
          // Check if Chapter 0 exists
          const hasWorkflowMetadata = chapters.some((ch: any) => ch.chapterNumber === 0);
          const hasContentChapters = chapters.some((ch: any) => ch.chapterNumber > 0);
          
          if (!hasWorkflowMetadata && hasContentChapters) {
            console.log('[Chat] Old book format detected - has content chapters but no workflow metadata');
            
            // Get the first chapter for book title
            const firstChapter = chapters.find((ch: any) => ch.chapterNumber === 1);
            const bookTitle = firstChapter?.bookTitle || 'Migrated Book';
            
            // Create workflow state for old book
            const workflowState = {
              bookId: bookId,
              bookTitle: bookTitle,
              bookConcept: 'Migrated from old book format - existing content available in Step 5',
              targetAge: '3-8 years',
              currentStep: 5, // Start at Step 5 since content already exists
              steps: [
                { stepNumber: 1, stepName: 'Story Planning', status: 'approved', data: null },
                { stepNumber: 2, stepName: 'Character Creation', status: 'approved', data: null },
                { stepNumber: 3, stepName: 'Chapter Writing', status: 'approved', data: null },
                { stepNumber: 4, stepName: 'Environment Design', status: 'approved', data: null },
                { stepNumber: 5, stepName: 'Scene Composition', status: 'completed', data: { chapters: [] } },
                { stepNumber: 6, stepName: 'Final Review', status: 'pending', data: null }
              ],
              createdAt: new Date(),
              updatedAt: new Date()
            };
            
            console.log('[Chat] Created workflow state for migration:', workflowState);
            
            // Open the workflow artifact with migrated state
            setArtifact({
              documentId: bookId,
              kind: 'book-creation',
              content: JSON.stringify(workflowState),
              title: `📖 ${bookTitle} (Migrated)`,
              isVisible: true,
              status: 'idle',
              boundingBox: {
                top: 100,
                left: 100,
                width: 800,
                height: 600,
              },
            });
            
            // Store book context for system prompt enhancement (no visible message)
            // The book context will be sent via headers and processed by the API
            console.log('[Chat] Book context for migrated book will be provided via system prompt enhancement');
            
            console.log('[Chat] ✅ Successfully migrated old book to workflow format');
          } else if (hasContentChapters) {
            console.log('[Chat] Book already has workflow format or no migration needed');
          } else {
            console.log('[Chat] No book content found for migration');
          }
        } catch (error) {
          console.error('[Chat] Error migrating old book:', error);
        }
      };
      
      openBookArtifact();
    }
  }, [bookId, session?.user?.id, setArtifact]);
  // Debug messages as they update - REMOVED TO PREVENT INFINITE LOOPS
  // This useEffect was causing infinite loops during streaming by triggering re-renders
  // useEffect(() => {
  //   const lastMessage = messages[messages.length - 1];
  //   console.log(`[Chat] 🔄 MESSAGES/STATUS UPDATE:`, { ... });
  // }, [messages, status]);

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
  const isArtifactVisible = artifact.isVisible;

  // Create handleSubmit function
  const handleSubmit = useCallback((e?: React.FormEvent) => {
    e?.preventDefault();
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
      
      // Track chat message event
      trackChatEvent('Message Sent', {
        message_length: input.length,
        has_attachments: attachments.length > 0,
        attachment_count: attachments.length,
        has_context: selectedContexts.length > 0,
        context_count: selectedContexts.length,
        chat_id: id,
        model: selectedChatModel,
      });
      
      sendMessage({ role: 'user', parts });
      setInput('');
    }
  }, [input, sendMessage, selectedContexts, attachments, trackChatEvent, id, selectedChatModel]);

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
        {/* Messages area - takes remaining space and scrolls */}
        <div className="flex-1 overflow-y-auto w-full min-h-0">
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
            setInput={setInput}
            handleSubmit={handleSubmit}
            sendMessage={sendMessage}
            bookId={bookId}
          />
        </div>

        {/* Fixed bottom section - voice indicators, usage warning, and input */}
        <div className="flex-shrink-0">
          {/* Voice Activity Indicators */}
          {voiceState.isConnecting && (
            <div className={`mx-auto px-4 mb-2 ${isMobile ? 'w-full' : 'w-[70%]'}`}>
              <div className="flex items-center justify-center p-4 bg-gray-50 border border-gray-200 rounded-lg">
                <div className="flex items-center gap-3">
                  <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-gray-500"></div>
                  <span className="text-sm font-medium text-gray-700">Connecting to voice chat...</span>
                </div>
              </div>
            </div>
          )}
          
          {voiceState.isRecording && !voiceState.isMuted && (
            <div className={`mx-auto px-4 mb-2 ${isMobile ? 'w-full' : 'w-[70%]'}`}>
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
                
                {/* Audio waveform animation - hide on very small screens */}
                {!isMobile && (
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
                )}
              </div>
            </div>
          )}
          
          {voiceState.isPlaying && (
            <div className={`mx-auto px-4 mb-2 ${isMobile ? 'w-full' : 'w-[70%]'}`}>
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
                
                {/* Speaking animation - hide on very small screens */}
                {!isMobile && (
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
                )}
              </div>
            </div>
          )}

          {/* Usage Warning */}
          <div className={`mx-auto ${isMobile ? 'px-4 w-full' : 'px-7 w-[70%]'}`}>
            <UsageWarning />
          </div>

          {/* Chat Input Form - Fixed at bottom when no artifact */}
          {!isArtifactVisible && (
            <form 
              className={`flex mx-auto px-4 pb-4 md:pb-6 gap-2 ${isMobile ? 'w-full' : 'w-[70%]'}`}
              onSubmit={onSubmit}
              data-chat-form
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
          )}
        </div>
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
