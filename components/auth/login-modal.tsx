'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { Button } from '@/components/ui/button';
import { X } from 'lucide-react';

interface LoginModalProps {
  isOpen: boolean;
  setIsOpen: (isOpen: boolean) => void;
}

export function LoginModal({ isOpen, setIsOpen }: LoginModalProps) {
  const router = useRouter();

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
      <div className="bg-white dark:bg-zinc-900 rounded-lg w-full max-w-md p-6 shadow-lg">
        <div className="flex justify-between items-center mb-4">
          <h2 className="text-xl font-bold">Sign in to continue</h2>
          <Button 
            variant="ghost" 
            size="icon" 
            className="h-8 w-8 rounded-full"
            onClick={() => setIsOpen(false)}
          >
            <X className="h-4 w-4" />
          </Button>
        </div>
        
        <p className="text-gray-600 dark:text-gray-300 mb-6">
          You need to be signed in to chat with the AI assistant. Please sign in or create a free account.
        </p>
        
        <div className="flex flex-col gap-3">
          <Button 
            className="w-full" 
            onClick={() => router.push('/login')}
          >
            Sign in
          </Button>
          
          <Button 
            variant="outline" 
            className="w-full"
            onClick={() => router.push('/register')}
          >
            Create account
          </Button>
        </div>
        
        <div className="mt-6 text-center text-sm text-gray-500">
          By continuing, you agree to our <Link href="#" className="underline">Terms of Service</Link> and <Link href="#" className="underline">Privacy Policy</Link>.
        </div>
      </div>
    </div>
  );
} 