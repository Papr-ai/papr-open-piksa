import { ThinkBlock } from './think-block';

interface ReasoningEvent {
  type: 'reasoning';
  content: {
    text: string;
    timestamp: string;
    step: 'start' | 'init' | 'search' | 'complete' | 'error' | 'think' | 'reading';
    duration?: number;
  };
}

export function ThinkingBlockList({ events }: { events: ReasoningEvent[] }) {
  // Deduplicate events based on their text content
  // Accept both 'think' and 'complete' steps for reasoning content
  const uniqueEvents = events
    .filter(e => e.content.step === 'think' || e.content.step === 'complete')
    .reduce((unique, event) => {
      // Check if we already have an event with the same text content
      const exists = unique.some(e => e.content.text === event.content.text);
      if (!exists) {
        unique.push(event);
      }
      return unique;
    }, [] as ReasoningEvent[]);

  return (
    <>
      {uniqueEvents.map((event, idx) => (
        <ThinkBlock key={event.content.timestamp + idx} content={event.content.text} className="text-sm mt-2" />
      ))}
    </>
  );
} 