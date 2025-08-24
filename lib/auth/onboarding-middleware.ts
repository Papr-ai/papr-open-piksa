import { auth } from '@/app/(auth)/auth';
import { getUser } from '@/lib/db/queries';
import { NextResponse } from 'next/server';

export interface OnboardingCheckResult {
  isCompleted: boolean;
  user?: any;
  response?: NextResponse;
}

/**
 * Server-side middleware to check if user has completed onboarding
 * Returns the user if onboarding is complete, or an error response if not
 */
export async function checkOnboardingStatus(): Promise<OnboardingCheckResult> {
  try {
    const session = await auth();
    
    if (!session?.user?.email) {
      return {
        isCompleted: false,
        response: NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
      };
    }

    const [dbUser] = await getUser(session.user.email);
    
    if (!dbUser) {
      return {
        isCompleted: false,
        response: NextResponse.json({ error: 'User not found' }, { status: 404 })
      };
    }

    // Check if onboarding is completed
    if (!dbUser.onboardingCompleted) {
      return {
        isCompleted: false,
        response: NextResponse.json({ 
          error: 'Onboarding not completed',
          code: 'ONBOARDING_REQUIRED',
          redirectTo: '/onboarding'
        }, { status: 403 })
      };
    }

    return {
      isCompleted: true,
      user: dbUser
    };
  } catch (error) {
    console.error('Onboarding check error:', error);
    return {
      isCompleted: false,
      response: NextResponse.json(
        { error: 'Internal server error' },
        { status: 500 }
      )
    };
  }
}

/**
 * Wrapper function for API routes that require completed onboarding
 */
export function withOnboardingCheck<T extends any[]>(
  handler: (onboardingResult: OnboardingCheckResult, ...args: T) => Promise<Response>
) {
  return async (...args: T): Promise<Response> => {
    const onboardingResult = await checkOnboardingStatus();
    
    if (!onboardingResult.isCompleted) {
      return onboardingResult.response!;
    }
    
    return handler(onboardingResult, ...args);
  };
}
