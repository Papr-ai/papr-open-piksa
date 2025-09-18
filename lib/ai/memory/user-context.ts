import { searchUserMemories } from './middleware';

export interface UserContextData {
  preferences: string[];
  insights: string[];
  goals: string[];
  patterns: string[];
  context: string;
}

/**
 * Search user memory for preferences, insights, and goals to enhance chat context
 * Optimized to reduce API calls and improve performance
 */
export async function getUserContext(userId: string, apiKey: string): Promise<UserContextData> {
  if (!apiKey) {
    console.log('[User Context] No memory API key provided');
    return {
      preferences: [],
      insights: [],
      goals: [],
      patterns: [],
      context: ''
    };
  }

  try {
    console.log('[User Context] Fetching user context from memory for user:', userId);
    const startTime = Date.now();

    // OPTIMIZATION 1: Single comprehensive search instead of 4 separate calls
    // This reduces API calls from 4 to 1, significantly improving performance
    const comprehensiveMemories = await searchUserMemories({
      userId,
      query: 'user preferences settings configuration goals objectives projects patterns behavior work style habits routine workflow programming languages frameworks tools learning approach',
      maxResults: 20, // Get more results in single call
      apiKey
    });

    const searchTime = Date.now() - startTime;
    console.log(`[User Context] Memory search completed in ${searchTime}ms`);

    // OPTIMIZATION 2: Categorize results client-side using keyword matching
    // This is much faster than separate API calls
    const preferences: string[] = [];
    const insights: string[] = [];
    const goals: string[] = [];
    const patterns: string[] = [];

    comprehensiveMemories.forEach((memory: any) => {
      const content = memory.content?.toLowerCase() || '';
      const memoryText = memory.content || '';
      
      // Categorize based on content keywords
      if (content.includes('prefer') || content.includes('like') || content.includes('favorite') || 
          content.includes('setting') || content.includes('configuration') || content.includes('tool')) {
        if (preferences.length < 8) preferences.push(memoryText);
      }
      
      if (content.includes('goal') || content.includes('objective') || content.includes('target') || 
          content.includes('plan') || content.includes('want to') || content.includes('working on')) {
        if (goals.length < 5) goals.push(memoryText);
      }
      
      if (content.includes('pattern') || content.includes('behavior') || content.includes('style') || 
          content.includes('approach') || content.includes('method') || content.includes('way')) {
        if (insights.length < 6) insights.push(memoryText);
      }
      
      if (content.includes('habit') || content.includes('routine') || content.includes('workflow') || 
          content.includes('process') || content.includes('usually') || content.includes('always')) {
        if (patterns.length < 5) patterns.push(memoryText);
      }
    });

    // OPTIMIZATION 3: Fallback categorization for remaining memories
    // Distribute remaining memories if categories are still empty
    if (preferences.length === 0 || goals.length === 0 || insights.length === 0 || patterns.length === 0) {
      comprehensiveMemories.slice(0, 10).forEach((memory: any, index: number) => {
        const memoryText = memory.content || '';
        if (!memoryText) return;
        
        // Round-robin distribution for remaining memories
        if (index % 4 === 0 && preferences.length < 8) preferences.push(memoryText);
        else if (index % 4 === 1 && goals.length < 5) goals.push(memoryText);
        else if (index % 4 === 2 && insights.length < 6) insights.push(memoryText);
        else if (index % 4 === 3 && patterns.length < 5) patterns.push(memoryText);
      });
    }

    console.log('[User Context] Memory search results:', {
      preferencesCount: preferences.length,
      insightsCount: insights.length,
      goalsCount: goals.length,
      patternsCount: patterns.length
    });

    // Log the actual search results for debugging (simplified to avoid type issues)
    console.log('[User Context] Context categories populated:', {
      preferences: preferences.length,
      insights: insights.length,
      goals: goals.length,
      patterns: patterns.length
    });

    // Extract and format the content
    const extractContent = (memories: any[]) => 
      memories
        .map(memory => memory.content || '')
        .filter(content => content.trim().length > 0)
        .slice(0, 3); // Limit to top 3 most relevant

    const userPreferences = extractContent(preferences);
    const userInsights = extractContent(insights);
    const userGoals = extractContent(goals);
    const userPatterns = extractContent(patterns);

    // Log extracted content
    console.log('[User Context] Extracted preferences:', userPreferences);
    console.log('[User Context] Extracted insights:', userInsights);
    console.log('[User Context] Extracted goals:', userGoals);
    console.log('[User Context] Extracted patterns:', userPatterns);

    // Generate a consolidated context summary
    let contextSummary = '';
    
    if (userPreferences.length > 0) {
      contextSummary += `User Preferences:\n${userPreferences.map(p => `- ${p}`).join('\n')}\n\n`;
    }
    
    if (userGoals.length > 0) {
      contextSummary += `Current Goals:\n${userGoals.map(g => `- ${g}`).join('\n')}\n\n`;
    }
    
    if (userInsights.length > 0) {
      contextSummary += `User Insights:\n${userInsights.map(i => `- ${i}`).join('\n')}\n\n`;
    }
    
    if (userPatterns.length > 0) {
      contextSummary += `Work Patterns:\n${userPatterns.map(p => `- ${p}`).join('\n')}\n\n`;
    }

    if (contextSummary) {
      contextSummary = `User Context Information:\n\n${contextSummary}---\n`;
    }

    console.log('[User Context] Generated context summary:', {
      length: contextSummary.length,
      hasPreferences: userPreferences.length > 0,
      hasGoals: userGoals.length > 0,
      hasInsights: userInsights.length > 0,
      hasPatterns: userPatterns.length > 0
    });

    // Log the full context that will be sent to the LLM
    console.log('[User Context] Full context being sent to LLM:');
    console.log('='.repeat(80));
    console.log(contextSummary || '(EMPTY CONTEXT)');
    console.log('='.repeat(80));
    
    // Additional debug logging
    console.log('[User Context] DEBUG - Context generation details:', {
      contextSummaryLength: contextSummary.length,
      userPreferencesCount: userPreferences.length,
      userGoalsCount: userGoals.length,
      userInsightsCount: userInsights.length,
      userPatternsCount: userPatterns.length,
      contextSummaryPreview: contextSummary.substring(0, 200) + '...'
    });

    return {
      preferences: userPreferences,
      insights: userInsights,
      goals: userGoals,
      patterns: userPatterns,
      context: contextSummary
    };

  } catch (error) {
    console.error('[User Context] Error fetching user context:', error);
    return {
      preferences: [],
      insights: [],
      goals: [],
      patterns: [],
      context: ''
    };
  }
}

/**
 * Generate enhanced instructions with user context for chat sessions
 */
export function generateContextualInstructions(
  baseInstructions: string,
  userContext: UserContextData,
  isVoiceMode: boolean = false
): string {
  if (!userContext.context) {
    return baseInstructions;
  }

  const contextualInstructions = `${baseInstructions}

${userContext.context}

${isVoiceMode ? 
  'Remember: This is a voice conversation. Reference the user context naturally in your responses when relevant.' :
  'Use this context to provide more personalized and relevant assistance. Reference the user\'s preferences and goals when appropriate.'
}`;

  return contextualInstructions;
}
