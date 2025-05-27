import { useEffect, useState, useRef } from 'react';
import type { ExtendedUIMessage } from '@/lib/types';
import { FileIcon } from './icons';
import { MemoryDrawer } from './memory-drawer';
import { useThinkingState } from '@/lib/thinking-state';

interface ChatMemoryResultsProps {
  message: ExtendedUIMessage;
}

// Create a global cache to track messages with no memories
const NO_MEMORY_MESSAGES = new Set<string>();
// Create a global cache to track messages with memories
const HAS_MEMORY_MESSAGES = new Set<string>();
// Track rendered memory components by message ID
const RENDERED_MEMORY_COMPONENTS = new Set<string>();

export function ChatMemoryResults({ message }: ChatMemoryResultsProps) {
  const [isDrawerOpen, setIsDrawerOpen] = useState(false);
  const [memories, setMemories] = useState<Array<any>>([]);
  const [memoryCount, setMemoryCount] = useState(0);
  const [isLoading, setIsLoading] = useState(false);
  const { setThinkingState } = useThinkingState();
  // Add a ref to track if this is the first render
  const isFirstRender = useRef(true);
  const messageId = ((message as any).objectId || message.id) as string;

  // Function to store memories in localStorage for fast retrieval
  const storeMemoriesInLocalStorage = (messageId: string, memoriesData: any[]) => {
    try {
      localStorage.setItem(`memory-${messageId}`, JSON.stringify(memoriesData));
      console.log(`[MEMORY] Stored ${memoriesData.length} memories for message ${messageId} in localStorage`);
    } catch (err) {
      console.error('[MEMORY] Error storing memories in localStorage:', err);
    }
  };

  // Function to fetch memories from localStorage
  const fetchMemoriesFromLocalStorage = (messageId: string) => {
    try {
      const storedMemories = localStorage.getItem(`memory-${messageId}`);
      if (storedMemories) {
        const parsedMemories = JSON.parse(storedMemories);
        console.log(`[MEMORY] Retrieved ${parsedMemories.length} memories for message ${messageId} from localStorage`);
        return parsedMemories;
      }
    } catch (err) {
      console.error('[MEMORY] Error retrieving memories from localStorage:', err);
    }
    return null;
  };

  // Prevent duplicate memory components
  useEffect(() => {
    // Skip if not first render
    if (!isFirstRender.current) return;
    isFirstRender.current = false;
    
    // If this message ID is already rendered, don't render it again
    if (RENDERED_MEMORY_COMPONENTS.has(messageId)) {
      console.log(`[MEMORY RESULTS] Skipping duplicate memory component for message ${messageId}`);
      // Force component to not render by setting memoryCount to 0
      setMemoryCount(0);
      return;
    }
    
    // Mark this message as rendered
    RENDERED_MEMORY_COMPONENTS.add(messageId);
    
    // Cleanup function to remove this message ID when component unmounts
    return () => {
      RENDERED_MEMORY_COMPONENTS.delete(messageId);
    };
  }, [messageId]);

  // Load memories directly from the message object or localStorage
  useEffect(() => {
    if (!message) return;

    // Skip user messages - only assistant messages have memories
    if (message.role === 'user') return;
    
    // Skip if we've already determined this is a duplicate
    if (RENDERED_MEMORY_COMPONENTS.has(messageId) && 
        document.querySelectorAll(`[data-memory-component="${messageId}"]`).length > 1) {
      return;
    }
    
    console.log(`[MEMORY] Processing message ${messageId} for memories`);
    
    // Start loading
    setIsLoading(true);
    setThinkingState('Searching memories...', 'memory_direct_load');
    
    // Check for memories in the message object itself (new approach)
    if ((message as any).memories && Array.isArray((message as any).memories)) {
      const memoriesFromMessage = (message as any).memories;
      console.log(`[MEMORY] Found ${memoriesFromMessage.length} memories directly in message object`);
      
      setMemories(memoriesFromMessage);
      setMemoryCount(memoriesFromMessage.length);
      
      // Store in localStorage for faster future access
      storeMemoriesInLocalStorage(messageId, memoriesFromMessage);
      
      setIsLoading(false);
      setThinkingState('Thinking...', 'memory_direct_found');
      return;
    }
    
    // Fallback to localStorage for previously stored memories
    const localStorageMemories = fetchMemoriesFromLocalStorage(messageId);
    if (localStorageMemories && localStorageMemories.length > 0) {
      console.log(`[MEMORY] Using ${localStorageMemories.length} memories from localStorage`);
      
      setMemories(localStorageMemories);
      setMemoryCount(localStorageMemories.length);
      
      setIsLoading(false);
      setThinkingState('Thinking...', 'memory_local_found');
      return;
    }
    
    // For compatibility with older messages, check for tool invocations with memory results
    const toolInvocations = (message as any).toolInvocations;
    if (toolInvocations?.length) {
      for (const invocation of toolInvocations) {
        if (
          (invocation.toolName === 'searchMemories' ||
            invocation.toolName === 'mcp_Papr_MCP_Server_get_memory') &&
          invocation.result?.memories?.length
        ) {
          try {
            const memoriesFromTool = invocation.result.memories;
            if (memoriesFromTool && memoriesFromTool.length > 0) {
              console.log(`[MEMORY] Found ${memoriesFromTool.length} memories in tool invocation`);
              
              // Store in localStorage for future access
              storeMemoriesInLocalStorage(messageId, memoriesFromTool);
              
              setMemories(memoriesFromTool);
              setMemoryCount(memoriesFromTool.length);
              
              setIsLoading(false);
              setThinkingState('Processing information...', 'memory_tool_found');
              return;
            }
          } catch (err) {
            console.error('[MEMORY] Error processing memory results from tool invocation:', err);
          }
        }
      }
    }
    
    // For compatibility with even older messages, check tool_calls
    const toolCalls = (message as any).tool_calls;
    if (toolCalls?.length) {
      for (const call of toolCalls) {
        if (
          call?.function?.name && 
          (call.function.name.includes('searchMemories') || call.function.name.includes('get_memory')) &&
          call.function?.output
        ) {
          try {
            const output = typeof call.function.output === 'string' 
              ? JSON.parse(call.function.output) 
              : call.function.output;
            
            if (output?.memories?.length) {
              const memoriesFromCall = output.memories;
              console.log(`[MEMORY] Found ${memoriesFromCall.length} memories in tool_calls output`);
              
              // Store in localStorage for future access
              storeMemoriesInLocalStorage(messageId, memoriesFromCall);
              
              setMemories(memoriesFromCall);
              setMemoryCount(memoriesFromCall.length);
              
              setIsLoading(false);
              setThinkingState('Processing information...', 'memory_call_found');
              return;
            }
          } catch (e) {
            console.error(`[MEMORY] Error parsing tool call output:`, e);
          }
        }
      }
    }
    
    // No memories found through any method
    console.log(`[MEMORY] No memories found for message ${messageId}`);
    setIsLoading(false);
    setThinkingState('Thinking...', 'memory_none_found');
  }, [message, messageId, setThinkingState]);

  if (memoryCount === 0 && !isLoading) return null;

  return (
    <>
      <div className="mt-2" data-memory-component={messageId}>
        <button
          type="button"
          onClick={() => setIsDrawerOpen(true)}
          className="bg-muted/50 cursor-pointer border py-2 px-3 rounded-xl w-fit flex flex-row gap-3 items-start hover:bg-muted/70 transition-colors"
          disabled={isLoading}
        >
          <div className="text-muted-foreground mt-1">
            <FileIcon />
          </div>
          <div className="text-left flex flex-col">
            <span className="font-medium">Related Memories</span>
            <span className="text-sm text-muted-foreground">
              {isLoading 
                ? "Loading memories..." 
                : `${memoryCount} ${memoryCount === 1 ? 'memory' : 'memories'} found - Click to view`}
            </span>
          </div>
        </button>
      </div>

      <MemoryDrawer 
        isOpen={isDrawerOpen}
        onClose={() => setIsDrawerOpen(false)}
        memories={memories}
      />
    </>
  );
}
