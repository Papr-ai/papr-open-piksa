'use client';

import { useState } from 'react';
import { useSession } from 'next-auth/react';
import Link from 'next/link';
import { 
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { SUBSCRIPTION_PLANS } from '@/lib/subscription/plans';

interface UpgradeModalProps {
  isOpen: boolean;
  onClose: () => void;
  title?: string;
  message?: string;
  currentUsage?: {
    current: number;
    limit: number;
    type: string;
  };
}

export function UpgradeModal({
  isOpen,
  onClose,
  title = "Upgrade Required",
  message = "You've reached your plan limit. Upgrade to continue using premium features.",
  currentUsage
}: UpgradeModalProps) {
  const { data: session } = useSession();
  const [subscribing, setSubscribing] = useState(false);

  const handleSubscribe = async (planId: string) => {
    if (!session?.user || planId === 'free') return;

    setSubscribing(true);
    try {
      const response = await fetch('/api/subscription/create-checkout', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          planId: planId,
        }),
      });

      if (response.ok) {
        const { url } = await response.json();
        window.location.href = url;
      } else {
        console.error('Failed to create checkout session');
      }
    } catch (error) {
      console.error('Error creating checkout session:', error);
    } finally {
      setSubscribing(false);
    }
  };

  const paidPlans = SUBSCRIPTION_PLANS.filter(plan => plan.id !== 'free');

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-4xl">
        <DialogHeader>
          <DialogTitle className="text-2xl">{title}</DialogTitle>
          <DialogDescription className="text-lg">
            {message}
          </DialogDescription>
        </DialogHeader>

        {currentUsage && (
          <div className="mb-4 p-4 bg-orange-50 border border-orange-200 rounded-lg">
            <div className="flex items-center justify-between">
              <span className="font-medium text-orange-800">
                Current Usage: {currentUsage.type}
              </span>
              <Badge variant="outline" className="text-orange-600 border-orange-300">
                {currentUsage.current}/{currentUsage.limit === -1 ? '∞' : currentUsage.limit}
              </Badge>
            </div>
          </div>
        )}

        <div className="grid md:grid-cols-2 gap-4">
          {paidPlans.map((plan) => (
            <Card key={plan.id} className={`relative ${plan.isPopular ? 'border-2' : ''}`} style={{
              borderColor: plan.isPopular ? '#0161E0' : ''
            }}>
              {plan.isPopular && (
                <Badge className="absolute -top-2 left-1/2 transform -translate-x-1/2 text-white" style={{ backgroundColor: '#0161E0' }}>
                  Most Popular
                </Badge>
              )}
              
              <CardHeader>
                <CardTitle className="flex items-center justify-between">
                  {plan.name}
                  <span className="text-2xl font-bold">
                    ${plan.price}
                    <span className="text-sm font-normal text-muted-foreground">
                      /{plan.interval}
                    </span>
                  </span>
                </CardTitle>
                <CardDescription>{plan.description}</CardDescription>
              </CardHeader>
              
              <CardContent className="space-y-4">
                <div className="space-y-2">
                  <div className="flex items-center justify-between text-sm">
                    <span>Premium AI Models</span>
                    <span className="font-medium text-green-600">✓</span>
                  </div>
                  <div className="flex items-center justify-between text-sm">
                    <span>Basic Interactions</span>
                    <span className="font-medium">
                      {plan.features.basicInteractions === -1 ? 'Unlimited' : plan.features.basicInteractions.toLocaleString()}
                    </span>
                  </div>
                  <div className="flex items-center justify-between text-sm">
                    <span>Memories Added</span>
                    <span className="font-medium">
                      {plan.features.memoriesAdded === -1 ? 'Unlimited' : plan.features.memoriesAdded.toLocaleString()}
                    </span>
                  </div>
                  <div className="flex items-center justify-between text-sm">
                    <span>Memory Searches</span>
                    <span className="font-medium">
                      {plan.features.memoriesSearched === -1 ? 'Unlimited' : plan.features.memoriesSearched.toLocaleString()}
                    </span>
                  </div>
                </div>
                
                <Button
                  className="w-full"
                  onClick={() => handleSubscribe(plan.id)}
                  disabled={subscribing}
                  variant={plan.isPopular ? 'default' : 'outline'}
                >
                  {subscribing ? 'Processing...' : `Upgrade to ${plan.name}`}
                </Button>
              </CardContent>
            </Card>
          ))}
        </div>

        <div className="flex justify-center pt-4 border-t">
          <Link href="/subscription">
            <Button variant="ghost" onClick={onClose}>
              View All Plans
            </Button>
          </Link>
        </div>
      </DialogContent>
    </Dialog>
  );
}

