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

  return (
    <Card className="my-4 border-l-4 border-l-blue-500">
      <CardHeader className="pb-3">
        <CardTitle className="flex items-center gap-2 text-lg">
          {getTitle()}
        </CardTitle>
        <div className="text-sm text-muted-foreground">
          {getProgressMessage()}
        </div>
        {progress && (
          <div className="mt-2">
            <div className="w-full bg-gray-200 rounded-full h-2">
              <div
                className="bg-blue-500 h-2 rounded-full transition-all duration-300"
                style={{ width: `${progress.percentage}%` }}
              />
            </div>
          </div>
        )}
      </CardHeader>
      
      <CardContent className="space-y-4">
        {/* Single task display for task-updated and task-completed */}
        {(type === 'task-updated' || type === 'task-completed') && task && (
          <div className="border rounded-lg p-3 bg-gray-50">
            <div className="flex items-start gap-3">
              {getStatusIcon(task.status)}
              <div className="flex-1">
                <div className="flex items-center gap-2 mb-1">
                  <span className="font-medium">{task.title}</span>
                  <Badge className={`text-xs ${getStatusBadgeColor(task.status)}`}>
                    {task.status.replace('_', ' ')}
                  </Badge>
                </div>
                {task.description && (
                  <p className="text-sm text-gray-600 mb-2">{task.description}</p>
                )}
                <div className="flex items-center gap-4 text-xs text-gray-500">
                  <span className="flex items-center gap-1">
                    <ClockIcon className="w-3 h-3" />
                    {task.estimatedDuration || 'No estimate'}
                  </span>
                  <span>Created {formatDate(task.createdAt)}</span>
                  {task.completedAt && (
                    <span>Completed {formatDate(task.completedAt)}</span>
                  )}
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Task list display for task-plan-created and task-status */}
        {(type === 'task-plan-created' || type === 'task-status') && tasks && tasks.length > 0 && (
          <div className="space-y-2">
            {tasks.slice(0, 5).map((t, index) => (
              <div
                key={t.id}
                className={`flex items-start gap-3 p-3 rounded-lg border ${
                  t.status === 'in_progress' ? 'border-blue-200 bg-blue-50' : 'border-gray-200 bg-gray-50'
                }`}
              >
                {getStatusIcon(t.status)}
                <div className="flex-1">
                  <div className="flex items-center gap-2 mb-1">
                    <span className="font-medium text-sm">{t.title}</span>
                    <Badge className={`text-xs ${getStatusBadgeColor(t.status)}`}>
                      {t.status.replace('_', ' ')}
                    </Badge>
                  </div>
                  {t.description && (
                    <p className="text-xs text-gray-600 line-clamp-2">{t.description}</p>
                  )}
                  <div className="flex items-center gap-3 text-xs text-gray-500 mt-1">
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
            ))}
            
            {tasks.length > 5 && (
              <div className="text-sm text-gray-500 text-center py-2">
                ... and {tasks.length - 5} more tasks
              </div>
            )}
          </div>
        )}

        {/* Next task display */}
        {nextTask && (
          <div className="border-t pt-3">
            <div className="text-sm font-medium text-gray-700 mb-2">Next Task:</div>
            <div className="flex items-start gap-3 p-3 rounded-lg border-2 border-blue-200 bg-blue-50">
              {getStatusIcon(nextTask.status)}
              <div className="flex-1">
                <div className="flex items-center gap-2 mb-1">
                  <span className="font-medium text-sm">{nextTask.title}</span>
                  <Badge className="text-xs bg-blue-100 text-blue-800">
                    Up Next
                  </Badge>
                </div>
                {nextTask.description && (
                  <p className="text-xs text-gray-600">{nextTask.description}</p>
                )}
                <div className="flex items-center gap-3 text-xs text-gray-500 mt-1">
                  {nextTask.estimatedDuration && (
                    <span className="flex items-center gap-1">
                      <ClockIcon className="w-3 h-3" />
                      {nextTask.estimatedDuration}
                    </span>
                  )}
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Success message for all completed */}
        {allCompleted && (
          <div className="border-t pt-3">
            <div className="text-center p-4 bg-green-50 rounded-lg border border-green-200">
              <div className="text-green-800 font-medium">🎉 All Tasks Completed!</div>
              <div className="text-sm text-green-600 mt-1">
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
    // First, try to detect if there are multiple JSON objects
    const jsonObjectRegex = /\{[\s\S]*?\}/g;
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