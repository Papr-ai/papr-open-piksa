import { useState } from 'react';
import { GitHubRepoGrid, GitHubRepoCard, Repository } from './github-repo-card';
import { Card, CardContent, CardHeader } from './ui/card';
import { Button } from './ui/button';
import { GitBranchIcon, ChevronDownIcon, ChevronUpIcon } from 'lucide-react';

interface GitHubRepoResultsProps {
  repositories: Repository[];
  onRepositorySelect?: (repository: Repository) => void;
  title?: string;
}

export function GitHubRepoResults({ 
  repositories, 
  onRepositorySelect, 
  title = "GitHub Repositories" 
}: GitHubRepoResultsProps) {
  const [isExpanded, setIsExpanded] = useState(false);

  if (!repositories || repositories.length === 0) {
    return null;
  }

  // Show first 6 repositories by default
  const displayedRepositories = isExpanded ? repositories : repositories.slice(0, 6);
  const hasMore = repositories.length > 6;

  return (
    <Card className="my-4">
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <GitBranchIcon size={20} className="text-blue-600" />
            <h3 className="text-lg font-semibold">{title}</h3>
          </div>
          <span className="text-sm text-muted-foreground">
            {repositories.length} repositories
          </span>
        </div>
        <p className="text-sm text-muted-foreground">
          Select a repository to work with or browse its files
        </p>
      </CardHeader>
      <CardContent>
        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-3">
          {displayedRepositories.map((repository) => (
            <GitHubRepoCard
              key={repository.id}
              repository={repository}
              onClick={() => onRepositorySelect?.(repository)}
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
                  Show {repositories.length - 6} More
                </>
              )}
            </Button>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

// Helper function to detect if a message contains GitHub repository data
export function detectGitHubRepositories(content: string): Repository[] | null {
  try {
    // Try to parse the content as JSON
    const parsed = JSON.parse(content);
    
    // Check if it has a repositories array
    if (parsed.success && parsed.repositories && Array.isArray(parsed.repositories)) {
      return parsed.repositories.map((repo: any) => ({
        id: repo.id,
        name: repo.name,
        owner: repo.owner,
        description: repo.description,
        private: repo.private,
        url: repo.url,
        updated_at: repo.updated_at,
      }));
    }
    
    return null;
  } catch (e) {
    // If parsing fails, check if it's a raw repository array
    try {
      const parsed = JSON.parse(content);
      if (Array.isArray(parsed) && parsed.length > 0 && parsed[0].id && parsed[0].name) {
        return parsed.map((repo: any) => ({
          id: repo.id,
          name: repo.name,
          owner: repo.owner?.login || repo.owner,
          description: repo.description,
          private: repo.private,
          url: repo.html_url || repo.url,
          updated_at: repo.updated_at,
        }));
      }
    } catch (e2) {
      // Not JSON or not repository data
    }
    
    return null;
  }
}

// Helper function to extract repository data from tool call results
export function extractRepositoriesFromToolResult(toolResult: any): Repository[] | null {
  if (!toolResult) return null;
  
  // Check if it's a direct repository result
  if (toolResult.success && toolResult.repositories && Array.isArray(toolResult.repositories)) {
    return toolResult.repositories.map((repo: any) => ({
      id: repo.id,
      name: repo.name,
      owner: repo.owner,
      description: repo.description,
      private: repo.private,
      url: repo.url,
      updated_at: repo.updated_at,
    }));
  }
  
  return null;
} 