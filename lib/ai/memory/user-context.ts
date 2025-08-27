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

    // Search for different types of user information
    const [preferences, insights, goals, patterns] = await Promise.all([
      // User preferences and settings
      searchUserMemories({
        userId,
        query: 'user preferences settings configuration likes dislikes favorite tools programming languages frameworks',
        maxResults: 8,
        apiKey
      }),
      
      // Insights about the user's work patterns and behavior
      searchUserMemories({
        userId,
        query: 'user insights patterns behavior work style learning approach problem solving methods',
        maxResults: 6,
        apiKey
      }),
      
      // Current goals and objectives
      searchUserMemories({
        userId,
        query: 'user goals objectives projects planning weekly goals monthly targets learning goals career goals',
        maxResults: 5,
        apiKey
      }),
      
      // Work patterns and habits
      searchUserMemories({
        userId,
        query: 'user habits routine workflow development process coding style project structure',
        maxResults: 5,
        apiKey
      })
    ]);

    console.log('[User Context] Memory search results:', {
      preferencesCount: preferences.length,
      insightsCount: insights.length,
      goalsCount: goals.length,
      patternsCount: patterns.length
    });

    // Log the actual search results for debugging
    console.log('[User Context] Raw preferences results:', preferences.map(p => ({
      content: p.content?.substring(0, 100) + '...',
      metadata: p.metadata
    })));
    console.log('[User Context] Raw insights results:', insights.map(i => ({
      content: i.content?.substring(0, 100) + '...',
      metadata: i.metadata
    })));
    console.log('[User Context] Raw goals results:', goals.map(g => ({
      content: g.content?.substring(0, 100) + '...',
      metadata: g.metadata
    })));
    console.log('[User Context] Raw patterns results:', patterns.map(p => ({
      content: p.content?.substring(0, 100) + '...',
      metadata: p.metadata
    })));

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
