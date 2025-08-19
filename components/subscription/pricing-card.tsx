'use client';

import React from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { CheckCircleFillIcon } from '@/components/common/icons';
import type { SubscriptionPlan } from '@/lib/subscription/types';

interface PricingCardProps {
  plan: SubscriptionPlan;
  isPopular?: boolean;
  onSubscribe: (planId: string) => void;
  isCurrentPlan?: boolean;
  loading?: boolean;
}

export function PricingCard({ 
  plan, 
  isPopular, 
  onSubscribe, 
  isCurrentPlan,
  loading 
}: PricingCardProps) {
  const formatFeatureValue = (value: number) => {
    if (value === -1) return 'Unlimited';
    if (value === 0) return 'None';
    return value.toLocaleString();
  };

  return (
    <Card className={`relative ${isPopular ? 'border-blue-500 shadow-lg' : ''} ${isCurrentPlan ? 'bg-muted/50' : ''}`}>
      {isPopular && (
        <div className="absolute -top-3 left-1/2 transform -translate-x-1/2">
          <Badge className="bg-blue-500 text-white">Most Popular</Badge>
        </div>
      )}
      
      <CardHeader className="text-center">
        <CardTitle className="text-2xl">{plan.name}</CardTitle>
        <CardDescription>{plan.description}</CardDescription>
        
        <div className="mt-4">
          <div className="flex items-baseline justify-center">
            <span className="text-4xl font-bold">${plan.price}</span>
            {plan.price > 0 && (
              <span className="text-muted-foreground ml-2">/{plan.interval}</span>
            )}
          </div>
        </div>
      </CardHeader>
      
      <CardContent>
        <Button 
          onClick={() => onSubscribe(plan.id)}
          disabled={isCurrentPlan || loading || plan.id === 'free'}
          className="w-full mb-6"
          variant={isCurrentPlan ? 'secondary' : 'default'}
        >
          {loading ? 'Loading...' : 
           isCurrentPlan ? 'Current Plan' : 
           plan.id === 'free' ? 'Free Forever' : 
           'Subscribe'}
        </Button>
        
        <div className="space-y-3">
          <p className="text-sm font-semibold">This includes:</p>
          
          <div className="space-y-2">
            <div className="flex items-center gap-2">
              <div className="text-green-500 flex-shrink-0">
                <CheckCircleFillIcon size={16} />
              </div>
              <span className="text-sm">
                {plan.features.premium ? 'Premium AI models' : 'Basic AI models only'}
              </span>
            </div>
            
            <div className="flex items-center gap-2">
              <div className="text-green-500 flex-shrink-0">
                <CheckCircleFillIcon size={16} />
              </div>
              <span className="text-sm">
                {formatFeatureValue(plan.features.basicInteractions)} basic interactions per month
              </span>
            </div>
            
            <div className="flex items-center gap-2">
              <div className="text-green-500 flex-shrink-0">
                <CheckCircleFillIcon size={16} />
              </div>
              <span className="text-sm">
                {plan.features.premiumInteractions === 0 
                  ? 'No premium interactions' 
                  : `${formatFeatureValue(plan.features.premiumInteractions)} premium interactions per month`
                }
              </span>
            </div>
            
            <div className="flex items-center gap-2">
              <div className="text-green-500 flex-shrink-0">
                <CheckCircleFillIcon size={16} />
              </div>
              <span className="text-sm">
                {formatFeatureValue(plan.features.memoriesAdded)} memories storage capacity
              </span>
            </div>
            
            <div className="flex items-center gap-2">
              <div className="text-green-500 flex-shrink-0">
                <CheckCircleFillIcon size={16} />
              </div>
              <span className="text-sm">
                {formatFeatureValue(plan.features.memoriesSearched)} memory searches per month
              </span>
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
