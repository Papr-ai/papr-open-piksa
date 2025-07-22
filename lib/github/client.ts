import { Octokit } from '@octokit/rest';

export class GitHubClient {
  private octokit: Octokit;
  private stagedFiles: Map<string, Map<string, string>> = new Map(); // owner/repo -> path -> content
  private BRANCH_PREFIX = 'papr-staging';

  constructor(accessToken: string) {
    this.octokit = new Octokit({ auth: accessToken });
  }

  // Staging-related methods
  async getStagedFileContent(owner: string, repo: string, path: string): Promise<string | null> {
    const repoKey = `${owner}/${repo}`;
    const repoFiles = this.stagedFiles.get(repoKey);
    return repoFiles?.get(path) || null;
  }

  async updateStagedFile(owner: string, repo: string, path: string, content: string): Promise<void> {
    const repoKey = `${owner}/${repo}`;
    if (!this.stagedFiles.has(repoKey)) {
      this.stagedFiles.set(repoKey, new Map());
    }
    this.stagedFiles.get(repoKey)!.set(path, content);
  }

  async getStagedFiles(owner: string, repo: string): Promise<Array<{ path: string; content: string }>> {
    const repoKey = `${owner}/${repo}`;
    const repoFiles = this.stagedFiles.get(repoKey);
    if (!repoFiles) return [];
    
    return Array.from(repoFiles.entries()).map(([path, content]) => ({
      path,
      content
    }));
  }

  async clearStagedFiles(owner: string, repo: string): Promise<number> {
    const repoKey = `${owner}/${repo}`;
    const repoFiles = this.stagedFiles.get(repoKey);
    const count = repoFiles?.size || 0;
    this.stagedFiles.delete(repoKey);
    return count;
  }

  async createProject(
    owner: string,
    repo: string,
    name: string,
    description?: string
  ): Promise<Array<{ path: string; content: string }>> {
    // Create basic project structure
    const files = [
      {
        path: 'README.md',
        content: `# ${name}\n\n${description || ''}\n\nProject created with PaprChat.`
      },
      {
        path: 'package.json',
        content: JSON.stringify({
          name: name.toLowerCase().replace(/[^a-z0-9-]/g, '-'),
          version: '0.1.0',
          description: description || '',
          private: true,
          scripts: {
            start: "http-server -c-1"
          },
          dependencies: {
            "http-server": "^14.1.1"
          }
        }, null, 2)
      },
      {
        path: 'index.html',
        content: `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${name}</title>
  <link rel="stylesheet" href="style.css">
</head>
<body>
  <div class="container">
    <h1>${name}</h1>
    <p>${description || 'Welcome to my project'}</p>
    <div id="app"></div>
  </div>
  <script src="script.js"></script>
</body>
</html>`
      },
      {
        path: 'style.css',
        content: `* {
  margin: 0;
  padding: 0;
  box-sizing: border-box;
}

body {
  font-family: Arial, sans-serif;
  line-height: 1.6;
  color: #333;
  background-color: #f4f4f4;
  padding: 20px;
}

.container {
  max-width: 1100px;
  margin: 0 auto;
  overflow: auto;
  padding: 0 20px;
}

h1 {
  color: #333;
  margin-bottom: 20px;
  text-align: center;
}

p {
  margin: 10px 0;
  text-align: center;
}

#app {
  background: #fff;
  border-radius: 5px;
  padding: 20px;
  margin-top: 20px;
  box-shadow: 0 0 10px rgba(0, 0, 0, 0.1);
}`
      },
      {
        path: 'script.js',
        content: `// Main application script
document.addEventListener('DOMContentLoaded', () => {
  const app = document.getElementById('app');
  
  // Create a welcome message
  const welcomeMessage = document.createElement('div');
  welcomeMessage.innerHTML = '<h2>Hello from JavaScript!</h2>';
  welcomeMessage.innerHTML += '<p>This project was created with PaprChat</p>';
  
  // Add a button
  const button = document.createElement('button');
  button.textContent = 'Click me!';
  button.style.padding = '8px 16px';
  button.style.margin = '20px 0';
  button.style.backgroundColor = '#4CAF50';
  button.style.color = 'white';
  button.style.border = 'none';
  button.style.borderRadius = '4px';
  button.style.cursor = 'pointer';
  
  button.addEventListener('click', () => {
    alert('Button clicked!');
  });
  
  // Append elements to the app
  app.appendChild(welcomeMessage);
  app.appendChild(button);
  
  console.log('Application initialized');
});`
      }
    ];

    // Stage all files
    for (const file of files) {
      await this.updateStagedFile(owner, repo, file.path, file.content);
    }

    return files;
  }

  async getRepositories() {
    try {
      console.log('[GitHub Client] Fetching repositories for authenticated user');
      const { data } = await this.octokit.repos.listForAuthenticatedUser({
        sort: 'updated',
        per_page: 100,
      });
      console.log(`[GitHub Client] Found ${data.length} repositories`);
      return data;
    } catch (error: any) {
      console.error('[GitHub Client] Failed to fetch repositories:', error);
      if (error.status === 401) {
        throw new Error('GitHub authentication failed. Please check your token.');
      }
      if (error.status === 403 && error.message?.includes('rate limit')) {
        throw new Error('GitHub API rate limit exceeded. Please try again later.');
      }
      throw new Error(`Failed to fetch repositories: ${error.message || 'Unknown error'}`);
    }
  }

  async getRepository(owner: string, repo: string) {
    try {
      console.log(`[GitHub Client] Getting repository info for ${owner}/${repo}`);
      const { data } = await this.octokit.repos.get({
        owner,
        repo,
      });
      console.log(`[GitHub Client] Repository info retrieved:`, {
        defaultBranch: data.default_branch,
        id: data.id,
        name: data.name
      });
      return data;
    } catch (error: any) {
      console.error(`[GitHub Client] Failed to get repository ${owner}/${repo}:`, error);
      throw new Error(`Failed to get repository: ${error.message}`);
    }
  }

  async getFileTree(owner: string, repo: string, path: string = '') {
    try {
      console.log(`[GitHub Client] Getting file tree for ${owner}/${repo} at path: "${path}"`);
      
      // Get staged files for this repository
      const repoKey = `${owner}/${repo}`;
      const stagedFiles = this.stagedFiles.get(repoKey);
      
      // If we have staged files for this repository, prioritize them
      if (stagedFiles && stagedFiles.size > 0) {
        console.log(`[GitHub Client] Using staged files for ${owner}/${repo}, found ${stagedFiles.size} total files`);
        
        // Create a map of directory paths to track directories we need to create
        const directories = new Set<string>();
        const result: any[] = [];
        
        // Process all staged files to identify directories and files in the current path
        for (const [filePath, content] of stagedFiles.entries()) {
          // Skip files not in the current path
          if (path !== '' && !filePath.startsWith(`${path}/`) && filePath !== path) {
            continue;
          }
          
          // For files directly in the current path
          if ((path === '' && !filePath.includes('/')) || 
              (path !== '' && filePath === path)) {
            // This is a file directly in the current path
            result.push({
              name: filePath.split('/').pop() || filePath,
              path: filePath,
              type: 'file',
              sha: `staged-${Date.now()}`,
              isStaged: true,
              size: content.length
            });
            continue;
          }
          
          // For files in subdirectories of the current path
          if (path === '' || filePath.startsWith(`${path}/`)) {
            // Extract the next directory or file name in the path
            const relativePath = path === '' ? filePath : filePath.substring(path.length + 1);
            const nextSegment = relativePath.split('/')[0];
            const fullSegmentPath = path === '' ? nextSegment : `${path}/${nextSegment}`;
            
            // If this is a directory (has more path segments)
            if (relativePath.includes('/')) {
              // Add directory if we haven't seen it yet
              if (!directories.has(fullSegmentPath)) {
                directories.add(fullSegmentPath);
                result.push({
                  name: nextSegment,
                  path: fullSegmentPath,
                  type: 'dir',
                  sha: `dir-${Date.now()}`,
                  isStaged: true
                });
              }
            } 
            // Direct file in current path
            else if (fullSegmentPath === filePath) {
              result.push({
                name: nextSegment,
                path: filePath,
                type: 'file',
                sha: `staged-${Date.now()}`,
                isStaged: true,
                size: content.length
              });
            }
          }
        }
        
        console.log(`[GitHub Client] Returning ${result.length} staged files/directories for path "${path}"`);
        return result;
      }
      
      // If no staged files, fall back to GitHub API
      console.log(`[GitHub Client] No staged files found, fetching from GitHub API for path "${path}"`);
      const { data } = await this.octokit.repos.getContent({
        owner,
        repo,
        path,
      });
      
      const repoFiles = Array.isArray(data) ? data : [data];
      console.log(`[GitHub Client] Returning ${repoFiles.length} GitHub files for path "${path}"`);
      return repoFiles;
    } catch (error: any) {
      // Handle empty repository case
      if (error.status === 404 && error.message?.includes('empty')) {
        console.log(`[GitHub Client] Repository is empty or path "${path}" not found`);
        return [];
      }
      
      console.error(`[GitHub Client] Error getting file tree for ${owner}/${repo}:`, error);
      // Re-throw other errors
      throw error;
    }
  }

  async getFile(owner: string, repo: string, path: string) {
    // Check if the file is staged first
    const stagedContent = await this.getStagedFileContent(owner, repo, path);
    if (stagedContent !== null) {
      console.log(`[GitHub Client] Returning staged file: ${path}`);
      return {
        name: path.split('/').pop() || path,
        path,
        sha: `staged-${Date.now()}`,
        size: stagedContent.length,
        content: stagedContent,
        isStaged: true,
        type: 'file'
      };
    }
    
    // If not staged, get from GitHub
    try {
      console.log(`[GitHub Client] Getting file from GitHub: ${path}`);
      const { data } = await this.octokit.repos.getContent({
        owner,
        repo,
        path,
      });
      
      if ('content' in data) {
        return {
          ...data,
          content: Buffer.from(data.content, 'base64').toString('utf-8'),
        };
      }
      throw new Error('Not a file');
    } catch (error: any) {
      console.error(`[GitHub Client] Error getting file ${path}:`, error);
      throw error;
    }
  }

  async createOrUpdateFile(
    owner: string,
    repo: string,
    path: string,
    content: string,
    message: string,
    sha?: string
  ) {
    const { data } = await this.octokit.repos.createOrUpdateFileContents({
      owner,
      repo,
      path,
      message,
      content: Buffer.from(content).toString('base64'),
      sha,
    });
    return data;
  }

  async createRepository(name: string, description?: string) {
    const { data } = await this.octokit.repos.createForAuthenticatedUser({
      name,
      description,
      private: false,
    });
    return data;
  }

  async getBranches(owner: string, repo: string) {
    try {
      console.log(`[GitHub Client] Getting branches for ${owner}/${repo}`);
      const { data } = await this.octokit.repos.listBranches({
        owner,
        repo,
      });
      console.log(`[GitHub Client] Found ${data.length} branches`);
      return data;
    } catch (error: any) {
      console.error(`[GitHub Client] Failed to list branches for ${owner}/${repo}:`, error);
      throw new Error(`Failed to list branches: ${error.message}`);
    }
  }

  async createBranch(owner: string, repo: string): Promise<string> {
    try {
      // 1. Pick a unique name
      const branchName = `papr-staging-${Date.now()}`;
      console.log(`[GitHub Client] Creating branch ${branchName} in ${owner}/${repo}`);

      // 2. Get the repo's default-branch HEAD SHA
      const { data: repoInfo } = await this.octokit.repos.get({ owner, repo });
      const defaultBranch = repoInfo.default_branch;
      console.log(`[GitHub Client] Default branch: ${defaultBranch}`);

      const { data: baseRef } = await this.octokit.git.getRef({
        owner,
        repo,
        ref: `heads/${defaultBranch}`, // note: omit the "refs/" prefix here
      });
      const baseSha = baseRef.object.sha;
      console.log(`[GitHub Client] Base SHA: ${baseSha}`);

      // 3. Create your new branch off that SHA
      await this.octokit.git.createRef({
        owner,
        repo,
        ref: `refs/heads/${branchName}`,
        sha: baseSha,
      });
      console.log(`[GitHub Client] Successfully created branch: ${branchName}`);

      // 4. Hand back exactly the branch name
      return branchName;
    } catch (error: any) {
      console.error('[GitHub Client] Error creating branch:', error);
      if (error.status === 422) {
        throw new Error('Branch already exists or invalid SHA');
      }
      throw new Error(`Failed to create branch: ${error.message}`);
    }
  }

  async deleteBranch(owner: string, repo: string, branchName: string) {
    try {
      console.log(`[GitHub Client] Deleting branch ${branchName} from ${owner}/${repo}`);
      const { data } = await this.octokit.git.deleteRef({
        owner,
        repo,
        ref: `refs/heads/${branchName}`,
      });
      console.log(`[GitHub Client] Branch deleted successfully`);
      return data;
    } catch (error: any) {
      console.error(`[GitHub Client] Failed to delete branch ${branchName}:`, error);
      throw new Error(`Failed to delete branch: ${error.message}`);
    }
  }

  async searchFiles(
    query: string,
    repository?: { owner: string; name: string },
    fileExtensions?: string[]
  ) {
    let searchQuery = query;
    
    // Add repository filter if specified
    if (repository) {
      searchQuery += ` repo:${repository.owner}/${repository.name}`;
    }
    
    // Add file extension filters if specified
    if (fileExtensions && fileExtensions.length > 0) {
      const extensionFilters = fileExtensions.map(ext => `extension:${ext}`).join(' OR ');
      searchQuery += ` (${extensionFilters})`;
    }
    
    const { data } = await this.octokit.search.code({
      q: searchQuery,
      per_page: 20,
    });
    
    return data.items;
  }

  async createStagingBranch(
    owner: string,
    repo: string,
    defaultBranch: string = 'main',
    existingBranches: Array<{ name: string; sha: string }> = []
  ): Promise<string | null> {
    try {
      console.log('[GitHub Client] Creating staging branch with params:', {
        owner,
        repo,
        defaultBranch,
        existingBranches: existingBranches.length
      });
      
      // Validate owner parameter
      if (!owner) {
        console.error('[GitHub Client] Owner parameter is empty or invalid:', owner);
        throw new Error('Invalid repository owner');
      }
      
      // First, check if repository has any branches at all
      let branches: Array<{ name: string; commit: { sha: string } }> = [];
      if (existingBranches.length === 0) {
        try {
          console.log(`[GitHub Client] Checking if repository has any branches`);
          const { data: repoBranches } = await this.octokit.repos.listBranches({
            owner,
            repo,
            per_page: 100
          });
          branches = repoBranches;
          console.log(`[GitHub Client] Found ${branches.length} branches in repository`);
        } catch (error) {
          console.error('[GitHub Client] Error listing branches:', error);
          // Continue with empty branches array
        }
      } else {
        console.log(`[GitHub Client] Using ${existingBranches.length} provided branches`);
      }
      
      // If no branches exist at all, we need to create an initial branch
      if (branches.length === 0 && existingBranches.length === 0) {
        console.log(`[GitHub Client] Repository has no branches. Creating initial 'main' branch`);
        
        try {
          // Get repository info to check if it has content
          const { data: repoInfo } = await this.octokit.repos.get({ owner, repo });
          
          // Create a README.md file to initialize the repository
          console.log(`[GitHub Client] Creating README.md to initialize repository`);
          const readmeContent = `# ${repoInfo.name}\n\n${repoInfo.description || 'Repository created with Papr.'}\n`;
          
          // Create the file directly on the main branch
          await this.octokit.repos.createOrUpdateFileContents({
            owner,
            repo,
            path: 'README.md',
            message: 'Initialize repository',
            content: Buffer.from(readmeContent).toString('base64'),
            branch: 'main'
          });
          
          console.log(`[GitHub Client] Successfully created 'main' branch with README.md`);
          
          // Now get the SHA of the main branch
          const { data: mainBranchRef } = await this.octokit.git.getRef({
            owner,
            repo,
            ref: 'heads/main'
          });
          
          // Set default branch to 'main' since we just created it
          defaultBranch = 'main';
          
          // Create a new branch name with timestamp
          const timestamp = Date.now();
          const newBranchName = `${this.BRANCH_PREFIX}-${timestamp}`;
          
          // Create the staging branch from the main branch
          await this.octokit.git.createRef({
            owner,
            repo,
            ref: `refs/heads/${newBranchName}`,
            sha: mainBranchRef.object.sha
          });
          
          console.log(`[GitHub Client] Created staging branch '${newBranchName}' from 'main'`);
          return newBranchName;
        } catch (initError: any) {
          console.error('[GitHub Client] Error initializing repository with main branch:', initError);
          throw new Error(`Failed to initialize repository: ${initError.message}`);
        }
      }
      
      // Try to use existing branches if provided
      if (existingBranches.length > 0) {
        console.log('[GitHub Client] Using existing branches information');
        // Find the default branch in the existing branches
        const defaultBranchInfo = existingBranches.find(b => b.name === defaultBranch);
        if (defaultBranchInfo) {
          console.log('[GitHub Client] Found default branch in existing branches:', defaultBranchInfo);
          // Create a new branch name with timestamp
          const timestamp = Date.now();
          const newBranchName = `${this.BRANCH_PREFIX}-${timestamp}`;
          
          console.log('[GitHub Client] Creating new branch with ref:', `refs/heads/${newBranchName}`, 'and SHA:', defaultBranchInfo.sha);
          
          // Create the new branch using the SHA from existing branches
          await this.octokit.git.createRef({
            owner,
            repo,
            ref: `refs/heads/${newBranchName}`,
            sha: defaultBranchInfo.sha
          });
          
          console.log('[GitHub Client] Created new branch using existing branch info:', newBranchName);
          return newBranchName;
        } else {
          console.log('[GitHub Client] Default branch not found in existing branches, falling back to API');
        }
      }
      
      // If we have branches from our list call, use those
      if (branches.length > 0) {
        // Find the default branch or any branch
        const defaultBranchInfo = branches.find(b => b.name === defaultBranch) || branches[0];
        console.log(`[GitHub Client] Using branch '${defaultBranchInfo.name}' as base`);
        
        // Create a new branch name with timestamp
        const timestamp = Date.now();
        const newBranchName = `${this.BRANCH_PREFIX}-${timestamp}`;
        
        // Create the new branch
        await this.octokit.git.createRef({
          owner,
          repo,
          ref: `refs/heads/${newBranchName}`,
          sha: defaultBranchInfo.commit.sha
        });
        
        console.log('[GitHub Client] Created new branch:', newBranchName);
        return newBranchName;
      }
      
      // Get repository info to determine the actual default branch
      console.log(`[GitHub Client] Fetching repository info for ${owner}/${repo}`);
      try {
        const { data: repoInfo } = await this.octokit.repos.get({ owner, repo });
        if (repoInfo.default_branch && repoInfo.default_branch !== defaultBranch) {
          console.log(`[GitHub Client] Using repository's actual default branch: ${repoInfo.default_branch}`);
          defaultBranch = repoInfo.default_branch;
        }
      } catch (repoError) {
        console.error('[GitHub Client] Error fetching repository info:', repoError);
        // Continue with the provided default branch
      }
      
      // Try to get the SHA of the default branch
      let baseSha: string | undefined;
      try {
        console.log(`[GitHub Client] Fetching ref for heads/${defaultBranch}`);
        const { data: refData } = await this.octokit.git.getRef({
          owner,
          repo,
          ref: `heads/${defaultBranch}`
        });
        baseSha = refData.object.sha;
      } catch (refError) {
        // If default branch fails, try common alternatives
        console.warn(`[GitHub Client] Failed to get ref for ${defaultBranch}, trying alternatives`);
        const alternatives = ['main', 'master', 'develop', 'development'];
        let foundAlternative = false;
        
        for (const alt of alternatives) {
          if (alt === defaultBranch) continue; // Skip if it's the same as what we already tried
          
          try {
            console.log(`[GitHub Client] Trying alternative branch: ${alt}`);
            const { data: altRefData } = await this.octokit.git.getRef({
              owner,
              repo,
              ref: `heads/${alt}`
            });
            baseSha = altRefData.object.sha;
            console.log(`[GitHub Client] Successfully found alternative branch: ${alt}`);
            foundAlternative = true;
            break;
          } catch (altError) {
            console.log(`[GitHub Client] Alternative branch ${alt} not found`);
          }
        }
        
        if (!foundAlternative) {
          throw new Error(`Repository has no valid branches. Please initialize the repository with at least one branch.`);
        }
      }
      
      if (!baseSha) {
        throw new Error('Failed to get a valid SHA for the branch');
      }

      console.log('[GitHub Client] Got base SHA:', baseSha);

      // Create a new branch name with timestamp
      const timestamp = Date.now();
      const newBranchName = `${this.BRANCH_PREFIX}-${timestamp}`;

      // Create the new branch
      console.log('[GitHub Client] Creating new branch with ref:', `refs/heads/${newBranchName}`);
      await this.octokit.git.createRef({
        owner,
        repo,
        ref: `refs/heads/${newBranchName}`,
        sha: baseSha
      });

      console.log('[GitHub Client] Created new branch:', newBranchName);
      return newBranchName;
    } catch (error: any) {
      console.error('[GitHub Client] Error creating staging branch:', error);
      console.error('[GitHub Client] Error details:', {
        message: error.message,
        status: error.status,
        response: error.response?.data
      });
      throw new Error(`Failed to create staging branch: ${error.message}`);
    }
  }

  async stageChanges(
    owner: string,
    repo: string,
    branchName: string,
    files: Array<{ path: string; content: string }>
  ): Promise<void> {
    try {
      for (const file of files) {
        // Get current file content to get SHA if it exists
        let fileSha: string | undefined;
        try {
          const { data: existingFile } = await this.octokit.repos.getContent({
            owner,
            repo,
            path: file.path,
            ref: branchName
          });

          if ('sha' in existingFile) {
            fileSha = existingFile.sha;
          }
        } catch (error) {
          // File doesn't exist yet, which is fine
        }

        // Create or update file
        await this.octokit.repos.createOrUpdateFileContents({
          owner,
          repo,
          path: file.path,
          message: `Update ${file.path}`,
          content: Buffer.from(file.content).toString('base64'),
          branch: branchName,
          ...(fileSha ? { sha: fileSha } : {})
        });
      }
    } catch (error: any) {
      console.error('[GitHub Client] Error staging changes:', error);
      throw new Error(`Failed to stage changes: ${error.message}`);
    }
  }
} 