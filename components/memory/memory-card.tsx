import { formatDistanceToNow } from 'date-fns';
import { Card, CardContent, CardHeader, CardFooter } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';

// Custom Memory Icon component
const MemoryIcon = ({
  size = 14,
  isEnabled = false,
  gradientId,
}: {
  size?: number;
  isEnabled: boolean;
  gradientId: string;
}) => {
  return (
    <svg
      width={size}
      height={size * 1.18}
      viewBox="0 0 105 124"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
    >
      <path
        d="M27.9998 101.5C-11.5 158 6.99988 51 43.4008 60.5002C99.2884 75.0861 115.18 20.7781 83.6804 8.27816C40.2693 -8.94844 51.9998 65 27.9998 101.5Z"
        stroke={isEnabled ? `url(#${gradientId})` : 'currentColor'}
        strokeWidth="8"
        strokeLinecap="round"
        strokeLinejoin="round"
        className={isEnabled ? '' : 'opacity-70'}
      />
      <defs>
        <linearGradient
          id={gradientId}
          x1="17.2207"
          y1="89.4214"
          x2="68.8959"
          y2="35.8394"
          gradientUnits="userSpaceOnUse"
        >
          <stop stopColor="#0060E0" />
          <stop offset="0.6" stopColor="#00ACFA" />
          <stop offset="1" stopColor="#0BCDFF" />
        </linearGradient>
      </defs>
    </svg>
  );
};

export interface MemoryItem {
  content: string;
  id: string;
  timestamp?: string;
  createdAt?: string;
  emoji_tags?: string[];
  topics?: string[];
  hierarchical_structure?: string;
  category?: string;
  customMetadata?: {
    category?: string;
  };
}

interface MemoryCardProps {
  memory: MemoryItem;
  onClick?: () => void;
}

// Get category colors
function getCategoryColor(category?: string): { bg: string; text: string } {
  switch (category?.toLowerCase()) {
    case 'preferences':
      return { bg: 'bg-blue-100', text: 'text-blue-800' };
    case 'goals':
      return { bg: 'bg-green-100', text: 'text-green-800' };
    case 'tasks':
      return { bg: 'bg-purple-100', text: 'text-purple-800' };
    case 'knowledge':
      return { bg: 'bg-amber-100', text: 'text-amber-800' };
    default:
      return { bg: 'bg-gray-100', text: 'text-gray-800' };
  }
}

export function MemoryCard({ memory, onClick }: MemoryCardProps) {
  // Format the timestamp - use createdAt if available, otherwise timestamp
  const formattedDate = (() => {
    try {
      const dateStr = memory.createdAt || memory.timestamp;
      if (!dateStr) return 'unknown time';

      // Try parsing the timestamp
      const date = new Date(dateStr);

      // Check if date is valid
      if (Number.isNaN(date.getTime())) return 'unknown time';

      return formatDistanceToNow(date, { addSuffix: true });
    } catch (e) {
      console.error('Error formatting memory date:', e);
      return 'unknown time';
    }
  })();

  // Clean up memory content
  const cleanContent = (() => {
    try {
      if (!memory.content) return 'No content';

      // If content is an object, pretty-print it
      if (typeof memory.content === 'object') {
        return (
          <pre className="whitespace-pre-wrap text-xs">
            {JSON.stringify(memory.content, null, 2)}
          </pre>
        );
      }

      // Some memories might have HTML or special formatting
      let content = memory.content;

      // Remove any HTML tags
      if (typeof content === 'string') {
        content = content.replace(/<[^>]*>/g, '');
        // Remove any excessive whitespace
        content = content.replace(/\s+/g, ' ').trim();
        return content;
      }
      // fallback
      return String(content);
    } catch (e) {
      console.error('Error cleaning memory content:', e);
      return 'Error displaying content';
    }
  })();

  // Create a unique gradient ID for this memory card
  const gradientId = `memory-gradient-${memory.id.substring(0, 8)}`;
  
  // Get category from either direct property or customMetadata
  const category = memory.category || memory.customMetadata?.category;
  const categoryColors = getCategoryColor(category);
  
  // Check if we have enhanced metadata fields
  const hasEnhancedFields = !!(memory.emoji_tags?.length || memory.topics?.length || memory.hierarchical_structure);

  return (
    <Card
      className="hover:bg-muted/50 transition-colors cursor-pointer flex flex-col"
      onClick={onClick}
    >
      <CardHeader className="pb-1 pt-3 px-4 flex flex-row items-center gap-2">
        <div className="shrink-0 flex items-center gap-2">
          <MemoryIcon size={18} isEnabled={true} gradientId={gradientId} />
          {category && (
            <Badge variant="outline" className={`${categoryColors.bg} ${categoryColors.text} text-xs`}>
              {category}
            </Badge>
          )}
        </div>
        <div className="text-xs text-muted-foreground ml-auto">{formattedDate}</div>
      </CardHeader>
      <CardContent className="px-4 py-2 grow">
        {typeof cleanContent === 'string' ? (
          <p className="text-sm line-clamp-3">{cleanContent}</p>
        ) : (
          cleanContent
        )}
        
        {memory.emoji_tags && memory.emoji_tags.length > 0 && (
          <div className="text-lg mt-1">
            {memory.emoji_tags.join(' ')}
          </div>
        )}
      </CardContent>
      
      {hasEnhancedFields && (
        <CardFooter className="px-4 py-2 flex flex-col items-start gap-1 border-t border-border">
          {memory.topics && memory.topics.length > 0 && (
            <div className="flex flex-wrap gap-1">
              {memory.topics.slice(0, 3).map((topic, i) => (
                <Badge key={i} variant="secondary" className="text-xs">
                  {topic}
                </Badge>
              ))}
              {memory.topics.length > 3 && (
                <Badge variant="outline" className="text-xs">
                  +{memory.topics.length - 3}
                </Badge>
              )}
            </div>
          )}
          
          {memory.hierarchical_structure && (
            <div className="text-xs text-muted-foreground flex items-center gap-1">
              <span>Path:</span>
              <code className="bg-muted p-1 rounded text-xs truncate max-w-[200px]">
                {memory.hierarchical_structure}
              </code>
            </div>
          )}
        </CardFooter>
      )}
    </Card>
  );
}

export function MemoryCardGrid({
  memories,
  onMemoryClick,
}: {
  memories: MemoryItem[];
  onMemoryClick?: (memory: MemoryItem) => void;
}) {
  if (!memories || memories.length === 0) {
    return (
      <div className="bg-muted p-4 rounded-lg text-center">
        <p className="text-muted-foreground text-sm">No memories found</p>
      </div>
    );
  }

  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-3">
      {memories.map((memory) => (
        <MemoryCard
          key={memory.id}
          memory={memory}
          onClick={() => onMemoryClick?.(memory)}
        />
      ))}
    </div>
  );
}
