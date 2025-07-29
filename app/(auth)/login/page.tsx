'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useActionState, useEffect, useState } from 'react';
import { toast } from '@/components/common/toast';
import { signIn } from 'next-auth/react';

import { AuthForm } from '@/components/auth/auth-form';
import { SubmitButton } from '@/components/common/submit-button';
import { Button } from '@/components/ui/button';

import { login, type LoginActionState } from '../actions';

export default function Page(): JSX.Element {
  const router = useRouter();

  const [email, setEmail] = useState<string>('');
  const [isSuccessful, setIsSuccessful] = useState<boolean>(false);
  const [mounted, setMounted] = useState<boolean>(false);
  const [debugInfo, setDebugInfo] = useState<any>(null);
  const [showDebug, setShowDebug] = useState<boolean>(false);

  const [state, formAction] = useActionState<LoginActionState, FormData>(
    login,
    {
      status: 'idle',
    },
  );

  // Handle mounting to avoid hydration issues
  useEffect(() => {
    setMounted(true);
    
    // Load debug info from localStorage
    try {
      const storedDebug = localStorage.getItem('github_auth_debug');
      const storedResult = localStorage.getItem('github_auth_result');
      const storedError = localStorage.getItem('github_auth_error');
      
      if (storedDebug || storedResult || storedError) {
        setDebugInfo({
          debug: storedDebug ? JSON.parse(storedDebug) : null,
          result: storedResult ? JSON.parse(storedResult) : null,
          error: storedError ? JSON.parse(storedError) : null
        });
      }
    } catch (error) {
      console.error('Error loading debug info:', error);
    }
  }, []);

  useEffect(() => {
    if (!mounted) return;

    if (state.status === 'failed') {
      toast({
        type: 'error',
        description: 'Invalid credentials!',
      });
    } else if (state.status === 'invalid_data') {
      toast({
        type: 'error',
        description: 'Failed validating your submission!',
      });
    } else if (state.status === 'success') {
      setIsSuccessful(true);
      router.refresh();
    }
  }, [state.status, mounted, router]);

  const handleSubmit = (formData: FormData): void => {
    setEmail(formData.get('email') as string);
    formAction(formData);
  };

  // Don't render until client-side hydration is complete
  if (!mounted) {
    return <div className="min-h-dvh bg-background" />;
  }

  return (
    <div className="flex h-dvh w-screen items-start pt-12 md:pt-0 md:items-center justify-center bg-background">
      <div className="w-full max-w-md overflow-hidden rounded-2xl flex flex-col gap-12">
        <div className="flex flex-col items-center justify-center gap-2 px-4 text-center sm:px-16">
          <h3 className="text-xl font-semibold dark:text-zinc-50">Sign In</h3>
          <p className="text-sm text-gray-500 dark:text-zinc-400">
            Use your email or GitHub to sign in
          </p>
        </div>
        <AuthForm action={handleSubmit} defaultEmail={email}>
          <SubmitButton isSuccessful={isSuccessful}>
            Sign in
          </SubmitButton>
        </AuthForm>
        
        <div className="px-4 sm:px-16">
          <div className="relative">
            <div className="absolute inset-0 flex items-center">
              <span className="w-full border-t" />
            </div>
            <div className="relative flex justify-center text-xs uppercase">
              <span className="bg-background px-2 text-muted-foreground">
                Or continue with
              </span>
            </div>
          </div>
          
          <Button
            variant="outline"
            className="w-full mt-4"
            onClick={async () => {
              try {
                const debugInfo = {
                  timestamp: new Date().toISOString(),
                  currentUrl: window.location.href,
                  userAgent: navigator.userAgent,
                  action: 'github_signin_clicked'
                };
                
                // Store debug info in localStorage
                localStorage.setItem('github_auth_debug', JSON.stringify(debugInfo));
                
                console.log('Attempting to sign in with GitHub...');
                console.log('Debug info stored:', debugInfo);
                
                // Try with redirect: false first to see the actual result
                const result = await signIn('github', { 
                  callbackUrl: '/',
                  redirect: false 
                });
                
                console.log('GitHub sign-in result:', result);
                
                // Store the result in localStorage for later inspection
                localStorage.setItem('github_auth_result', JSON.stringify({
                  ...debugInfo,
                  result: result,
                  timestamp: new Date().toISOString()
                }));
                
                if (result?.error) {
                  console.error('GitHub sign-in error:', result.error);
                  toast({
                    type: 'error',
                    description: `GitHub sign-in failed: ${result.error}`,
                  });
                } else if (result?.url) {
                  console.log('Redirecting to:', result.url);
                  window.location.href = result.url;
                } else if (result?.ok) {
                  console.log('Sign in successful, redirecting to /');
                  window.location.href = '/';
                } else {
                  console.log('Unexpected result:', result);

                }
              } catch (error) {
                console.error('Error during GitHub sign-in:', error);
                
                // Store error info in localStorage
                localStorage.setItem('github_auth_error', JSON.stringify({
                  timestamp: new Date().toISOString(),
                  error: error instanceof Error ? error.message : 'Unknown error',
                  stack: error instanceof Error ? error.stack : undefined
                }));
                
                toast({
                  type: 'error',
                  description: 'Failed to initiate GitHub sign-in',
                });
              }
            }}
            disabled={isSuccessful}
          >
            <svg
              className="mr-2 h-4 w-4"
              fill="currentColor"
              viewBox="0 0 20 20"
              xmlns="http://www.w3.org/2000/svg"
            >
              <path
                fillRule="evenodd"
                d="M10 0C4.477 0 0 4.484 0 10.017c0 4.425 2.865 8.18 6.839 9.504.5.092.682-.217.682-.483 0-.237-.008-.868-.013-1.703-2.782.605-3.369-1.343-3.369-1.343-.454-1.158-1.11-1.466-1.11-1.466-.908-.62.069-.608.069-.608 1.003.07 1.531 1.032 1.531 1.032.892 1.53 2.341 1.088 2.91.832.092-.647.35-1.088.636-1.338-2.22-.253-4.555-1.113-4.555-4.951 0-1.093.39-1.988 1.029-2.688-.103-.253-.446-1.272.098-2.65 0 0 .84-.27 2.75 1.026A9.564 9.564 0 0110 4.844c.85.004 1.705.115 2.504.337 1.909-1.296 2.747-1.027 2.747-1.027.546 1.379.203 2.398.1 2.651.64.7 1.028 1.595 1.028 2.688 0 3.848-2.339 4.695-4.566 4.942.359.31.678.921.678 1.856 0 1.338-.012 2.419-.012 2.747 0 .268.18.58.688.482A10.019 10.019 0 0020 10.017C20 4.484 15.522 0 10 0z"
                clipRule="evenodd"
              />
            </svg>
            Sign in with GitHub
          </Button>
          
          <p className="text-center text-sm text-gray-600 mt-4 dark:text-zinc-400">
            {"Don't have an account? "}
            <Link
              href="/register"
              className="font-semibold text-gray-800 hover:underline dark:text-zinc-200"
            >
              Sign up
            </Link>
            {' for free.'}
          </p>
        </div>
        

      </div>
    </div>
  );
}
