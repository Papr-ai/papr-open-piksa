import { z } from 'zod';
import { tool, type Tool, type ToolCallOptions } from 'ai';
import type { DataStreamWriter } from '@/lib/types';
import { createMemoryService } from '@/lib/ai/memory/service';
import { ensurePaprUser } from '@/lib/ai/memory/middleware';
import type { Session } from 'next-auth';
import { unifiedTaskService, type UnifiedTask, type TaskProgress } from '@/lib/db/unified-task-service';
import { generateUUID } from '@/lib/utils';

// Task status types (extended to match unified system)
export type TaskStatus = 'pending' | 'in_progress' | 'completed' | 'blocked' | 'cancelled' | 'approved' | 'skipped';

// Task structure (compatible with UnifiedTask)
export interface Task {
  id: string;
  title: string;
  description?: string | null;
  status: TaskStatus;
  dependencies?: string[]; // IDs of tasks that must be completed first
  createdAt: Date | null;
  completedAt?: Date | null;
  estimatedDuration?: string | null;
  actualDuration?: string | null;
  taskType?: 'workflow' | 'general';
  sessionId?: string | null;
  stepNumber?: number;
  stepName?: string;
}

// Helper to convert UnifiedTask to Task interface
function unifiedTaskToTask(unifiedTask: UnifiedTask): Task {
  return {
    id: unifiedTask.id,
    title: unifiedTask.title,
    description: unifiedTask.description,
    status: unifiedTask.status as TaskStatus,
    dependencies: unifiedTask.dependencies,
    createdAt: unifiedTask.createdAt,
    completedAt: unifiedTask.completedAt,
    estimatedDuration: unifiedTask.estimatedDuration,
    actualDuration: unifiedTask.actualDuration,
    taskType: unifiedTask.taskType as 'workflow' | 'general',
    sessionId: unifiedTask.sessionId,
    stepNumber: unifiedTask.stepNumber || undefined,
    stepName: unifiedTask.stepName || undefined,
  };
}

// Tool input/output types
export type TaskPlanInput = z.infer<typeof createTaskPlanSchema>;

export type TaskPlanOutput = {
  success: boolean;
  error?: string;
  type?: 'task-plan-created';
  plan?: Task[];
  nextTask?: Task | null;
  progress?: { completed: number; total: number; percentage: number };
};

export type UpdateTaskInput = z.infer<typeof updateTaskSchema>;

export type UpdateTaskOutput = TaskPlanOutput & {
  task?: Task;
  tasks?: Task[];
};

export type CompleteTaskInput = z.infer<typeof completeTaskSchema>;

export type CompleteTaskOutput = TaskPlanOutput & {
  task?: Task;
  allCompleted?: boolean;
};

export type GetTaskStatusInput = z.infer<typeof getTaskStatusSchema>;

export type GetTaskStatusOutput = {
  success: boolean;
  error?: string;
  type?: 'task-status';
  tasks?: Task[];
  nextTask?: Task | null;
  progress?: { completed: number; total: number; percentage: number };
  allCompleted?: boolean;
  message?: string;
};

export type AddTaskInput = z.infer<typeof addTaskSchema>;

export type AddTaskOutput = {
  success: boolean;
  error?: string;
  type?: 'tasks-added';
  message?: string;
  tasks?: Task[];
  newTasks?: Task[];
  nextTask?: Task | null;
  progress?: { completed: number; total: number; percentage: number };
  allCompleted?: boolean;
};

// In-memory task store (in a real app, this would be persistent)
const taskStore = new Map<string, Task[]>();

// Track memory IDs for task plans to enable proper updates
const taskMemoryStore = new Map<string, string>(); // sessionId -> memoryId

// Load memory ID from existing task plan memory (for restoration after server restart)
async function loadMemoryIdFromDatabase(sessionId: string, userId: string): Promise<string | null> {
  if (taskMemoryStore.has(sessionId)) {
    return taskMemoryStore.get(sessionId) || null;
  }
  
  const apiKey = process.env.PAPR_MEMORY_API_KEY;
  if (!apiKey) {
    return null;
  }

  try {
    const paprUserId = await ensurePaprUser(userId, apiKey);
    if (!paprUserId) {
      return null;
    }

    const memoryService = createMemoryService(apiKey);
    const existingMemories = await memoryService.searchMemories(
      paprUserId,
      `task plan chat_id:${sessionId}`,
      5
    );
    
    const existingTaskMemory = existingMemories.find(mem => {
      const customMeta = mem.metadata?.customMetadata as any;
      return (customMeta?.chat_id === sessionId && customMeta?.content_type === 'task_plan') ||
             (mem.metadata?.sourceType === 'PaprChat_TaskPlan' && customMeta?.chat_id === sessionId);
    });
    
    if (existingTaskMemory) {
      taskMemoryStore.set(sessionId, existingTaskMemory.id);
      return existingTaskMemory.id;
    }
  } catch (error) {
    console.error(`[Task Tracker] Failed to load memory ID for session ${sessionId}:`, error);
  }
  
  return null;
}

// Get tasks for a session (unified database + in-memory cache)
async function getTasks(sessionId: string, userId: string): Promise<Task[]> {
  console.log(`[Task Tracker] Getting tasks for session ${sessionId}`);
  
  // Always try database first to ensure we have the latest state
  try {
    const unifiedTasks = await unifiedTaskService.getGeneralTasks(sessionId, userId);
    const tasks = unifiedTasks.map(unifiedTaskToTask);
    
    if (tasks.length > 0) {
      // Update cache with latest database state
      taskStore.set(sessionId, tasks);
      console.log(`[Task Tracker] Found ${tasks.length} tasks from database for session ${sessionId}`);
      return tasks;
    }
  } catch (error) {
    console.error(`[Task Tracker] Database query failed for session ${sessionId}:`, error);
  }
  
  // Fallback to cache if database fails or returns no results
  const cachedTasks = taskStore.get(sessionId) || [];
  if (cachedTasks.length > 0) {
    console.log(`[Task Tracker] Using ${cachedTasks.length} cached tasks for session ${sessionId} (database fallback)`);
    return cachedTasks;
  }
  
  console.log(`[Task Tracker] No tasks found for session ${sessionId} (neither database nor cache)`);
  return [];
}

// Synchronous version for backward compatibility (uses cache only)
function getTasksSync(sessionId: string): Task[] {
  const tasks = taskStore.get(sessionId) || [];
  
  if (tasks.length === 0) {
    console.log(`[Task Tracker] Warning: No cached tasks found for session ${sessionId}`);
    console.log(`[Task Tracker] Available sessions:`, Array.from(taskStore.keys()));
    console.log(`[Task Tracker] Consider using the async getTasks() method for database fallback`);
  }
  
  return tasks;
}

// Detect if a session is related to a picture book by analyzing task content and memory
async function detectPictureBookContext(sessionId: string, tasks: Task[], userId: string): Promise<boolean> {
  try {
    // Check task titles and descriptions for picture book indicators
    const pictureBookKeywords = [
      'picture book', 'illustration', 'illustrated', 'scene', 'character portrait', 
      'environment', 'visual', 'image', 'drawing', 'art', 'spread', 'page layout',
      'character creation', 'environment creation', 'scene creation', 'scene manifest',
      'render scene', 'visual continuity'
    ];
    
    const hasPictureBookTasks = tasks.some(task => {
      const text = `${task.title} ${task.description || ''}`.toLowerCase();
      return pictureBookKeywords.some(keyword => text.includes(keyword));
    });
    
    if (hasPictureBookTasks) {
      console.log(`[Task Tracker] Detected picture book context from task content for session ${sessionId}`);
      return true;
    }
    
    // Check memory for picture book context
    const apiKey = process.env.PAPR_MEMORY_API_KEY;
    if (apiKey) {
      const paprUserId = await ensurePaprUser(userId, apiKey);
      if (paprUserId) {
        const memoryService = createMemoryService(apiKey);
        
        // Search for book-related memories in this session
        const bookMemories = await memoryService.searchMemories(
          paprUserId,
          `picture book illustration visual scene character environment ${sessionId}`,
          5
        );
        
        const hasPictureBookMemory = bookMemories.some(mem => {
          const customMeta = mem.metadata?.customMetadata as any;
          return customMeta?.is_picture_book === true || 
                 customMeta?.isPictureBook === true ||
                 mem.content?.toLowerCase().includes('picture book') ||
                 mem.content?.toLowerCase().includes('illustration');
        });
        
        if (hasPictureBookMemory) {
          console.log(`[Task Tracker] Detected picture book context from memory for session ${sessionId}`);
          return true;
        }
      }
    }
    
    return false;
  } catch (error) {
    console.error(`[Task Tracker] Error detecting picture book context for session ${sessionId}:`, error);
    return false;
  }
}

// Save tasks for a session (both in-memory and database)
async function saveTasks(sessionId: string, tasks: Task[], userId: string): Promise<void> {
  console.log(`[Task Tracker] Saving ${tasks.length} tasks for session ${sessionId}`);
  
  // Save to in-memory cache for performance
  taskStore.set(sessionId, tasks);
  
  // Save to database immediately with default isPictureBook=false for fast response
  try {
    const taskInputs = tasks.map(task => ({
      id: task.id, // Include ID for proper updates
      title: task.title,
      description: task.description || undefined,
      dependencies: task.dependencies || [],
      estimatedDuration: task.estimatedDuration || undefined,
      status: task.status,
      completedAt: task.completedAt,
      isPictureBook: false, // Default to false for immediate save
      stepNumber: task.stepNumber,
      stepName: task.stepName,
    }));
    
    await unifiedTaskService.upsertGeneralTasks(sessionId, userId, taskInputs);
    console.log(`[Task Tracker] Successfully persisted ${tasks.length} tasks to database`);
    
    // Detect picture book context and update asynchronously (don't block response)
    updatePictureBookFlagAsync(sessionId, tasks, userId);
    
  } catch (error) {
    console.error(`[Task Tracker] Failed to persist tasks to database:`, error);
  }
}

/**
 * Asynchronously detect and update picture book flag without blocking response
 */
async function updatePictureBookFlagAsync(sessionId: string, tasks: Task[], userId: string): Promise<void> {
  try {
    const isPictureBook = await detectPictureBookContext(sessionId, tasks, userId);
    
    if (isPictureBook) {
      // Update the tasks with the correct isPictureBook flag
      const taskInputs = tasks.map(task => ({
        id: task.id,
        title: task.title,
        description: task.description || undefined,
        dependencies: task.dependencies || [],
        estimatedDuration: task.estimatedDuration || undefined,
        status: task.status,
        completedAt: task.completedAt,
        isPictureBook: true, // Update with correct flag
      }));
      
      await unifiedTaskService.upsertGeneralTasks(sessionId, userId, taskInputs);
      console.log(`[Task Tracker] Updated ${tasks.length} tasks with isPictureBook=true`);
    }
  } catch (error) {
    console.error(`[Task Tracker] Failed to update picture book flag:`, error);
    // Don't throw - this is async and shouldn't affect the main response
  }
}

// Synchronous version for backward compatibility (cache only)
function saveTasksSync(sessionId: string, tasks: Task[]): void {
  console.log(`[Task Tracker] Saving ${tasks.length} tasks to cache for session ${sessionId}`);
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
        createdAt: task.createdAt?.toISOString() || new Date().toISOString(),
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

    // Search for existing task plan memory for this session first
    let existingTaskMemory = null;
    if (!existingMemoryId) {
      try {
        // Search more specifically for task plan memories
        const existingMemories = await memoryService.searchMemories(
          paprUserId,
          `task plan chat_id:${sessionId}`,
          10
        );
        
        // Look for task plan memory for this specific session with better matching
        existingTaskMemory = existingMemories.find(mem => {
          const customMeta = mem.metadata?.customMetadata as any;
          // More robust matching - check both chat_id and content_type
          return (customMeta?.chat_id === sessionId && customMeta?.content_type === 'task_plan') ||
                 (mem.metadata?.sourceType === 'PaprChat_TaskPlan' && customMeta?.chat_id === sessionId);
        });
        
        if (existingTaskMemory) {
          console.log(`[Task Memory] Found existing task plan memory for session: ${sessionId}, memory ID: ${existingTaskMemory.id}`);
        } else {
          console.log(`[Task Memory] No existing task plan memory found for session: ${sessionId}`);
        }
      } catch (error) {
        console.error('[Task Memory] Error searching for existing memories:', error);
      }
    }

    const targetMemoryId = existingMemoryId || existingTaskMemory?.id;

    if (targetMemoryId) {
      // Update existing memory
      console.log(`[Task Memory] Attempting to update existing memory: ${targetMemoryId}`);
      const success = await memoryService.updateMemory(targetMemoryId, {
        content,
        metadata: {
          // Include all metadata fields for proper update
          sourceType: metadata.sourceType,
          sourceUrl: metadata.sourceUrl,
          user_id: metadata.user_id,
          external_user_id: metadata.external_user_id,
          'emoji tags': metadata['emoji tags'],
          topics: metadata.topics,
          createdAt: metadata.createdAt,
          customMetadata: {
            ...metadata.customMetadata,
            updatedAt: new Date().toISOString(), // Track when it was last updated
          }
        }
      });
      
      if (success) {
        console.log(`[Task Memory] ✅ Updated existing task plan memory: ${targetMemoryId}`);
        return targetMemoryId;
      } else {
        console.error(`[Task Memory] ❌ Failed to update memory: ${targetMemoryId}, falling back to creating new memory`);
        // Fall through to create new memory if update fails
      }
    }
    
    // Create new memory (either no existing memory found or update failed)
    console.log(`[Task Memory] Creating new task plan memory for session: ${sessionId}`);
    
    try {
      // Use storeContent to save memory
      const success = await memoryService.storeContent(
        paprUserId,
        content,
        'text',
        metadata.customMetadata || {},
        session.user.id
      );

      if (success) {
        console.log(`[Task Memory] ✅ Created new task plan memory for session: ${sessionId}`);
        // Return a placeholder since storeContent doesn't return the actual memory ID
        return 'memory_created_successfully';
      } else {
        console.error('[Task Memory] ❌ Failed to save task plan to memory');
        return null;
      }
    } catch (error) {
      console.error('[Task Memory] ❌ Error creating new task plan memory:', error);
      return null;
    }
  } catch (error) {
    console.error('[Task Memory] Failed to save tasks to memory:', error);
    return null;
  }
}

/**
 * Asynchronously save tasks to memory without blocking the main response
 */
async function saveTasksToMemoryAsync(
  sessionId: string,
  tasks: Task[],
  session: Session,
  chatTitle?: string
): Promise<void> {
  try {
    // Load existing memory ID if available
    const userId = session.user?.id;
    if (!userId) {
      console.error('[Task Memory Async] No user ID available');
      return;
    }
    
    const existingMemoryId = taskMemoryStore.get(sessionId) || 
                            await loadMemoryIdFromDatabase(sessionId, userId);
    
    const memoryId = await saveTasksToMemory(sessionId, tasks, session, chatTitle, existingMemoryId || undefined);
    
    if (memoryId && memoryId !== existingMemoryId) {
      taskMemoryStore.set(sessionId, memoryId);
    }
  } catch (error) {
    console.error('[Task Memory Async] Failed to save tasks to memory:', error);
    // Don't throw - this is async and shouldn't affect the main response
  }
}

// Generate a unique task ID using proper UUID format
function generateTaskId(): string {
  return generateUUID();
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
  tasks: z.array(taskItemSchema).describe('Tasks to create for the plan'),
});

const updateTaskSchema = z.object({
  taskId: z.string().describe('ID of the task to update'),
  status: z.enum(['pending', 'in_progress', 'completed', 'blocked', 'cancelled', 'approved', 'skipped']).describe('New status for the task'),
});

const completeTaskSchema = z.object({
  taskId: z.string().describe('ID of the task to complete'),
});

const getTaskStatusSchema = z.object({
  // No parameters needed - will use current chat ID automatically
});

const addTaskSchema = z.object({
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

// Helper function to determine if all tasks are truly completed
function areAllTasksCompleted(tasks: Task[]): boolean {
  // If there are no tasks, they're not "completed" - they're just empty
  if (tasks.length === 0) {
    console.log(`[Task Tracker] areAllTasksCompleted: No tasks found, returning false`);
    return false;
  }
  
  const completed = tasks.filter(t => t.status === 'completed').length;
  const allComplete = tasks.every(task => task.status === 'completed');
  
  console.log(`[Task Tracker] areAllTasksCompleted: ${completed}/${tasks.length} completed, returning ${allComplete}`);
  
  // Only return true if there are tasks AND all of them are completed
  return allComplete;
}

// Create task plan tool
export function createCreateTaskPlanTool(dataStream: DataStreamWriter, session: Session, chatId?: string) {
  return tool({
    description: 'Create a comprehensive task plan at the start of complex requests',
    inputSchema: createTaskPlanSchema,
    execute: async (input) => {
      const { tasks } = input;
      // Always use the provided chatId
      if (!chatId) {
        return {
          success: false,
          error: 'No chat ID available for task tracking',
        };
      }
      const effectiveSessionId = chatId;
      
      if (!session?.user?.id) {
        return {
          success: false,
          error: 'User authentication required',
        };
      }
      
      // Validate required parameters
      if (!tasks || tasks.length === 0) {
        return { 
          success: false,
          error: 'No tasks provided for plan creation' 
        };
      }
      
      // Check if tasks already exist (with database fallback)
      const existingTasks = await getTasks(effectiveSessionId, session.user.id);
      if (existingTasks.length > 0) {
        console.log(`[createTaskPlan] Tasks already exist for session ${effectiveSessionId}, returning existing plan`);
        const planProgress = getTaskProgress(existingTasks);
        const planNextTask = getNextAvailableTask(existingTasks);
        
        return {
          success: true,
          type: 'task-plan-exists',
          tasks: existingTasks,
          nextTask: planNextTask,
          progress: planProgress,
          allCompleted: areAllTasksCompleted(existingTasks),
          message: `Found existing task plan with ${existingTasks.length} tasks`,
        };
      }
      
      const newTasks: Task[] = tasks.map((task: any, index: number) => ({
        id: generateTaskId(),
        title: task.title,
        description: task.description || '',
        status: 'pending' as TaskStatus,
        dependencies: task.dependencies || [],
        createdAt: new Date(),
        estimatedDuration: task.estimatedDuration || '',
        taskType: 'general',
        sessionId: effectiveSessionId,
        stepNumber: index + 1,
        stepName: getStepNameFromTitle(task.title, index + 1),
      }));
      
      // Save to both cache and database
      await saveTasks(effectiveSessionId, newTasks, session.user.id);
      
      // Save to persistent memory asynchronously (don't block user response)
      saveTasksToMemoryAsync(effectiveSessionId, newTasks, session, 'Task Plan');
      
      const planNextTask = getNextAvailableTask(newTasks);
      const planProgress = getTaskProgress(newTasks);
      
      return {
        success: true,
        type: 'task-plan-created',
        plan: newTasks,
        tasks: newTasks, // Include tasks for UI display
        nextTask: planNextTask,
        progress: planProgress,
        allCompleted: areAllTasksCompleted(newTasks),
        message: `Created task plan with ${newTasks.length} tasks`,
      };
    },
  });
}

// Update task tool
export function createUpdateTaskTool(dataStream: DataStreamWriter, session: Session, chatId?: string) {
  return tool({
    description: 'Update the status of a task in the plan',
    inputSchema: updateTaskSchema,
    execute: async (input) => {
      const { taskId, status } = input;
      // Always use the provided chatId
      if (!chatId) {
        return {
          success: false,
          error: 'No chat ID available for task tracking',
        };
      }
      const effectiveSessionId = chatId;
      
      if (!session?.user?.id) {
        return {
          success: false,
          error: 'User authentication required',
        };
      }
      
      const currentTasks = await getTasks(effectiveSessionId, session.user.id);
      
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
      
      await saveTasks(effectiveSessionId, updatedTasks, session.user.id);
      
      // Update persistent memory asynchronously
      saveTasksToMemoryAsync(effectiveSessionId, updatedTasks, session, 'Task Plan');
      
      const updateNextTask = getNextAvailableTask(updatedTasks);
      const updateProgress = getTaskProgress(updatedTasks);
      
      return {
        success: true,
        type: 'task-updated',
        tasks: updatedTasks, // Include full task list for UI display
        task: updatedTasks[taskIndex],
        nextTask: updateNextTask,
        progress: updateProgress,
        allCompleted: areAllTasksCompleted(updatedTasks),
        message: `Task updated: ${updatedTasks[taskIndex].title}`,
      };
    },
  });
}

// Complete task tool
export function createCompleteTaskTool(dataStream: DataStreamWriter, session: Session, chatId?: string) {
  return tool({
    description: 'Mark a specific task as completed',
    inputSchema: completeTaskSchema,
    execute: async (input) => {
      const { taskId } = input;
      // Always use the provided chatId
      if (!chatId) {
        return {
          success: false,
          error: 'No chat ID available for task tracking',
        };
      }
      const effectiveSessionId = chatId;
      
      if (!session?.user?.id) {
        return {
          success: false,
          error: 'User authentication required',
        };
      }
      
      const currentTasks = await getTasks(effectiveSessionId, session.user.id);
      
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
      
      await saveTasks(effectiveSessionId, completedTasks, session.user.id);
      
      // Update persistent memory asynchronously
      saveTasksToMemoryAsync(effectiveSessionId, completedTasks, session, 'Task Plan');
      
      const completedTask = completedTasks[completeTaskIndex];
      const completeNextTask = getNextAvailableTask(completedTasks);
      const completeProgress = getTaskProgress(completedTasks);
      
      return {
        success: true,
        type: 'task-completed',
        tasks: completedTasks, // Include full task list for UI display
        task: completedTask,
        nextTask: completeNextTask,
        progress: completeProgress,
        allCompleted: areAllTasksCompleted(completedTasks),
        message: `Completed task: ${completedTask.title}`,
      };
    },
  });
}

// Get task status tool
export function createGetTaskStatusTool(dataStream: DataStreamWriter, session: Session, chatId?: string) {
  return tool({
    description: 'Check the progress and status of the current task plan',
    inputSchema: getTaskStatusSchema,
    execute: async (input) => {
      // Always use the provided chatId - no input parameters needed
      if (!chatId) {
        return {
          success: false,
          error: 'No chat ID available for task tracking',
        };
      }
      const effectiveSessionId = chatId;
      
      if (!session?.user?.id) {
        return {
          success: false,
          error: 'User authentication required',
        };
      }
      
      console.log(`[getTaskStatus] Called with effectiveSessionId: ${effectiveSessionId}`);
      const currentTasks = await getTasks(effectiveSessionId, session.user.id);
      console.log(`[getTaskStatus] Found ${currentTasks.length} tasks for session ${effectiveSessionId}`);
      
      const statusProgress = getTaskProgress(currentTasks);
      const statusNextTask = getNextAvailableTask(currentTasks);
      
      const result = {
        success: true,
        type: 'task-status',
        tasks: currentTasks,
        nextTask: statusNextTask,
        progress: statusProgress,
        allCompleted: areAllTasksCompleted(currentTasks),
        message: `Task Status: ${statusProgress.completed}/${statusProgress.total} completed (${statusProgress.percentage}%)`,
      };
      
      console.log('[getTaskStatus] Returning result:', JSON.stringify(result, null, 2));
      return result;
    },
  });
}

// Add tasks tool
export function createAddTaskTool(dataStream: DataStreamWriter, session: Session, chatId?: string) {
  return tool({
    description: 'Add new tasks to an existing plan',
    inputSchema: addTaskSchema,
    execute: async (input) => {
      const { tasks } = input;
      // Always use the provided chatId
      if (!chatId) {
        return {
          success: false,
          error: 'No chat ID available for task tracking',
        };
      }
      const effectiveSessionId = chatId;
      
      if (!session?.user?.id) {
        return {
          success: false,
          error: 'User authentication required',
        };
      }
      
      const currentTasks = await getTasks(effectiveSessionId, session.user.id);
      
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
      await saveTasks(effectiveSessionId, allTasks, session.user.id);
      
      // Update persistent memory asynchronously
      saveTasksToMemoryAsync(effectiveSessionId, allTasks, session, 'Task Plan');
      
      const addProgress = getTaskProgress(allTasks);
      
      return {
        success: true,
        type: 'task-updated',
        message: `Added ${additionalTasks.length} new tasks`,
        tasks: allTasks,
        newTasks: additionalTasks,
        nextTask: getNextAvailableTask(allTasks),
        progress: addProgress,
        allCompleted: areAllTasksCompleted(allTasks),
      };
    },
  });
}

// For backward compatibility, export a combined function
export function createTaskTrackerTools(dataStream: DataStreamWriter, session: Session, chatId?: string) {
  return {
    createTaskPlan: createCreateTaskPlanTool(dataStream, session, chatId),
    updateTask: createUpdateTaskTool(dataStream, session, chatId),
    completeTask: createCompleteTaskTool(dataStream, session, chatId),
    getTaskStatus: createGetTaskStatusTool(dataStream, session, chatId),
    addTask: createAddTaskTool(dataStream, session, chatId),
  };
}

/**
 * Derive step name from task title
 */
function getStepNameFromTitle(title: string, stepNumber: number): string {
  const lowerTitle = title.toLowerCase();
  
  if (lowerTitle.includes('plan') || lowerTitle.includes('outline')) {
    return 'Story Planning';
  } else if (lowerTitle.includes('chapter') || lowerTitle.includes('draft')) {
    return 'Chapter Drafting';
  } else if (lowerTitle.includes('scene') && lowerTitle.includes('segment')) {
    return 'Scene Segmentation';
  } else if (lowerTitle.includes('character')) {
    return 'Character Creation';
  } else if (lowerTitle.includes('environment') || lowerTitle.includes('setting')) {
    return 'Environment Creation';
  } else if (lowerTitle.includes('scene') && lowerTitle.includes('image')) {
    return 'Scene Creation';
  } else if (lowerTitle.includes('complete') || lowerTitle.includes('final')) {
    return 'Book Completion';
  }
  
  // Default step names based on step number
  const defaultSteps = [
    'Story Planning',
    'Chapter Drafting', 
    'Scene Segmentation',
    'Character Creation',
    'Environment Creation',
    'Scene Creation',
    'Book Completion'
  ];
  
  return defaultSteps[stepNumber - 1] || `Step ${stepNumber}`;
} 