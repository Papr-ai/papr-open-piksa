import { useState } from 'react';
import { ThinkBlock } from './message/think-block';
import { ChevronDownIcon } from 'lucide-react';
import { Markdown } from './common/markdown';

interface ReasoningEvent {
  type: 'reasoning';
  content: {
    text: string;
    timestamp: string;
    step: 'start' | 'init' | 'search' | 'complete' | 'error' | 'think' | 'reading';
    duration?: number;
  };
}

function getToolStatus(text: string): 'starting' | 'processing' | 'complete' | 'error' | 'thinking' {
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
}

function getToolDisplayName(toolName: string): string {
  const toolNameMap: Record<string, string> = {
    'createDocument': 'Create Document',
    'updateDocument': 'Update Document',
    'searchMemories': 'Search Memories',
    'get_memory': 'Search Memories'
  };
  return toolNameMap[toolName] || toolName.replace(/([A-Z])/g, ' $1').replace(/^./, str => str.toUpperCase());
}

// Extract the tool action name from the first event (e.g., searchMemories)
function getToolActionName(toolEvents: ReasoningEvent[]): string {
  // Try to extract from the first event's text
  const first = toolEvents[0]?.content.text || '';
  // Look for patterns like 'Calling searchMemories'
  const match = first.match(/Calling ([a-zA-Z0-9_]+)/);
  if (match && match[1]) return match[1];
  // Fallback: use the toolName from the group key (handled in parent)
  return '';
}

export function ToolGroupList({ groups }: { groups: Record<string, ReasoningEvent[]> }) {
  const [expanded, setExpanded] = useState<Record<string, boolean>>({});

  const toggle = (toolName: string) => {
    setExpanded(prev => ({ ...prev, [toolName]: !prev[toolName] }));
  };

  return (
    <div className="mt-2">
      {Object.entries(groups).map(([toolName, toolEvents], groupIndex) => {
        if (!toolEvents.length) return null;
        const latestEvent = [...toolEvents].sort((a, b) =>
          new Date(b.content.timestamp).getTime() - new Date(a.content.timestamp).getTime()
        )[0];
        const toolStatus = getToolStatus(latestEvent?.content.text || '');
        const hasError = toolEvents.some(event =>
          event.content.text && (
            event.content.text.includes('error') ||
            event.content.text.includes('failed')
          )
        );
        
        // Deduplicate tool thinking events by content
        const uniqueToolThinkingEvents = toolEvents
          .filter(e => e.content.step === 'think')
          .reduce((unique, event) => {
            // Check if we already have an event with the same text content
            const exists = unique.some(e => e.content.text === event.content.text);
            if (!exists) {
              unique.push(event);
            }
            return unique;
          }, [] as ReasoningEvent[]);
        
        const displayEvents = toolEvents.filter(e => e.content.step !== 'think');
        const isOpen = expanded[toolName] ?? false;
        const toolActionName = getToolActionName(toolEvents) || toolName;
        return (
          <div
            key={`tool-group-${groupIndex}`}
            className={
              isOpen
                ? 'mb-1 border border-zinc-200 dark:border-zinc-800 rounded-md'
                : 'mb-1'
            }
          >
            <div
              className={
                'text-xs font-medium flex bg-zinc-100 dark:bg-zinc-900 items-center gap-2 mb-1 p-3 cursor-pointer border-b border-zinc-200 dark:border-zinc-800 ' +
                (!isOpen ? 'border border-zinc-200 dark:border-zinc-800 rounded-md' : '')
              }
              onClick={() => toggle(toolName)}
            >
              <span>{`Calling '${toolActionName}'`}</span>
              <span className={`transition-transform ${isOpen ? '' : 'rotate-180'}`}>
                <ChevronDownIcon className="w-4 h-4" />
              </span>
            </div>
            {isOpen && (
              <div className="pl-2 flex flex-col gap-1">
                {uniqueToolThinkingEvents.map((event, idx) => (
                  <ThinkBlock key={event.content.timestamp + idx} content={event.content.text} className="text-sm mb-2" />
                ))}
                {displayEvents.map((event, idx) => (
                  <div className="flex items-start gap-2 text-sm mb-1" key={event.content.timestamp + idx}>
                    <div className="flex-1">
                      {hasError ? (
                        <span className="inline-block px-1.5 py-0.5 rounded text-xs mr-2 bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200">
                          error
                        </span>
                      ) : (
                        toolStatus === 'complete' && (
                          <span className="inline-block px-1.5 py-0.5 rounded text-xs mr-2 bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200">
                            done
                          </span>
                        )
                      )}
                      <Markdown>{event.content.text}</Markdown>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
} 