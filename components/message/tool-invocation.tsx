'use client';

import { DocumentToolCall, DocumentToolResult } from '@/components/document/document';
import { BookToolCall, BookToolResult } from '@/components/book/book-tool-result';
import { AddMemoryResults } from '@/components/memory/add-memory-results';
import { useState, useEffect } from 'react';
import { FileIcon } from 'lucide-react';
import { AlertTriangleIcon, XCircleIcon } from 'lucide-react';
import { useArtifact } from '@/hooks/use-artifact';



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
    default:
      return '🔧';
  }
}

function getToolLabel(toolName: string, args?: any) {
  switch (toolName) {
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


export function ToolInvocation({ 
  toolName, 
  state, 
  toolCallId, 
  args, 
  result,
  isReadonly = false
}: ToolInvocationProps) {

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

} 