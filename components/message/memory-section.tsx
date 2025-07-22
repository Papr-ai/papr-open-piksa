'use client';

import { ChatMemoryResults } from '../chat-memory-results';
import type { UIMessage } from 'ai';

interface MemorySectionProps {
  message: UIMessage;
}

export function MemorySection({ message }: MemorySectionProps) {
  if (message.role !== 'assistant') return null;

  return <ChatMemoryResults message={message as any} />;
} 