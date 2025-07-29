'use client';

import type { Attachment, UIMessage } from 'ai';
import { useChat } from '@ai-sdk/react';
import React, { useEffect, useState, useCallback, useRef } from 'react';
import useSWR, { useSWRConfig } from 'swr';
import type { Vote } from '@/lib/db/schema';
import { fetcher, generateUUID } from '@/lib/utils';
import { Artifact } from '@/components/artifact/artifact';
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

  const {
    messages,
    setMessages,
    handleSubmit,
    input,
    setInput,
    append,
    status,
    stop,
    reload,
  } = useChat({
    id,
    body: { id, selectedChatModel: selectedChatModel },
    initialMessages,
    experimental_throttle: 100,
    sendExtraMessageFields: true,
    generateId: generateUUID,
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
    onError: () => {
      toast.error('An error occurred, please try again!');
    },
  });
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

  const [attachments, setAttachments] = useState<Array<Attachment>>([]);
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
