'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useSession } from 'next-auth/react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { toast } from '@/components/common/toast';
import { Camera, User } from 'lucide-react';

interface OnboardingData {
  name?: string;
  image?: string;
  referredBy?: string;
  useCase?: string;
  useCaseOther?: string;
  referredByOther?: string;
}

const referralSources = [
  'ChatGPT',
  'Reddit',
  'X (Twitter)',
  'LinkedIn',
  'Google',
  'Other'
];

const useCases = [
  'Building an AI app',
  'Writing a book',
  'Creating games',
  'Project management',
  'Personal assistant',
  'Other'
];

export default function OnboardingPage() {
  const router = useRouter();
  const { data: session, status } = useSession();
  const [isLoading, setIsLoading] = useState(false);
  const [data, setData] = useState<OnboardingData>({});

  // Check if user needs onboarding
  useEffect(() => {
    if (status === 'loading') return;
    
    if (!session?.user) {
      router.push('/login');
      return;
    }

    // Pre-populate data for OAuth users
    if (session.user.name || session.user.image) {
      setData({
        name: session.user.name || '',
        image: session.user.image || '',
      });
    }
  }, [session, status, router]);

  const handleComplete = async () => {
    // Validate required fields
    if (!data.name || !data.useCase || !data.referredBy) {
      toast({ type: 'error', description: 'Please fill in all required fields.' });
      return;
    }

    setIsLoading(true);
    try {
      // Prepare final data
      const finalData = {
        name: data.name,
        image: data.image,
        useCase: data.useCase === 'Other' ? data.useCaseOther : data.useCase,
        referredBy: data.referredBy === 'Other' ? data.referredByOther : data.referredBy,
      };

      const response = await fetch('/api/onboarding', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(finalData),
      });

      if (!response.ok) {
        throw new Error('Failed to complete onboarding');
      }

      toast({ type: 'success', description: 'Welcome to Papr! Your account is all set up.' });
      router.push('/');
    } catch (error) {
      console.error('Onboarding error:', error);
      toast({ type: 'error', description: 'Failed to complete onboarding. Please try again.' });
    } finally {
      setIsLoading(false);
    }
  };

  const handleImageUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    // Validate file type and size
    if (!file.type.startsWith('image/')) {
      toast({ type: 'error', description: 'Please select an image file.' });
      return;
    }

    if (file.size > 5 * 1024 * 1024) {
      toast({ type: 'error', description: 'Image size must be less than 5MB.' });
      return;
    }

    try {
      // Show loading state
      setData({ ...data, image: 'uploading' });

      const formData = new FormData();
      formData.append('file', file);

      const response = await fetch('/api/upload/image', {
        method: 'POST',
        body: formData,
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || 'Upload failed');
      }

      const { imageUrl } = await response.json();
      setData({ ...data, image: imageUrl });
      
      toast({ type: 'success', description: 'Image uploaded successfully!' });
    } catch (error) {
      console.error('Image upload error:', error);
      toast({ type: 'error', description: 'Failed to upload image. Please try again.' });
      setData({ ...data, image: undefined });
    }
  };

  const getDefaultAvatar = () => {
    // Create a default avatar with Vercel-style colors
    const canvas = document.createElement('canvas');
    canvas.width = 120;
    canvas.height = 120;
    const ctx = canvas.getContext('2d');
    
    if (ctx) {
      // Vercel-style gradient background
      const gradient = ctx.createLinearGradient(0, 0, 120, 120);
      gradient.addColorStop(0, '#0070f3');
      gradient.addColorStop(1, '#7928ca');
      
      ctx.fillStyle = gradient;
      ctx.fillRect(0, 0, 120, 120);
      
      // Add user initial if name exists
      if (data.name) {
        ctx.fillStyle = 'white';
        ctx.font = 'bold 48px system-ui';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText(data.name.charAt(0).toUpperCase(), 60, 60);
      }
    }
    
    return canvas.toDataURL();
  };

  if (status === 'loading') {
    return (
      <div className="flex h-screen items-center justify-center">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-gray-900"></div>
      </div>
    );
  }

  return (
    <div className="flex h-screen w-screen bg-background">
      {/* Main content area with collapsed sidebar space */}
      <div className="flex-1 flex items-center justify-center p-8 ml-12">
        <div className="w-full max-w-lg space-y-8">
          {/* Header */}
          <div className="text-center space-y-2">
            <h1 className="text-3xl font-bold tracking-tight">Welcome to Papr!</h1>
            <p className="text-muted-foreground text-lg">
              Let's get you set up in just a few steps
            </p>
          </div>

          <div className="space-y-8">
            {/* Profile Image Section */}
            <div className="space-y-4">
              <div className="flex flex-col items-center space-y-4">
                <div className="relative">
                  <div className="w-24 h-24 rounded-full overflow-hidden bg-gradient-to-br from-blue-500 to-purple-600 flex items-center justify-center text-white text-2xl font-bold cursor-pointer hover:opacity-80 transition-opacity"
                       onClick={() => document.getElementById('imageUpload')?.click()}>
                    {data.image === 'uploading' ? (
                      <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-white"></div>
                    ) : data.image && data.image !== 'uploading' ? (
                      <img src={data.image} alt="Profile" className="w-full h-full object-cover" />
                    ) : (
                      <span>{data.name?.charAt(0)?.toUpperCase() || <User className="w-8 h-8" />}</span>
                    )}
                  </div>
                  <button
                    onClick={() => document.getElementById('imageUpload')?.click()}
                    className="absolute -bottom-2 -right-2 w-8 h-8 bg-primary text-primary-foreground rounded-full flex items-center justify-center hover:bg-primary/90 transition-colors"
                  >
                    <Camera className="w-4 h-4" />
                  </button>
                  <input
                    id="imageUpload"
                    type="file"
                    accept="image/*"
                    onChange={handleImageUpload}
                    className="hidden"
                  />
                </div>
                <p className="text-sm text-muted-foreground">Click to add your profile picture</p>
              </div>
            </div>

            {/* Name Field */}
            <div className="space-y-2">
              <Label htmlFor="name" className="text-base font-medium">Your Name *</Label>
              <Input
                id="name"
                type="text"
                value={data.name || ''}
                onChange={(e) => setData({ ...data, name: e.target.value })}
                placeholder="Enter your full name"
                className="h-12 text-base"
                required
              />
            </div>

            {/* Use Case Field */}
            <div className="space-y-2">
              <Label htmlFor="useCase" className="text-base font-medium">What do you want to create with Papr? *</Label>
              <Select onValueChange={(value) => setData({ ...data, useCase: value })}>
                <SelectTrigger className="h-12 text-base">
                  <SelectValue placeholder="Select your main use case" />
                </SelectTrigger>
                <SelectContent>
                  {useCases.map((useCase) => (
                    <SelectItem key={useCase} value={useCase} className="text-base py-3">
                      {useCase}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              {data.useCase === 'Other' && (
                <Textarea
                  value={data.useCaseOther || ''}
                  onChange={(e) => setData({ ...data, useCaseOther: e.target.value })}
                  placeholder="Please specify your use case..."
                  className="mt-2"
                  rows={3}
                />
              )}
            </div>

            {/* Referral Source Field */}
            <div className="space-y-2">
              <Label htmlFor="referredBy" className="text-base font-medium">Where did you hear about Papr? *</Label>
              <Select onValueChange={(value) => setData({ ...data, referredBy: value })}>
                <SelectTrigger className="h-12 text-base">
                  <SelectValue placeholder="Select referral source" />
                </SelectTrigger>
                <SelectContent>
                  {referralSources.map((source) => (
                    <SelectItem key={source} value={source} className="text-base py-3">
                      {source}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              {data.referredBy === 'Other' && (
                <Input
                  value={data.referredByOther || ''}
                  onChange={(e) => setData({ ...data, referredByOther: e.target.value })}
                  placeholder="Please specify where you heard about us..."
                  className="mt-2"
                />
              )}
            </div>

            {/* Submit Button */}
            <Button 
              onClick={handleComplete} 
              className="w-full h-12 text-base font-medium"
              disabled={isLoading || !data.name || !data.useCase || !data.referredBy}
            >
              {isLoading ? 'Setting up your account...' : 'Complete Setup'}
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}
