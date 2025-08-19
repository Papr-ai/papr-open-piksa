'use client';

import { useState, useEffect } from 'react';
import { useSession } from 'next-auth/react';
import Link from 'next/link';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';

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
  const { data: session } = useSession();
  const [usageData, setUsageData] = useState<UsageData | null>(null);
  const [dismissed, setDismissed] = useState<string[]>([]);

  useEffect(() => {
    if (session?.user) {
      fetchUsageWarnings();
    }
  }, [session]);

  const fetchUsageWarnings = async () => {
    try {
      const response = await fetch('/api/subscription/usage-warnings');
      if (response.ok) {
        const data = await response.json();
        setUsageData(data);
      }
    } catch (error) {
      console.error('Error fetching usage warnings:', error);
    }
  };

  const dismissWarning = (type: string) => {
    setDismissed(prev => [...prev, type]);
  };

  if (!usageData || !session?.user) return null;

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
              <Button
                variant="ghost"
                size="sm"
                onClick={() => dismissWarning(warning.type)}
                className="text-xs text-orange-600 hover:text-orange-800"
              >
                ✕
              </Button>
            </div>
          </AlertDescription>
        </Alert>
      ))}
    </div>
  );
}

export function UsageOverviewCard() {
  const { data: session } = useSession();
  const [usageData, setUsageData] = useState<{
    basicInteractions: { current: number; limit: number; percentage: number };
    premiumInteractions: { current: number; limit: number; percentage: number };
    memoriesAdded: { current: number; limit: number; percentage: number };
    memoriesSearched: { current: number; limit: number; percentage: number };
    plan: string;
  } | null>(null);

  useEffect(() => {
    if (session?.user) {
      fetchUsageOverview();
    }
  }, [session]);

  const fetchUsageOverview = async () => {
    try {
      const response = await fetch('/api/subscription/usage-overview');
      if (response.ok) {
        const data = await response.json();
        setUsageData(data);
      }
    } catch (error) {
      console.error('Error fetching usage overview:', error);
    }
  };

  if (!usageData || !session?.user) return null;

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

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-lg">Usage Overview</CardTitle>
        <CardDescription>
          Your current usage for this month ({usageData.plan} plan)
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div>
          <div className="flex justify-between text-sm mb-1">
            <span>Basic Interactions</span>
            <span>{formatUsage(usageData.basicInteractions.current, usageData.basicInteractions.limit)}</span>
          </div>
          <div className="w-full bg-gray-200 rounded-full h-2">
            <div 
              className={`h-2 rounded-full ${getProgressColor(usageData.basicInteractions.percentage)}`}
              style={{ width: `${Math.min(usageData.basicInteractions.percentage, 100)}%` }}
            />
          </div>
        </div>

        <div>
          <div className="flex justify-between text-sm mb-1">
            <span>Premium Interactions</span>
            <span>{formatUsage(usageData.premiumInteractions.current, usageData.premiumInteractions.limit)}</span>
          </div>
          <div className="w-full bg-gray-200 rounded-full h-2">
            <div 
              className={`h-2 rounded-full ${getProgressColor(usageData.premiumInteractions.percentage)}`}
              style={{ width: `${Math.min(usageData.premiumInteractions.percentage, 100)}%` }}
            />
          </div>
        </div>

        <div>
          <div className="flex justify-between text-sm mb-1">
            <span>Memory Storage</span>
            <span>{formatUsage(usageData.memoriesAdded.current, usageData.memoriesAdded.limit)}</span>
          </div>
          <div className="w-full bg-gray-200 rounded-full h-2">
            <div 
              className={`h-2 rounded-full ${getProgressColor(usageData.memoriesAdded.percentage)}`}
              style={{ width: `${Math.min(usageData.memoriesAdded.percentage, 100)}%` }}
            />
          </div>
        </div>

        <div>
          <div className="flex justify-between text-sm mb-1">
            <span>Memory Searches</span>
            <span>{formatUsage(usageData.memoriesSearched.current, usageData.memoriesSearched.limit)}</span>
          </div>
          <div className="w-full bg-gray-200 rounded-full h-2">
            <div 
              className={`h-2 rounded-full ${getProgressColor(usageData.memoriesSearched.percentage)}`}
              style={{ width: `${Math.min(usageData.memoriesSearched.percentage, 100)}%` }}
            />
          </div>
        </div>

        {usageData.plan === 'free' && (
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
