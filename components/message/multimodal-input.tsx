'use client';

import type { FileUIPart, UIMessage } from 'ai';
import type { UseChatHelpers } from '@ai-sdk/react'; 

import cx from 'classnames';
import type React from 'react';
import {
  useRef,
  useEffect,
  useState,
  useCallback,
  type Dispatch,
  type SetStateAction,
  type ChangeEvent,
  memo,
} from 'react';
import { toast } from 'sonner';
import { useLocalStorage, useWindowSize } from 'usehooks-ts';
import { useIsMobile } from '@/hooks/use-mobile';

import { ArrowUpIcon, PaperclipIcon, StopIcon } from '@/components/common/icons';
import { PreviewAttachment } from '@/components/message/preview-attachment';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import equal from 'fast-deep-equal';
import { MemoryToggle } from '@/components/memory/memory-toggle';
import { WebSearchToggle } from '@/components/message/web-search-toggle';
import { ModelSelector } from '@/components/message/model-selector';
import { VisibilitySelector } from '@/components/message/visibility-selector';
import type { VisibilityType } from '@/components/message/visibility-selector';
import { PageContext } from '@/types/app';
import { AddContextButton } from '@/components/message/context-chip';
import { useContext } from '@/hooks/use-context';
import { useArtifact } from '@/hooks/use-artifact';
import { VoiceButton } from '@/components/message/voice-button';
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip';

// Define interaction modes - simplified to just chat
export type InteractionMode = 'chat';

function PureMultimodalInput({
  chatId,
  input,
  setInput,
  status,
  stop,
  attachments,
  setAttachments,
  messages,
  setMessages,
  append,
  handleSubmit,
  className,
  selectedModelId,
  selectedVisibilityType,
  onVoiceStateChange,
}: {
  chatId: string;
  input: string;
  setInput: (input: string) => void;
  status: UseChatHelpers<UIMessage>['status'];
  stop: UseChatHelpers<UIMessage>['stop'];
  attachments: Array<FileUIPart>;
  setAttachments: Dispatch<SetStateAction<Array<FileUIPart>>>;
  messages: UseChatHelpers<UIMessage>['messages'];
  setMessages: UseChatHelpers<UIMessage>['setMessages'];
  append: UseChatHelpers<UIMessage>['sendMessage'];
  handleSubmit: (event?: any) => void;
  className?: string;
  selectedModelId: string;
  selectedVisibilityType: VisibilityType;
  onVoiceStateChange?: (state: any) => void;
}) {
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const { width } = useWindowSize();
  const isMobile = useIsMobile();
  
  // Use the artifact hook with chat ID for chat-specific artifacts
  const { artifact, setArtifact } = useArtifact(chatId);

  // Set interaction mode to just chat since we removed build mode
  const [interactionMode] = useLocalStorage<InteractionMode>('interaction-mode', 'chat');

  // Use the custom context hook
  const { 
    selectedContexts,
    updateContexts,
    clearContexts 
  } = useContext();

  // Track memory enabled state
  const [isMemoryEnabled, setIsMemoryEnabled] = useState(true);
  
  // Track web search enabled state
  const [isWebSearchEnabled, setIsWebSearchEnabled] = useState(false);

  // Track voice chat state for UI changes
  const [voiceState, setVoiceState] = useState({
    isConnected: false,
    isRecording: false,
    isPlaying: false,
    isConnecting: false,
    isMuted: false,
    error: null as string | null,
  });

  // Convert context images to attachments so they show previews and get sent to AI
  useEffect(() => {
    const contextImages = selectedContexts.filter(context => 
      context.type === 'image' && context.file?.url
    );
    
    if (contextImages.length === 0) {
      // No context images, just keep regular attachments
      const nonContextAttachments = attachments.filter(attachment => 
        !selectedContexts.some(context => context.file?.url === attachment.url)
      );
      if (nonContextAttachments.length !== attachments.length) {
        setAttachments(nonContextAttachments);
      }
      return;
    }
    
    const contextAttachments: Array<FileUIPart> = contextImages.map(context => {
      // Determine mediaType from file extension or default to image/jpeg
      const filename = context.file!.name;
      let mediaType = 'image/jpeg';
      if (filename.toLowerCase().endsWith('.png')) mediaType = 'image/png';
      else if (filename.toLowerCase().endsWith('.webp')) mediaType = 'image/webp';
      else if (filename.toLowerCase().endsWith('.gif')) mediaType = 'image/gif';
      
      return {
        type: 'file' as const,
        url: context.file!.url,
        filename: filename,
        mediaType,
      };
    });
    
    // Get non-context attachments (regular file uploads)
    const nonContextAttachments = attachments.filter(attachment => 
      !contextImages.some(context => context.file?.url === attachment.url)
    );
    
    // Merge both types of attachments
    const allAttachments = [...nonContextAttachments, ...contextAttachments];
    
    // Update if we need to add context attachments or remove ones that are no longer in context
    const needsUpdate = contextAttachments.some(contextAttachment => 
      !attachments.some(attachment => attachment.url === contextAttachment.url)
    ) || attachments.some(attachment => 
      selectedContexts.some(context => context.file?.url === attachment.url) &&
      !contextAttachments.some(contextAttachment => contextAttachment.url === attachment.url)
    );
    
    if (needsUpdate) {
      setAttachments(allAttachments);
    }
  }, [selectedContexts, attachments, setAttachments]);

  useEffect(() => {
    if (textareaRef.current) {
      adjustHeight();
    }
  }, []);

  const adjustHeight = () => {
    if (textareaRef.current) {
      textareaRef.current.style.height = 'auto';
      textareaRef.current.style.height = `${textareaRef.current.scrollHeight + 2}px`;
    }
  };

  const resetHeight = () => {
    if (textareaRef.current) {
      textareaRef.current.style.height = 'auto';
      // Use smaller initial height on mobile
      textareaRef.current.style.height = isMobile ? '60px' : '98px';
    }
  };
  const storageKey = `chat-input-${chatId}`;
  const [localStorageInput, setLocalStorageInput] = useLocalStorage(storageKey, '');

  // Initialize from localStorage after mount
  useEffect(() => {
    const storedMemoryValue = localStorage.getItem('memory-enabled');
    if (storedMemoryValue !== null) {
      setIsMemoryEnabled(storedMemoryValue === 'true');
    }

    const storedWebSearchValue = localStorage.getItem('web-search-enabled');
    if (storedWebSearchValue !== null) {
      setIsWebSearchEnabled(storedWebSearchValue === 'true');
    }

    // Add event listener for memory toggle changes
    const handleMemoryToggle = (event: CustomEvent) => {
      console.log('[MultimodalInput] Memory toggle changed:', event.detail.enabled);
      setIsMemoryEnabled(event.detail.enabled);
    };

    // Add event listener for web search toggle changes
    const handleWebSearchToggle = (event: CustomEvent) => {
      console.log('[MultimodalInput] Web search toggle changed:', event.detail.enabled);
      setIsWebSearchEnabled(event.detail.enabled);
    };

    window.addEventListener('memory-toggle-changed', handleMemoryToggle as EventListener);
    window.addEventListener('web-search-toggle-changed', handleWebSearchToggle as EventListener);

    return () => {
      window.removeEventListener('memory-toggle-changed', handleMemoryToggle as EventListener);
      window.removeEventListener('web-search-toggle-changed', handleWebSearchToggle as EventListener);
    };
  }, []);

  useEffect(() => {
    if (textareaRef.current) {
      const domValue = textareaRef.current.value;
      // Prefer DOM value over localStorage to handle hydration
      const finalValue = domValue || localStorageInput || '';
      setInput(finalValue);
      adjustHeight();
    }
    // Only run once after hydration
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    setLocalStorageInput(input);
  }, [input, setLocalStorageInput]);

  const handleInput = (event: React.ChangeEvent<HTMLTextAreaElement>) => {
    setInput(event.target.value);
    adjustHeight();
  };

  const fileInputRef = useRef<HTMLInputElement>(null);
  const [uploadQueue, setUploadQueue] = useState<Array<string>>([]);

  const submitForm = useCallback(() => {
    // Check if input is empty or just whitespace
    if (!input || input.trim().length === 0) {
      console.log('[MultimodalInput] Preventing empty message submission');
      return;
    }

    window.history.replaceState({}, '', `/chat/${chatId}`);

    // Prepare custom headers with memory, web search and context info
    console.log('[MULTIMODAL INPUT] Preparing headers with contexts:', selectedContexts.length, selectedContexts);
    const customHeaders: Record<string, string> = {
      'X-Memory-Enabled': isMemoryEnabled ? 'true' : 'false',
      'X-Web-Search-Enabled': isWebSearchEnabled ? 'true' : 'false',
      'X-Context': selectedContexts.length > 0 ? JSON.stringify(selectedContexts) : '',
      'X-Interaction-Mode': interactionMode,
    };
    console.log('[MULTIMODAL INPUT] Headers prepared:', customHeaders);

    // Submit the message with our custom headers
    handleSubmit();

    setAttachments([]);
    clearContexts(); // Clear selected contexts after submitting
    setLocalStorageInput('');
    resetHeight();

    if (width && width > 768) {
      textareaRef.current?.focus();
    }
  }, [
    input,
    attachments,
    handleSubmit,
    setAttachments,
    setLocalStorageInput,
    width,
    chatId,
    isMemoryEnabled,
    isWebSearchEnabled,
    selectedContexts,
    clearContexts,
    interactionMode,
  ]);

  const uploadFile = async (file: File) => {
    const formData = new FormData();
    formData.append('file', file);

    try {
      const response = await fetch('/api/files/upload', {
        method: 'POST',
        body: formData,
      });

      if (response.ok) {
        const data = await response.json();
        const { url, pathname, contentType } = data;

        return {
          type: 'file' as const,
          url,
          filename: pathname,
          mediaType: contentType,
        };
      }
      const { error } = await response.json();
      toast.error(error);
    } catch (error) {
      toast.error('Failed to upload file, please try again!');
    }
  };

  const handleFileChange = useCallback(
    async (event: ChangeEvent<HTMLInputElement>) => {
      const files = Array.from(event.target.files || []);

      setUploadQueue(files.map((file) => file.name));

      try {
        const uploadPromises = files.map((file) => uploadFile(file));
        const uploadedAttachments = await Promise.all(uploadPromises);
        const successfullyUploadedAttachments = uploadedAttachments.filter(
          (attachment) => attachment !== undefined,
        );

        setAttachments((currentAttachments) => [
          ...currentAttachments,
          ...successfullyUploadedAttachments,
        ]);
      } catch (error) {
        console.error('Error uploading files!', error);
      } finally {
        setUploadQueue([]);
      }
    },
    [setAttachments],
  );

  return (
    <div className="relative w-full flex flex-col gap-2 bg-background p-2 rounded-[15px] dark:border-zinc-700"
        style={{
          boxShadow: '0 -2px 10px hsl(var(--ring) / 0.1)',
        }}
      >
        {/* Add Context at the top */}
        <div className="flex flex-wrap items-center gap-1 mb-1">
          <AddContextButton
            selectedContexts={selectedContexts}
            onContextsChange={updateContexts}
          />
        </div>
      
      <div className="flex flex-col items-start w-full gap-2">
        <Textarea
          ref={textareaRef}
          tabIndex={0}
          placeholder="Ask anything"
          className={`flex-1 resize-none bg-background px-4 py-2 overflow-y-auto border-none focus:ring-0 focus-visible:ring-0 focus-visible:ring-offset-0 ${
            isMobile ? 'min-h-[36px] max-h-[180px] text-base' : 'min-h-[40px] max-h-[240px]'
          }`}
          value={input}          
          onChange={handleInput}
          onKeyDown={(event) => {
            if (
              event.key === 'Enter' &&
              !event.shiftKey &&
              !event.nativeEvent.isComposing &&
              status !== 'streaming' &&
              input && 
              input.trim().length > 0
            ) {
              event.preventDefault();
              submitForm();
            }
          }}
          disabled={status === 'streaming'}
        />
        <div className={`flex items-center justify-between gap-2 w-full ${isMobile ? 'flex-col space-y-2' : 'flex-row'}`}>
          <div className={`flex items-center gap-2 ${isMobile ? 'w-full justify-between' : ''}`}>
            <ModelSelector selectedModelId={selectedModelId} className={isMobile ? "h-8 flex-1 max-w-[120px]" : "h-8"} />
            <div className="flex items-center gap-1">
              <MemoryToggle />
              <WebSearchToggle />
            </div>
          </div>
          <div className={`flex flex-row pb-2 ${isMobile ? 'w-full justify-end' : 'justify-start'}`}>
            <div className={`flex flex-row justify-start gap-1 ${isMobile ? '' : 'ml-3 mr-2'}`}>
              <VoiceButton
                chatId={chatId}
                selectedModel={selectedModelId}
                isMemoryEnabled={isMemoryEnabled}
                isWebSearchEnabled={isWebSearchEnabled}
                disabled={status === 'streaming'}
                messages={messages}
                onVoiceMessage={(message) => {
                  setInput(message);
                  adjustHeight();
                }}
                onVoiceStateChange={useCallback((state: any) => {
                  console.log('[MultimodalInput] Received voice state:', state);
                  setVoiceState(state);
                  onVoiceStateChange?.(state);
                }, [onVoiceStateChange])}
              />
              {status === 'streaming' ? (
                <StopButton stop={stop} setMessages={setMessages} />
              ) : voiceState.isConnected ? (
                <StopVoiceButton onStop={() => {
                  // We need to trigger the voice disconnect
                  // Let's dispatch a custom event that the voice button can listen to
                  window.dispatchEvent(new CustomEvent('voice-disconnect'));
                }} />
              ) : (
                <SendButton
                  submitForm={submitForm}
                  input={input}
                  uploadQueue={uploadQueue}
                />
              )}
            </div>
          </div>
        </div>

      </div>

      {(attachments.length > 0 || uploadQueue.length > 0) && (
        <div className="flex flex-wrap gap-2 mt-2">
          {uploadQueue.map((id) => (
            <div
              key={id}
              className="flex items-center gap-1 bg-muted p-1 rounded-lg text-xs"
            >
              <div className="animate-pulse">Uploading...</div>
            </div>
          ))}
          {attachments.map((attachment) => (
            <PreviewAttachment
              key={attachment.filename || attachment.url}
              attachment={attachment}
              isUploading={false}
            />
          ))}
        </div>
      )}

      <input
        ref={fileInputRef}
        className="hidden"
        type="file"
        accept="image/jpeg,image/jpg,image/png,image/webp,image/gif"
        onChange={handleFileChange}
        tabIndex={-1}
        multiple
      />
    </div>
  );
}

export const MultimodalInput = memo(
  PureMultimodalInput,
  (prevProps, nextProps) => {
    if (prevProps.input !== nextProps.input) return false;
    if (prevProps.status !== nextProps.status) return false;
    if (!equal(prevProps.attachments, nextProps.attachments)) return false;

    return true;
  },
);



function PureStopButton({
  stop,
  setMessages,
}: {
  stop: () => void;
  setMessages: UseChatHelpers<UIMessage>['setMessages'];
}) {
  return (
    <Button
      type="button"
      data-testid="stop-button"
      className="rounded-full p-1.5 h-8 w-8 bg-red-500 hover:bg-red-600 text-white"
      onClick={(event) => {
        event.preventDefault();
        stop();
        // Just trigger a re-render without changing messages
      }}
    >
      <StopIcon size={16} />
    </Button>
  );
}

const StopButton = memo(PureStopButton);

function PureSendButton({
  submitForm,
  input,
  uploadQueue,
}: {
  submitForm: () => void;
  input: string;
  uploadQueue: Array<string>;
}) {
  return (
    <Button
      type="button"
      data-testid="send-button"
      className="rounded-full p-1.5 h-8 w-8 bg-blue-500 hover:bg-blue-600 text-white cursor-pointer z-10"
      onClick={(event) => {
        event.preventDefault();
        submitForm();
      }}
      disabled={!input || input.trim().length === 0 || uploadQueue.length > 0}
    >
      <ArrowUpIcon size={16} />
    </Button>
  );
}

const SendButton = memo(PureSendButton, (prevProps, nextProps) => {
  if (prevProps.uploadQueue.length !== nextProps.uploadQueue.length)
    return false;
  if (prevProps.input !== nextProps.input) return false;
  return true;
});

function PureStopVoiceButton({ onStop }: { onStop: () => void }) {
  return (
    <Button
      type="button"
      data-testid="stop-voice-button"
      className="rounded-full p-1.5 h-8 w-8 bg-red-500 hover:bg-red-600 text-white cursor-pointer z-10"
      onClick={(event) => {
        event.preventDefault();
        console.log('Stop voice chat clicked');
        onStop();
      }}
    >
      <StopIcon size={16} />
    </Button>
  );
}

const StopVoiceButton = memo(PureStopVoiceButton);
