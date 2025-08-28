import { memo } from 'react';
import { MemoryIcon } from '@/components/common/icons';
import { Card, CardContent, CardHeader } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';

interface AddMemoryResult {
  success: boolean;
  message?: string;
  memoryId?: string;
  error?: string;
  category?: string;
  content?: string;
}

interface AddMemoryResultsProps {
  memoryResult: AddMemoryResult;
}

function PureAddMemoryResults({ memoryResult }: AddMemoryResultsProps) {
  const isSuccess = memoryResult.success && !memoryResult.error;
  const displayCategory = memoryResult.category || 'General';
  
  return (
    <Card className={`my-4 ${isSuccess ? 'border-green-200 bg-green-50' : 'border-red-200 bg-red-50'}`}>
      <CardHeader className="pb-3">
        <div className="flex items-center gap-2">
          <MemoryIcon size={20} isEnabled={isSuccess} className={isSuccess ? 'text-green-600' : 'text-red-600'} />
          <h3 className="text-lg font-semibold">
            {isSuccess ? 'Memory Added' : 'Memory Error'}
          </h3>
          {isSuccess && (
            <Badge variant="outline" className="bg-green-100 text-green-700">
              {displayCategory}
            </Badge>
          )}
        </div>
        <p className="text-sm text-muted-foreground">
          {isSuccess 
            ? 'Successfully saved to your knowledge base'
            : 'Failed to save memory'
          }
        </p>
      </CardHeader>
      <CardContent>
        <div className="space-y-2">
          {memoryResult.message && (
            <div className="text-sm">
              {memoryResult.message}
            </div>
          )}
          
          {memoryResult.error && (
            <div className="text-sm text-red-600">
              Error: {memoryResult.error}
            </div>
          )}
          
          {isSuccess && memoryResult.content && (
            <div className="text-xs text-muted-foreground bg-white p-2 rounded border">
              {memoryResult.content.length > 200 
                ? `${memoryResult.content.slice(0, 200)}...` 
                : memoryResult.content
              }
            </div>
          )}
          
          {isSuccess && memoryResult.memoryId && (
            <div className="text-xs text-muted-foreground">
              Memory ID: {memoryResult.memoryId}
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  );
}

export const AddMemoryResults = memo(PureAddMemoryResults, () => true);

// Helper function to detect if a message contains addMemory results
export function detectAddMemoryResults(content: string): AddMemoryResult | null {
  try {
    // Look for patterns that indicate addMemory tool results
    
    // Check for JSON patterns with addMemory-like structure
    const successPattern = /"success":\s*true/;
    const memoryPattern = /"memoryId"|"memory_id"/;
    const errorPattern = /"error":/;
    
    if (successPattern.test(content) && memoryPattern.test(content)) {
      // Try to extract JSON
      const jsonMatch = content.match(/\{[^{}]*(?:\{[^{}]*\}[^{}]*)*\}/);
      if (jsonMatch) {
        const parsed = JSON.parse(jsonMatch[0]);
        
        if (parsed.success !== undefined) {
          return {
            success: parsed.success,
            message: parsed.message,
            memoryId: parsed.memoryId || parsed.memory_id,
            error: parsed.error,
            category: parsed.category,
            content: parsed.content,
          };
        }
      }
    }
    
    // Check if the entire content is a JSON object with memory result structure
    if (content.trim().startsWith('{') && content.trim().endsWith('}')) {
      const parsed = JSON.parse(content);
      
      if (parsed.success !== undefined && (parsed.memoryId || parsed.memory_id || parsed.error)) {
        return {
          success: parsed.success,
          message: parsed.message,
          memoryId: parsed.memoryId || parsed.memory_id,
          error: parsed.error,
          category: parsed.category,
          content: parsed.content,
        };
      }
    }
    
    return null;
  } catch (e) {
    return null;
  }
}
