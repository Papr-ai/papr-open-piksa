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
  onManageSubscription?: () => void;
  isCurrentPlan?: boolean;
  hasActiveSubscription?: boolean;
  renewalDate?: string;
  loading?: boolean;
}

export function PricingCard({ 
  plan, 
  isPopular, 
  onSubscribe,
  onManageSubscription,
  isCurrentPlan,
  hasActiveSubscription,
  renewalDate,
  loading 
}: PricingCardProps) {
  const formatFeatureValue = (value: number) => {
    if (value === -1) return 'Unlimited';
    if (value === 0) return 'None';
    return value.toLocaleString();
  };

  return (
    <Card className={`relative shadow-lg`} style={{
      borderColor: isCurrentPlan || isPopular ? '#0161E0' : '',
      backgroundColor: isCurrentPlan ? '#0161E0' + '10' : '' // 10% opacity of your brand blue
    }}>
      {isCurrentPlan && (
        <div className="absolute -top-3 left-1/2 transform -translate-x-1/2">
          <Badge className="text-white" style={{ backgroundColor: '#0161E0' }}>Current Plan</Badge>
        </div>
      )}
      {isPopular && !isCurrentPlan && (
        <div className="absolute -top-3 left-1/2 transform -translate-x-1/2">
          <Badge className="text-white" style={{ backgroundColor: '#0161E0' }}>Most Popular</Badge>
        </div>
      )}
      
      <CardHeader className="text-center pb-4">
        <CardTitle className="text-2xl" style={{
          color: isCurrentPlan ? '#0161E0' : ''
        }}>
          {plan.name}
        </CardTitle>
        <CardDescription>{plan.description}</CardDescription>
        
        <div className="mt-4">
          <div className="flex items-baseline justify-center">
            <span className="text-4xl font-bold">${plan.price}</span>
            {plan.price > 0 && (
              <span className="text-muted-foreground ml-2">/{plan.interval}</span>
            )}
          </div>
          {isCurrentPlan && renewalDate && (
            <p className="text-sm text-muted-foreground mt-2">
              Renews on {new Date(renewalDate).toLocaleDateString()}
            </p>
          )}
        </div>
      </CardHeader>
      
      <CardContent className="pt-0 px-6 pb-6">
        <Button 
          onClick={() => {
            if (isCurrentPlan && hasActiveSubscription && onManageSubscription) {
              onManageSubscription();
            } else {
              onSubscribe(plan.id);
            }
          }}
          disabled={loading || (plan.id === 'free') || (isCurrentPlan && !hasActiveSubscription)}
          className="w-full mb-6"
          variant={isCurrentPlan && hasActiveSubscription ? 'outline' : 'default'}
        >
          {loading ? 'Loading...' : 
           isCurrentPlan && hasActiveSubscription ? 'Manage Subscription' :
           isCurrentPlan ? 'Current Plan' :
           plan.id === 'free' ? 'Free Forever' : 
           'Subscribe'}
        </Button>
        
        <div className="space-y-4">
          <p className="text-sm font-semibold">This includes:</p>
          
          <div className="space-y-3">
            <div className="flex items-center gap-2">
              <div className="flex-shrink-0" style={{ color: '#0161E0' }}>
                <CheckCircleFillIcon size={16} />
              </div>
              <span className="text-sm">
                {plan.features.premium ? 'Premium AI models' : 'Basic AI models only'}
              </span>
            </div>
            
            <div className="flex items-center gap-2">
              <div className="flex-shrink-0" style={{ color: '#0161E0' }}>
                <CheckCircleFillIcon size={16} />
              </div>
              <span className="text-sm">
                {formatFeatureValue(plan.features.basicInteractions)} basic interactions per month
              </span>
            </div>
            
            <div className="flex items-center gap-2">
              <div className="flex-shrink-0" style={{ color: '#0161E0' }}>
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
              <div className="flex-shrink-0" style={{ color: '#0161E0' }}>
                <CheckCircleFillIcon size={16} />
              </div>
              <span className="text-sm">
                {formatFeatureValue(plan.features.memoriesAdded)} memories storage capacity
              </span>
            </div>
            
            <div className="flex items-center gap-2">
              <div className="flex-shrink-0" style={{ color: '#0161E0' }}>
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
