'use client';

import { ReactNode } from 'react';
import { Markdown } from './markdown';

interface ThinkBlockProps {
  content: string;
  className?: string;
}

export function ThinkBlock({ content, className = '' }: ThinkBlockProps) {
  // Clean up the content
  const cleanedContent = content
    .replace(/<think>([\s\S]*?)<\/think>/g, '$1') // Remove think tags if present
    .trim();

  if (!cleanedContent) return null;
  
  return (
    <div className={`border-l-2 border-blue-300 dark:border-blue-700 pl-3 py-1 text-blue-800 dark:text-blue-400 italic ${className}`}>
      <Markdown>{cleanedContent}</Markdown>
    </div>
  );
}

// Helper function to process text and extract think blocks
export function processThinkBlocks(text: string): { 
  processedText: string;
  thinkBlocks: { id: string; content: string }[];
} {
  // Define regex to match <think> blocks
  const thinkBlockRegex = /<think>([\s\S]*?)<\/think>/g;
  const thinkBlocks: { id: string; content: string }[] = [];
  const seenContents = new Set<string>();
  
  // Replace think blocks with placeholders and collect them
  const processedText = text.replace(thinkBlockRegex, (_, content) => {
    const trimmedContent = content.trim();
    // Only add unique think blocks
    if (!seenContents.has(trimmedContent)) {
      const id = `think-${Math.random().toString(36).substr(2, 9)}`;
      thinkBlocks.push({ id, content: trimmedContent });
      seenContents.add(trimmedContent);
      return `{{${id}}}`;
    }
    // Return empty string for duplicates to remove them
    return '';
  });
  
  return { processedText, thinkBlocks };
} 