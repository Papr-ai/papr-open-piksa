import { z } from 'zod';
import { tool, type Tool, type ToolCallOptions } from 'ai';
import type { DataStreamWriter } from '@/lib/types';
import { createMemoryService } from '@/lib/ai/memory/service';
import { ensurePaprUser } from '@/lib/ai/memory/middleware';
import type { Session } from 'next-auth';

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

// Tool input/output types
type TaskPlanInput = {
  sessionId: string;
  tasks: Array<{
    title: string;
    description?: string;
    dependencies?: string[];
    estimatedDuration?: string;
  }>;
};

type TaskPlanOutput = {
  success: boolean;
  error?: string;
  type?: string;
  tasks?: Task[];
  nextTask?: Task | null;
  progress?: { completed: number; total: number; percentage: number };
  allCompleted?: boolean;
  message?: string;
};

type UpdateTaskInput = {
  sessionId: string;
  taskId: string;
  status: TaskStatus;
};

type UpdateTaskOutput = TaskPlanOutput & {
  task?: Task;
  tasks?: Task[];
};

type CompleteTaskInput = {
  sessionId: string;
  taskId: string;
};

type CompleteTaskOutput = TaskPlanOutput & {
  task?: Task;
  allCompleted?: boolean;
};

type GetTaskStatusInput = {
  sessionId: string;
};

type GetTaskStatusOutput = {
  success: boolean;
  type: string;
  tasks: Task[];
  nextTask: Task | null;
  progress: { completed: number; total: number; percentage: number };
  allCompleted: boolean;
  message: string;
};

type AddTaskInput = {
  sessionId: string;
  tasks: Array<{
    title: string;
    description?: string;
    dependencies?: string[];
    estimatedDuration?: string;
  }>;
};

type AddTaskOutput = {
  success: boolean;
  error?: string;
  type?: string;
  message?: string;
  tasks?: Task[];
  newTasks?: Task[];
  nextTask?: Task | null;
  progress?: { completed: number; total: number; percentage: number };
  allCompleted?: boolean;
};

// In-memory task store (in a real app, this would be persistent)
const taskStore = new Map<string, Task[]>();

// Get tasks for a session
function getTasks(sessionId: string): Task[] {
  return taskStore.get(sessionId) || [];
}

// Save tasks for a session (both in-memory and persistent memory)
function saveTasks(sessionId: string, tasks: Task[]): void {
  taskStore.set(sessionId, tasks);
}

// Save tasks to persistent memory
async function saveTasksToMemory(
  sessionId: string, 
  tasks: Task[], 
  session: Session, 
  chatTitle?: string,
  existingMemoryId?: string
): Promise<string | null> {
  if (!session?.user?.id) {
    console.error('[Task Memory] No user ID available');
    return null;
  }

  const apiKey = process.env.PAPR_MEMORY_API_KEY;
  if (!apiKey) {
    console.error('[Task Memory] No API key provided');
    return null;
  }

  try {
    const paprUserId = await ensurePaprUser(session.user.id, apiKey);
    if (!paprUserId) {
      console.error('[Task Memory] Failed to get Papr user ID');
      return null;
    }

    const memoryService = createMemoryService(apiKey);
    
    // Prepare task data for memory storage
    const taskData = {
      sessionId,
      chatTitle: chatTitle || 'Task Plan',
      tasks: tasks.map(task => ({
        id: task.id,
        title: task.title,
        description: task.description,
        status: task.status,
        dependencies: task.dependencies,
        createdAt: task.createdAt.toISOString(),
        completedAt: task.completedAt?.toISOString(),
        estimatedDuration: task.estimatedDuration,
        actualDuration: task.actualDuration,
      })),
      progress: getTaskProgress(tasks),
      updatedAt: new Date().toISOString(),
    };

    const content = `Task Plan: ${chatTitle || 'Task Plan'}

Tasks (${taskData.progress.completed}/${taskData.progress.total} completed):
${tasks.map(task => `• ${task.status === 'completed' ? '✅' : task.status === 'in_progress' ? '🔄' : '⭕'} ${task.title}${task.description ? ` - ${task.description}` : ''}`).join('\n')}

Progress: ${taskData.progress.percentage}% complete`;

    // Create metadata for the memory
    const metadata = {
      sourceType: 'PaprChat_TaskPlan',
      sourceUrl: `/chat/${sessionId}`,
      user_id: paprUserId,
      external_user_id: session.user.id,
      'emoji tags': ['📋', '✅', '📝'],
      topics: ['tasks', 'planning', 'productivity'],
      createdAt: new Date().toISOString(),
      customMetadata: {
        category: 'Task Planning',
        app_user_id: session.user.id,
        tool: 'taskTracker',
        content_type: 'task_plan',
        chat_id: sessionId,
        chat_title: chatTitle || 'Task Plan',
        task_count: tasks.length,
        completed_count: taskData.progress.completed,
        progress_percentage: taskData.progress.percentage,
        task_data: JSON.stringify(taskData),
      }
    };

    if (existingMemoryId) {
      // Update existing memory
      const success = await memoryService.updateMemory(existingMemoryId, {
        content,
        metadata
      });
      
      if (success) {
        console.log('[Task Memory] Updated task plan in memory:', existingMemoryId);
        return existingMemoryId;
      }
    } else {
      // Create new memory
      const success = await memoryService.storeContent(
        paprUserId,
        content,
        'document',
        metadata
      );

      if (success) {
        // Try to get the memory ID from the response (this depends on the memory service implementation)
        console.log('[Task Memory] Saved task plan to memory');
        return 'new_memory_created'; // We'd need the actual memory ID from the service
      }
    }

    return null;
  } catch (error) {
    console.error('[Task Memory] Failed to save tasks to memory:', error);
    return null;
  }
}

// Generate a unique task ID
function generateTaskId(): string {
  return `task_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
}

// Common task item schema
const taskItemSchema = z.object({
  title: z.string().describe('Task title'),
  description: z.string().optional().describe('Task description'),
  dependencies: z.array(z.string()).optional().describe('IDs of tasks that must be completed first. NA if there are no dependencies'),
  estimatedDuration: z.string().optional().describe('Estimated time to complete task'),
});

// Tool parameter schemas
const createTaskPlanSchema = z.object({
  sessionId: z.string().describe('Unique session identifier (use chat ID)'),
  tasks: z.array(taskItemSchema).describe('Tasks to create for the plan'),
});

const updateTaskSchema = z.object({
  sessionId: z.string().describe('Unique session identifier (use chat ID)'),
  taskId: z.string().describe('ID of the task to update'),
  status: z.enum(['pending', 'in_progress', 'completed', 'blocked', 'cancelled']).describe('New status for the task'),
});

const completeTaskSchema = z.object({
  sessionId: z.string().describe('Unique session identifier (use chat ID)'),
  taskId: z.string().describe('ID of the task to complete'),
});

const getTaskStatusSchema = z.object({
  sessionId: z.string().describe('Unique session identifier (use chat ID)'),
});

const addTaskSchema = z.object({
  sessionId: z.string().describe('Unique session identifier (use chat ID)'),
  tasks: z.array(taskItemSchema).describe('Tasks to add to the plan'),
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
export function createCreateTaskPlanTool(dataStream: DataStreamWriter, session: Session): Tool<TaskPlanInput, TaskPlanOutput> {
  return tool({
    description: 'Create a comprehensive task plan at the start of complex requests',
    inputSchema: createTaskPlanSchema,
    execute: async (input: TaskPlanInput, options: ToolCallOptions): Promise<TaskPlanOutput> => {
      const { sessionId, tasks } = input;
      // Validate required parameters
      if (!tasks || tasks.length === 0) {
        return { 
          success: false,
          error: 'No tasks provided for plan creation' 
        };
      }
      
      const newTasks: Task[] = tasks.map((task: any) => ({
        id: generateTaskId(),
        title: task.title,
        description: task.description || '',
        status: 'pending' as TaskStatus,
        dependencies: task.dependencies || [],
        createdAt: new Date(),
        estimatedDuration: task.estimatedDuration || '',
      }));
      
      saveTasks(sessionId, newTasks);
      
      // Save to persistent memory
      await saveTasksToMemory(sessionId, newTasks, session, 'Task Plan');
      
      const planNextTask = getNextAvailableTask(newTasks);
      const planProgress = getTaskProgress(newTasks);
      
      return {
        success: true,
        type: 'task-plan-created',
        tasks: newTasks,
        nextTask: planNextTask,
        progress: planProgress,
        allCompleted: planProgress.completed === planProgress.total,
        message: `Created task plan with ${newTasks.length} tasks`,
      };
    },
  });
}

// Update task tool
export function createUpdateTaskTool(dataStream: DataStreamWriter, session: Session): Tool<UpdateTaskInput, UpdateTaskOutput> {
  return tool({
    description: 'Update the status of a task in the plan',
    inputSchema: updateTaskSchema,
    execute: async (input: UpdateTaskInput, options: ToolCallOptions): Promise<UpdateTaskOutput> => {
      const { sessionId, taskId, status } = input;
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
      
      // Update persistent memory
      await saveTasksToMemory(sessionId, updatedTasks, session, 'Task Plan');
      
      const updateNextTask = getNextAvailableTask(updatedTasks);
      const updateProgress = getTaskProgress(updatedTasks);
      
      return {
        success: true,
        type: 'task-updated',
        tasks: updatedTasks,
        task: updatedTasks[taskIndex],
        nextTask: updateNextTask,
        progress: updateProgress,
        allCompleted: updateProgress.completed === updateProgress.total,
        message: `Task updated: ${updatedTasks[taskIndex].title}`,
      };
    },
  });
}

// Complete task tool
export function createCompleteTaskTool(dataStream: DataStreamWriter, session: Session): Tool<CompleteTaskInput, CompleteTaskOutput> {
  return tool({
    description: 'Mark a specific task as completed',
    inputSchema: completeTaskSchema,
    execute: async (input: CompleteTaskInput, options: ToolCallOptions): Promise<CompleteTaskOutput> => {
      const { sessionId, taskId } = input;
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
      
      // Update persistent memory
      await saveTasksToMemory(sessionId, completedTasks, session, 'Task Plan');
      
      const completedTask = completedTasks[completeTaskIndex];
      const completeNextTask = getNextAvailableTask(completedTasks);
      const completeProgress = getTaskProgress(completedTasks);
      
      return {
        success: true,
        type: 'task-completed',
        tasks: completedTasks,
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
export function createGetTaskStatusTool(dataStream: DataStreamWriter, session: Session): Tool<GetTaskStatusInput, GetTaskStatusOutput> {
  return tool({
    description: 'Check the progress and status of the current task plan',
    inputSchema: getTaskStatusSchema,
    execute: async (input: GetTaskStatusInput, options: ToolCallOptions): Promise<GetTaskStatusOutput> => {
      const { sessionId } = input;
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
export function createAddTaskTool(dataStream: DataStreamWriter, session: Session): Tool<AddTaskInput, AddTaskOutput> {
  return tool({
    description: 'Add new tasks to an existing plan',
    inputSchema: addTaskSchema,
    execute: async (input: AddTaskInput, options: ToolCallOptions): Promise<AddTaskOutput> => {
      const { sessionId, tasks } = input;
      const currentTasks = getTasks(sessionId);
      
      // Validate required parameters
      if (!tasks || tasks.length === 0) {
        return { 
          success: false,
          error: 'No tasks provided to add' 
        };
      }
      
      const additionalTasks: Task[] = tasks.map((task: any) => ({
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
      
      // Update persistent memory
      await saveTasksToMemory(sessionId, allTasks, session, 'Task Plan');
      
      const addProgress = getTaskProgress(allTasks);
      
      return {
        success: true,
        type: 'task-updated',
        message: `Added ${additionalTasks.length} new tasks`,
        tasks: allTasks,
        newTasks: additionalTasks,
        nextTask: getNextAvailableTask(allTasks),
        progress: addProgress,
        allCompleted: addProgress.completed === addProgress.total,
      };
    },
  });
}

// For backward compatibility, export a combined function
export function createTaskTrackerTools(dataStream: DataStreamWriter, session: Session) {
  return {
    createTaskPlan: createCreateTaskPlanTool(dataStream, session),
    updateTask: createUpdateTaskTool(dataStream, session),
    completeTask: createCompleteTaskTool(dataStream, session),
    getTaskStatus: createGetTaskStatusTool(dataStream, session),
    addTask: createAddTaskTool(dataStream, session),
  };
} 