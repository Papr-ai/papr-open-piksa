import { desc, eq, and, sql, isNull, isNotNull, or } from 'drizzle-orm';
import { db } from './db';
import { task } from './schema';
import type { Task as TaskModel } from './schema';

// Unified task types
export type UnifiedTaskStatus = 'pending' | 'in_progress' | 'completed' | 'blocked' | 'cancelled' | 'approved' | 'skipped';
export type TaskType = 'workflow' | 'general';

// Unified task interface (extends the database type)
export interface UnifiedTask extends Omit<TaskModel, 'dependencies'> {
  dependencies: string[]; // Parsed from JSONB
}

// Input types for creating tasks
export interface CreateWorkflowTaskInput {
  bookId: string;
  bookTitle: string;
  stepNumber: number;
  stepName: string;
  userId: string;
  isPictureBook?: boolean;
  toolUsed?: string;
  metadata?: Record<string, any>;
}

export interface CreateGeneralTaskInput {
  title: string;
  description?: string;
  sessionId: string;
  userId: string;
  dependencies?: string[];
  estimatedDuration?: string;
  parentTaskId?: string;
  toolUsed?: string;
  metadata?: Record<string, any>;
}

// Task progress summary
export interface TaskProgress {
  total: number;
  completed: number;
  inProgress: number;
  pending: number;
  percentage: number;
}

/**
 * Unified Task Service
 * Handles both workflow tasks (book creation) and general tasks (AI-generated)
 */
export class UnifiedTaskService {
  
  // === WORKFLOW TASK METHODS ===
  
  /**
   * Initialize workflow tasks for a new book
   */
  async initializeWorkflowTasks(
    bookId: string,
    bookTitle: string,
    userId: string,
    isPictureBook: boolean = false
  ): Promise<UnifiedTask[]> {
    const workflowSteps = [
      { stepNumber: 1, stepName: 'Story Planning', toolUsed: 'createBookPlan' },
      { stepNumber: 2, stepName: 'Chapter Drafting', toolUsed: 'draftChapter' },
      { stepNumber: 3, stepName: 'Scene Segmentation', toolUsed: 'segmentChapterIntoScenes' },
      { stepNumber: 4, stepName: 'Character Creation', toolUsed: 'createCharacterPortraits' },
      { stepNumber: 5, stepName: 'Environment Creation', toolUsed: 'createEnvironments' },
      { stepNumber: 6, stepName: 'Scene Creation', toolUsed: 'createSceneManifest' },
      { stepNumber: 7, stepName: 'Book Completion', toolUsed: 'completeBook' },
    ];

    // For non-picture books, only include steps 1, 2, and 7
    const applicableSteps = isPictureBook 
      ? workflowSteps 
      : workflowSteps.filter(step => [1, 2, 7].includes(step.stepNumber));

    const tasks = await Promise.all(
      applicableSteps.map(async (step) => {
        try {
          const [newTask] = await db
            .insert(task)
            .values({
              title: step.stepName,
              taskType: 'workflow',
              bookId,
              bookTitle,
              stepNumber: step.stepNumber,
              stepName: step.stepName,
              toolUsed: step.toolUsed,
              isPictureBook,
              userId,
              status: 'pending',
              dependencies: JSON.stringify([]),
            })
            .onConflictDoNothing()
            .returning();
          
          return this.parseTaskDependencies(newTask);
        } catch (error) {
          console.error(`Failed to create workflow task ${step.stepName}:`, error);
          return null;
        }
      })
    );

    return tasks.filter(Boolean) as UnifiedTask[];
  }

  /**
   * Get workflow tasks for a specific book
   */
  async getWorkflowTasks(bookId: string, userId: string): Promise<UnifiedTask[]> {
    const tasks = await db
      .select()
      .from(task)
      .where(
        and(
          eq(task.bookId, bookId),
          eq(task.userId, userId),
          eq(task.taskType, 'workflow')
        )
      )
      .orderBy(task.stepNumber);

    return tasks.map(task => this.parseTaskDependencies(task));
  }

  // === GENERAL TASK METHODS ===

  /**
   * Create general tasks for a session
   */
  async createGeneralTasks(
    sessionId: string,
    userId: string,
    tasks: Omit<CreateGeneralTaskInput, 'sessionId' | 'userId'>[]
  ): Promise<UnifiedTask[]> {
    console.log(`[UnifiedTaskService] Creating ${tasks.length} general tasks for session ${sessionId}`);
    
    const createdTasks = await Promise.all(
      tasks.map(async (taskInput) => {
        try {
          const [newTask] = await db
            .insert(task)
            .values({
              title: taskInput.title,
              description: taskInput.description,
              taskType: 'general',
              sessionId,
              userId,
              status: 'pending',
              dependencies: JSON.stringify(taskInput.dependencies || []),
              estimatedDuration: taskInput.estimatedDuration,
              parentTaskId: taskInput.parentTaskId,
              toolUsed: taskInput.toolUsed,
              metadata: taskInput.metadata || {},
            })
            .onConflictDoUpdate({
              target: [task.sessionId, task.title],
              set: {
                description: taskInput.description,
                status: 'pending',
                dependencies: JSON.stringify(taskInput.dependencies || []),
                estimatedDuration: taskInput.estimatedDuration,
                updatedAt: new Date(),
              },
            })
            .returning();
          
          return this.parseTaskDependencies(newTask);
        } catch (error) {
          console.error(`Failed to create general task ${taskInput.title}:`, error);
          return null;
        }
      })
    );

    const validTasks = createdTasks.filter(Boolean) as UnifiedTask[];
    console.log(`[UnifiedTaskService] Successfully created ${validTasks.length} general tasks`);
    return validTasks;
  }

  /**
   * Get general tasks for a session
   */
  async getGeneralTasks(sessionId: string, userId: string): Promise<UnifiedTask[]> {
    console.log(`[UnifiedTaskService] Getting general tasks for session ${sessionId}`);
    
    const tasks = await db
      .select()
      .from(task)
      .where(
        and(
          eq(task.sessionId, sessionId),
          eq(task.userId, userId),
          eq(task.taskType, 'general')
        )
      )
      .orderBy(task.createdAt);

    const parsedTasks = tasks.map(task => this.parseTaskDependencies(task));
    console.log(`[UnifiedTaskService] Found ${parsedTasks.length} general tasks for session ${sessionId}`);
    return parsedTasks;
  }

  /**
   * Update or create general tasks for a session (upsert operation)
   */
  async upsertGeneralTasks(
    sessionId: string,
    userId: string,
    tasks: Array<Omit<CreateGeneralTaskInput, 'sessionId' | 'userId'> & { id?: string; status?: UnifiedTaskStatus; completedAt?: Date | null; isPictureBook?: boolean }>
  ): Promise<UnifiedTask[]> {
    console.log(`[UnifiedTaskService] Upserting ${tasks.length} general tasks for session ${sessionId}`);
    
    const upsertedTasks = await Promise.all(
      tasks.map(async (taskInput) => {
        try {
          // If task has an ID, try to update existing task first
          if (taskInput.id) {
            const existingTask = await this.getTaskById(taskInput.id, userId);
            if (existingTask) {
              // Update existing task
              const [updatedTask] = await db
                .update(task)
                .set({
                  title: taskInput.title,
                  description: taskInput.description,
                  status: taskInput.status || 'pending',
                  dependencies: JSON.stringify(taskInput.dependencies || []),
                  estimatedDuration: taskInput.estimatedDuration,
                  completedAt: taskInput.completedAt,
                  isPictureBook: taskInput.isPictureBook || false,
                  updatedAt: new Date(),
                })
                .where(eq(task.id, taskInput.id))
                .returning();
              
              return this.parseTaskDependencies(updatedTask);
            }
          }
          
          // Create new task (either no ID provided or existing task not found)
          const [newTask] = await db
            .insert(task)
            .values({
              title: taskInput.title,
              description: taskInput.description,
              taskType: 'general',
              sessionId,
              userId,
              status: taskInput.status || 'pending',
              dependencies: JSON.stringify(taskInput.dependencies || []),
              estimatedDuration: taskInput.estimatedDuration,
              parentTaskId: taskInput.parentTaskId,
              toolUsed: taskInput.toolUsed,
              metadata: taskInput.metadata || {},
              completedAt: taskInput.completedAt,
              isPictureBook: taskInput.isPictureBook || false,
            })
            .onConflictDoUpdate({
              target: [task.sessionId, task.title],
              set: {
                description: taskInput.description,
                status: taskInput.status || 'pending',
                dependencies: JSON.stringify(taskInput.dependencies || []),
                estimatedDuration: taskInput.estimatedDuration,
                completedAt: taskInput.completedAt,
                isPictureBook: taskInput.isPictureBook || false,
                updatedAt: new Date(),
              },
            })
            .returning();
          
          return this.parseTaskDependencies(newTask);
        } catch (error) {
          console.error(`Failed to upsert general task ${taskInput.title}:`, error);
          return null;
        }
      })
    );

    const validTasks = upsertedTasks.filter(Boolean) as UnifiedTask[];
    console.log(`[UnifiedTaskService] Successfully upserted ${validTasks.length} general tasks`);
    return validTasks;
  }

  // === UNIFIED TASK METHODS ===

  /**
   * Update task status
   */
  async updateTaskStatus(
    taskId: string,
    status: UnifiedTaskStatus,
    userId: string,
    metadata?: Record<string, any>,
    notes?: string
  ): Promise<UnifiedTask | null> {
    const updates: any = {
      status,
      updatedAt: new Date(),
    };

    if (status === 'completed') {
      updates.completedAt = new Date();
    }

    if (status === 'approved') {
      updates.approvedAt = new Date();
    }

    if (metadata) {
      updates.metadata = metadata;
    }

    if (notes) {
      updates.notes = notes;
    }

    const [updatedTask] = await db
      .update(task)
      .set(updates)
      .where(and(eq(task.id, taskId), eq(task.userId, userId)))
      .returning();

    return updatedTask ? this.parseTaskDependencies(updatedTask) : null;
  }

  /**
   * Get task by ID
   */
  async getTaskById(taskId: string, userId: string): Promise<UnifiedTask | null> {
    const [foundTask] = await db
      .select()
      .from(task)
      .where(and(eq(task.id, taskId), eq(task.userId, userId)))
      .limit(1);

    return foundTask ? this.parseTaskDependencies(foundTask) : null;
  }

  /**
   * Get all tasks for a user (optionally filtered by type)
   */
  async getAllTasks(
    userId: string,
    taskType?: TaskType,
    sessionId?: string
  ): Promise<UnifiedTask[]> {
    const conditions = [eq(task.userId, userId)];
    
    if (taskType) {
      conditions.push(eq(task.taskType, taskType));
    }
    
    if (sessionId) {
      conditions.push(eq(task.sessionId, sessionId));
    }

    const tasks = await db
      .select()
      .from(task)
      .where(and(...conditions))
      .orderBy(task.createdAt);

    return tasks.map(task => this.parseTaskDependencies(task));
  }

  /**
   * Calculate task progress
   */
  getTaskProgress(tasks: UnifiedTask[]): TaskProgress {
    const total = tasks.length;
    const completed = tasks.filter(t => t.status === 'completed' || t.status === 'approved').length;
    const inProgress = tasks.filter(t => t.status === 'in_progress').length;
    const pending = tasks.filter(t => t.status === 'pending').length;
    const percentage = total > 0 ? Math.round((completed / total) * 100) : 0;

    return {
      total,
      completed,
      inProgress,
      pending,
      percentage,
    };
  }

  /**
   * Get next available task (one with no incomplete dependencies)
   */
  getNextAvailableTask(tasks: UnifiedTask[]): UnifiedTask | null {
    return tasks.find(task => {
      if (task.status !== 'pending') return false;
      
      // Check if all dependencies are completed
      if (task.dependencies && task.dependencies.length > 0) {
        const allDepsCompleted = task.dependencies.every(depId => {
          const depTask = tasks.find(t => t.id === depId);
          return depTask && (depTask.status === 'completed' || depTask.status === 'approved');
        });
        return allDepsCompleted;
      }
      
      return true;
    }) || null;
  }

  /**
   * Delete tasks for a session (cleanup)
   */
  async deleteSessionTasks(sessionId: string, userId: string): Promise<number> {
    const result = await db
      .delete(task)
      .where(
        and(
          eq(task.sessionId, sessionId),
          eq(task.userId, userId),
          eq(task.taskType, 'general')
        )
      );

    return result.length || 0;
  }

  // === CLEANUP METHODS ===

  /**
   * Clean up tasks with malformed dependencies
   * Converts non-JSON dependencies to empty arrays
   */
  async cleanupMalformedDependencies(): Promise<number> {
    try {
      // Find tasks with non-JSON dependencies by checking if they can be parsed as JSON
      const allTasks = await db
        .select()
        .from(task)
        .where(isNotNull(task.dependencies));

      const tasksWithBadDeps = allTasks.filter(t => {
        if (!t.dependencies) return false;
        try {
          JSON.parse(t.dependencies as string);
          return false; // Valid JSON
        } catch {
          return true; // Invalid JSON
        }
      });

      console.log(`[UnifiedTaskService] Found ${tasksWithBadDeps.length} tasks with malformed dependencies`);

      if (tasksWithBadDeps.length === 0) {
        return 0;
      }

      // Update each malformed dependency individually
      let cleanedCount = 0;
      for (const badTask of tasksWithBadDeps) {
        try {
          await db
            .update(task)
            .set({ dependencies: '[]' })
            .where(eq(task.id, badTask.id));
          cleanedCount++;
        } catch (error) {
          console.error(`[UnifiedTaskService] Error updating task ${badTask.id}:`, error);
        }
      }

      console.log(`[UnifiedTaskService] Cleaned up ${cleanedCount} tasks with malformed dependencies`);
      return cleanedCount;
    } catch (error) {
      console.error('[UnifiedTaskService] Error cleaning up malformed dependencies:', error);
      return 0;
    }
  }

  // === HELPER METHODS ===

  /**
   * Parse JSONB dependencies field to string array
   * Handles both JSON arrays and legacy text data
   */
  private parseTaskDependencies(task: TaskModel): UnifiedTask {
    let dependencies: string[] = [];
    
    try {
      if (task.dependencies) {
        // Check if it's already an array
        if (Array.isArray(task.dependencies)) {
          dependencies = task.dependencies;
        } else {
          const depString = task.dependencies as string;
          
          // Check if it's a JSON array string
          if (typeof depString === 'string' && depString.startsWith('[') && depString.endsWith(']')) {
            dependencies = JSON.parse(depString);
          } else if (typeof depString === 'string' && depString.trim()) {
            // Legacy text data - convert to empty array and log for cleanup
            console.log(`[UnifiedTaskService] Converting legacy text dependency to empty array for task ${task.id}: "${depString.substring(0, 50)}..."`);
            dependencies = [];
          }
        }
      }
    } catch (error) {
      console.warn(`Failed to parse dependencies for task ${task.id}:`, error);
      console.warn(`Dependencies value:`, task.dependencies);
      dependencies = [];
    }

    return {
      ...task,
      dependencies,
    };
  }
}

// Export singleton instance
export const unifiedTaskService = new UnifiedTaskService();