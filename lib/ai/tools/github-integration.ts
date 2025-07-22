import { Octokit } from '@octokit/rest';
import { GitHubClient } from '@/lib/github/client';
import type { DataStreamWriter } from 'ai';
import { tool } from 'ai';
import type { Session } from 'next-auth';
import { z } from 'zod';

// Parameter schemas
const repositorySchema = z.object({
  owner: z.union([z.string(), z.object({ login: z.string() })]).describe('Repository owner (username or organization)'),
  name: z.string().describe('Repository name')
});

const projectSchema = z.object({
  name: z.string().describe('Project name'),
  description: z.string().describe('Project description')
});

const createProjectParams = z.object({
  repository: repositorySchema.describe('The GitHub repository details'),
  project: projectSchema.describe('Project configuration with name and description'),
  clearStagedFiles: z.boolean().describe('Whether to clear existing staged files before creating the project')
});

const getRepositoryFilesParams = z.object({
  repository: repositorySchema,
  path: z.string().describe('The path to the file or directory to get files from')
});

const getFileContentParams = z.object({
  repository: repositorySchema,
  path: z.string()
});

const searchFilesParams = z.object({
  repository: repositorySchema,
  query: z.string()
});

const openFileExplorerParams = z.object({
  repository: repositorySchema
});

const createRepositoryParams = z.object({
  name: z.string(),
  description: z.string().describe('The description of the repository'),
  private: z.boolean().describe('Whether the repository is private')
});

const updateStagedFileParams = z.object({
  repository: repositorySchema,
  filePath: z.string(),
  content: z.string()
});

const getStagingStateParams = z.object({
  repository: repositorySchema
});

const clearStagedFilesParams = z.object({
  repository: repositorySchema
});

interface GitHubToolResult {
  success: boolean;
  error?: string;
  repositories?: any[];
  files?: any[];
  file?: any;
  repository?: any;
  currentPath?: string;
  repositoryName?: string;
  searchResults?: any[];
  searchQuery?: string;
  message?: string;
  branchName?: string;
  stagedFiles?: any[];
  stagedFilesCount?: number;
  clearedCount?: number;
  requiresApproval?: boolean;
  project?: any;
}

type GitHubToolArgs = 
  | z.infer<typeof createProjectParams>
  | z.infer<typeof getRepositoryFilesParams>
  | z.infer<typeof getFileContentParams>
  | z.infer<typeof searchFilesParams>
  | z.infer<typeof openFileExplorerParams>
  | z.infer<typeof createRepositoryParams>
  | z.infer<typeof updateStagedFileParams>
  | z.infer<typeof getStagingStateParams>
  | z.infer<typeof clearStagedFilesParams>
  | Record<string, never>; // For empty args

interface GitHubToolProps {
  session: Session;
  dataStream: DataStreamWriter;
}

// Type guards
function isGetRepositoryFilesArgs(args: GitHubToolArgs): args is z.infer<typeof getRepositoryFilesParams> {
  return 'repository' in args && 
         args.repository !== undefined && 
         'name' in args.repository &&
         'owner' in args.repository;
}

function isGetFileContentArgs(args: GitHubToolArgs): args is z.infer<typeof getFileContentParams> {
  return 'repository' in args && 
         args.repository !== undefined && 
         'name' in args.repository &&
         'owner' in args.repository &&
         'path' in args;
}

function isSearchFilesArgs(args: GitHubToolArgs): args is z.infer<typeof searchFilesParams> {
  return 'repository' in args && 
         args.repository !== undefined && 
         'name' in args.repository &&
         'owner' in args.repository &&
         'query' in args;
}

function isCreateRepositoryArgs(args: GitHubToolArgs): args is z.infer<typeof createRepositoryParams> {
  return 'name' in args;
}

function isCreateProjectArgs(args: GitHubToolArgs): args is z.infer<typeof createProjectParams> {
  return 'repository' in args && 
         args.repository !== undefined && 
         'name' in args.repository &&
         'owner' in args.repository &&
         'project' in args &&
         args.project !== undefined;
}

function isUpdateStagedFileArgs(args: GitHubToolArgs): args is z.infer<typeof updateStagedFileParams> {
  return 'repository' in args && 
         args.repository !== undefined && 
         'name' in args.repository &&
         'owner' in args.repository &&
         'filePath' in args && 
         'content' in args;
}

function isRepositoryArgs(args: GitHubToolArgs): args is { repository: { owner: string | { login: string }; name: string } } {
  return 'repository' in args && 
         args.repository !== undefined && 
         'name' in args.repository &&
         'owner' in args.repository;
}

// Add a helper function to extract owner string
function getOwnerString(owner: string | { login: string }): string {
  return typeof owner === 'string' ? owner : owner.login;
}

// Create tool functions that take a session and dataStream parameter
export function createListRepositoriesTool({ session, dataStream }: GitHubToolProps) {
  return tool({
    description: 'List GitHub repositories for the authenticated user',
    parameters: z.object({}),
    execute: async () => {
          dataStream.writeData({
        type: 'tool-status',
        content: 'Loading GitHub repositories...'
      });
      return handleGitHubTool('listRepositories', {}, 'user', (session.user as any)?.githubAccessToken);
    }
  });
}

export function createCreateProjectTool({ session, dataStream }: GitHubToolProps) {
  return tool({
    description: 'Create a new project in a GitHub repository',
    parameters: createProjectParams,
    execute: async (args: z.infer<typeof createProjectParams>) => {
      dataStream.writeData({
        type: 'tool-status',
        content: `Creating project ${args.project?.name || ''} in ${args.repository?.owner}/${args.repository?.name}...`
      });
      return handleGitHubTool('createProject', args, 'user', (session.user as any)?.githubAccessToken);
    }
  });
}

export function createGetRepositoryFilesTool({ session, dataStream }: GitHubToolProps) {
  return tool({
    description: 'Get files from a GitHub repository',
    parameters: getRepositoryFilesParams,
    execute: async (args: z.infer<typeof getRepositoryFilesParams>) => {
            dataStream.writeData({
        type: 'tool-status',
        content: `Loading files from ${args.repository?.owner}/${args.repository?.name}...`
      });
      return handleGitHubTool('getRepositoryFiles', args, 'user', (session.user as any)?.githubAccessToken);
    }
  });
}

export function createGetFileContentTool({ session, dataStream }: GitHubToolProps) {
  return tool({
    description: 'Get content of a file from a GitHub repository',
    parameters: getFileContentParams,
    execute: async (args: z.infer<typeof getFileContentParams>) => {
              dataStream.writeData({
        type: 'tool-status',
        content: `Reading file: ${args.path}...`
      });
      return handleGitHubTool('getFileContent', args, 'user', (session.user as any)?.githubAccessToken);
    }
  });
}

export function createSearchFilesTool({ session, dataStream }: GitHubToolProps) {
  return tool({
    description: 'Search for files in a GitHub repository',
    parameters: searchFilesParams,
    execute: async (args: z.infer<typeof searchFilesParams>) => {
              dataStream.writeData({
        type: 'tool-status',
        content: `Searching for files matching: "${args.query}"...`
      });
      return handleGitHubTool('searchFiles', args, 'user', (session.user as any)?.githubAccessToken);
    }
  });
}

export function createOpenFileExplorerTool({ session, dataStream }: GitHubToolProps) {
  return tool({
    description: 'Open the file explorer for a GitHub repository',
    parameters: openFileExplorerParams,
    execute: async (args: z.infer<typeof openFileExplorerParams>) => {
      dataStream.writeData({
        type: 'tool-status',
        content: `Opening file explorer for ${getOwnerString(args.repository.owner)}/${args.repository.name}...`
      });
      
      // Get GitHub client to fetch staged files
      const githubToken = (session.user as any)?.githubAccessToken;
      if (githubToken) {
        try {
          const client = new GitHubClient(githubToken);
          const stagedFiles = await client.getStagedFiles(
            getOwnerString(args.repository.owner),
            args.repository.name
          );
          
          console.log(`[GitHub Tool] Found ${stagedFiles.length} staged files for repository`);
          
          // Include staged files in the response
          const result = await handleGitHubTool('openFileExplorer', args, 'user', githubToken);
          return {
            ...result,
            stagedFiles
          };
        } catch (error) {
          console.error('[GitHub Tool] Error fetching staged files:', error);
          // Continue with normal operation if staged files fetch fails
        }
      }
      
      return handleGitHubTool('openFileExplorer', args, 'user', (session.user as any)?.githubAccessToken);
    }
  });
}

export function createCreateRepositoryTool({ session, dataStream }: GitHubToolProps) {
  return tool({
    description: 'Create a new GitHub repository (requires user approval)',
    parameters: createRepositoryParams,
    execute: async (args: z.infer<typeof createRepositoryParams>) => {
          dataStream.writeData({
        type: 'tool-status',
        content: `Requesting approval to create repository: ${args.name}...`
      });
      
      // First request user approval by returning a response that indicates approval is needed
      // The UI will display this as an approval card to the user
      return {
        success: true,
        requiresApproval: true,
        repository: {
          name: args.name,
          description: args.description,
          private: args.private || false
        },
        message: `Awaiting user approval to create repository "${args.name}"`
      };
      
      // Note: The actual repository creation will happen when the user approves
      // This will be handled by a separate API endpoint that the UI will call
    }
  });
}

export function createUpdateStagedFileTool({ session, dataStream }: GitHubToolProps) {
  return tool({
    description: 'Update a staged file in a GitHub repository',
    parameters: updateStagedFileParams,
    execute: async (args: z.infer<typeof updateStagedFileParams>) => {
          dataStream.writeData({
        type: 'tool-status',
        content: `Updating staged file: ${args.filePath}...`
      });
      return handleGitHubTool('updateStagedFile', args, 'user', (session.user as any)?.githubAccessToken);
    }
  });
}

export function createGetStagingStateTool({ session, dataStream }: GitHubToolProps) {
  return tool({
    description: 'Get the staging state of a GitHub repository',
    parameters: getStagingStateParams,
    execute: async (args: z.infer<typeof getStagingStateParams>) => {
          dataStream.writeData({
        type: 'tool-status',
        content: `Checking staging state for ${args.repository?.owner}/${args.repository?.name}...`
      });
      return handleGitHubTool('getStagingState', args, 'user', (session.user as any)?.githubAccessToken);
    }
  });
}

export function createClearStagedFilesTool({ session, dataStream }: GitHubToolProps) {
  return tool({
    description: 'Clear all staged files in a GitHub repository',
    parameters: clearStagedFilesParams,
    execute: async (args: z.infer<typeof clearStagedFilesParams>) => {
          dataStream.writeData({
        type: 'tool-status',
        content: `Clearing staged files for ${args.repository?.owner}/${args.repository?.name}...`
      });
      return handleGitHubTool('clearStagedFiles', args, 'user', (session.user as any)?.githubAccessToken);
    }
  });
}

export async function handleGitHubTool(
  toolName: string,
  args: GitHubToolArgs,
  userId: string,
  accessToken?: string | null
): Promise<GitHubToolResult> {
  try {
    if (!accessToken) {
        return {
          success: false,
        error: 'GitHub access token not found'
        };
      }

    const octokit = new Octokit({ auth: accessToken });
    const client = new GitHubClient(accessToken);
      
    switch (toolName) {
      case 'listRepositories':
        try {
          console.log('[GitHub Tool] Listing repositories for authenticated user');
          const { data: repos } = await octokit.repos.listForAuthenticatedUser();
          console.log(`[GitHub Tool] Found ${repos.length} repositories`);
          
          if (!Array.isArray(repos)) {
            throw new Error('Invalid response from GitHub API - expected array of repositories');
          }

        return {
            success: true,
            repositories: repos.map(repo => ({
              id: repo.id,
              name: repo.name,
              owner: repo.owner.login,
              description: repo.description,
              private: repo.private,
              url: repo.html_url,
              updated_at: repo.updated_at
            }))
          };
        } catch (error: any) {
          console.error('[GitHub Tool] Error listing repositories:', error);
        return {
          success: false,
            error: error.message || 'Failed to list repositories',
            repositories: [] // Always return an empty array on error
        };
      }

      case 'openFileExplorer':
        if (!isRepositoryArgs(args)) {
        return {
          success: false,
            error: 'Repository details are required'
        };
      }

      try {
          // Get repository details from GitHub
          const repoOwner = getOwnerString(args.repository.owner);
          
          console.log('[GitHub Tool] Opening file explorer with owner:', repoOwner, 'and repo:', args.repository.name);
            
          const [repoResponse, branchesResponse] = await Promise.all([
            octokit.repos.get({
              owner: repoOwner,
              repo: args.repository.name
            }),
            octokit.repos.listBranches({
              owner: repoOwner,
              repo: args.repository.name
            })
          ]);
          
          const repoData = repoResponse.data;
          const branches = branchesResponse.data;
          
          console.log('[GitHub Tool] Fetched branches:', branches);
          
          // Ensure we're returning the owner as a string, not an object
          // This matches what the initialRepository prop expects in GitHubFileExplorer
        return {
          success: true,
            repository: {
              id: repoData.id,
              name: repoData.name,
              full_name: repoData.full_name,
              owner: repoData.owner.login, // Return as string instead of object
              private: repoData.private,
              description: repoData.description,
              html_url: repoData.html_url,
              default_branch: repoData.default_branch,
              branches: branches.map(branch => ({
                name: branch.name,
                sha: branch.commit.sha
              }))
            }
          };
        } catch (error: any) {
          console.error('[GitHub Tool] Error fetching repository details:', error);
        return {
          success: false,
            error: error.message || 'Failed to get repository details'
        };
      }

      case 'getRepositoryFiles':
        if (!isRepositoryArgs(args)) {
      return {
        success: false,
            error: 'Repository details are required'
          };
        }

        try {
          // Use empty string as default path if not provided
          const path = 'path' in args ? args.path || '' : '';
          
          const { data: files } = await octokit.repos.getContent({
            owner: getOwnerString(args.repository.owner),
            repo: args.repository.name,
            path
          });
        
        return {
            success: true,
            files: Array.isArray(files) ? files : [files],
            currentPath: path,
            repositoryName: `${getOwnerString(args.repository.owner)}/${args.repository.name}`
          };
        } catch (error: any) {
          if (error.status === 404) {
        return {
          success: false,
              error: 'Repository or path not found'
        };
          }
          throw error;
      }

      case 'getFileContent':
        if (!isGetFileContentArgs(args)) {
        return {
          success: false,
            error: 'Repository and file path are required'
          };
        }

        try {
          // First check staging area
          const stagedContent = await client.getStagedFileContent(
            getOwnerString(args.repository.owner),
            args.repository.name,
            args.path
          );
          if (stagedContent) {
        return {
          success: true,
          file: {
                path: args.path,
                content: stagedContent,
                isStaged: true
              }
            };
          }

          // If not in staging, get from GitHub
          const { data: file } = await octokit.repos.getContent({
            owner: getOwnerString(args.repository.owner),
            repo: args.repository.name,
            path: args.path
          });

          if ('content' in file && typeof file.content === 'string') {
        return {
          success: true,
            file: {
                ...file,
                content: Buffer.from(file.content, 'base64').toString('utf-8')
              }
            };
          } else {
        return {
          success: false,
              error: 'Invalid file content'
        };
      }
        } catch (error: any) {
          if (error.status === 404) {
      return {
        success: false,
              error: 'File not found'
            };
          }
          throw error;
        }

      case 'searchFiles':
        if (!isSearchFilesArgs(args)) {
        return {
          success: false,
            error: 'Repository and search query are required'
          };
        }

        const { data: searchResults } = await octokit.search.code({
          q: `${args.query} repo:${getOwnerString(args.repository.owner)}/${args.repository.name}`
        });
      
      return {
        success: true,
          searchResults: searchResults.items,
          searchQuery: args.query
        };

      case 'createRepository':
        if (!isCreateRepositoryArgs(args)) {
        return {
          success: false,
            error: 'Repository name is required'
          };
        }

        // For the createRepository tool, we only return an approval request
        // The actual repository creation will be handled through a separate flow
        // when the user approves via the UI
        return {
          success: true,
          requiresApproval: true,
          repository: {
            name: args.name,
            description: args.description,
            private: args.private || false
          },
          message: 'Repository creation requires user approval'
        };

      case 'createProject':
        if (!isCreateProjectArgs(args)) {
        return {
          success: false,
            error: 'Repository and project details are required'
          };
        }

        try {
          // Clear staged files if requested
          if (args.clearStagedFiles) {
            await client.clearStagedFiles(
              getOwnerString(args.repository.owner),
              args.repository.name
            );
          }

          // Create project files
          const stagedFiles = await client.createProject(
            getOwnerString(args.repository.owner),
            args.repository.name,
            args.project.name,
            args.project.description
          );
        
        return {
          success: true,
            project: args.project,
            stagedFiles,
            message: 'Project created and files staged for review'
          };
        } catch (error: any) {
        return {
          success: false,
            error: error.message || 'Failed to create project'
        };
      }

      case 'updateStagedFile':
        if (!isUpdateStagedFileArgs(args)) {
      return {
        success: false,
            error: 'Repository, file path, and content are required'
          };
        }

        try {
          await client.updateStagedFile(
            getOwnerString(args.repository.owner),
            args.repository.name,
            args.filePath,
            args.content
          );

        return {
            success: true,
            message: `File ${args.filePath} updated in staging area`
          };
        } catch (error: any) {
        return {
          success: false,
            error: error.message || 'Failed to update staged file'
          };
        }

      case 'getStagingState':
        if (!isRepositoryArgs(args)) {
      return {
        success: false,
            error: 'Repository details are required'
          };
        }

        try {
          const stagedFiles = await client.getStagedFiles(
            getOwnerString(args.repository.owner),
            args.repository.name
          );
      
      return {
        success: true,
            stagedFiles,
        stagedFilesCount: stagedFiles.length,
            message: `Found ${stagedFiles.length} staged files`
          };
        } catch (error: any) {
      return {
        success: false,
            error: error.message || 'Failed to get staging state'
          };
        }

      case 'clearStagedFiles':
        if (!isRepositoryArgs(args)) {
        return {
          success: false,
            error: 'Repository details are required'
          };
        }

        try {
          const clearedCount = await client.clearStagedFiles(
            getOwnerString(args.repository.owner),
            args.repository.name
          );

        return {
          success: true,
            clearedCount,
            message: `Cleared ${clearedCount} staged files`
          };
        } catch (error: any) {
      return {
        success: false,
            error: error.message || 'Failed to clear staged files'
          };
        }

      default:
      return {
        success: false,
          error: 'Unknown GitHub tool'
      };
    }
  } catch (error: any) {
    console.error('GitHub tool error:', error);
    return {
      success: false,
      error: error.message || 'An error occurred while processing GitHub request'
    };
  }
}