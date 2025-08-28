'use client';

import { useMemo } from 'react';
import { Markdown } from '../common/markdown';
import { ThinkBlock, processThinkBlocks } from './think-block';
import { GitHubRepoResults, detectGitHubRepositories } from '../github/github-repo-results';
import { GitHubSearchResults, detectGitHubSearchResults } from '../github/github-search-results';
import { TaskCard, detectTaskTrackerData } from '../task-card';
import { MemoryCard, detectMemoryData } from '../memory-card';


import { Button } from '../ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '../ui/card';
import { AlertTriangleIcon, CheckCircleIcon, XCircleIcon } from 'lucide-react';



interface ProcessedMessageProps {
  content: string;
  isAssistantMessage?: boolean;
}

// Helper function to detect repository approval requests
function detectRepositoryApproval(content: string): {
  repositoryName: string;
  repositoryDescription: string;
  approvalMessage: string;
  nextSteps: string[];
  warning: string;
} | null {
  try {
    const parsed = JSON.parse(content);
    
    if (parsed.requiresApproval && parsed.repositoryName) {
      return {
        repositoryName: parsed.repositoryName,
        repositoryDescription: parsed.repositoryDescription,
        approvalMessage: parsed.approvalMessage,
        nextSteps: parsed.nextSteps || [],
        warning: parsed.warning,
      };
    }
    
    return null;
  } catch (e) {
    // Look for approval request patterns in text
    if (content.includes('Repository Creation Approval Required') || 
        content.includes('requiresApproval') || 
        content.includes('Reply "Approve" to create')) {
      
      // Try to extract repository name from common patterns
      const repoMatch = content.match(/repository.*?named.*?"([^"]+)"/i) || 
                       content.match(/create.*?repository.*?"([^"]+)"/i);
      
      if (repoMatch) {
        return {
          repositoryName: repoMatch[1],
          repositoryDescription: 'Created from PaprChat',
          approvalMessage: `I need your approval to create a new GitHub repository named "${repoMatch[1]}".`,
          nextSteps: ['Reply "Approve" to create the repository', 'Reply "Stop" to cancel'],
          warning: 'This will create a new repository in your GitHub account.',
        };
      }
    }
    
    return null;
  }
}

export function ProcessedMessage({ content, isAssistantMessage = false }: ProcessedMessageProps) {
  // Check for GitHub repository data
  const repositoryData = useMemo(() => {
    return detectGitHubRepositories(content);
  }, [content]);

  // Remove file data detection
  
  // Check for GitHub search results
  const searchData = useMemo(() => {
    return detectGitHubSearchResults(content);
  }, [content]);

  // Remove staged files detection
  
  // Check for repository approval requests
  const approvalData = useMemo(() => {
    return detectRepositoryApproval(content);
  }, [content]);

  // Check for task tracker data
  const taskData = useMemo(() => {
    return detectTaskTrackerData(content);
  }, [content]);

  // Check for memory data
  const memoryData = useMemo(() => {
    return detectMemoryData(content);
  }, [content]);





  // Process the content to extract think blocks
  const { processedText, thinkBlocks } = useMemo(() => {
    return processThinkBlocks(content);
  }, [content]);

  // If task tracker data is detected, show task card
  if (taskData) {
    return <TaskCard {...taskData} />;
  }

  // If memory data is detected, show memory card
  if (memoryData) {
    return <MemoryCard {...memoryData} />;
  }



  // If repository approval is required, show approval card
  if (approvalData) {
    const handleApprovalResponse = (response: 'approve' | 'stop') => {
      const chatInput = document.querySelector('textarea[placeholder*="Ask"]') as HTMLTextAreaElement;
      if (chatInput) {
        chatInput.value = response === 'approve' ? 'Approve' : 'Stop';
        chatInput.focus();
        
        // Trigger input event to update the form
        const event = new Event('input', { bubbles: true });
        chatInput.dispatchEvent(event);
        
        // Trigger form submission
        const form = chatInput.closest('form');
        if (form) {
          const submitEvent = new Event('submit', { bubbles: true });
          form.dispatchEvent(submitEvent);
        }
      }
    };

    return (
      <Card className=" border-l-4 border-l-yellow-500 bg-yellow-50">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <AlertTriangleIcon className="h-5 w-5 text-yellow-600" />
            Repository Creation Approval Required
          </CardTitle>
          <CardDescription>
            {approvalData.approvalMessage}
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <p><strong>Repository Name:</strong> {approvalData.repositoryName}</p>
            <p><strong>Description:</strong> {approvalData.repositoryDescription}</p>
          </div>
          
          <div className="p-3 bg-yellow-100 rounded-md">
            <p className="text-sm text-yellow-800">
              <strong>⚠️ Warning:</strong> {approvalData.warning}
            </p>
          </div>
          
          <div className="space-y-2">
            <p className="text-sm font-medium">Next Steps:</p>
            <ul className="text-sm space-y-1">
              {approvalData.nextSteps.map((step, index) => (
                <li key={index} className="flex items-start gap-2">
                  <span className="text-gray-400">•</span>
                  <span>{step}</span>
                </li>
              ))}
            </ul>
          </div>
          
          <div className="flex gap-3 pt-2">
            <Button 
              onClick={() => handleApprovalResponse('approve')}
              className="bg-green-600 hover:bg-green-700 text-white"
            >
              <CheckCircleIcon className="h-4 w-4 mr-2" />
              Approve
            </Button>
            <Button 
              onClick={() => handleApprovalResponse('stop')}
              variant="outline"
              className="border-red-600 text-red-600 hover:bg-red-50"
            >
              <XCircleIcon className="h-4 w-4 mr-2" />
              Stop
            </Button>
          </div>
        </CardContent>
      </Card>
    );
  }

  // If GitHub staged files data is detected, render it with cards
  // This section is removed as GitHubFileResults and detectGitHubStagedFiles are removed.

  // If GitHub repository data is detected, render it with cards
  if (repositoryData && repositoryData.length > 0) {
    const handleRepositorySelect = (repository: any) => {
      // Create a message to request file browsing for the selected repository
      const message = `I'd like to work with the ${repository.name} repository (${repository.owner}/${repository.name}). Please show me the files and folders in this repository so I can choose what to edit or work with.`;
      
      // Find the chat input and set the message
      const chatInput = document.querySelector('textarea[placeholder*="Ask"]') as HTMLTextAreaElement;
      if (chatInput) {
        chatInput.value = message;
        chatInput.focus();
        
        // Trigger input event to update the form
        const event = new Event('input', { bubbles: true });
        chatInput.dispatchEvent(event);
      }
    };

    return (
      <div className="flex flex-col gap-2">
        <GitHubRepoResults 
          repositories={repositoryData}
          onRepositorySelect={handleRepositorySelect}
          title="Your GitHub Repositories"
        />
      </div>
    );
  }

  // If GitHub search results are detected, render them with search cards
  if (searchData && searchData.searchResults && searchData.searchResults.length > 0) {
    const handleSearchResultSelect = (result: any) => {
      // Create a message to request file content for editing
      const message = `I'd like to edit the ${result.file.name} file (${result.file.path}) in the ${result.repository.owner}/${result.repository.name} repository. Please open the GitHub file explorer for this file.`;
      
      // Find the chat input and set the message
      const chatInput = document.querySelector('textarea[placeholder*="Ask"]') as HTMLTextAreaElement;
      if (chatInput) {
        chatInput.value = message;
        chatInput.focus();
        
        // Trigger input event to update the form
        const event = new Event('input', { bubbles: true });
        chatInput.dispatchEvent(event);
      }
    };

    return (
      <div className="flex flex-col gap-2">
        <GitHubSearchResults 
          searchResults={searchData.searchResults}
          searchQuery={searchData.searchQuery}
          onFileSelect={handleSearchResultSelect}
          title="File Search Results"
        />
      </div>
    );
  }

  // If GitHub file data is detected, render it with file cards
  // This section is removed as GitHubFileResults and detectGitHubStagedFiles are removed.


  // Render the message content with think blocks
  const renderProcessedContent = () => {
    // If it's an assistant message and has think blocks, these will be handled differently
    if (isAssistantMessage && thinkBlocks.length > 0) {
      // For assistant messages, we completely remove think blocks from display
      // as they will be shown in the reasoning component
      return <Markdown>{processedText}</Markdown>;
    }
    
    // If no think blocks or user message, just render the content as is
    if (thinkBlocks.length === 0) {
      return <Markdown>{content}</Markdown>;
    }

    // Split the processed text by placeholders
    const parts = processedText.split(/\{\{(think-[a-z0-9]+)\}\}/);
    
    // Ensure we only render each think block once
    const renderedBlocks = new Set();
    
    return (
      <>
        {parts.map((part, index) => {
          // Even indices are regular text
          if (index % 2 === 0) {
            return part ? <Markdown key={`text-${index}`}>{part}</Markdown> : null;
          } 
          // Odd indices are think block IDs
          else {
            const thinkBlock = thinkBlocks.find(block => block.id === part);
            
            if (thinkBlock && !renderedBlocks.has(thinkBlock.content)) {
              renderedBlocks.add(thinkBlock.content);
              // Return null as this is handled by the MessageReasoning component
              return null;
            }
            return null;
          }
        })}
      </>
    );
  };

  return (
    <div className="flex flex-col gap-2">
      {renderProcessedContent()}
    </div>
  );
} 