'use client';

import { useState } from 'react';
import { PageContext } from '@/types/app';

export function useContext() {
  const [selectedContexts, setSelectedContexts] = useState<PageContext[]>([]);
  const [isContextSelectorOpen, setIsContextSelectorOpen] = useState(false);

  const updateContexts = (contexts: PageContext[]) => {
    console.log('[USE CONTEXT] Updating contexts:', contexts.length, contexts);
    setSelectedContexts(contexts);
  };

  const addContext = (context: PageContext) => {
    setSelectedContexts((prev) => [...prev, context]);
  };

  const removeContext = (contextId: string) => {
    setSelectedContexts((prev) => prev.filter((ctx) => ctx.id !== contextId));
  };

  const clearContexts = () => {
    setSelectedContexts([]);
  };

  return {
    selectedContexts,
    isContextSelectorOpen,
    setIsContextSelectorOpen,
    updateContexts,
    addContext,
    removeContext,
    clearContexts,
  };
} 