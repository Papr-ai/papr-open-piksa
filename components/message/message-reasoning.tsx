'use client';

import { useState, useEffect } from 'react';
import { ChevronDownIcon, LoaderIcon } from '../common/icons';
import { motion, AnimatePresence } from 'framer-motion';
import { Markdown } from '../common/markdown';
import { ReasoningHeader } from './reasoning-header';
import { ThinkingBlockList } from './thinking-block-list';
import { ToolGroupList } from '../tool-group-list';
import { MemoryResultsList } from '../memory/memory-results-list';
import { GenericStepList } from '../generic-step-list';

interface ReasoningEvent {
  type: 'reasoning';
  content: {
    text: string;
    timestamp: string;
    step: 'start' | 'init' | 'search' | 'complete' | 'error' | 'think' | 'reading';
    duration?: number;
  };
}

interface MessageReasoningProps {
  isLoading: boolean;
  reasoning: string;
  events?: ReasoningEvent[];
  userQuery?: string;
  selectedModelId?: string;
}

export function MessageReasoning({
  isLoading,
  reasoning,
  events = [],
  userQuery = '',
  selectedModelId,
}: MessageReasoningProps & { selectedModelId?: string }) {
  // We no longer need to skip rendering for non-reasoning models
  // as the parent component will decide whether to render us or not
  
  const [isExpanded, setIsExpanded] = useState(false);
  const [prevEventsLength, setPrevEventsLength] = useState(events.length);
  const [wasPreviouslyLoading, setWasPreviouslyLoading] = useState(isLoading);

  // Add debug logging
  useEffect(() => {
    console.log('[MessageReasoning] Props:', {
      isLoading,
      reasoning,
      events: events.length,
      eventDetails: events,
      userQuery,
    });
  }, [isLoading, reasoning, events, userQuery]);

  // Auto-expand reasoning when loading or when important new events come in
  useEffect(() => {
    if (isLoading) {
      setIsExpanded(true);
      setWasPreviouslyLoading(true);
    } else if (wasPreviouslyLoading && !isLoading) {
      // Auto-collapse when thinking is complete
      setIsExpanded(false);
      setWasPreviouslyLoading(false);
    }
    
    // Still expand for significant events even when not loading
    if (events.length > prevEventsLength) {
      // Check if the new events are significant enough to auto-expand
      const newEvents = events.slice(prevEventsLength);
      const hasSignificantNewEvent = newEvents.some(event => 
        // Auto-expand for errors or memory search results
        event.content.step === 'error' ||
        (event.content.text && (
          event.content.text.includes('Found') ||
          event.content.text.startsWith('✅') ||
          event.content.text.includes('Error')
        ))
      );
      
      if (hasSignificantNewEvent) {
        setIsExpanded(true);
      }
      
      setPrevEventsLength(events.length);
    }
  }, [isLoading, events.length, prevEventsLength, wasPreviouslyLoading]);

  const variants = {
    collapsed: {
      height: 0,
      opacity: 0,
      marginTop: 0,
      marginBottom: 0,
    },
    expanded: {
      height: 'auto',
      opacity: 1,
      marginTop: '1rem',
      marginBottom: '0.5rem',
    },
  };

  // Process events to ensure they're properly sorted by timestamp
  const sortedEvents = [...events].sort((a, b) => 
    new Date(a.content.timestamp).getTime() - new Date(b.content.timestamp).getTime()
  );

  // Filter out generic processing steps but keep meaningful steps
  const filteredEvents = sortedEvents.filter(event => {
    const text = event.content.text || '';
    
    // Always keep memory-related and thinking steps
    if (text.includes('memory') || 
        text.includes('memories') ||
        text.startsWith('🔍') || 
        text.startsWith('✅') ||
        event.content.step === 'think' ||
        event.content.step === 'reading' ||
        (text.length > 50 && !text.startsWith('Processing'))) {
      return true;
    }
    
    // Filter out generic processing placeholders
    return !(text === "Processing..." || 
             text === "Processing" ||
             text.startsWith("Processing step") ||
             text === "");
  });
  
  // Group events into steps - uses a map to group by step type
  const stepGroups = filteredEvents.reduce((groups, event) => {
    const step = event.content.step;
    if (!groups[step]) {
      groups[step] = [];
    }
    groups[step].push(event);
    return groups;
  }, {} as Record<string, ReasoningEvent[]>);

  // Get total duration if available
  const totalDuration = events.reduce((total, event) => {
    return total + (event.content.duration || 0);
  }, 0);

  // Detect if we have any memory search events
  const hasMemorySearch = events.some(event => 
    event.content.text && (
      event.content.text.includes('memory search') || 
      event.content.text.includes('memories')
    )
  );

  // Detect if memory search is complete
  const isMemorySearchComplete = events.some(event => 
    event.content.step === 'complete' && 
    event.content.text && 
    event.content.text.includes('Found')
  );
  
  // Detect if we have any tool calls
  const hasToolCalls = events.some(event => 
    event.content.text && (
      event.content.text.includes('tool call') || 
      event.content.text.includes('Calling') ||
      event.content.text.includes('Result from') ||
      event.content.text.startsWith('🔍') ||
      event.content.text.startsWith('✅')
    )
  );

  // Check if we have any think blocks
  const hasThinkBlocks = events.some(event => 
    event.content.text && (
      event.content.text.includes('<think>') ||
      event.content.step === 'think'
    )
  );

  // New: Helper to get total reasoning duration in seconds
  const getTotalReasoningDuration = () => {
    if (!events.length) return 0;
    // Use the max duration from events, or fallback to 0
    return (
      events.reduce((total, event) => total + (event.content.duration || 0), 0) / 1000
    );
  };

  // New: Helper to determine if we're actively thinking
  const isThinking = isLoading || events.some(e => e.content.step === 'think' && (!e.content.duration || e.content.duration === 0));

  // New: Only show one thinking block per message
  const firstThinkingEvent = events.find(e => e.content.step === 'think');

  // Get a summarized status text based on the latest event step
  const getStatusText = () => {
    if (events.length === 0) {
      return 'Thinking...';
    }
    
    // Check for reading memories event first - it should override other events
    const hasReadingStep = events.some(event => 
      event.content.step === 'reading' && 
      event.content.text && 
      event.content.text.includes('Reading memories')
    );
    
    if (hasReadingStep && !isLoading) {
      return 'Reading memories...';
    }
    
    // Find the latest event by timestamp
    const latestEvent = [...events].sort((a, b) => 
      new Date(b.content.timestamp).getTime() - new Date(a.content.timestamp).getTime()
    )[0];
    
    // Special handling for memory search 
    if (hasMemorySearch) {
      if (isMemorySearchComplete) {
        // If we have a specific result, show that
        const memCount = events.find(e => e.content.text && e.content.text.match(/Found (\d+) relevant/i))?.content.text.match(/Found (\d+) relevant/i);
        const count = memCount ? memCount[1] : '0';
        
        // If we're still loading after finding memories, show "Reading memories"
        if (isLoading) {
          return `Reading memories...`;
        }
        
        return `Found ${count} memories`;
      } else if (latestEvent.content.step === 'search') {
        return 'Searching memories...';
      } else if (latestEvent.content.step === 'error') {
        return 'Error searching memories';
      } else {
        return 'Accessing memories...';
      }
    }
    
    // Check if we have thinking/reasoning content
    const hasThinkingContent = events.some(event => 
      (event.content.step === 'think' || 
       (event.content.text && event.content.text.length > 50 && 
        !event.content.text.startsWith('🔍') && 
        !event.content.text.startsWith('✅')))
    );
    
    if (hasThinkingContent) {
      return 'Thinking...';
    }
    
    // Check for tool calls
    const hasToolCall = events.some(event =>
      event.content.text && (
        event.content.text.includes('tool call') ||
        event.content.text.includes('Calling')
      )
    );
    
    const hasToolResult = events.some(event =>
      event.content.text && event.content.text.includes('Result from')
    );
    
    if (hasToolCall) {
      if (hasToolResult) {
        return 'Processing results...';
      }
      return 'Processing tool call...';
    }
    
    switch (latestEvent.content.step) {
      case 'start': return 'Working...';
      case 'init': return 'Thinking...';
      case 'search': return 'Searching...';
      case 'reading': return 'Reading memories...';
      case 'think': return 'Thinking...';
      case 'complete': return totalDuration > 0 
        ? `Complete (${(totalDuration / 1000).toFixed(2)}s)`
        : 'Complete';
      case 'error': return 'Error during reasoning';
      default: return 'Thinking...';
    }
  };



  // Process tool call events
  const getToolCallEvents = () => {
    return events.filter(event => 
      event.content.text && (
        // Match any tool-related keywords
        event.content.text.includes('tool call') ||
        event.content.text.includes('getWeather') ||
        event.content.text.includes('createDocument') ||
        event.content.text.includes('updateDocument') ||
        event.content.text.includes('searchMemories') ||
        event.content.text.includes('get_memory') ||
        event.content.text.includes('function call') ||
        event.content.text.match(/calling\s+\w+/i) ||
        event.content.text.match(/using\s+\w+\s+tool/i)
      )
    );
  };
  
  // Get tool name from event text
  const getToolNameFromEvent = (text: string): string => {
    // Try to extract tool name using various patterns
    const toolNamePatterns = [
      /calling\s+(\w+)/i,
      /using\s+(\w+)/i,
      /tool\s+(\w+)/i,
      /(\w+)\s+tool/i,
      /(getWeather|createDocument|updateDocument|searchMemories|get_memory)/i
    ];
    
    for (const pattern of toolNamePatterns) {
      const match = text.match(pattern);
      if (match && match[1]) {
        return match[1];
      }
    }
    
    return "tool";
  };

  // Get friendly tool name for display
  const getToolDisplayName = (toolName: string): string => {
    const toolNameMap: Record<string, string> = {
      'getWeather': 'Weather',
      'createDocument': 'Create Document',
      'updateDocument': 'Update Document',
      'searchMemories': 'Search Memories',
      'get_memory': 'Search Memories'
    };
    
    return toolNameMap[toolName] || 
      toolName.replace(/([A-Z])/g, ' $1').replace(/^./, str => str.toUpperCase());
  };

  // Determine tool status from event
  const getToolStatus = (text: string): 'starting' | 'processing' | 'complete' | 'error' | 'thinking' => {
    if (text.includes('start') || text.includes('calling')) {
      return 'starting';
    } else if (text.includes('complete') || text.includes('result') || text.includes('Found')) {
      return 'complete';
    } else if (text.includes('error') || text.includes('failed')) {
      return 'error';
    } else if (text.includes('I need to') || text.includes('thinking')) {
      return 'thinking';
    } else {
      return 'processing';
    }
  };



  // Add thinking content for memory searches
  const enhanceToolEventsWithThinking = (toolEvents: ReasoningEvent[], toolName: string): ReasoningEvent[] => {
    // If this is a memory search, add thinking context at the beginning
    if (toolName === 'searchMemories' || toolName === 'get_memory') {
      const hasThinkingEvent = toolEvents.some(event => 
        event.content.step === 'think' || 
        (event.content.text && event.content.text.includes('I need to search'))
      );
      
      // Only add if there's no explicit thinking already
      if (!hasThinkingEvent) {
        // Extract query if possible
        const queryMatch = toolEvents.find(event => 
          event.content.text?.match(/query.*?['"](.*?)['"]/)
        )?.content.text?.match(/query.*?['"](.*?)['"]/);
        
        const query = queryMatch ? queryMatch[1] : "requested information";
        
        // Create a thinking event
        const thinkingEvent: ReasoningEvent = {
          type: 'reasoning',
          content: {
            text: `I need to search through memory to find ${query}. Let me look that up for you.`,
            timestamp: new Date(Date.now() - 1000).toISOString(), // Place before other events
            step: 'think'
          }
        };
        
        return [thinkingEvent, ...toolEvents];
      }
    }
    
    return toolEvents;
  };

  // Group tool events by tool name - update to include thinking context
  const groupToolEventsByTool = (events: ReasoningEvent[]): Record<string, ReasoningEvent[]> => {
    const groups = events.reduce((groups, event) => {
      if (!event.content.text) return groups;
      
      const toolName = getToolNameFromEvent(event.content.text);
      if (!groups[toolName]) {
        groups[toolName] = [];
      }
      groups[toolName].push(event);
      return groups;
    }, {} as Record<string, ReasoningEvent[]>);
    
    // Enhance memory search tool events with thinking context
    Object.keys(groups).forEach(toolName => {
      groups[toolName] = enhanceToolEventsWithThinking(groups[toolName], toolName);
    });
    
    return groups;
  };

  const toolCallEvents = getToolCallEvents();
  const toolGroups = groupToolEventsByTool(toolCallEvents);
  
  // Determine if we're actively searching memories
  const isActiveMemorySearch = events.some(event => 
    event.content.step === 'search' || 
    (event.content.step === 'start' && event.content.text && event.content.text.includes('memory search'))
  );
  
  // Determine if we should show the reasoning section
  // Only hide if the only event is a generic "Processing..." step AND no tool calls
  const shouldHideReasoningUI = events.length === 1 && 
    events[0].content.text === "Processing..." &&
    !isLoading &&
    !hasToolCalls;
    
  // Never hide reasoning if we've completed a memory search
  if (isMemorySearchComplete) {
    return (
      <div className="flex flex-col">
        <div className="flex flex-row gap-2 items-center">
          <div className="font-medium">
            {isLoading ? "Reading memories..." : `Found ${events.find(e => e.content.text && e.content.text.match(/Found (\d+) relevant/i))?.content.text.match(/Found (\d+) relevant/i)?.[1] || '0'} memories`}
          </div>

          {!isLoading && (
            <button
              data-testid="message-reasoning-toggle"
              type="button"
              className="cursor-pointer"
              onClick={() => {
                setIsExpanded(!isExpanded);
              }}
            >
              <ChevronDownIcon />
            </button>
          )}
        </div>

        <AnimatePresence initial={false}>
          {isExpanded && (
            <motion.div
              data-testid="message-reasoning"
              key="content"
              initial="collapsed"
              animate="expanded"
              exit="collapsed"
              variants={variants}
              transition={{ duration: 0.2, ease: 'easeInOut' }}
              style={{ overflow: 'hidden' }}
              className="pl-4 text-zinc-600 dark:text-zinc-400 border-l flex flex-col gap-4"
            >
              {/* Display only memory search results */}
              <div className="flex flex-col gap-2 mt-2">
                <div>
                  {events
                    .filter(event => 
                      event.content.text && (
                        event.content.text.includes('Found') ||
                        event.content.text.startsWith('✅')
                      )
                    )
                    .map((event, eventIndex) => (
                      <div
                        key={`memory-${eventIndex}`}
                        className="flex items-start gap-2 text-sm"
                      >
                        <div className="flex-1">
                          <span
                            className="inline-block px-1.5 py-0.5 rounded text-xs mr-2 bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200"
                          >
                            done
                          </span>
                          {event.content.text}
                          {event.content.duration && (
                            <span className="text-xs text-zinc-500 dark:text-zinc-400 ml-2">
                              ({(event.content.duration / 1000).toFixed(2)}s)
                            </span>
                          )}
                        </div>
                      </div>
                    ))}
                </div>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    );
  }
    
  if (shouldHideReasoningUI) {
    return null;
  }

  // Simplified tool call display function
  const formatToolCallDisplay = (toolName: string, text: string): string => {
    // For errors, create a user-friendly message
    if (text.includes('error') || text.includes('failed')) {
      return `Error accessing ${getToolDisplayName(toolName)}`;
    }
    
    // For tool calls with JSON arguments, clean up the display
    if (text.includes('query') && text.includes('maxResults')) {
      // Extract just the query parameter for memory searches
      const queryMatch = text.match(/query.*?['"](.*?)['"]/);
      if (queryMatch) {
        return `Searching for "${queryMatch[1]}"`;
      }
    }
    
    // For results, clean up the display
    if (text.includes('Result from')) {
      // If the result found memories
      if (text.includes('Found') && text.includes('relevant')) {
        const countMatch = text.match(/Found (\d+) relevant/i);
        if (countMatch) {
          return `Found ${countMatch[1]} memories`;
        }
      }
      
      // Generic result
      return `Processed ${getToolDisplayName(toolName)} request`;
    }
    
    // Clean up calling tool text
    if (text.includes('Calling')) {
      return `Using ${getToolDisplayName(toolName)}`;
    }
    
    // Default case - just return cleaned text
    return text
      .replace(/^(Calling|Using|Tool|Function call)\s+\w+\s*:?\s*/i, '')
      .replace(/^Result from\s+\w+\s*:?\s*/i, '')
      .replace(/^\{.*?\}$/, ''); // Remove pure JSON objects
  };

  // Helper: Only show the first unique thinking event (deduplicate)
  const getUniqueThinkingEvent = (events: ReasoningEvent[]) => {
    const seen = new Set();
    for (const e of events) {
      if (e.content.step === 'think' && !seen.has(e.content.text)) {
        seen.add(e.content.text);
        return e;
      }
    }
    return null;
  };

  // Helper: For tool calls, only show thinking if not already shown in main
  const getToolThinkingEvent = (toolEvents: ReasoningEvent[], mainThinkingText: string | null) => {
    return toolEvents.find(e => e.content.step === 'think' && e.content.text !== mainThinkingText) || null;
  };

  // Helper: Only show spinner if no complete or error event
  const isStepLoading = (events: ReasoningEvent[]) => {
    return !events.some(e => e.content.step === 'complete' || e.content.step === 'error');
  };

  // Main unique thinking event
  const mainThinkingEvent = getUniqueThinkingEvent(events);
  const mainThinkingText = mainThinkingEvent ? mainThinkingEvent.content.text : null;

  // Compute status text for header - modified to use "Thoughts" when complete
  // Only show "Thinking..." if we're actively in the thinking state
  const hasStartedReasoning = events.some(e => 
    e.content.step !== 'init' && 
    e.content.text && 
    e.content.text !== 'Processing...'
  );
  
  const statusText = isLoading && hasStartedReasoning
    ? 'Thinking...'
    : isLoading && !hasStartedReasoning
    ? 'Processing...'
    : `Thoughts`;

  // Prepare event lists for subcomponents
  const thinkingEvents = events.filter(e => e.content.step === 'think');
  const memoryEvents = events.filter(event =>
    event.content.text && (
      event.content.text.includes('Found') ||
      event.content.text.startsWith('✅')
    )
  );
  const genericEvents = Object.entries(stepGroups)
    .filter(([step, _]) => !['think', 'search', 'start', 'complete', 'reading'].includes(step))
    .flatMap(([_, stepEvents]) => stepEvents)
    .filter(event =>
      event.content.text &&
      !(event.content.text === 'Processing...' ||
        event.content.text === 'Processing' ||
        event.content.text.startsWith('Processing step'))
    );

  return (
    <div className="flex flex-col mt-2">
      <ReasoningHeader
        statusText={statusText}
        isExpanded={isExpanded}
        onToggle={() => setIsExpanded(!isExpanded)}
      />
      <AnimatePresence initial={false}>
        {isExpanded && (
          <motion.div
            data-testid="message-reasoning"
            key="content"
            initial="collapsed"
            animate="expanded"
            exit="collapsed"
            variants={variants}
            transition={{ duration: 0.2, ease: 'easeInOut' }}
            style={{ overflow: 'hidden' }}
            className="text-zinc-600 dark:text-zinc-400 flex flex-col gap-1"
          >
            <ThinkingBlockList events={thinkingEvents} />
            <ToolGroupList groups={toolGroups} />
            <MemoryResultsList events={memoryEvents} />
            <GenericStepList events={genericEvents} />
            {/* Display base reasoning if no step groups */}
            {Object.entries(stepGroups).length === 0 && reasoning && (
              <Markdown>{reasoning}</Markdown>
            )}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
