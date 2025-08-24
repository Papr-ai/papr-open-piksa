import { useCallback, useState } from 'react';
import type { UseStreamChatReturn } from '@/types/app';

export function useStreamChat(): UseStreamChatReturn {
  const [reasoningSteps, setReasoningSteps] = useState<any[]>([]);
  
  const streamMessage = useCallback(
    async ({ prompt, chatId, model = 'gpt-4' }: { prompt: string; chatId: string; model?: string }) => {
      try {
        const response = await fetch(`/api/chat/${chatId}/stream`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ prompt, model }),
        });

        if (!response.ok) {
          throw new Error('Failed to stream message');
        }
        
        // Extract the response data
        const data = await response.json();
        
        // If we have a model interface that supports onStepFinish
        if (data.modelConfig) {
          const { generateText } = await import('ai');
          
          const result = await generateText({
            model: data.modelConfig.model,
            maxSteps: 10,
            messages: [{ role: 'user', content: prompt }],
            onStepFinish({ text, toolCalls, toolResults, finishReason, usage }) {
              if (!text && !toolCalls?.length) return; // Skip empty steps
              
              // Track reasoning steps - filter out empty/placeholder steps
              setReasoningSteps(prevSteps => {
                const stepContent = text?.trim() || JSON.stringify(toolCalls);
                if (stepContent && stepContent.length > 5) {
                  return [...prevSteps, {
                    step: prevSteps.length + 1,
                    text: text || `Using tool: ${toolCalls?.[0]?.toolName || 'unknown'}`,
                    toolCalls,
                    toolResults,
                    finishReason,
                    usage,
                    timestamp: new Date().toISOString()
                  }];
                }
                return prevSteps;
              });
              
              // Emit reasoning event to the stream
              if (toolCalls?.length > 0) {
                // Handle tool calls - track reasoning for tool usage
                toolCalls.forEach(toolCall => {
                  const toolName = toolCall.toolName;
                  const toolArgs = toolCall.input;
                  
                  console.log(`[Reasoning] Tool call: ${toolName}`, toolArgs);
                  
                  // If it's a memory tool, emit special reasoning events
                  if (toolName === 'searchMemories') {
                    fetch(`/api/memory/message/reasoning?chatId=${chatId}`, {
                      method: 'POST',
                      headers: { 'Content-Type': 'application/json' },
                      body: JSON.stringify({
                        type: 'reasoning',
                        content: {
                          text: `🔍 Searching memories with query: "${toolArgs.query}"`,
                          timestamp: new Date().toISOString(),
                          step: 'search'
                        }
                      })
                    });
                  }
                });
              } else if (text && text.trim()) {
                // Handle normal text steps - track LLM reasoning
                // Filter out short/generic messages
                const trimmedText = text.trim();
                if (trimmedText.length > 20 && 
                    !trimmedText.startsWith("Processing") && 
                    !trimmedText.startsWith("Step:")) {
                  fetch(`/api/memory/message/reasoning?chatId=${chatId}`, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                      type: 'reasoning',
                      content: {
                        text: trimmedText.substring(0, 500) + (text.length > 500 ? '...' : ''),
                        timestamp: new Date().toISOString(),
                        step: 'think'
                      }
                    })
                  });
                }
              }
            },
            ...data.modelConfig.options
          });
          
          return result;
        }
        
        return data;
      } catch (error) {
        console.error('Error streaming message:', error);
        throw error;
      }
    },
    [],
  );
  
  const getReasoningSteps = useCallback(() => reasoningSteps, [reasoningSteps]);
  
  return { streamMessage, reasoningSteps, getReasoningSteps };
}
