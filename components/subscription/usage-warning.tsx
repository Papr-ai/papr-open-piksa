'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { useUsageData, useSubscription } from './subscription-context';

interface UsageWarning {
  type: string;
  message: string;
  percentage: number;
  current: number;
  limit: number;
}

interface UsageData {
  warnings: UsageWarning[];
  shouldShowUpgrade: boolean;
}

export function UsageWarning() {
  const { usage, loading } = useUsageData();
  const { subscription } = useSubscription();
  const [usageData, setUsageData] = useState<UsageData | null>(null);
  const [dismissed, setDismissed] = useState<string[]>([]);

  // Calculate warnings from context data instead of making API calls
  useEffect(() => {
    if (!usage || loading) {
      setUsageData(null);
      return;
    }

    const warnings: UsageWarning[] = [];
    
    // Check each usage type for warnings (80% threshold)
    const usageTypes = [
      { key: 'basicInteractions', name: 'Basic Interactions', data: usage.basicInteractions },
      { key: 'premiumInteractions', name: 'Premium Interactions', data: usage.premiumInteractions },
      { key: 'memoriesAdded', name: 'Memories Added', data: usage.memoriesAdded },
      { key: 'memoriesSearched', name: 'Memory Searches', data: usage.memoriesSearched },
      { key: 'voiceChats', name: 'Voice Chats', data: usage.voiceChats },
      { key: 'videosGenerated', name: 'Videos Generated', data: usage.videosGenerated },
    ];

    for (const usageType of usageTypes) {
      const { current, limit, percentage } = usageType.data;
      if (percentage >= 80) {
        warnings.push({
          type: usageType.key,
          message: `${usageType.name}: ${current}/${limit} used (${percentage.toFixed(1)}%)`,
          percentage,
          current,
          limit,
        });
      }
    }

    setUsageData({
      warnings,
      shouldShowUpgrade: subscription.subscriptionPlan === 'free' && warnings.length > 0,
    });
  }, [usage, loading, subscription.subscriptionPlan]);

  const dismissWarning = (type: string, percentage: number) => {
    // Don't allow dismissal if user is at 100% usage
    if (percentage >= 100) {
      return;
    }
    setDismissed(prev => [...prev, type]);
  };

  if (!usageData || loading) return null;

  const activeWarnings = usageData.warnings.filter(w => !dismissed.includes(w.type));

  if (activeWarnings.length === 0) return null;

  return (
    <div className="space-y-2">
      {activeWarnings.map((warning) => (
        <Alert key={warning.type} className="border-orange-200 bg-orange-50">
          <AlertDescription className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Badge variant="outline" className="text-orange-600 border-orange-300">
                {warning.percentage.toFixed(0)}%
              </Badge>
              <span className="text-sm text-orange-800">
                {warning.message} ({warning.current}/{warning.limit === -1 ? '∞' : warning.limit})
              </span>
            </div>
            <div className="flex items-center gap-2">
              {usageData.shouldShowUpgrade && (
                <Link href="/subscription">
                  <Button size="sm" className="text-xs">
                    Upgrade
                  </Button>
                </Link>
              )}
              {warning.percentage < 100 && (
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => dismissWarning(warning.type, warning.percentage)}
                  className="text-xs text-orange-600 hover:text-orange-800"
                >
                  ✕
                </Button>
              )}
            </div>
          </AlertDescription>
        </Alert>
      ))}
    </div>
  );
}

export function UsageOverviewCard() {
  const { usage, loading } = useUsageData();

  if (loading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center justify-between">
            Usage Overview
            <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-blue-600"></div>
          </CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-muted-foreground">Loading usage data...</p>
        </CardContent>
      </Card>
    );
  }

  if (!usage || loading) return null;

  const formatUsage = (current: number, limit: number) => {
    if (limit === -1) return `${current.toLocaleString()} / Unlimited`;
    return `${current.toLocaleString()} / ${limit.toLocaleString()}`;
  };

  const getProgressColor = (percentage: number) => {
    if (percentage >= 90) return 'bg-red-500';
    if (percentage >= 80) return 'bg-orange-500';
    if (percentage >= 60) return 'bg-yellow-500';
    return 'bg-green-500';
  };

  const getProgressStyle = (percentage: number) => {
    const color = getProgressColor(percentage);
    if (color === 'bg-green-500') {
      return { backgroundColor: '#0161E0' }; // Use your brand blue for healthy usage
    }
    return {}; // Use Tailwind classes for other colors
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-lg">Usage Overview</CardTitle>
        <CardDescription>
          Your current usage for this month ({usage.plan} plan)
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div>
          <div className="flex justify-between text-sm mb-1">
            <span>Basic Interactions</span>
            <span>{formatUsage(usage.basicInteractions.current, usage.basicInteractions.limit)}</span>
          </div>
          <div className="w-full bg-gray-200 rounded-full h-2">
            <div 
              className={`h-2 rounded-full ${getProgressColor(usage.basicInteractions.percentage)}`}
              style={{ 
                width: `${Math.min(usage.basicInteractions.percentage, 100)}%`,
                ...getProgressStyle(usage.basicInteractions.percentage)
              }}
            />
          </div>
        </div>

        <div>
          <div className="flex justify-between text-sm mb-1">
            <span>Premium Interactions</span>
            <span>{formatUsage(usage.premiumInteractions.current, usage.premiumInteractions.limit)}</span>
          </div>
          <div className="w-full bg-gray-200 rounded-full h-2">
            <div 
              className={`h-2 rounded-full ${getProgressColor(usage.premiumInteractions.percentage)}`}
              style={{ 
                width: `${Math.min(usage.premiumInteractions.percentage, 100)}%`,
                ...getProgressStyle(usage.premiumInteractions.percentage)
              }}
            />
          </div>
        </div>

        <div>
          <div className="flex justify-between text-sm mb-1">
            <span>Memory Storage</span>
            <span>{formatUsage(usage.memoriesAdded.current, usage.memoriesAdded.limit)}</span>
          </div>
          <div className="w-full bg-gray-200 rounded-full h-2">
            <div 
              className={`h-2 rounded-full ${getProgressColor(usage.memoriesAdded.percentage)}`}
              style={{ 
                width: `${Math.min(usage.memoriesAdded.percentage, 100)}%`,
                ...getProgressStyle(usage.memoriesAdded.percentage)
              }}
            />
          </div>
        </div>

        <div>
          <div className="flex justify-between text-sm mb-1">
            <span>Memory Searches</span>
            <span>{formatUsage(usage.memoriesSearched.current, usage.memoriesSearched.limit)}</span>
          </div>
          <div className="w-full bg-gray-200 rounded-full h-2">
            <div 
              className={`h-2 rounded-full ${getProgressColor(usage.memoriesSearched.percentage)}`}
              style={{ 
                width: `${Math.min(usage.memoriesSearched.percentage, 100)}%`,
                ...getProgressStyle(usage.memoriesSearched.percentage)
              }}
            />
          </div>
        </div>

        {usage.voiceChats && (
          <div>
            <div className="flex justify-between text-sm mb-1">
              <span>Voice Chats</span>
              <span>{formatUsage(usage.voiceChats.current, usage.voiceChats.limit)}</span>
            </div>
            <div className="w-full bg-gray-200 rounded-full h-2">
              <div 
                className={`h-2 rounded-full ${getProgressColor(usage.voiceChats.percentage)}`}
                style={{ 
                  width: `${Math.min(usage.voiceChats.percentage, 100)}%`,
                  ...getProgressStyle(usage.voiceChats.percentage)
                }}
              />
            </div>
          </div>
        )}

        {usage.videosGenerated && (
          <div>
            <div className="flex justify-between text-sm mb-1">
              <span>Videos Generated</span>
              <span>{formatUsage(usage.videosGenerated.current, usage.videosGenerated.limit)}</span>
            </div>
            <div className="w-full bg-gray-200 rounded-full h-2">
              <div 
                className={`h-2 rounded-full ${getProgressColor(usage.videosGenerated.percentage)}`}
                style={{ 
                  width: `${Math.min(usage.videosGenerated.percentage, 100)}%`,
                  ...getProgressStyle(usage.videosGenerated.percentage)
                }}
              />
            </div>
          </div>
        )}

        {usage.plan === 'free' && (
          <div className="pt-2 border-t">
            <Link href="/subscription">
              <Button className="w-full">
                Upgrade for higher limits
              </Button>
            </Link>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
