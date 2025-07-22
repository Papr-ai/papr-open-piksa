'use client';

import { motion } from 'framer-motion';
import { cn } from '@/lib/utils';

interface TypingIndicatorProps {
  isVisible?: boolean;
  className?: string;
}

export function TypingIndicator({ isVisible = true, className }: TypingIndicatorProps) {
  if (!isVisible) return null;

  return (
    <motion.div
      className={cn(
        'inline-flex items-center gap-1 h-4',
        'bg-gradient-to-r from-transparent via-primary/10 to-transparent',
        'animate-pulse rounded px-2',
        className
      )}
      initial={{ opacity: 0, width: 0 }}
      animate={{ opacity: 1, width: 'auto' }}
      exit={{ opacity: 0, width: 0 }}
      transition={{ duration: 0.3 }}
    >
      <motion.span
        className="w-1 h-1 bg-primary/50 rounded-full"
        animate={{ scale: [1, 1.2, 1] }}
        transition={{ duration: 0.6, repeat: Infinity }}
      />
      <motion.span
        className="w-1 h-1 bg-primary/50 rounded-full"
        animate={{ scale: [1, 1.2, 1] }}
        transition={{ duration: 0.6, repeat: Infinity, delay: 0.2 }}
      />
      <motion.span
        className="w-1 h-1 bg-primary/50 rounded-full"
        animate={{ scale: [1, 1.2, 1] }}
        transition={{ duration: 0.6, repeat: Infinity, delay: 0.4 }}
      />
    </motion.div>
  );
}

interface MessageChunkProps {
  content: string;
  isTyping?: boolean;
  className?: string;
}

export function MessageChunk({ content, isTyping, className }: MessageChunkProps) {
  return (
    <span className={cn('relative inline', className)}>
      {content}
      {isTyping && <TypingIndicator className="absolute -right-8 top-1/2 -translate-y-1/2" />}
    </span>
  );
} 