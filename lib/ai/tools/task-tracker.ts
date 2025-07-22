import { z } from 'zod';
import { tool } from 'ai';
import type { DataStreamWriter } from 'ai';

// Task status types
export type TaskStatus = 'pending' | 'in_progress' | 'completed' | 'blocked' | 'cancelled';

// Task structure
export interface Task {
  id: string;
  title: string;
  description?: string;
  status: TaskStatus;
  dependencies?: string[]; // IDs of tasks that must be completed first
  createdAt: Date;
  completedAt?: Date;
  estimatedDuration?: string;
  actualDuration?: string;
}

// In-memory task store (in a real app, this would be persistent)
const taskStore = new Map<string, Task[]>();

// Get tasks for a session
function getTasks(sessionId: string): Task[] {
  return taskStore.get(sessionId) || [];
}

// Save tasks for a session
function saveTasks(sessionId: string, tasks: Task[]): void {
  taskStore.set(sessionId, tasks);
}

// Generate a unique task ID
function generateTaskId(): string {
  return `task_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
}

// Common task item schema
const taskItemSchema = z.object({
  title: z.string().describe('Task title'),
  description: z.string().describe('Task description'),
  dependencies: z.array(z.string()).describe('IDs of tasks that must be completed first. NA if there are no dependencies'),
  estimatedDuration: z.string().describe('Estimated time to complete task'),
});

// Helper function to get the next available task (one with no incomplete dependencies)
function getNextAvailableTask(tasks: Task[]): Task | null {
  return tasks.find(task => {
    if (task.status !== 'pending') return false;
    
    // Check if all dependencies are completed
    if (task.dependencies && task.dependencies.length > 0) {
      const allDepsCompleted = task.dependencies.every(depId => {
        const depTask = tasks.find(t => t.id === depId);
        return depTask && depTask.status === 'completed';
      });
      return allDepsCompleted;
    }
    
    return true; // No dependencies, so it's available
  }) || null;
}

// Helper function to get task progress
function getTaskProgress(tasks: Task[]): { completed: number; total: number; percentage: number } {
  const total = tasks.length;
  const completed = tasks.filter(t => t.status === 'completed').length;
  const percentage = total > 0 ? Math.round((completed / total) * 100) : 0;
  
  return { completed, total, percentage };
}

// Create task plan tool
export function createCreateTaskPlanTool(dataStream: DataStreamWriter) {
  return tool({
    description: 'Create a comprehensive task plan at the start of complex requests',
    parameters: z.object({
      sessionId: z.string().describe('Unique session identifier (use chat ID)'),
      tasks: z.array(taskItemSchema).describe('Tasks to create for the plan'),
    }),
    execute: async ({ sessionId, tasks }) => {
      // Validate required parameters
      if (!tasks || tasks.length === 0) {
        return { 
          success: false,
          error: 'No tasks provided for plan creation' 
        };
      }
      
      const newTasks: Task[] = tasks.map(task => ({
        id: generateTaskId(),
        title: task.title,
        description: task.description || '',
        status: 'pending' as TaskStatus,
        dependencies: task.dependencies || [],
        createdAt: new Date(),
        estimatedDuration: task.estimatedDuration || '',
      }));
      
      saveTasks(sessionId, newTasks);
      
      const planNextTask = getNextAvailableTask(newTasks);
      const planProgress = getTaskProgress(newTasks);
      
      return {
        success: true,
        type: 'task-plan-created',
        tasks: newTasks,
        nextTask: planNextTask,
        progress: planProgress,
        message: `Created task plan with ${newTasks.length} tasks`,
      };
    },
  });
}

// Update task tool
export function createUpdateTaskTool(dataStream: DataStreamWriter) {
  return tool({
    description: 'Update the status of a task in the plan',
    parameters: z.object({
      sessionId: z.string().describe('Unique session identifier (use chat ID)'),
      taskId: z.string().describe('ID of specific task to update'),
      status: z.enum(['pending', 'in_progress', 'completed', 'blocked', 'cancelled']).describe('New status for task'),
    }),
    execute: async ({ sessionId, taskId, status }) => {
      const currentTasks = getTasks(sessionId);
      
      // Validate required parameters
      if (!taskId) {
        return { 
          success: false,
          error: 'Task ID required for update' 
        };
      }
      
      const taskIndex = currentTasks.findIndex(t => t.id === taskId);
      if (taskIndex === -1) {
        return { 
          success: false,
          error: 'Task not found' 
        };
      }
      
      const updatedTasks = [...currentTasks];
      updatedTasks[taskIndex].status = status;
      if (status === 'completed') {
        updatedTasks[taskIndex].completedAt = new Date();
      }
      
      saveTasks(sessionId, updatedTasks);
      
      const updateNextTask = getNextAvailableTask(updatedTasks);
      const updateProgress = getTaskProgress(updatedTasks);
      
      return {
        success: true,
        type: 'task-updated',
        task: updatedTasks[taskIndex],
        nextTask: updateNextTask,
        progress: updateProgress,
        message: `Task updated: ${updatedTasks[taskIndex].title}`,
      };
    },
  });
}

// Complete task tool
export function createCompleteTaskTool(dataStream: DataStreamWriter) {
  return tool({
    description: 'Mark a specific task as completed',
    parameters: z.object({
      sessionId: z.string().describe('Unique session identifier (use chat ID)'),
      taskId: z.string().describe('ID of specific task to complete'),
    }),
    execute: async ({ sessionId, taskId }) => {
      const currentTasks = getTasks(sessionId);
      
      // Validate required parameters
      if (!taskId) {
        return { 
          success: false,
          error: 'Task ID required for completion' 
        };
      }
      
      const completeTaskIndex = currentTasks.findIndex(t => t.id === taskId);
      if (completeTaskIndex === -1) {
        return { 
          success: false,
          error: 'Task not found' 
        };
      }
      
      const completedTasks = [...currentTasks];
      completedTasks[completeTaskIndex].status = 'completed';
      completedTasks[completeTaskIndex].completedAt = new Date();
      
      saveTasks(sessionId, completedTasks);
      
      const completedTask = completedTasks[completeTaskIndex];
      const completeNextTask = getNextAvailableTask(completedTasks);
      const completeProgress = getTaskProgress(completedTasks);
      
      return {
        success: true,
        type: 'task-completed',
        task: completedTask,
        nextTask: completeNextTask,
        progress: completeProgress,
        allCompleted: completeProgress.completed === completeProgress.total,
        message: `Completed task: ${completedTask.title}`,
      };
    },
  });
}

// Get task status tool
export function createGetTaskStatusTool(dataStream: DataStreamWriter) {
  return tool({
    description: 'Check the progress and status of the current task plan',
    parameters: z.object({
      sessionId: z.string().describe('Unique session identifier (use chat ID)'),
    }),
    execute: async ({ sessionId }) => {
      const currentTasks = getTasks(sessionId);
      
      const statusProgress = getTaskProgress(currentTasks);
      const statusNextTask = getNextAvailableTask(currentTasks);
      
      return {
        success: true,
        type: 'task-status',
        tasks: currentTasks,
        nextTask: statusNextTask,
        progress: statusProgress,
        allCompleted: statusProgress.completed === statusProgress.total,
        message: `Task Status: ${statusProgress.completed}/${statusProgress.total} completed (${statusProgress.percentage}%)`,
      };
    },
  });
}

// Add tasks tool
export function createAddTaskTool(dataStream: DataStreamWriter) {
  return tool({
    description: 'Add new tasks to an existing plan',
    parameters: z.object({
      sessionId: z.string().describe('Unique session identifier (use chat ID)'),
      tasks: z.array(taskItemSchema).describe('Tasks to add to the plan'),
    }),
    execute: async ({ sessionId, tasks }) => {
      const currentTasks = getTasks(sessionId);
      
      // Validate required parameters
      if (!tasks || tasks.length === 0) {
        return { 
          success: false,
          error: 'No tasks provided to add' 
        };
      }
      
      const additionalTasks: Task[] = tasks.map(task => ({
        id: generateTaskId(),
        title: task.title,
        description: task.description || '',
        status: 'pending' as TaskStatus,
        dependencies: task.dependencies || [],
        createdAt: new Date(),
        estimatedDuration: task.estimatedDuration || '',
      }));
      
      const allTasks = [...currentTasks, ...additionalTasks];
      saveTasks(sessionId, allTasks);
      
      return {
        success: true,
        message: `Added ${additionalTasks.length} new tasks`,
        tasks: allTasks,
        newTasks: additionalTasks,
        nextTask: getNextAvailableTask(allTasks),
      };
    },
  });
}

// For backward compatibility, export a combined function
export function createTaskTrackerTools(dataStream: DataStreamWriter) {
  return {
    createTaskPlan: createCreateTaskPlanTool(dataStream),
    updateTask: createUpdateTaskTool(dataStream),
    completeTask: createCompleteTaskTool(dataStream),
    getTaskStatus: createGetTaskStatusTool(dataStream),
    addTask: createAddTaskTool(dataStream),
  };
} 