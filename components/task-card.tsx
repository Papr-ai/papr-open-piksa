'use client';

import { Card, CardContent, CardHeader, CardTitle } from './ui/card';
import { Badge } from './ui/badge';
import { CheckCircleIcon, CircleIcon, ClockIcon, PlayIcon, XCircleIcon, ChevronDownIcon, ChevronRightIcon } from 'lucide-react';
import { formatDistanceToNow } from 'date-fns';
import { useState } from 'react';

interface Task {
  id: string;
  title: string;
  description?: string;
  status: 'pending' | 'in_progress' | 'completed' | 'blocked' | 'cancelled';
  dependencies?: string[];
  createdAt: string;
  completedAt?: string;
  estimatedDuration?: string;
  actualDuration?: string;
}

interface TaskProgress {
  completed: number;
  total: number;
  percentage: number;
}

interface TaskCardProps {
  type: 'task-plan-created' | 'task-updated' | 'task-completed' | 'task-status' | 'task-plan-creating';
  tasks?: Task[];
  task?: Task;
  nextTask?: Task;
  progress?: TaskProgress;
  allCompleted?: boolean;
  message?: string;
  taskCount?: number; // For showing count during creation
}

// Helper function to get status icon
function getStatusIcon(status: string) {
  switch (status) {
    case 'pending':
      return <CircleIcon className="w-4 h-4 text-gray-500" />;
    case 'in_progress':
      return <PlayIcon className="w-4 h-4 text-blue-500 animate-pulse" />;
    case 'completed':
      return <CheckCircleIcon className="w-4 h-4 text-green-500" />;
    case 'blocked':
      return <XCircleIcon className="w-4 h-4 text-red-500" />;
    case 'cancelled':
      return <XCircleIcon className="w-4 h-4 text-gray-500" />;
    default:
      return <CircleIcon className="w-4 h-4 text-gray-500" />;
  }
}

// Helper function to get status badge color
function getStatusBadgeColor(status: string) {
  switch (status) {
    case 'pending':
      return 'bg-gray-100 text-gray-800';
    case 'in_progress':
      return 'bg-blue-100 text-blue-800';
    case 'completed':
      return 'bg-green-100 text-green-800';
    case 'blocked':
      return 'bg-red-100 text-red-800';
    case 'cancelled':
      return 'bg-gray-100 text-gray-800';
    default:
      return 'bg-gray-100 text-gray-800';
  }
}

// Helper function to format date
function formatDate(dateString: string) {
  try {
    const date = new Date(dateString);
    return formatDistanceToNow(date, { addSuffix: true });
  } catch (e) {
    return 'unknown time';
  }
}

// Compact Task Item Component
function CompactTaskItem({ task, isUpNext }: { task: Task; isUpNext: boolean }) {
  const [isExpanded, setIsExpanded] = useState(false);

  return (
    <div
      className={`border-b last:border-b-0 transition-colors ${
        isUpNext 
          ? 'bg-blue-50 dark:bg-blue-900/20 border-blue-200 dark:border-blue-700' 
          : task.status === 'in_progress' 
          ? 'bg-blue-50 dark:bg-blue-900/10 border-blue-200 dark:border-blue-700' 
          : task.status === 'completed'
          ? 'bg-green-50 dark:bg-green-900/10 border-green-200 dark:border-green-700'
          : 'bg-white dark:bg-gray-800 border-gray-200 dark:border-gray-700'
      }`}
    >
      {/* Compact header - always visible */}
      <div 
        className="flex items-center gap-2 py-2 px-3 cursor-pointer hover:bg-opacity-80 transition-colors"
        onClick={() => setIsExpanded(!isExpanded)}
      >
        {getStatusIcon(task.status)}
        <span className="font-medium text-sm dark:text-gray-100 flex-1 truncate">
          {task.title}
        </span>
        <div className="flex items-center gap-1.5">
          <Badge className={`text-xs px-1.5 py-0.5 ${getStatusBadgeColor(task.status)}`}>
            {task.status.replace('_', ' ')}
          </Badge>
          {task.description && (
            <button className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-300">
              {isExpanded ? (
                <ChevronDownIcon className="w-3 h-3" />
              ) : (
                <ChevronRightIcon className="w-3 h-3" />
              )}
            </button>
          )}
        </div>
      </div>

      {/* Expanded details - only visible when expanded */}
      {isExpanded && task.description && (
        <div className="px-3 pb-2 border-t border-gray-200 dark:border-gray-600">
          <div className="pt-2">
            <p className="text-sm text-gray-600 dark:text-gray-400 mb-1.5">{task.description}</p>
            <div className="flex items-center gap-2 text-xs text-gray-500 dark:text-gray-400">
              {task.estimatedDuration && (
                <span className="flex items-center gap-1">
                  <ClockIcon className="w-2.5 h-2.5" />
                  {task.estimatedDuration}
                </span>
              )}
              {task.dependencies && task.dependencies.length > 0 && (
                <span>{task.dependencies.length} dependencies</span>
              )}
              {task.createdAt && (
                <span>Created {formatDate(task.createdAt.toString())}</span>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export function TaskCard({ type, tasks, task, nextTask, progress, allCompleted, message, taskCount }: TaskCardProps) {
  
  // Debug logging to see what data we're receiving
  console.log('[TaskCard] Received props:', {
    type,
    tasks: tasks?.length || 0,
    tasksData: tasks,
    task,
    nextTask,
    progress,
    allCompleted,
    message,
    taskCount
  });
  
  // Show compact version for individual task updates/completions and empty task status
  const isCompact = type === 'task-updated' || type === 'task-completed' || 
    (type === 'task-status' && (!tasks || tasks.length === 0));
  
  const getTitle = () => {
    switch (type) {
      case 'task-plan-creating':
        return `Creating Task Plan`;
      case 'task-plan-created':
        return `Task Plan Created`;
      case 'task-updated':
        return `Task Updated`;
      case 'task-completed':
        return `Task Completed`;
      case 'task-status':
        return `Task Status`;
      default:
        return `Task Tracker`;
    }
  };

  const getProgressMessage = () => {
    if (type === 'task-plan-creating') {
      return taskCount ? `Planning ${taskCount} tasks...` : 'Analyzing requirements and creating task plan...';
    }
    
    if (allCompleted) {
      return `🎉 All tasks completed! Great work!`;
    }
    
    if (progress) {
      return `${progress.completed}/${progress.total} tasks completed (${progress.percentage}%)`;
    }
    
    return message || '';
  };

  // Modern SVG icons matching Papr logo style
  const getModernIcon = (status: 'completed' | 'updated' | 'up-next' | 'plan-created') => {
    const gradientId = `gradient-${status}-${Math.random().toString(36).substr(2, 9)}`;
    
    switch (status) {
      case 'plan-created':
        return (
          <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
            <defs>
              <linearGradient id={gradientId} x1="0%" y1="0%" x2="100%" y2="100%">
                <stop offset="0%" stopColor="#0060E0" />
                <stop offset="60%" stopColor="#00ACFA" />
                <stop offset="100%" stopColor="#0BCDFF" />
              </linearGradient>
            </defs>
            <rect x="2" y="2" width="12" height="12" rx="2" fill={`url(#${gradientId})`}/>
            <path d="M4 5h8M4 7h6M4 9h8M4 11h4" stroke="white" strokeWidth="1.2" strokeLinecap="round"/>
            <circle cx="12" cy="4" r="2" fill="#10B981"/>
            <path d="M11 4l0.5 0.5L13 3" stroke="white" strokeWidth="1" strokeLinecap="round" strokeLinejoin="round"/>
          </svg>
        );
      case 'completed':
        return (
          <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
            <defs>
              <linearGradient id={gradientId} x1="0%" y1="0%" x2="100%" y2="100%">
                <stop offset="0%" stopColor="#10B981" />
                <stop offset="100%" stopColor="#059669" />
              </linearGradient>
            </defs>
            <circle cx="8" cy="8" r="7" fill={`url(#${gradientId})`} stroke="white" strokeWidth="1"/>
            <path d="M5 8l2 2 4-4" stroke="white" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
          </svg>
        );
      case 'updated':
        return (
          <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
            <defs>
              <linearGradient id={gradientId} x1="0%" y1="0%" x2="100%" y2="100%">
                <stop offset="0%" stopColor="#0060E0" />
                <stop offset="60%" stopColor="#00ACFA" />
                <stop offset="100%" stopColor="#0BCDFF" />
              </linearGradient>
            </defs>
            <rect x="2" y="3" width="12" height="10" rx="2" fill={`url(#${gradientId})`}/>
            <path d="M4 6h8M4 8h6M4 10h4" stroke="white" strokeWidth="1.5" strokeLinecap="round"/>
          </svg>
        );
      case 'up-next':
        return (
          <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
            <defs>
              <linearGradient id={gradientId} x1="0%" y1="0%" x2="100%" y2="100%">
                <stop offset="0%" stopColor="#0060E0" />
                <stop offset="60%" stopColor="#00ACFA" />
                <stop offset="100%" stopColor="#0BCDFF" />
              </linearGradient>
            </defs>
            <circle cx="8" cy="8" r="7" fill={`url(#${gradientId})`} stroke="white" strokeWidth="1"/>
            <path d="M6 5l4 3-4 3V5z" fill="white"/>
          </svg>
        );
      default:
        return null;
    }
  };

  // Render compact version for updates and completions
  if (isCompact) {
    // Use the type prop to determine the correct display
    const isUpNext = nextTask && task && task.id === nextTask.id && task.status === 'pending';
    const statusType = type === 'task-completed' ? 'completed' : 
                      type === 'task-status' ? 'updated' : 
                      isUpNext ? 'up-next' : 'updated';
    const statusText = type === 'task-completed' ? 'completed' : 
                      type === 'task-updated' ? 'updated' : 
                      type === 'task-status' ? 'no tasks found' : 'up next';
    
    // Get the task title - could be from task object or message
    const taskTitle = type === 'task-status' ? 'No Task Plan Found' : task?.title || message || 'Task';
    
    return (
      <div className={`flex items-center gap-2 py-1.5 px-2.5 border rounded-lg text-xs transition-colors w-fit max-w-full ${
        isUpNext 
          ? 'bg-blue-50 dark:bg-blue-900/20 border-blue-200 dark:border-blue-700' 
          : type === 'task-completed'
          ? 'bg-green-50 dark:bg-green-900/20 border-green-200 dark:border-green-700'
          : 'bg-gray-50 dark:bg-gray-800 border-gray-200 dark:border-gray-700'
      }`}>
        {getModernIcon(statusType)}
        <span className="font-medium text-xs dark:text-gray-100">
          Task {statusText}:
        </span>
        <span className="text-gray-700 dark:text-gray-300 flex-1 truncate text-sm">
          {taskTitle}
        </span>
        {progress && (
          <span className="text-sm text-gray-500 dark:text-gray-400 ml-2 whitespace-nowrap">
            {progress.completed}/{progress.total}
          </span>
        )}
      </div>
    );
  }

  // Special loading card for task creation
  if (type === 'task-plan-creating') {
    return (
      <Card className="border-l-4 border-l-blue-500 dark:border-l-blue-400 dark:bg-gray-900">
        <CardHeader className="pb-3">
          <CardTitle className="flex items-center gap-2 text-lg dark:text-gray-100">
            <div className="flex items-center gap-2">
              <div className="w-5 h-5 border-2 border-blue-500 border-t-transparent rounded-full animate-spin"></div>
              {getTitle()}
            </div>
          </CardTitle>
          <div className="text-sm text-muted-foreground dark:text-gray-400">
            {getProgressMessage()}
          </div>
        </CardHeader>
        <CardContent>
          <div className="flex items-center justify-center p-8 bg-blue-50 dark:bg-blue-900/20 rounded-lg border border-blue-200 dark:border-blue-700">
            <div className="text-center">
              <div className="w-12 h-12 border-4 border-blue-500 border-t-transparent rounded-full animate-spin mx-auto mb-4"></div>
              <div className="text-blue-800 dark:text-blue-400 font-medium mb-2">
                Setting up your task plan
              </div>
              <div className="text-sm text-blue-600 dark:text-blue-500">
                Breaking down your request into manageable steps...
              </div>
            </div>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="border-l-4 border-l-blue-500 dark:border-l-blue-400 dark:bg-gray-900 w-fit max-w-full">
      <CardHeader className="pb-2 pt-3">
        <CardTitle className="flex items-center gap-2 text-sm font-semibold dark:text-gray-100">
          {type === 'task-plan-created' && getModernIcon('plan-created')}
          {getTitle()}
        </CardTitle>
        <div className="text-xs text-muted-foreground dark:text-gray-400">
          {getProgressMessage()}
        </div>
        {progress && (
          <div className="mt-2">
            <div className="w-full bg-gray-200 dark:bg-gray-700 rounded-full h-2">
              <div
                className="bg-blue-500 dark:bg-blue-400 h-2 rounded-full transition-all duration-300"
                style={{ width: `${progress.percentage}%` }}
              />
            </div>
          </div>
        )}
      </CardHeader>
      
      <CardContent>


        {/* Task list display for task-plan-created and task-status */}
        {(type === 'task-plan-created' || type === 'task-status') && (
          tasks && tasks.length > 0 ? (
          <div className="border border-gray-200 dark:border-gray-700 rounded-lg overflow-hidden">
            {tasks.slice(0, 10).map((t, index) => {
              const isUpNext = !!(nextTask && t.id === nextTask.id && t.status === 'pending');
              return (
                <CompactTaskItem 
                  key={t.id} 
                  task={t} 
                  isUpNext={isUpNext}
                />
              );
            })}
            
            {tasks.length > 10 && (
              <div className="text-sm text-gray-500 text-center py-2 border-t border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-800">
                <span className="px-2 py-0.5 bg-gray-100 dark:bg-gray-700 rounded-full text-xs">
                  + {tasks.length - 10} more tasks
                </span>
              </div>
            )}
          </div>
          ) : (
            // Show message when no tasks are found for task-status
            <div className="text-center p-3 bg-gray-50 dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700">
              <div className="text-gray-600 dark:text-gray-400 font-medium text-sm">No Task Plan Found</div>
              <div className="text-sm text-gray-500 dark:text-gray-500 mt-1">
                {type === 'task-status' 
                  ? 'No active task plan for this session. Create a task plan to get started.'
                  : 'Task plan is empty.'
                }
              </div>
            </div>
          )
        )}

        {/* Next task is now highlighted directly in the task list above */}

        {/* Success message for all completed */}
        {allCompleted && (
          <div className="border-t pt-2 dark:border-gray-700">
            <div className="text-center p-3 bg-green-50 dark:bg-green-900/20 rounded-lg border border-green-200 dark:border-green-800">
              <div className="text-green-800 dark:text-green-400 font-medium text-sm">🎉 All Tasks Completed!</div>
              <div className="text-sm text-green-600 dark:text-green-500 mt-1">
                Great job completing all the tasks in your plan!
              </div>
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
// Helper function to detect task tracker data in content
export function detectTaskTrackerData(content: string): TaskCardProps | null {
  try {
    // Look for JSON objects that contain task data - match more precisely
    const jsonObjectRegex = /\{[\s\S]*?"type":\s*"task-[^"]*"[\s\S]*?\}/g;
    const jsonMatches = content.match(jsonObjectRegex);
    
    if (jsonMatches && jsonMatches.length > 0) {
      // Process each JSON object and find the most recent/relevant one
      let latestTaskData: TaskCardProps | null = null;
      
      for (const jsonMatch of jsonMatches) {
        try {
          const parsed = JSON.parse(jsonMatch.trim());
          
          if (parsed.type && typeof parsed.type === 'string' && parsed.type.startsWith('task-')) {
            // Prioritize certain types: task-plan-creating > task-plan-created > task-completed > task-updated
            const priority = {
              'task-plan-creating': 4,
              'task-plan-created': 3,
              'task-completed': 2,
              'task-updated': 1,
              'task-status': 1
            };
            
            const currentPriority = priority[parsed.type as keyof typeof priority] || 0;
            const latestPriority = latestTaskData ? priority[latestTaskData.type as keyof typeof priority] || 0 : 0;
            
            // Update if this is higher priority or if we don't have any task data yet
            if (currentPriority >= latestPriority || !latestTaskData) {
              latestTaskData = {
                type: parsed.type,
                tasks: parsed.tasks,
                task: parsed.task,
                nextTask: parsed.nextTask,
                progress: parsed.progress,
                allCompleted: parsed.allCompleted,
                message: parsed.message,
                taskCount: parsed.taskCount,
              };
            }
          }
        } catch (e) {
          // Skip invalid JSON objects
          continue;
        }
      }
      
      return latestTaskData;
    }
    
    // Fallback to original logic for single JSON objects
    let jsonString = content.trim();
    const codeFenceMatch = jsonString.match(/```(?:json)?\s*([\s\S]*?)```/);
    if (codeFenceMatch) {
      jsonString = codeFenceMatch[1].trim();
    }
    const parsed = JSON.parse(jsonString);

    if (parsed.type && typeof parsed.type === 'string' && parsed.type.startsWith('task-')) {
      return {
        type: parsed.type,
        tasks: parsed.tasks,
        task: parsed.task,
        nextTask: parsed.nextTask,
        progress: parsed.progress,
        allCompleted: parsed.allCompleted,
        message: parsed.message,
        taskCount: parsed.taskCount,
      };
    }
    return null;
  } catch (e) {
    return null;
  }
} 
