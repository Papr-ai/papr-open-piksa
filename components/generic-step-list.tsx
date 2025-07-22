interface ReasoningEvent {
  type: 'reasoning';
  content: {
    text: string;
    timestamp: string;
    step: 'start' | 'init' | 'search' | 'complete' | 'error' | 'think' | 'reading';
    duration?: number;
  };
}

export function GenericStepList({ events }: { events: ReasoningEvent[] }) {
  return (
    <>
      {events.map((event, eventIndex) => (
        <div key={`generic-${eventIndex}`} className="text-sm">
          {event.content.text}
        </div>
      ))}
    </>
  );
} 