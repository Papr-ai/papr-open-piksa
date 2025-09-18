'use client';

import { Weather } from '../weather';
import { DocumentToolCall, DocumentToolResult } from '@/components/document/document';
import { BookToolCall, BookToolResult } from '@/components/book/book-tool-result';
import { AddMemoryResults } from '@/components/memory/add-memory-results';
// Remove GitHub file results imports
import { GitHubSearchResults } from '../github/github-search-results';
import { TruncatedFileDisplay } from './truncated-file';
import { GitBranchIcon, ChevronDownIcon, ChevronUpIcon, ServerIcon, TerminalIcon } from 'lucide-react';
import cx from 'classnames';
import { GitHubRepoCard, type Repository as RepoCardRepository } from '@/components/github/github-repo-card';
import { useState, useEffect } from 'react';
import { FileIcon } from 'lucide-react';
import { AlertTriangleIcon, XCircleIcon, RefreshCwIcon } from 'lucide-react';
import { useArtifact } from '@/hooks/use-artifact';
import { generateUUID } from '@/lib/utils';
import { toast } from 'sonner';
import { Button } from '../ui/button';

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

// Define a simplified GitHub file interface to replace the imported one
interface GitHubFile {
  name: string;
  path: string;
  type: 'file' | 'dir';
  sha: string;
  size?: number;
  download_url?: string;
  content?: string;
}

function getToolIcon(toolName: string) {
  switch (toolName) {
    case 'getWeather':
      return '🌤️';
    case 'createDocument':
    case 'updateDocument':
      return '📝';
    case 'createBook':
      return '📚';
    case 'createBookArtifact':
      return '📖';
    case 'createImage':
    case 'createSingleBookImage':
    case 'structuredBookImageCreation':
      return '🎨';
    case 'enhancedBookCreation':
      return '✨';
    case 'createWritingTools':
      return '🖊️';
    case 'requestSuggestions':
      return '💡';
    case 'searchMemories':
    case 'get_memory':
      return '🔍';
    case 'addMemory':
      return '💾';
    case 'createTaskPlan':
    case 'updateTask':
    case 'completeTask':
    case 'getTaskStatus':
    case 'addTask':
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
    case 'createBook':
      return `Creating book chapter: ${args?.chapterTitle || '...'}`;
    case 'createBookArtifact':
      // Provide specific labels for different book creation actions
      if (args?.action === 'create_new') return `Creating new book: "${args?.bookTitle || '...'}"`;
      if (args?.action === 'update_step') {
        const stepNames = {
          1: 'Story Planning',
          2: 'Character Creation', 
          3: 'Chapter Writing',
          4: 'Environment Design',
          5: 'Scene Composition',
          6: 'Final Review'
        };
        const stepName = stepNames[args?.stepNumber as keyof typeof stepNames] || `Step ${args?.stepNumber}`;
        return `Updating ${stepName}...`;
      }
      if (args?.action === 'approve_step') return `Approving step ${args?.stepNumber}...`;
      if (args?.action === 'regenerate') return `Regenerating step ${args?.stepNumber}...`;
      return 'Working on book creation...';
    case 'createImage':
      return `Creating image: ${args?.prompt?.substring(0, 50) || '...'}`;
    case 'createSingleBookImage':
      return `Creating book illustration...`;
    case 'structuredBookImageCreation':
      return `Creating structured book images...`;
    case 'enhancedBookCreation':
      return `Creating enhanced book content...`;
    case 'createWritingTools':
      return `Setting up writing tools...`;
    case 'requestSuggestions':
      return 'Generating suggestions';
    case 'searchMemories':
    case 'get_memory':
      return `Searching memories: "${args?.query || '...'}"`;
    case 'addMemory':
      return `Adding ${args?.category || '...'} memory`;
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

function getToolResult(toolName: string, result: any, args?: any) {
  if (!result.success) {
    return `Error: ${result.error}`;
  }

  switch (toolName) {
    case 'searchMemories':
    case 'get_memory':
      return `Found ${result.memories?.length || 0} relevant memories`;
    case 'addMemory':
      return `Added ${args?.category || ''} memory`;
    case 'taskTracker':
      if (result.error) return `Error: ${result.error}`;
      if (result.allCompleted) return '🎉 All tasks completed!';
      if (result.nextTask) return `Next: ${result.nextTask.title}`;
      return result.message || 'Task updated';
    case 'listRepositories':
      return `Found ${result.repositories?.length || 0} repositories`;
    case 'createRepository':
      return result.requiresApproval ? 'Awaiting approval' : `Created repository "${result.repository?.name}"`;
    case 'createProject':
      return `Created project "${result.project?.name}" with ${result.stagedFiles?.length || 0} files`;
    case 'getRepositoryFiles':
      return `Loaded ${result.files?.length || 0} files from ${result.currentPath || '/'}`;
    case 'searchFiles':
      return `Found ${result.searchResults?.length || 0} matching files`;
    case 'updateStagedFile':
      return `Created/Updated file "${result.filePath || result.path || 'file'}" in staging area`;
    case 'getBranchStatus':
      return result.branchName ? `On branch: ${result.branchName}` : result.message;
    case 'openFileExplorer':
      return `Opened file explorer for ${result.repository?.full_name}`;
    case 'getFileContent':
      return `File "${result.path || args?.path || 'file'}" read successfully`;
    default:
      // Try to provide a more specific message if possible
      if (toolName.includes('File') || toolName.includes('file')) {
        return `File operation completed successfully`;
      }
      if (result.message) {
        return result.message;
      }
      return `${toolName} completed successfully`;
  }
}

// Create a separate component for the repository approval UI
function RepositoryApprovalCard({ repository }: { repository: any }) {
  const [isApproving, setIsApproving] = useState(false);
  const [isApproved, setIsApproved] = useState(false);
  
  const handleApprove = async () => {
    setIsApproving(true);
    try {
      const response = await fetch('/api/github/create-repository', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          name: repository.name,
          description: repository.description,
          isPrivate: repository.private
        }),
      });
      
      const data = await response.json();
      
      if (data.success) {
        toast.success(`Repository "${data.repository.name}" created successfully!`);
        setIsApproved(true);
        // Open the repository in a new tab
        if (data.repository.html_url) {
          window.open(data.repository.html_url, '_blank');
        }
      } else {
        toast.error(`Failed to create repository: ${data.error}`);
      }
    } catch (error) {
      console.error('[GitHub] Error creating repository:', error);
      toast.error('Failed to create repository. Please try again.');
    } finally {
      setIsApproving(false);
    }
  };

  return (
    <div className="mt-2 p-3 bg-blue-50 border border-blue-200 rounded-md">
      <div className="flex items-center gap-2 mb-2">
        <GitBranchIcon className="w-5 h-5 text-blue-600" />
        <span className="text-sm font-medium text-blue-800">Repository Creation Request</span>
      </div>
      <p className="text-sm text-blue-700 mb-3">
        Approve creating a new repository with these details:
      </p>
      <div className="space-y-1 mb-3">
        <div className="text-sm"><span className="font-medium">Name:</span> {repository.name}</div>
        <div className="text-sm"><span className="font-medium">Description:</span> {repository.description}</div>
        <div className="text-sm">
          <span className="font-medium">Visibility:</span> {repository.private ? 'Private' : 'Public'}
        </div>
      </div>
      {isApproved ? (
        <div className="text-sm text-green-600 font-medium">
          ✓ Repository created successfully
        </div>
      ) : (
        <div className="flex justify-end gap-2">
          <Button 
            variant="outline" 
            size="sm"
            className="bg-white text-red-600 border-red-200 hover:bg-red-50 hover:text-red-700"
            onClick={() => {
              toast.error('Repository creation cancelled');
            }}
            disabled={isApproving}
          >
            Cancel
          </Button>
          <Button 
            variant="default"
            size="sm"
            className="bg-blue-600 text-white hover:bg-blue-700"
            onClick={handleApprove}
            disabled={isApproving}
          >
            {isApproving ? (
              <>
                <RefreshCwIcon className="w-4 h-4 mr-1 animate-spin" />
                Creating...
              </>
            ) : 'Approve'}
          </Button>
        </div>
      )}
    </div>
  );
}

function getToolResultDetails(toolName: string, result: any) {
  if (!result.success) {
    return null;
  }

  switch (toolName) {
    case 'createRepository':
      if (result.requiresApproval && result.repository) {
        return <RepositoryApprovalCard repository={result.repository} />;
      }
      return null;
    
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
                    <span className="text-xs bg-blue-100 text-blue-700 px-2 py-0.5 rounded">Created & Staged</span>
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
            <span className="text-gray-600">{result.filePath || result.path || 'File updated'}</span>
            <span className="text-xs bg-green-100 text-green-700 px-2 py-0.5 rounded">Updated & Staged</span>
          </div>
          <div className="text-xs text-gray-500 mt-1">
            File &quot;{result.filePath || result.path || 'file'}&quot; has been updated in staging area
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
              <div className="text-xs text-gray-500 mt-1">
                {result.stagedFiles.length} file{result.stagedFiles.length !== 1 ? 's' : ''} in staging area
              </div>
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

// Update the GitHubFile type to include content
interface ExtendedGitHubFile extends GitHubFile {
  content?: string;
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
  // Move the useArtifact hook outside of conditional rendering
  const { setArtifact } = useArtifact();

  // Add logging for props
  useEffect(() => {
    console.log('[ToolInvocation] Props:', {
      toolName,
      state,
      toolCallId,
      args,
      result
    });
    
    // Special logging for image creation tools
    if (toolName === 'createSingleBookImage' || toolName === 'createImage') {
      console.log('[ToolInvocation] 🎨 Image creation tool detected:', {
        toolName,
        state,
        hasArgs: !!args,
        hasResult: !!result
      });
    }
  }, [toolName, state, toolCallId, args, result]);

  // Auto-expand file explorer when it's rendered
  useEffect(() => {
    if (state === 'result' && toolName === 'openFileExplorer' && result?.success) {
      console.log('[ToolInvocation] Auto-expanding file explorer');
      setIsExpanded(true);
    }
  }, [state, toolName, result]);

  // Create GitHub artifact effect for file explorer
  useEffect(() => {
    if (state === 'result' && toolName === 'openFileExplorer' && result?.success && result?.repository) {
      const ownerLogin = getOwnerString(result.repository.owner);
      
      if (ownerLogin) {
        console.log('[ToolInvocation] Creating GitHub code artifact for repository:', {
          owner: ownerLogin,
          name: result.repository.name,
          initialFilePath: result.initialFilePath || ''
        });
        
        try {
          // Create the artifact with proper initialization data
          const metadata = {
            initialRepository: {
              owner: ownerLogin,
              name: result.repository.name
            },
            initialFilePath: result.initialFilePath || '',
            stagedFiles: result.stagedFiles || []
          };
          
          // Create a proper UUID instead of timestamp-based ID
          const documentId = generateUUID();
          
          console.log('[ToolInvocation] Setting artifact with metadata:', metadata);
          
          setArtifact({
            title: `GitHub File Explorer: Repository ${ownerLogin}/${result.repository.name}`,
            documentId: documentId,
            kind: 'text',  // Change from 'github-code' to 'text' as a valid type
            content: JSON.stringify(metadata),
            isVisible: true,
            status: 'idle',
            boundingBox: {
              top: 100,
              left: 100,
              width: 1000, // Wider to accommodate all panels
              height: 600
            },
            language: 'typescript' // Default language
          });
          
          // Log success message
          console.log('[ToolInvocation] GitHub artifact created successfully with documentId:', documentId);
        } catch (error) {
          console.error('[ToolInvocation] Error creating GitHub artifact:', error);
          toast.error('Failed to create GitHub file explorer');
        }
      } else {
        console.error('[ToolInvocation] Invalid repository owner format');
        toast.error('Invalid repository format');
      }
    }
  }, [state, toolName, result, setArtifact]);

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



  // Special handling for createBook tool
  if (toolName === 'createBook') {
    return state === 'call' ? (
      <BookToolCall
        args={args}
        isReadonly={isReadonly}
      />
    ) : (
      <BookToolResult
        result={result}
        isReadonly={isReadonly}
      />
    );
  }

  // Special handling for addMemory tool
  if (toolName === 'addMemory') {
    return state === 'result' ? (
      <AddMemoryResults
        memoryResult={{
          success: result?.success || false,
          message: result?.message,
          memoryId: result?.memoryId || result?.memory_id,
          error: result?.error,
          category: args?.category || args?.type,
          content: args?.content,
        }}
      />
    ) : (
      // For call state, show a simple loading state
      <div className="w-fit border py-2 px-3 rounded-xl flex flex-row items-start gap-3 bg-blue-50 border-blue-200">
        <div className="text-blue-600 mt-1">
          💾
        </div>
        <div className="text-left">
          <div className="font-medium">
            Adding {args?.category || args?.type || 'General'} Memory
          </div>
          <div className="text-sm text-muted-foreground">
            Saving to your knowledge base...
          </div>
        </div>
        <div className="animate-spin mt-1">
          <div className="w-4 h-4 border-2 border-gray-300 border-t-blue-600 rounded-full"></div>
        </div>
      </div>
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

  // Special handling for book creation tools
  if (toolName === 'createBookArtifact') {
    if (state === 'call') {
      const stepNames = {
        1: 'Story Planning',
        2: 'Character Creation', 
        3: 'Chapter Writing',
        4: 'Environment Design',
        5: 'Scene Composition',
        6: 'Final Review'
      };
      
      let message = 'Working on book creation...';
      let stepDetail = '';
      
      if (args?.action === 'create_new') {
        message = 'Creating new book...';
        stepDetail = args?.bookTitle ? `"${args.bookTitle}"` : '';
      } else if (args?.action === 'update_step') {
        const stepName = stepNames[args?.stepNumber as keyof typeof stepNames] || `Step ${args?.stepNumber}`;
        message = `Updating ${stepName}...`;
        stepDetail = 'Generating content and saving progress';
      } else if (args?.action === 'approve_step') {
        message = `Approving step ${args?.stepNumber}...`;
      } else if (args?.action === 'regenerate') {
        const stepName = stepNames[args?.stepNumber as keyof typeof stepNames] || `Step ${args?.stepNumber}`;
        message = `Regenerating ${stepName}...`;
        stepDetail = 'Creating new content based on feedback';
      }
      
      return (
        <div className="bg-blue-50 border border-blue-200 rounded-lg p-3">
          <div className="flex items-center gap-2">
            <span className="text-xl">📖</span>
            <span className="text-blue-800 font-medium">{message}</span>
          </div>
          {stepDetail && (
            <p className="text-sm text-blue-700 mt-1">{stepDetail}</p>
          )}
          <div className="flex items-center gap-2 mt-2">
            <div className="animate-spin">
              <div className="w-4 h-4 border-2 border-gray-300 border-t-blue-600 rounded-full"></div>
            </div>
            <span className="text-sm text-blue-600">Processing...</span>
          </div>
        </div>
      );
    }
    
    // Handle result state - show success or error
    if (state === 'result' && result) {
      if (result.success) {
        return (
          <div className="bg-green-50 border border-green-200 rounded-lg p-3">
            <div className="flex items-center gap-2">
              <span className="text-xl">✅</span>
              <span className="text-green-800 font-medium">Book updated successfully</span>
            </div>
            {result.message && (
              <p className="text-sm text-green-700 mt-1">{result.message}</p>
            )}
          </div>
        );
      } else {
        return (
          <div className="bg-red-50 border border-red-200 rounded-lg p-3">
            <div className="flex items-center gap-2">
              <span className="text-xl">❌</span>
              <span className="text-red-800 font-medium">Book update failed</span>
            </div>
            {result.error && (
              <p className="text-sm text-red-700 mt-1">{result.error}</p>
            )}
          </div>
        );
      }
    }
  }

  // Special handling for image creation tools
  if (toolName === 'createImage' || toolName === 'createSingleBookImage' || toolName === 'structuredBookImageCreation') {
    if (state === 'call') {
      return (
        <div className="bg-purple-50 border border-purple-200 rounded-lg p-3">
          <div className="flex items-center gap-2">
            <span className="text-xl">🎨</span>
            <span className="text-purple-800 font-medium">Creating image...</span>
          </div>
          {args?.prompt && (
            <p className="text-sm text-purple-700 mt-1">"{args.prompt.substring(0, 100)}..."</p>
          )}
          <div className="flex items-center gap-2 mt-2">
            <div className="animate-spin">
              <div className="w-4 h-4 border-2 border-gray-300 border-t-purple-600 rounded-full"></div>
            </div>
            <span className="text-sm text-purple-600">Generating artwork...</span>
          </div>
        </div>
      );
    }
  }

  // Special handling for memory search tools
  if (toolName === 'searchMemories' || toolName === 'get_memory') {
    if (state === 'call') {
      return (
        <div className="bg-amber-50 border border-amber-200 rounded-lg p-3">
          <div className="flex items-center gap-2">
            <span className="text-xl">🧠</span>
            <span className="text-amber-800 font-medium">Searching memories...</span>
          </div>
          {args?.query && (
            <p className="text-sm text-amber-700 mt-1">Looking for: "{args.query}"</p>
          )}
          <div className="flex items-center gap-2 mt-2">
            <div className="animate-spin">
              <div className="w-4 h-4 border-2 border-gray-300 border-t-amber-600 rounded-full"></div>
            </div>
            <span className="text-sm text-amber-600">Searching knowledge base...</span>
          </div>
        </div>
      );
    }
  }

  // Special handling for task tracker tools - keep the detailed UI
  if (toolName === 'createTaskPlan' || toolName === 'updateTask' || 
      toolName === 'completeTask' || toolName === 'getTaskStatus' || toolName === 'addTask') {
    if (state === 'call') {
      return (
        <div className="bg-purple-50 border border-purple-200 rounded-lg p-3">
          <div className="flex items-center gap-2">
            <svg className="w-5 h-5 text-purple-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
            </svg>
            <span className="text-purple-800">
              {toolName === 'createTaskPlan' ? 'Creating task plan...' :
               toolName === 'completeTask' ? 'Completing task...' :
               toolName === 'updateTask' ? 'Updating task status...' :
               toolName === 'getTaskStatus' ? 'Checking task progress...' :
               toolName === 'addTask' ? 'Adding tasks to plan...' :
               'Managing tasks...'}
            </span>
          </div>
          {toolName === 'createTaskPlan' && args.tasks?.length > 0 && (
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

  // Render GitHub File Explorer placeholder for openFileExplorer tool
  if (state === 'result' && toolName === 'openFileExplorer' && safeResult?.success) {
    const ownerLogin = getOwnerString(safeResult.repository?.owner);
    
    if (!ownerLogin) {
      return (
        <div className="text-red-500 text-sm">
          Error: Invalid repository owner format
        </div>
      );
    }
    
    // Show a placeholder while the artifact is being created
    return (
      <div className="w-full border rounded-lg overflow-hidden p-4 bg-blue-50">
        <div className="flex items-center gap-2 mb-2">
          <GitBranchIcon className="w-5 h-5 text-blue-600" />
          <span className="font-medium">Opening GitHub File Explorer</span>
        </div>
        <p className="text-sm text-gray-600">
          Creating code artifact for {ownerLogin}/{safeResult.repository.name}...
        </p>
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
              getToolResult(toolName, safeResult, args)
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
            <div className="bg-gray-50 border border-gray-200 rounded-lg p-4">
              <h3 className="text-sm font-medium mb-2">
                {safeResult.repositoryName || "Repository"} Files
                {safeResult.currentPath && <span className="text-xs text-gray-500 ml-2">Path: {safeResult.currentPath}</span>}
              </h3>
              <div className="space-y-2">
                {safeResult.files.map((file: GitHubFile) => (
                  <div key={file.path} 
                    className="flex items-center gap-2 p-2 hover:bg-gray-100 rounded cursor-pointer"
                    onClick={() => console.log('File selected:', file)}
                  >
                    {file.type === 'dir' ? (
                      <svg className="w-4 h-4 text-blue-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 7v10a2 2 0 002 2h14a2 2 0 002-2V9a2 2 0 00-2-2h-6l-2-2H5a2 2 0 00-2 2z" />
                      </svg>
                    ) : (
                      <svg className="w-4 h-4 text-gray-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                      </svg>
                    )}
                    <span className="text-sm">{file.name}</span>
                  </div>
                ))}
              </div>
            </div>
          )}
          {safeResult?.success && safeResult?.file && (
            <TruncatedFileDisplay 
              file={safeResult.file} 
              editSuggestion={safeResult.editSuggestion}
            />
          )}
        </div>
      )}
    </div>
  );
} 