import { formatDistanceToNow } from 'date-fns';
import { Card, CardContent, CardHeader } from '@/components/ui/card';
import { GitBranchIcon, LockIcon, UnlockIcon, ExternalLinkIcon } from 'lucide-react';

export interface Repository {
  id: number;
  name: string;
  owner: string;
  description?: string;
  private: boolean;
  url: string;
  updated_at: string;
}

interface GitHubRepoCardProps {
  repository: Repository;
  onClick?: () => void;
}

export function GitHubRepoCard({ repository, onClick }: GitHubRepoCardProps) {
  // Format the timestamp
  const formattedDate = (() => {
    try {
      if (!repository.updated_at) return 'unknown time';

      const date = new Date(repository.updated_at);
      if (Number.isNaN(date.getTime())) return 'unknown time';

      return formatDistanceToNow(date, { addSuffix: true });
    } catch (e) {
      console.error('Error formatting repository date:', e);
      return 'unknown time';
    }
  })();

  return (
    <Card
      className="hover:bg-muted/50 transition-colors cursor-pointer flex flex-col"
      onClick={onClick}
    >
      <CardHeader className="pb-2 pt-3 px-4">
        <div className="flex items-center gap-2">
          <GitBranchIcon size={16} className="text-blue-600" />
          <div className="flex items-center gap-1 flex-1">
            <span className="font-medium text-sm">{repository.name}</span>
            {repository.private ? (
              <LockIcon size={12} className="text-gray-500" />
            ) : (
              <UnlockIcon size={12} className="text-gray-500" />
            )}
          </div>
          <a
            href={repository.url}
            target="_blank"
            rel="noopener noreferrer"
            className="text-gray-500 hover:text-blue-600 transition-colors"
            onClick={(e) => e.stopPropagation()}
          >
            <ExternalLinkIcon size={14} />
          </a>
        </div>
        <div className="text-xs text-muted-foreground">
          {repository.owner} • Updated {formattedDate}
        </div>
      </CardHeader>
      <CardContent className="px-4 py-2 grow">
        <p className="text-sm text-muted-foreground line-clamp-2">
          {repository.description || 'No description available'}
        </p>
      </CardContent>
    </Card>
  );
}

export function GitHubRepoGrid({
  repositories,
  onRepositoryClick,
}: {
  repositories: Repository[];
  onRepositoryClick?: (repository: Repository) => void;
}) {
  if (!repositories || repositories.length === 0) {
    return (
      <div className="bg-muted p-4 rounded-lg text-center">
        <p className="text-muted-foreground text-sm">No repositories found</p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h3 className="text-lg font-semibold">Your GitHub Repositories</h3>
        <span className="text-sm text-muted-foreground">
          {repositories.length} repositories
        </span>
      </div>
      <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-3">
        {repositories.map((repository) => (
          <GitHubRepoCard
            key={repository.id}
            repository={repository}
            onClick={() => onRepositoryClick?.(repository)}
          />
        ))}
      </div>
    </div>
  );
} 