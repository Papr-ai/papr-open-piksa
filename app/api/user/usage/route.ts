import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/app/(auth)/auth';
import { getCombinedUserData, calculateUsagePercentages } from '@/lib/db/user-data-cache';

/**
 * Optimized endpoint for user usage data
 * Uses combined query instead of multiple separate database calls
 */
export async function GET(request: NextRequest) {
  try {
    const session = await auth();
    
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });
    }

    // Get all user data in a single optimized query
    const userData = await getCombinedUserData(session.user.id);
    
    // Calculate usage percentages
    const percentages = calculateUsagePercentages(userData.usage, userData.planLimits);
    
    // Format response to match existing API
    const response = {
      basicInteractions: {
        current: userData.usage.basicInteractions,
        limit: userData.planLimits.basicInteractions,
        percentage: percentages.basicInteractions,
      },
      premiumInteractions: {
        current: userData.usage.premiumInteractions,
        limit: userData.planLimits.premiumInteractions,
        percentage: percentages.premiumInteractions,
      },
      memoriesAdded: {
        current: userData.usage.memoriesAdded,
        limit: userData.planLimits.memoriesAdded,
        percentage: percentages.memoriesAdded,
      },
      memoriesSearched: {
        current: userData.usage.memoriesSearched,
        limit: userData.planLimits.memoriesSearched,
        percentage: percentages.memoriesSearched,
      },
      voiceChats: {
        current: userData.usage.voiceChats,
        limit: userData.planLimits.voiceChats,
        percentage: percentages.voiceChats,
      },
      videosGenerated: {
        current: userData.usage.videosGenerated,
        limit: userData.planLimits.videosGenerated,
        percentage: percentages.videosGenerated,
      },
      plan: userData.subscription?.plan || 'free',
    };

    return NextResponse.json(response);
  } catch (error) {
    console.error('[Usage API] Error fetching usage data:', error);
    return NextResponse.json(
      { error: 'Failed to fetch usage data' },
      { status: 500 }
    );
  }
}
