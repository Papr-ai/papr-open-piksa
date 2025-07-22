interface ReasoningEvent {
  type: 'reasoning';
  content: {
    text: string;
    timestamp: string;
    step: 'start' | 'init' | 'search' | 'complete' | 'error' | 'think' | 'reading';
    duration?: number;
  };
}

export function MemoryResultsList({ events }: { events: ReasoningEvent[] }) {
  return (
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
  );
} 