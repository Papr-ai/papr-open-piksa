'use client';

import { Card, CardContent, CardHeader, CardTitle } from './ui/card';
import { Badge } from './ui/badge';
import { CheckCircleIcon, PlusCircleIcon, BookIcon, UserIcon, TargetIcon, LightbulbIcon } from 'lucide-react';
import { formatDistanceToNow } from 'date-fns';

interface MemoryCardProps {
  success: boolean;
  message: string;
  category: 'preferences' | 'goals' | 'tasks' | 'knowledge';
  emoji_tags?: string[];
  topics?: string[];
  hierarchical_structure?: string;
  error?: string;
}

// Helper function to get category icon and color
function getCategoryIcon(category: string) {
  switch (category) {
    case 'preferences':
      return <UserIcon className="w-4 h-4 text-blue-500" />;
    case 'goals':
      return <TargetIcon className="w-4 h-4 text-green-500" />;
    case 'tasks':
      return <CheckCircleIcon className="w-4 h-4 text-orange-500" />;
    case 'knowledge':
      return <LightbulbIcon className="w-4 h-4 text-purple-500" />;
    default:
      return <BookIcon className="w-4 h-4 text-gray-500" />;
  }
}

function getCategoryColor(category: string) {
  switch (category) {
    case 'preferences':
      return 'bg-blue-100 text-blue-800 border-blue-200';
    case 'goals':
      return 'bg-green-100 text-green-800 border-green-200';
    case 'tasks':
      return 'bg-orange-100 text-orange-800 border-orange-200';
    case 'knowledge':
      return 'bg-purple-100 text-purple-800 border-purple-200';
    default:
      return 'bg-gray-100 text-gray-800 border-gray-200';
  }
}

function getCategoryTitle(category: string) {
  switch (category) {
    case 'preferences':
      return '👤 Personal Preferences';
    case 'goals':
      return '🎯 Goals & Objectives';
    case 'tasks':
      return '✅ Tasks & Reminders';
    case 'knowledge':
      return '💡 Knowledge & Insights';
    default:
      return '📝 Memory';
  }
}

export function MemoryCard({ 
  success, 
  message, 
  category, 
  emoji_tags = [], 
  topics = [], 
  hierarchical_structure,
  error 
}: MemoryCardProps) {
  return (
    <Card className={`my-4 border-l-4 ${
      success 
        ? 'border-l-green-500 bg-green-50/50 dark:bg-green-950/20' 
        : 'border-l-red-500 bg-red-50/50 dark:bg-red-950/20'
    }`}>
      <CardHeader className="pb-3">
        <CardTitle className="flex items-center gap-2 text-lg">
          {success ? (
            <CheckCircleIcon className="w-5 h-5 text-green-500" />
          ) : (
            <PlusCircleIcon className="w-5 h-5 text-red-500" />
          )}
          {success ? 'Memory Added Successfully' : 'Memory Error'}
        </CardTitle>
        <div className="text-sm text-muted-foreground">
          {success ? message : error || 'Failed to add memory'}
        </div>
      </CardHeader>
      
      <CardContent className="space-y-4">
        {success && (
          <>
            {/* Category Badge */}
            <div className="flex items-center gap-2">
              {getCategoryIcon(category)}
              <Badge className={`${getCategoryColor(category)} text-sm`}>
                {getCategoryTitle(category)}
              </Badge>
            </div>

            {/* Emoji Tags */}
            {emoji_tags && emoji_tags.length > 0 && (
              <div className="flex items-center gap-2">
                <span className="text-sm font-medium text-gray-600 dark:text-gray-400">Tags:</span>
                <div className="flex gap-1">
                  {emoji_tags.map((emoji, index) => (
                    <span key={index} className="text-lg">{emoji}</span>
                  ))}
                </div>
              </div>
            )}

            {/* Topics */}
            {topics && topics.length > 0 && (
              <div className="flex items-start gap-2">
                <span className="text-sm font-medium text-gray-600 dark:text-gray-400 mt-0.5">Topics:</span>
                <div className="flex flex-wrap gap-1">
                  {topics.map((topic, index) => (
                    <Badge key={index} variant="secondary" className="text-xs bg-gray-100 dark:bg-gray-800">
                      {topic}
                    </Badge>
                  ))}
                </div>
              </div>
            )}

            {/* Hierarchical Structure */}
            {hierarchical_structure && (
              <div className="flex items-start gap-2">
                <span className="text-sm font-medium text-gray-600 dark:text-gray-400 mt-0.5">Structure:</span>
                <code className="text-xs bg-gray-100 dark:bg-gray-800 px-2 py-1 rounded font-mono">
                  {hierarchical_structure}
                </code>
              </div>
            )}

            {/* Success Message */}
            <div className="bg-green-50 dark:bg-green-950/30 border border-green-200 dark:border-green-800 rounded-lg p-3">
              <div className="flex items-center gap-2 text-green-800 dark:text-green-200">
                <CheckCircleIcon className="w-4 h-4" />
                <span className="text-sm font-medium">
                  Memory saved to your Papr knowledge base
                </span>
              </div>
              <div className="text-xs text-green-600 dark:text-green-400 mt-1">
                This information will be available for future conversations
              </div>
            </div>
          </>
        )}

        {/* Error State */}
        {!success && error && (
          <div className="bg-red-50 dark:bg-red-950/30 border border-red-200 dark:border-red-800 rounded-lg p-3">
            <div className="flex items-center gap-2 text-red-800 dark:text-red-200">
              <PlusCircleIcon className="w-4 h-4" />
              <span className="text-sm font-medium">Failed to save memory</span>
            </div>
            <div className="text-xs text-red-600 dark:text-red-400 mt-1">
              {error}
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

// Helper function to detect memory data in content
export function detectMemoryData(content: string): MemoryCardProps | null {
  try {
    // First, try to detect if there are multiple JSON objects (like with tasks)
    const jsonObjectRegex = /\{[\s\S]*?\}/g;
    const jsonMatches = content.match(jsonObjectRegex);
    
    if (jsonMatches && jsonMatches.length > 0) {
      // Process each JSON object and find memory-related ones
      for (const jsonMatch of jsonMatches) {
        try {
          const parsed = JSON.parse(jsonMatch.trim());
          
          // Check if this looks like a memory response
          if (parsed.success !== undefined && 
              parsed.message && 
              parsed.category &&
              ['preferences', 'goals', 'tasks', 'knowledge'].includes(parsed.category)) {
            return {
              success: parsed.success,
              message: parsed.message,
              category: parsed.category,
              emoji_tags: parsed.emoji_tags,
              topics: parsed.topics,
              hierarchical_structure: parsed.hierarchical_structure,
              error: parsed.error,
            };
          }
        } catch (e) {
          // Skip invalid JSON objects
          continue;
        }
      }
    }
    
    // Fallback to original logic for single JSON objects
    let jsonString = content.trim();
    const codeFenceMatch = jsonString.match(/```(?:json)?\s*([\s\S]*?)```/);
    if (codeFenceMatch) {
      jsonString = codeFenceMatch[1].trim();
    }
    const parsed = JSON.parse(jsonString);

    if (parsed.success !== undefined && 
        parsed.message && 
        parsed.category &&
        ['preferences', 'goals', 'tasks', 'knowledge'].includes(parsed.category)) {
      return {
        success: parsed.success,
        message: parsed.message,
        category: parsed.category,
        emoji_tags: parsed.emoji_tags,
        topics: parsed.topics,
        hierarchical_structure: parsed.hierarchical_structure,
        error: parsed.error,
      };
    }
    
    return null;
  } catch (e) {
    return null;
  }
}
