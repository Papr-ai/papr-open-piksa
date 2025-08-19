'use client';

import { useState, useCallback } from 'react';

interface UpgradeModalState {
  isOpen: boolean;
  title?: string;
  message?: string;
  currentUsage?: {
    current: number;
    limit: number;
    type: string;
  };
}

export function useUpgradeModal() {
  const [state, setState] = useState<UpgradeModalState>({
    isOpen: false,
  });

  const showUpgradeModal = useCallback((options?: {
    title?: string;
    message?: string;
    currentUsage?: {
      current: number;
      limit: number;
      type: string;
    };
  }) => {
    setState({
      isOpen: true,
      title: options?.title,
      message: options?.message,
      currentUsage: options?.currentUsage,
    });
  }, []);

  const hideUpgradeModal = useCallback(() => {
    setState(prev => ({ ...prev, isOpen: false }));
  }, []);

  const showUsageLimitModal = useCallback((usageType: string, current: number, limit: number) => {
    const typeLabels = {
      basicInteractions: 'Basic Interactions',
      premiumInteractions: 'Premium Interactions',
      memoriesAdded: 'Memories Added',
      memoriesSearched: 'Memory Searches',
    };

    const label = typeLabels[usageType as keyof typeof typeLabels] || usageType;

    showUpgradeModal({
      title: 'Usage Limit Reached',
      message: `You've reached your monthly limit for ${label.toLowerCase()}. Upgrade your plan to continue.`,
      currentUsage: {
        current,
        limit,
        type: label,
      },
    });
  }, [showUpgradeModal]);

  const showPremiumModelModal = useCallback(() => {
    showUpgradeModal({
      title: 'Premium Model Access Required',
      message: 'This AI model requires a premium subscription. Upgrade to access advanced reasoning models and enhanced capabilities.',
    });
  }, [showUpgradeModal]);

  return {
    ...state,
    showUpgradeModal,
    hideUpgradeModal,
    showUsageLimitModal,
    showPremiumModelModal,
  };
}
