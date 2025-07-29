import { useState } from 'react';
import { Card, CardContent, CardHeader } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { SearchIcon, ChevronDownIcon, ChevronUpIcon, FileIcon, FolderOpenIcon } from 'lucide-react';

interface SearchResult {
  repository: {
    owner: string;
    name: string;
  };
  file: {
    name: string;
    path: string;
    url: string;
  };
  score: number;
  textMatches?: any[];
}

interface GitHubSearchResultsProps {
  searchResults: SearchResult[];
  searchQuery: string;
  onFileSelect?: (result: SearchResult) => void;
  title?: string;
}

export function GitHubSearchResults({ 
  searchResults, 
  searchQuery,
  onFileSelect, 
  title = "File Search Results" 
}: GitHubSearchResultsProps) {
  const [isExpanded, setIsExpanded] = useState(false);

  if (!searchResults || searchResults.length === 0) {
    return (
      <Card className="my-4">
        <CardContent className="py-6">
          <div className="flex items-center justify-center flex-col text-center">
            <SearchIcon size={48} className="text-gray-400 mb-4" />
            <p className="text-lg font-medium text-gray-700">No files found</p>
            <p className="text-sm text-gray-500 mt-1">
              Try searching with different keywords or file extensions
            </p>
          </div>
        </CardContent>
      </Card>
    );
  }

  // Show first 8 results by default
  const displayedResults = isExpanded ? searchResults : searchResults.slice(0, 8);
  const hasMore = searchResults.length > 8;

  return (
    <Card className="my-4">
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <SearchIcon size={20} className="text-green-600" />
            <h3 className="text-lg font-semibold">{title}</h3>
          </div>
          <span className="text-sm text-muted-foreground">
            {searchResults.length} files found
          </span>
        </div>
        <p className="text-sm text-muted-foreground">
          Search results for &quot;{searchQuery}&quot; - Click on a file to view and edit
        </p>
      </CardHeader>
      <CardContent>
        <div className="space-y-3">
          {displayedResults.map((result, index) => (
            <SearchResultCard
              key={`${result.repository.owner}/${result.repository.name}/${result.file.path}`}
              result={result}
              onClick={() => onFileSelect?.(result)}
            />
          ))}
        </div>
        
        {hasMore && (
          <div className="mt-4 flex justify-center">
            <Button
              variant="outline"
              onClick={() => setIsExpanded(!isExpanded)}
              className="flex items-center gap-2"
            >
              {isExpanded ? (
                <>
                  <ChevronUpIcon size={16} />
                  Show Less
                </>
              ) : (
                <>
                  <ChevronDownIcon size={16} />
                  Show {searchResults.length - 8} More
                </>
              )}
            </Button>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

interface SearchResultCardProps {
  result: SearchResult;
  onClick: () => void;
}

function SearchResultCard({ result, onClick }: SearchResultCardProps) {
  const getFileIcon = (fileName: string) => {
    const extension = fileName.split('.').pop()?.toLowerCase();
    switch (extension) {
      case 'py':
        return <FileIcon className="w-4 h-4 text-green-500" />;
      case 'js':
      case 'jsx':
        return <FileIcon className="w-4 h-4 text-yellow-500" />;
      case 'ts':
      case 'tsx':
        return <FileIcon className="w-4 h-4 text-blue-600" />;
      case 'html':
        return <FileIcon className="w-4 h-4 text-orange-500" />;
      case 'css':
        return <FileIcon className="w-4 h-4 text-blue-400" />;
      case 'md':
        return <FileIcon className="w-4 h-4 text-gray-600" />;
      default:
        return <FileIcon className="w-4 h-4 text-gray-500" />;
    }
  };

  const formatPath = (path: string) => {
    const parts = path.split('/');
    if (parts.length <= 3) return path;
    return `${parts[0]}/.../${parts.slice(-2).join('/')}`;
  };

  return (
    <div
      onClick={onClick}
      className="border rounded-lg p-3 hover:bg-gray-50 cursor-pointer transition-colors"
    >
      <div className="flex items-start gap-3">
        <div className="flex-shrink-0 mt-1">
          {getFileIcon(result.file.name)}
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 mb-1">
            <span className="font-medium text-gray-900 truncate">
              {result.file.name}
            </span>
            <span className="text-xs bg-gray-100 text-gray-600 px-2 py-0.5 rounded">
              Score: {Math.round(result.score * 100)}%
            </span>
          </div>
          <div className="flex items-center gap-2 text-sm text-gray-600">
            <FolderOpenIcon size={14} />
            <span className="truncate">{formatPath(result.file.path)}</span>
          </div>
          <div className="flex items-center gap-2 text-sm text-gray-500 mt-1">
            <span className="bg-blue-100 text-blue-700 px-2 py-0.5 rounded text-xs">
              {result.repository.owner}/{result.repository.name}
            </span>
          </div>
        </div>
      </div>
    </div>
  );
}

// Helper function to detect if a message contains GitHub search results
export function detectGitHubSearchResults(content: string): { searchResults: SearchResult[], searchQuery: string } | null {
  try {
    // Try to parse the content as JSON
    const parsed = JSON.parse(content);
    
    // Check if it has search results
    if (parsed.success && parsed.searchResults && Array.isArray(parsed.searchResults)) {
      return {
        searchResults: parsed.searchResults,
        searchQuery: parsed.searchQuery || 'search',
      };
    }
    
    return null;
  } catch (e) {
    return null;
  }
} 