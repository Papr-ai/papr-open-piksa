import { useEffect, useState } from 'react';
import { MemoryResults } from './memory-results';
import type { ExtendedUIMessage } from '@/lib/types';

interface ChatMemoryResultsProps {
  aiState: {
    messages: ExtendedUIMessage[];
  };
}

export function ChatMemoryResults({ aiState }: ChatMemoryResultsProps) {
  const [memoryResults, setMemoryResults] = useState<any>(null);
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);

  // Extract memory search results from AI messages and tools
  useEffect(() => {
    if (!aiState?.messages) return;

    // Add debug logging to see all messages
    console.log('[Memory UI Debug] Total messages:', aiState.messages.length);

    // Check recent AI assistant messages for memory search tool usage
    const recentMessages = [...aiState.messages].reverse().slice(0, 5);

    // Log information about each message
    recentMessages.forEach((msg, idx) => {
      console.log(`[Memory UI Debug] Message #${idx + 1} role:`, msg.role);
      if (msg.tool_calls) {
        console.log(
          `[Memory UI Debug] Message #${idx + 1} has tool_calls:`,
          msg.tool_calls.length,
        );
        msg.tool_calls.forEach((tc, tcIdx) => {
          console.log(`[Memory UI Debug] Tool call #${tcIdx + 1}:`, {
            name: tc.function?.name,
            hasOutput: !!tc.function?.output,
          });
        });
      }
    });

    let foundMemories = null;
    let foundError = null;

    // Look for memory search results in tool_calls
    for (const message of recentMessages) {
      if (message.role !== 'assistant') continue;

      // Check for tool_calls (useChat properly structures these)
      if (message.tool_calls) {
        for (const toolCall of message.tool_calls) {
          if (
            toolCall.function?.name === 'searchMemories' &&
            toolCall.function?.output
          ) {
            try {
              console.log('[Memory UI] Found searchMemories tool call');
              console.log(
                '[Memory UI] Raw tool output:',
                toolCall.function.output,
              );
              const result = JSON.parse(toolCall.function.output);

              // Add more detailed logging
              console.log('[Memory UI] Tool output parsed:', result);
              console.log('[Memory UI] Tool output contents:', {
                hasMemories: !!result.memories,
                memoryCount: result.memories?.length || 0,
                isArray: Array.isArray(result.memories),
                error: result.error,
              });

              // Check if we have memory results
              if (result.memories && Array.isArray(result.memories)) {
                console.log(
                  `[Memory UI] Found ${result.memories.length} memories in tool call result`,
                );

                // Simply pass the raw memory result, let MemoryResults component handle parsing
                foundMemories = result;

                break;
              }

              // Check for errors
              if (result.error) {
                foundError = result.error;
              }
            } catch (err) {
              console.error('Error parsing memory search results:', err);
            }
          }
        }
      }

      // If we found memories, no need to check more messages
      if (foundMemories) break;
    }

    // Update state with found results
    setMemoryResults(foundMemories);
    setError(foundError);
    setIsLoading(false);
  }, [aiState?.messages]);

  // Don't render anything if there are no memory results
  if (
    !memoryResults ||
    !memoryResults.memories ||
    memoryResults.memories.length === 0
  ) {
    // Log why we're not showing results
    console.log('[Memory UI] Not showing memory results because:', {
      noResults: !memoryResults,
      noMemoriesProperty: memoryResults && !memoryResults.memories,
      emptyMemoriesArray: memoryResults?.memories?.length === 0,
    });
    return null;
  }

  return (
    <div className="bg-muted/30 rounded-lg p-4 mb-4">
      <h3 className="text-sm font-medium mb-3">Related Memories</h3>
      <MemoryResults
        memories={memoryResults}
        isLoading={isLoading}
        error={error}
      />
    </div>
  );
}
