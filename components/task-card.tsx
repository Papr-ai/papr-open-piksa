'use client';

import { Card, CardContent, CardHeader, CardTitle } from './ui/card';
import { Badge } from './ui/badge';
import { CheckCircleIcon, CircleIcon, ClockIcon, PlayIcon, XCircleIcon } from 'lucide-react';
import { formatDistanceToNow } from 'date-fns';

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
  type: 'task-plan-created' | 'task-updated' | 'task-completed' | 'task-status';
  tasks?: Task[];
  task?: Task;
  nextTask?: Task;
  progress?: TaskProgress;
  allCompleted?: boolean;
  message?: string;
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

export function TaskCard({ type, tasks, task, nextTask, progress, allCompleted, message }: TaskCardProps) {
  // Show compact version for individual task updates/completions
  const isCompact = type === 'task-updated' || type === 'task-completed';
  
  const getTitle = () => {
    switch (type) {
      case 'task-plan-created':
        return `📋 Task Plan Created`;
      case 'task-updated':
        return `📝 Task Updated`;
      case 'task-completed':
        return `✅ Task Completed`;
      case 'task-status':
        return `📊 Task Status`;
      default:
        return `📋 Task Tracker`;
    }
  };

  const getProgressMessage = () => {
    if (allCompleted) {
      return `🎉 All tasks completed! Great work!`;
    }
    
    if (progress) {
      return `${progress.completed}/${progress.total} tasks completed (${progress.percentage}%)`;
    }
    
    return message || '';
  };

  // Modern SVG icons matching Papr logo style
  const getModernIcon = (status: 'completed' | 'updated' | 'up-next') => {
    const gradientId = `gradient-${status}-${Math.random().toString(36).substr(2, 9)}`;
    
    switch (status) {
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
    const statusType = type === 'task-completed' ? 'completed' : isUpNext ? 'up-next' : 'updated';
    const statusText = type === 'task-completed' ? 'completed' : type === 'task-updated' ? 'updated' : 'up next';
    
    // Get the task title - could be from task object or message
    const taskTitle = task?.title || message || 'Task';
    
    return (
      <div className={`flex items-center gap-3 py-2 px-3 border rounded-lg text-sm transition-colors ${
        isUpNext 
          ? 'bg-blue-50 dark:bg-blue-900/20 border-blue-200 dark:border-blue-700' 
          : type === 'task-completed'
          ? 'bg-green-50 dark:bg-green-900/20 border-green-200 dark:border-green-700'
          : 'bg-gray-50 dark:bg-gray-800 border-gray-200 dark:border-gray-700'
      }`}>
        {getModernIcon(statusType)}
        <span className="font-medium dark:text-gray-100">
          Task {statusText}:
        </span>
        <span className="text-gray-700 dark:text-gray-300 flex-1 truncate">
          {taskTitle}
        </span>
        {progress && (
          <span className="text-xs text-gray-500 dark:text-gray-400 ml-2 whitespace-nowrap">
            {progress.completed}/{progress.total}
          </span>
        )}
      </div>
    );
  }

  return (
    <Card className="my-4 border-l-4 border-l-blue-500 dark:border-l-blue-400 dark:bg-gray-900">
      <CardHeader className="pb-3">
        <CardTitle className="flex items-center gap-2 text-lg dark:text-gray-100">
          {getTitle()}
        </CardTitle>
        <div className="text-sm text-muted-foreground dark:text-gray-400">
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
      
      <CardContent className="space-y-4">


        {/* Task list display for task-plan-created and task-status */}
        {(type === 'task-plan-created' || type === 'task-status') && tasks && tasks.length > 0 && (
          <div className="space-y-2">
            {tasks.slice(0, 5).map((t, index) => {
              const isUpNext = nextTask && t.id === nextTask.id && t.status === 'pending';
              return (
              <div
                key={t.id}
                className={`flex items-start gap-3 p-3 rounded-lg border ${
                  isUpNext 
                    ? 'border-blue-300 bg-blue-50 dark:border-blue-600 dark:bg-blue-900/20' 
                    : t.status === 'in_progress' 
                    ? 'border-blue-200 bg-blue-50 dark:border-blue-700 dark:bg-blue-900/10' 
                    : 'border-gray-200 bg-gray-50 dark:border-gray-700 dark:bg-gray-800'
                }`}
              >
                {getStatusIcon(t.status)}
                <div className="flex-1">
                  <div className="flex items-center gap-2 mb-1">
                    <span className="font-medium text-sm dark:text-gray-100">{t.title}</span>
                    <Badge className={`text-xs ${getStatusBadgeColor(t.status)}`}>
                      {t.status.replace('_', ' ')}
                    </Badge>
                  </div>
                  {t.description && (
                    <p className="text-xs text-gray-600 dark:text-gray-400 line-clamp-2">{t.description}</p>
                  )}
                  <div className="flex items-center gap-3 text-xs text-gray-500 dark:text-gray-400 mt-1">
                    {t.estimatedDuration && (
                      <span className="flex items-center gap-1">
                        <ClockIcon className="w-3 h-3" />
                        {t.estimatedDuration}
                      </span>
                    )}
                    {t.dependencies && t.dependencies.length > 0 && (
                      <span>{t.dependencies.length} dependencies</span>
                    )}
                  </div>
                </div>
              </div>
              );
            })}
            
            {tasks.length > 5 && (
              <div className="text-sm text-gray-500 text-center py-2">
                ... and {tasks.length - 5} more tasks
              </div>
            )}
          </div>
        )}

        {/* Next task is now highlighted directly in the task list above */}

        {/* Success message for all completed */}
        {allCompleted && (
          <div className="border-t pt-3 dark:border-gray-700">
            <div className="text-center p-4 bg-green-50 dark:bg-green-900/20 rounded-lg border border-green-200 dark:border-green-800">
              <div className="text-green-800 dark:text-green-400 font-medium">🎉 All Tasks Completed!</div>
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
            // Prioritize certain types: task-plan-created > task-completed > task-updated
            const priority = {
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
      };
    }
    return null;
  } catch (e) {
    return null;
  }
} 
