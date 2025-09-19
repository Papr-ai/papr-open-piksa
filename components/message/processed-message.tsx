'use client';

import { useMemo } from 'react';
import { Markdown } from '../common/markdown';
import { ThinkBlock, processThinkBlocks } from './think-block';
import { TaskCard, detectTaskTrackerData } from '../task-card';
import { MemoryCard, detectMemoryData } from '../memory-card';

interface ProcessedMessageProps {
  content: string;
  isAssistantMessage?: boolean;
}

export function ProcessedMessage({ content, isAssistantMessage = false }: ProcessedMessageProps) {
  // Check for task tracker data
  const taskData = useMemo(() => {
    return detectTaskTrackerData(content);
  }, [content]);

  // Check for memory data
  const memoryData = useMemo(() => {
    return detectMemoryData(content);
  }, [content]);

  // Process think blocks for assistant messages
  const processedContent = useMemo(() => {
    if (isAssistantMessage) {
      return processThinkBlocks(content);
    }
    return { content, thinkBlocks: [] };
  }, [content, isAssistantMessage]);

  return (
    <div className="space-y-4">
      {/* Render think blocks first */}
      {processedContent.thinkBlocks.map((block, index) => (
        <ThinkBlock key={index} content={block.content} />
      ))}

      {/* Render task card if detected */}
      {taskData && (
        <TaskCard {...taskData} />
      )}

      {/* Render memory card if detected */}
      {memoryData && (
        <MemoryCard {...memoryData} />
      )}

      {/* Render the main content */}
      <Markdown>{'processedText' in processedContent ? processedContent.processedText : processedContent.content}</Markdown>
    </div>
  );
}