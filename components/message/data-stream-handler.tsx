'use client';

import { useChat } from '@ai-sdk/react';
import { useEffect, useRef, useState } from 'react';
import { artifactDefinitions, type ArtifactKind } from '../artifact/artifact';
import type { Suggestion } from '@/lib/db/schema';
import { useArtifact } from '@/hooks/use-artifact';
import { useThinkingState } from '@/lib/thinking-state';
import { useBreadcrumb } from '@/components/layout/breadcrumb-context';

export type DataStreamDelta = {
  type:
    | 'text-delta'
    | 'code-delta'
    | 'sheet-delta'
    | 'image-delta'
    | 'title'
    | 'id'
    | 'suggestion'
    | 'clear'
    | 'finish'
    | 'kind'
    | 'status'
    | 'tool-call'
    | 'tool-result'
    | 'progress'
    | 'github-staged-files'
    | 'github-selection'
    | 'repository-approval-request'
    | 'repository-created'
    | 'project-creation-started';
  content: string | Suggestion | Record<string, any>;
  language?: string;
  toolCall?: {
    id: string;
    name: string;
  };
  toolResult?: {
    id: string;
    result: any;
  };
  tool_calls?: Array<{
    id: string;
    function: {
      name: string;
    };
  }>;
};

export function DataStreamHandler({ id }: { id: string }) {
  const { data: dataStream, messages, status } = useChat({ id });
  
  // Breadcrumb title updater: update when title delta arrives
  const { setTitle } = useBreadcrumb();
  const { artifact, setArtifact, setMetadata } = useArtifact();
  const lastProcessedIndex = useRef(-1);
  const { setThinkingState } = useThinkingState();
  
  // Get the artifact definition to access its onStreamPart handler
  const artifactDefinition = artifactDefinitions.find(
    (definition) => definition.kind === artifact.kind,
  );
  
  // Handle when chat is stopped - ensure artifact status is updated
  useEffect(() => {
    if (status !== 'streaming' && artifact.status === 'streaming') {
      console.log('[DATA STREAM] Chat stopped, updating artifact status to idle');
      setArtifact((draftArtifact) => ({
        ...draftArtifact,
        status: 'idle',
      }));
    }
  }, [status, artifact.status, setArtifact]);
  
  useEffect(() => {
    if (!dataStream?.length) return;

    const newDeltas = dataStream.slice(lastProcessedIndex.current + 1);
    lastProcessedIndex.current = dataStream.length - 1;

    // Log all new deltas with more details about tool calls
    console.log(
      '[DATA STREAM] New deltas:',
      newDeltas.map((d) => {
        if (d && typeof d === 'object') {
          const toolCallInfo = 'toolCall' in d ? d.toolCall : 
                               'tool_calls' in d ? d.tool_calls : 
                               null;
          
          const content = 'content' in d ? d.content : null;
          
          return {
            type: 'type' in d ? d.type : 'unknown',
            toolCall: toolCallInfo ? JSON.stringify(toolCallInfo) : undefined,
            contentPreview: typeof content === 'string' ? content.substring(0, 50) : 'non-string content',
            keys: Object.keys(d),
            timestamp: new Date().toISOString(),
          };
        }
        return 'unknown delta format';
      }),
    );

    // Handle errors first
    const errorDelta = newDeltas.find(
      (d) => d && typeof d === 'object' && 'type' in d && d.type === 'error',
    );

    if (errorDelta) {
      console.error('[DATA STREAM] Error delta received:', errorDelta);
      setArtifact((draftArtifact) => ({
        ...draftArtifact,
        status: 'idle',
        isVisible: true,
      }));
      
      setThinkingState('Thinking...', 'error_detected');
      return;
    }

    // Process each delta in sequence
    newDeltas.forEach((value) => {
      const delta = value as DataStreamDelta;
      if (!delta || typeof delta !== 'object') return;

      // Call the artifact's onStreamPart handler for all events, including custom ones
      if (artifactDefinition?.onStreamPart) {
        try {
          artifactDefinition.onStreamPart({
            streamPart: delta,
            setArtifact,
            setMetadata: (draft: Record<string, any>) => ({ 
              ...draft, 
              metadata: { 
                ...draft.metadata, 
                ...(typeof delta.content === 'object' && delta.content !== null ? delta.content : {}) 
              } 
            }),
          });
        } catch (error) {
          console.error('[DATA STREAM] Error calling artifact onStreamPart handler:', error);
        }
      }

      switch (delta.type) {
        case 'id':
          setArtifact((draftArtifact) => ({
            ...draftArtifact,
            documentId: delta.content as string,
            status: 'streaming',
          }));
          break;

        case 'title':
          // Update artifact and breadcrumb title
          setArtifact((draftArtifact) => ({
            ...draftArtifact,
            title: delta.content as string,
            status: 'streaming',
          }));
          setTitle(delta.content as string);
          break;

        case 'kind':
          setArtifact((draftArtifact) => ({
            ...draftArtifact,
            kind: delta.content as ArtifactKind,
            status: 'streaming',
          }));
          break;

        case 'clear':
          setArtifact((draftArtifact) => ({
            ...draftArtifact,
            content: '',
            status: 'streaming',
          }));
          break;

        case 'status':
          setArtifact((draftArtifact) => ({
            ...draftArtifact,
            status: delta.content as 'streaming' | 'idle',
          }));
          break;

        case 'text-delta':
          setArtifact((draftArtifact) => ({
            ...draftArtifact,
            content: draftArtifact.content + (delta.content as string),
            status: 'streaming',
          }));
          break;

        case 'finish':
          // Don't read from artifact here, as that creates a dependency
          console.log('[DATA STREAM] Finishing document generation');
          setArtifact((draftArtifact) => ({
            ...draftArtifact,
            status: 'idle',
          }));
          
          // Don't reset thinking state immediately on finish to avoid UI flicker
          // The thinking state will be properly updated when content is ready
          break;

        case 'progress':
          // Handle progress updates from tools (e.g., GitHub file creation)
          const progressData = delta.content as any;
          console.log('[DATA STREAM] Progress update:', progressData);
          
          // Update thinking state with progress message
          if (progressData.message) {
            console.log('[DATA STREAM] Setting thinking state to:', progressData.message);
            setThinkingState(progressData.message, 'github-progress');
          }
          
          // Handle specific progress actions
          if (progressData.action === 'project-init') {
            console.log('[DATA STREAM] Project initialization started');
            setThinkingState(`🔄 ${progressData.message}`, 'github-project-init');
          } else if (progressData.action === 'fetching-repositories') {
            console.log('[DATA STREAM] Fetching repositories started');
            setThinkingState(`🔄 ${progressData.message}`, 'github-fetching');
          } else if (progressData.action === 'repositories-loaded') {
            console.log('[DATA STREAM] Repositories loaded');
            setThinkingState(`✅ ${progressData.message}`, 'github-loaded');
          } else if (progressData.action === 'repositories-error') {
            console.log('[DATA STREAM] Repository loading error');
            setThinkingState(`❌ ${progressData.message}`, 'github-error');
          } else if (progressData.action === 'staging-project') {
            console.log('[DATA STREAM] Project staging started');
            const detailsText = progressData.details ? ` (${progressData.details.totalFiles} files)` : '';
            setThinkingState(`🔄 ${progressData.message}${detailsText}`, 'github-staging');
            
            // Create a temporary content update showing project staging
            setArtifact((draftArtifact) => ({
              ...draftArtifact,
              content: JSON.stringify({
                action: 'staging-project',
                message: progressData.message,
                repository: progressData.repository,
                projectName: progressData.projectName,
                projectType: progressData.projectType,
                details: progressData.details,
                status: 'in-progress'
              }, null, 2),
              status: 'streaming',
              isVisible: true,
            }));
          } else if (progressData.action === 'staging-file') {
            console.log('[DATA STREAM] File staging in progress');
            const progressText = progressData.progress ? ` (${progressData.progress})` : '';
            setThinkingState(`📁 ${progressData.message}${progressText}`, 'github-file-staging');
            
            // Create a temporary content update showing file being staged
            setArtifact((draftArtifact) => ({
              ...draftArtifact,
              content: JSON.stringify({
                action: 'staging-file',
                message: progressData.message,
                fileName: progressData.fileName,
                fileContent: progressData.fileContent,
                progress: progressData.progress,
                status: 'in-progress'
              }, null, 2),
              status: 'streaming',
              isVisible: true,
            }));
          } else if (progressData.action === 'project-completed') {
            // When project is completed, auto-open GitHub file explorer
            console.log('[DATA STREAM] Project completed, should open GitHub explorer');
            setThinkingState(`✅ ${progressData.message}`, 'github-completed');
            
            // Create a GitHub file explorer artifact
            const explorerTitle = `GitHub File Explorer: Repository ${progressData.repository}`;
            
            setArtifact((draftArtifact) => ({
              ...draftArtifact,
              kind: 'text',
              title: explorerTitle,
              status: 'idle',
              isVisible: true,
            }));
          } else if (progressData.action === 'project-staged') {
            // When project is staged, auto-open GitHub file explorer
            console.log('[DATA STREAM] Project staged, should open GitHub explorer');
            const projectDetails = progressData.projectDetails ? ` - ${progressData.projectDetails.type} project` : '';
            setThinkingState(`✅ ${progressData.message}${projectDetails}`, 'github-staged');
            
            // Create a GitHub file explorer artifact
            const explorerTitle = `GitHub File Explorer: Repository ${progressData.repository}`;
            
            setArtifact((draftArtifact) => ({
              ...draftArtifact,
              kind: 'text',
              title: explorerTitle,
              status: 'idle',
              isVisible: true,
            }));
          }
          break;

        case 'project-creation-started':
          // Handle project creation started - show progress card
          const projectStartData = delta.content as any;
          console.log('[DATA STREAM] Project creation started:', projectStartData);
          
          // Update thinking state
          if (projectStartData.message) {
            setThinkingState(projectStartData.message, 'project-creation-started');
          }
          
          // Create project creation progress card
          setArtifact((draftArtifact) => ({
            ...draftArtifact,
            kind: 'text',
            title: `Creating Project: ${projectStartData.project?.name || 'New Project'}`,
            content: JSON.stringify({
              type: 'project-creation-started',
              project: projectStartData.project,
              message: projectStartData.message,
              status: 'creating',
            }, null, 2),
            status: 'streaming',
            isVisible: true,
          }));
          break;

        case 'github-selection':
          // Handle GitHub repository/file selection to open file explorer
          const selectionData = delta.content as any;
          console.log('[DATA STREAM] GitHub selection received:', selectionData);
          
          if (selectionData.repository) {
            // Update thinking state with file summary
            const summary = selectionData.summary;
            const summaryText = summary ? 
              `Found ${summary.total} files (${summary.githubFiles} from GitHub, ${summary.stagedOnlyFiles} staged)` :
              `Opening GitHub file explorer for ${selectionData.repository.owner}/${selectionData.repository.name}`;
            
            setThinkingState(summaryText, 'github-selection');
            
            // Create GitHub file explorer artifact with file data
            const explorerTitle = `GitHub File Explorer: ${selectionData.repository.owner}/${selectionData.repository.name}`;
            
            setArtifact((draftArtifact) => ({
              ...draftArtifact,
              kind: 'text',
              title: explorerTitle,
              status: 'idle',
              isVisible: true,
              content: JSON.stringify({
                repository: selectionData.repository,
                files: selectionData.files || [],
                stagedFiles: selectionData.stagedFiles || [],
                summary: selectionData.summary || {
                  total: 0,
                  githubFiles: 0,
                  stagedFiles: 0,
                  stagedOnlyFiles: 0,
                },
              }, null, 2),
            }));
          }
          break;

        case 'github-staged-files':
          // Handle GitHub staged files updates
          const stagedFilesData = delta.content as any;
          console.log('[DATA STREAM] GitHub staged files received:', stagedFilesData);
          
          // Update thinking state
          if (stagedFilesData.files) {
            setThinkingState(`Updated ${stagedFilesData.files.length} staged files`, 'github-staged-files');
          }
          break;

        case 'suggestion':
          // Handle suggestions from the AI
          const suggestionData = delta.content as Suggestion;
          console.log('[DATA STREAM] Suggestion received:', suggestionData);
          break;

        case 'tool-call':
          // Handle tool call events - show inline feedback when tool starts
          const toolCallData = delta.content as any;
          console.log('[DATA STREAM] Tool call received:', toolCallData);
          
          // Add safety checks to prevent undefined errors
          if (toolCallData && typeof toolCallData === 'object') {
            // The tool call data could be structured in two ways:
            // 1. Legacy format: { name: 'createFile', args: {...} }
            // 2. New format: { content: { name: 'createFile', args: {...} } }
            
            const name = toolCallData.content?.name || toolCallData.name;
            const args = toolCallData.content?.args || toolCallData.args;
            const message = toolCallData.content?.message || toolCallData.message;
            const status = toolCallData.content?.status || toolCallData.status;
            
            // Handle createFile tool calls
            if (name === 'createFile' && args) {
              console.log('[DATA STREAM] Creating file via tool call:', args);
              
              // Access the window codeArtifactApi if available
              if (typeof window !== 'undefined' && (window as any).codeArtifactApi) {
                const api = (window as any).codeArtifactApi;
                const { path, content, language } = args;
                
                if (path && content) {
                  // Create or update file using the API
                  api.createOrUpdateFile(path, content, language);
                  console.log(`[DATA STREAM] Created/updated file: ${path}`);
                  
                  // Update thinking state with success message
                  setThinkingState(`Created file: ${path}`, 'tool-result-success');
                }
              }
            }
            
            // Update thinking state with tool call message if it exists
            if (typeof message === 'string') {
              setThinkingState(message, 'tool-call');
            }
            
            // Show the tool call is in progress in the artifact
            if (status === 'started') {
              setArtifact((draftArtifact) => ({
                ...draftArtifact,
                isVisible: true,
              }));
            }
          }
          break;

        case 'tool-result':
          // Handle tool result events - show inline feedback when tool completes
          const toolResultData = delta.content as any;
          console.log('[DATA STREAM] Tool result received:', toolResultData);
          
          // Update thinking state with tool result message
          if (toolResultData.message) {
            if (toolResultData.status === 'completed') {
              setThinkingState(toolResultData.message, 'tool-result-success');
            } else if (toolResultData.status === 'error') {
              setThinkingState(toolResultData.message, 'tool-result-error');
            }
          }
          break;

        case 'repository-approval-request':
          // Handle repository approval requests - show approval card
          const approvalData = delta.content as any;
          console.log('[DATA STREAM] Repository approval request received:', approvalData);
          
          // Update thinking state
          if (approvalData.message) {
            setThinkingState(approvalData.message, 'repository-approval-request');
          }
          
          // Create approval card artifact
          setArtifact((draftArtifact) => ({
            ...draftArtifact,
            kind: 'text',
            title: `Repository Approval Required`,
            content: `**Repository Creation Request**

I need your approval to create a new GitHub repository:

**Repository Name:** ${approvalData.repositoryName}
**Description:** ${approvalData.repositoryDescription}

This repository will be created in your GitHub account and will be ready for project files.

Please reply with **Approve** to proceed with creation, or **Stop** to cancel.`,
            status: 'idle',
            isVisible: true,
          }));
          break;

        case 'repository-created':
          // Handle repository creation success
          const repoCreatedData = delta.content as any;
          console.log('[DATA STREAM] Repository created successfully:', repoCreatedData);
          
          // Update thinking state
          if (repoCreatedData.message) {
            setThinkingState(repoCreatedData.message, 'repository-created');
          }
          
          // Update artifact with success state
          setArtifact((draftArtifact) => ({
            ...draftArtifact,
            kind: 'text',
            title: `Repository Created Successfully`,
            content: `✅ **Repository Created Successfully**

**Repository:** ${repoCreatedData.repository?.name}
**Owner:** ${repoCreatedData.repository?.owner}
**Description:** ${repoCreatedData.repository?.description}

🔗 **GitHub URL:** [${repoCreatedData.repository?.name}](${repoCreatedData.repository?.url})

${repoCreatedData.nextStep ? `**Next Step:** ${repoCreatedData.nextStep}` : ''}

The repository is now ready for project creation and file staging.`,
            status: 'idle',
            isVisible: true,
          }));
          break;





        default:
          console.log('[DATA STREAM] Unknown delta type:', delta.type);
          break;
      }
    });
  }, [dataStream, setArtifact, setMetadata, setTitle, setThinkingState]);

  return null;
}
