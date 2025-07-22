'use client';

import { Weather } from '../weather';
import { DocumentToolCall, DocumentToolResult } from '../document';
import { GitHubRepoResults } from '../github-repo-results';
import { GitHubFileResults, type GitHubFile } from '../github-file-results';
import { GitHubSearchResults } from '../github-search-results';
import { TruncatedFileDisplay } from './truncated-file';
import { GitBranchIcon, ChevronDownIcon, ChevronUpIcon } from 'lucide-react';
import cx from 'classnames';
import { GitHubFileExplorer } from '../github-file-explorer';
import { GitHubRepoCard, type Repository as RepoCardRepository } from '../github-repo-card';
import { useState, useEffect } from 'react';
import { FileIcon } from 'lucide-react';
import { AlertTriangleIcon, XCircleIcon, RefreshCwIcon } from 'lucide-react';

// Type for the file explorer repository
interface FileExplorerRepository {
  id: number;
  name: string;
  full_name: string;
  owner: { login: string };
  private: boolean;
  description?: string;
  html_url: string;
}

interface ToolInvocationProps {
  toolName: string;
  state: 'call' | 'result';
  toolCallId?: string;
  args?: any;
  result?: any;
  isReadonly?: boolean;
}

function getToolIcon(toolName: string) {
  switch (toolName) {
    case 'getWeather':
      return '🌤️';
    case 'createDocument':
    case 'updateDocument':
      return '📝';
    case 'requestSuggestions':
      return '💡';
    case 'searchMemories':
    case 'get_memory':
      return '🔍';
    case 'taskTracker':
      return '📋';
    case 'listRepositories':
    case 'createProject':
    case 'getRepositoryFiles':
    case 'getFileContent':
    case 'searchFiles':
    case 'openFileExplorer':
    case 'createRepository':
    case 'requestRepositoryApproval':
    case 'getBranchStatus':
    case 'updateStagedFile':
    case 'getStagingState':
    case 'clearStagedFiles':
      return '📂';
    default:
      return '🔧';
  }
}

function getToolLabel(toolName: string, args?: any) {
  switch (toolName) {
    case 'getWeather':
      return `Getting weather for ${args?.location || '...'}`;
    case 'createDocument':
      return `Creating document: ${args?.title || '...'}`;
    case 'updateDocument':
      return `Updating document: ${args?.title || '...'}`;
    case 'requestSuggestions':
      return 'Generating suggestions';
    case 'searchMemories':
    case 'get_memory':
      return `Searching memories: "${args?.query || '...'}"`;
    case 'taskTracker':
      if (args?.action === 'create_plan') return `Creating task plan (${args.tasks?.length || 0} tasks)`;
      if (args?.action === 'complete_task') return 'Completing task';
      if (args?.action === 'update_task') return 'Updating task status';
      if (args?.action === 'get_status') return 'Checking task progress';
      return 'Managing tasks';
    case 'listRepositories':
      return 'Loading repositories...';
    case 'createProject':
      return `Creating project: ${args?.project?.name || '...'}`;
    case 'getRepositoryFiles':
      return `Loading files from ${args?.repository?.owner}/${args?.repository?.name}...`;
    case 'getFileContent':
      return `Reading file: ${args?.path || '...'}`;
    case 'searchFiles':
      return `Searching files: "${args?.query || '...'}"`;
    case 'openFileExplorer':
      return `Opening file explorer: ${args?.repository?.owner}/${args?.repository?.name}...`;
    case 'createRepository':
      return `Creating repository: ${args?.name || '...'}`;
    case 'requestRepositoryApproval':
      return `Requesting approval: ${args?.name || '...'}`;
    case 'getBranchStatus':
      return 'Checking branch status...';
    case 'updateStagedFile':
      return `Updating file: ${args?.filePath || '...'}`;
    default:
      return `Running ${toolName}...`;
  }
}

function getToolResult(toolName: string, result: any) {
  if (!result.success) {
    return `Error: ${result.error}`;
  }

  switch (toolName) {
    case 'searchMemories':
    case 'get_memory':
      return `Found ${result.memories?.length || 0} relevant memories`;
    case 'taskTracker':
      if (result.error) return `Error: ${result.error}`;
      if (result.allCompleted) return '🎉 All tasks completed!';
      if (result.nextTask) return `Next: ${result.nextTask.title}`;
      return result.message || 'Task updated';
    case 'listRepositories':
      return `Found ${result.repositories?.length || 0} repositories`;
    case 'createProject':
      return `Created project "${result.project?.name}" with ${result.stagedFiles?.length || 0} files`;
    case 'getRepositoryFiles':
      return `Loaded ${result.files?.length || 0} files from ${result.currentPath || '/'}`;
    case 'searchFiles':
      return `Found ${result.searchResults?.length || 0} matching files`;
    case 'createRepository':
      return result.requiresApproval ? 'Awaiting approval' : `Created repository "${result.repository?.name}"`;
    case 'updateStagedFile':
      return `Updated ${result.filePath || 'file'} in staging area`;
    case 'getBranchStatus':
      return result.branchName ? `On branch: ${result.branchName}` : result.message;
    case 'openFileExplorer':
      return `Opened file explorer for ${result.repository?.full_name}`;
    default:
      return 'Operation completed successfully';
  }
}

function getToolResultDetails(toolName: string, result: any) {
  if (!result.success) {
    return null;
  }

  switch (toolName) {
    case 'createProject':
      if (result.stagedFiles?.length) {
        return (
          <div className="mt-2 space-y-2">
            <div className="text-sm font-medium text-gray-700">Created files:</div>
            <div className="space-y-1">
              {result.stagedFiles.map((file: any, index: number) => (
                <div key={index} className="flex items-center gap-2 text-sm bg-gray-50 p-2 rounded">
                  <FileIcon className="w-4 h-4 text-blue-500" />
                  <span className="text-gray-600">{file.path}</span>
                  {file.isStaged && (
                    <span className="text-xs bg-blue-100 text-blue-700 px-2 py-0.5 rounded">Staged</span>
                  )}
                </div>
              ))}
            </div>
            <div className="text-xs text-gray-500 mt-1">
              These files are staged and ready for review
            </div>
          </div>
        );
      }
      return null;

    case 'updateStagedFile':
      return (
        <div className="mt-2">
          <div className="flex items-center gap-2 text-sm bg-gray-50 p-2 rounded">
            <FileIcon className="w-4 h-4 text-green-500" />
            <span className="text-gray-600">{result.filePath || 'File updated'}</span>
            <span className="text-xs bg-green-100 text-green-700 px-2 py-0.5 rounded">Updated</span>
          </div>
        </div>
      );

    case 'getStagingState':
      if (result.stagedFiles?.length) {
        return (
          <div className="mt-2 space-y-2">
            <div className="text-sm font-medium text-gray-700">Currently staged files:</div>
            <div className="space-y-1">
              {result.stagedFiles.map((file: any, index: number) => (
                <div key={index} className="flex items-center gap-2 text-sm bg-gray-50 p-2 rounded">
                  <FileIcon className="w-4 h-4 text-blue-500" />
                  <span className="text-gray-600">{file.path}</span>
                  <span className="text-xs bg-blue-100 text-blue-700 px-2 py-0.5 rounded">Staged</span>
                </div>
              ))}
            </div>
          </div>
        );
      }
      return (
        <div className="mt-2 text-sm text-gray-600">
          No files currently staged
        </div>
      );

    case 'clearStagedFiles':
      return (
        <div className="mt-2 text-sm text-gray-600">
          Cleared {result.clearedCount} staged files
        </div>
      );

    default:
      return null;
  }
}

function getErrorDisplay(error: string) {
  // Handle specific error types
  if (error.includes('overloaded')) {
    return (
      <div className="mt-2 p-3 bg-yellow-50 border border-yellow-200 rounded-md">
        <div className="flex items-center gap-2">
          <AlertTriangleIcon className="w-5 h-5 text-yellow-600" />
          <span className="text-sm font-medium text-yellow-800">Server is busy</span>
        </div>
        <p className="mt-1 text-sm text-yellow-700">
          The server is currently overloaded. Please wait a moment and try again.
        </p>
      </div>
    );
  }

  // Default error display
  return (
    <div className="mt-2 p-3 bg-red-50 border border-red-200 rounded-md">
      <div className="flex items-center gap-2">
        <XCircleIcon className="w-5 h-5 text-red-600" />
        <span className="text-sm font-medium text-red-800">Error</span>
      </div>
      <p className="mt-1 text-sm text-red-700">{error}</p>
    </div>
  );
}

// Add a helper function to extract owner string
function getOwnerString(owner: string | { login: string } | undefined): string {
  if (!owner) return '';
  return typeof owner === 'string' ? owner : owner.login;
}

export function ToolInvocation({ 
  toolName, 
  state, 
  toolCallId, 
  args, 
  result,
  isReadonly = false
}: ToolInvocationProps) {
  const [isExpanded, setIsExpanded] = useState(false);
  const [isRetrying, setIsRetrying] = useState(false);

  // Add logging for props
  useEffect(() => {
    console.log('[ToolInvocation] Props:', {
      toolName,
      state,
      toolCallId,
      args,
      result
    });
  }, [toolName, state, toolCallId, args, result]);

  // Safety check for undefined result
  const safeResult = result || {};

  // Add logging for state changes
  useEffect(() => {
    if (state === 'result' && safeResult) {
      console.log(`[ToolInvocation] Tool ${toolName} completed:`, {
        success: safeResult.success,
        error: safeResult.error,
        hasRepositories: Boolean(safeResult.repositories),
        repositoriesLength: safeResult.repositories?.length
      });
    }
  }, [state, safeResult, toolName]);

  // Add retry handler
  const handleRetry = () => {
    console.log('[ToolInvocation] Retrying tool:', toolName);
    setIsRetrying(true);
    // Here you would implement the retry logic
    setTimeout(() => setIsRetrying(false), 2000);
  };

  // Special handling for document tools
  if (toolName === 'createDocument' || toolName === 'updateDocument' || toolName === 'requestSuggestions') {
    return state === 'call' ? (
      <DocumentToolCall
        type={toolName === 'createDocument' ? 'create' : toolName === 'updateDocument' ? 'update' : 'request-suggestions'}
        args={args}
        isReadonly={isReadonly}
      />
    ) : (
      <DocumentToolResult
        type={toolName === 'createDocument' ? 'create' : toolName === 'updateDocument' ? 'update' : 'request-suggestions'}
        result={result}
        isReadonly={isReadonly}
      />
    );
  }

  // Special handling for weather tool
  if (toolName === 'getWeather') {
    return state === 'call' ? (
      <Weather />
    ) : (
      <Weather weatherAtLocation={result} />
    );
  }

  // Special handling for task tracker - keep the detailed UI
  if (toolName === 'taskTracker') {
    if (state === 'call') {
      return (
        <div className="bg-purple-50 border border-purple-200 rounded-lg p-3">
          <div className="flex items-center gap-2">
            <svg className="w-5 h-5 text-purple-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
            </svg>
            <span className="text-purple-800">
              {args.action === 'create_plan' ? 'Creating task plan...' :
               args.action === 'complete_task' ? 'Completing task...' :
               args.action === 'update_task' ? 'Updating task status...' :
               args.action === 'get_status' ? 'Checking task progress...' :
               'Managing tasks...'}
            </span>
          </div>
          {args.action === 'create_plan' && args.tasks?.length > 0 && (
            <p className="text-sm text-purple-700 mt-1">Planning {args.tasks.length} tasks</p>
          )}
        </div>
      );
    }

    return (
      <div className="bg-purple-50 border border-purple-200 rounded-lg p-3">
        <div className="flex items-center gap-2">
          <svg className="w-5 h-5 text-purple-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
          </svg>
          <span className="text-purple-800">
            {result.error ? 'Task Error' : 'Task Updated'}
          </span>
        </div>
        {result.error ? (
          <p className="text-sm text-red-600 mt-1">{result.error}</p>
        ) : (
          <div className="mt-2">
            {result.message && (
              <p className="text-sm text-purple-700">{result.message}</p>
            )}
            {result.nextTask && (
              <div className="mt-1 text-sm text-purple-600">
                Next task: {result.nextTask.title}
              </div>
            )}
            {result.allCompleted && (
              <div className="mt-1 text-sm font-medium text-green-600">
                🎉 All tasks completed!
              </div>
            )}
            {result.tasks?.map((task: any, index: number) => (
              <div key={task.id || index} className="flex items-center gap-2 text-sm text-purple-700 mt-1">
                <span>{index + 1}.</span>
                <span>{task.title}</span>
                <span className="text-purple-500">({task.status})</span>
              </div>
            ))}
          </div>
        )}
      </div>
    );
  }

  // Compact tool invocation display with expand/collapse for details
  return (
    <div className={cx(
      'rounded-md text-sm overflow-hidden transition-all duration-200',
      state === 'call' ? 'bg-blue-50 border border-blue-100' : 
      !safeResult?.success ? 'bg-red-50 border border-red-100' :
      'bg-gray-50 border border-gray-100'
    )}>
      <div className="flex items-center gap-2 px-3 py-2 cursor-pointer" onClick={() => setIsExpanded(!isExpanded)}>
        <span className="text-lg" role="img" aria-label="tool icon">
          {getToolIcon(toolName)}
        </span>
        <div className="flex-1 min-w-0">
          <div className="font-medium text-gray-700 truncate">
            {state === 'call' ? (
              <div className="flex items-center gap-2">
                <span>{getToolLabel(toolName, args)}</span>
                <div className="animate-pulse w-2 h-2 bg-blue-400 rounded-full" />
              </div>
            ) : (
              getToolResult(toolName, safeResult)
            )}
          </div>
        </div>
        {state === 'result' && !safeResult?.success ? (
          <button 
            className="text-red-600 hover:text-red-800 p-1 rounded-full hover:bg-red-100 transition-colors"
            onClick={(e) => {
              e.stopPropagation();
              handleRetry();
            }}
          >
            <RefreshCwIcon className={cx("w-4 h-4", isRetrying && "animate-spin")} />
          </button>
        ) : (
          // Only show expand/collapse button if we have expandable content
          (toolName === 'openFileExplorer' && safeResult?.repository) || 
          (toolName === 'listRepositories' && safeResult?.repositories) || 
          safeResult?.files || 
          safeResult?.searchResults || 
          safeResult?.file
        ) && (
          <button className="text-gray-500 hover:text-gray-700">
            {isExpanded ? <ChevronUpIcon className="w-4 h-4" /> : <ChevronDownIcon className="w-4 h-4" />}
          </button>
        )}
      </div>

      {/* Error display */}
      {!safeResult?.success && safeResult?.error && (
        <div className="px-3 pb-3">
          {getErrorDisplay(safeResult.error)}
        </div>
      )}

      {/* Expandable content for results */}
      {isExpanded && state === 'result' && (
        <div className="border-t border-gray-100 p-3">
          {/* Show detailed result information */}
          {safeResult?.success && getToolResultDetails(toolName, safeResult)}
          
          {/* Handle repositories display with proper error checking */}
          {(() => {
            if (safeResult?.success && toolName === 'listRepositories') {
              console.log('[ToolInvocation] Full result:', safeResult);
              
              // Early return if no repositories is undefined
              if (!safeResult.repositories) {
                console.warn('[ToolInvocation] No repositories found in result');
                return (
                  <div className="text-gray-500 text-sm">
                    No repositories found
                  </div>
                );
              }

              // Early return if repositories is not an array
              if (!Array.isArray(safeResult.repositories)) {
                console.error('[ToolInvocation] Repositories is not an array:', safeResult.repositories);
                return (
                  <div className="text-red-500 text-sm">
                    Error: Invalid repository data format
                  </div>
                );
              }

              // Only proceed if we have valid data
              return (
                <div className="grid gap-4">
                  {console.log('[ToolInvocation] Repository data:', safeResult.repositories)}
                  {safeResult.repositories.map((repo: { 
                    id: number;
                    name: string;
                    owner: string | { login: string };
                    description?: string;
                    private: boolean;
                    url?: string;
                    html_url?: string;
                    updated_at: string;
                  }) => {
                    console.log('[ToolInvocation] Processing repo:', repo);
                    const ownerString = getOwnerString(repo.owner);
                    return (
                      <GitHubRepoCard
                        key={repo.id}
                        repository={{
                          id: repo.id,
                          name: repo.name,
                          owner: ownerString,
                          description: repo.description || '',
                          private: repo.private,
                          url: repo.url || repo.html_url || '',
                          updated_at: repo.updated_at
                        }}
                        onClick={() => {
                          console.log('Repository selected:', repo);
                        }}
                      />
                    );
                  })}
                </div>
              );
            }
            return null;
          })()}

          {/* Handle other result types */}
          {safeResult?.success && safeResult?.searchResults && (
            <GitHubSearchResults
              searchResults={safeResult.searchResults}
              searchQuery={safeResult.searchQuery}
              onFileSelect={(searchResult: any) => {
                console.log('Search result selected:', searchResult);
              }}
            />
          )}
          {safeResult?.success && safeResult?.files && (
            <GitHubFileResults
              files={safeResult.files}
              currentPath={safeResult.currentPath}
              repositoryName={safeResult.repositoryName}
              onFileSelect={(file: GitHubFile) => {
                console.log('File selected:', file);
              }}
            />
          )}
          {safeResult?.success && safeResult?.file && (
            <TruncatedFileDisplay 
              file={safeResult.file} 
              editSuggestion={safeResult.editSuggestion}
            />
          )}
          {safeResult?.success && safeResult?.repository && toolName === 'openFileExplorer' && (() => {
            console.log('[ToolInvocation] Opening file explorer with repo:', safeResult.repository);
            
            // Handle both string and object formats for owner using our helper function
            const ownerLogin = getOwnerString(safeResult.repository.owner);
            
            if (!ownerLogin) {
              console.error('[ToolInvocation] Invalid owner format in repository:', safeResult.repository);
              return (
                <div className="text-red-500 text-sm">
                  Error: Invalid repository owner format
                </div>
              );
            }
            
            return (
              <div className="w-full border rounded-lg overflow-hidden">
                <GitHubFileExplorer
                  onFileSelect={(file: GitHubFile, repo: FileExplorerRepository) => {
                    console.log('File selected:', file, 'from repo:', repo);
                  }}
                  onFileChange={(file: GitHubFile, content: string, repo: FileExplorerRepository) => {
                    console.log('File changed:', file, 'in repo:', repo);
                  }}
                  initialRepository={{
                    owner: ownerLogin,
                    name: safeResult.repository.name
                  }}
                />
              </div>
            );
          })()}
        </div>
      )}
    </div>
  );
} 