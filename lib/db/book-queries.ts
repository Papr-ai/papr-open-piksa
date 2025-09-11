import { desc, eq, and, sql } from 'drizzle-orm';
import { db } from './db';
import { Book, bookProp, task } from './schema';
import type { BookProp, Task } from './schema';
// Legacy import alias
import type { BookTask } from './schema';

// Types for working with existing Books table
export interface BookSummary {
  bookId: string;
  bookTitle: string;
  chapterCount: number;
  totalWordCount: number;
  lastUpdated: Date;
  userId: string;
}

export interface BookChapter {
  id: string;
  bookId: string;
  bookTitle: string;
  chapterNumber: number;
  chapterTitle: string;
  content: string;
  userId: string;
  createdAt: Date;
  updatedAt: Date;
  version?: string;
  is_latest?: boolean;
}

// Book queries - working with existing Books table structure
export async function getBooksByUserId(userId: string): Promise<BookSummary[]> {
  const result = await db.execute(sql`
    SELECT 
      "bookId",
      "bookTitle",
      COUNT(*) as "chapterCount",
      SUM(
        CASE 
          WHEN "content" IS NULL OR "content" = '' THEN 0
          ELSE array_length(string_to_array(trim("content"), ' '), 1)
        END
      ) as "totalWordCount",
      MAX("updatedAt") as "lastUpdated",
      "userId"
    FROM "Books"
    WHERE "userId" = ${userId} AND "is_latest" = true
    GROUP BY "bookId", "bookTitle", "userId"
    ORDER BY MAX("updatedAt") DESC
  `);
  
  return result.map(row => ({
    bookId: row.bookId as string,
    bookTitle: row.bookTitle as string,
    chapterCount: Number(row.chapterCount),
    totalWordCount: Number(row.totalWordCount) || 0,
    lastUpdated: new Date(row.lastUpdated as string),
    userId: row.userId as string,
  }));
}

export async function getBookChaptersByBookId(bookId: string, userId: string): Promise<BookChapter[]> {
  return await db
    .select()
    .from(Book)
    .where(and(
      eq(Book.bookId, bookId), 
      eq(Book.userId, userId),
      eq(Book.is_latest, true)  // Only get the latest version of each chapter
    ))
    .orderBy(Book.chapterNumber);
}

export async function getBookChapterById(chapterId: string, userId: string): Promise<BookChapter | null> {
  const chapters = await db
    .select()
    .from(Book)
    .where(and(eq(Book.id, chapterId), eq(Book.userId, userId)))
    .limit(1);
  
  return chapters[0] || null;
}

export async function createBookChapter(chapterData: {
  bookId: string;
  bookTitle: string;
  chapterNumber: number;
  chapterTitle: string;
  content: string;
  userId: string;
}): Promise<BookChapter> {
  const [newChapter] = await db
    .insert(Book)
    .values({
      ...chapterData,
      version: '1',
      is_latest: true,
    })
    .returning();
  
  return newChapter;
}

export async function updateBookChapter(
  chapterId: string,
  userId: string,
  updates: Partial<{
    chapterTitle: string;
    content: string;
    version: string;
  }>
): Promise<BookChapter | null> {
  const [updatedChapter] = await db
    .update(Book)
    .set({
      ...updates,
      updatedAt: new Date(),
    })
    .where(and(eq(Book.id, chapterId), eq(Book.userId, userId)))
    .returning();
  
  return updatedChapter || null;
}

export async function deleteBookChapter(chapterId: string, userId: string): Promise<boolean> {
  const result = await db
    .delete(Book)
    .where(and(eq(Book.id, chapterId), eq(Book.userId, userId)));
  
  return result.length > 0;
}

// Book props queries
export async function getBookPropsByBookId(bookId: string): Promise<BookProp[]> {
  return await db
    .select()
    .from(bookProp)
    .where(eq(bookProp.bookId, bookId))
    .orderBy(desc(bookProp.createdAt));
}

export async function getBookPropsByType(bookId: string, type: string): Promise<BookProp[]> {
  return await db
    .select()
    .from(bookProp)
    .where(and(eq(bookProp.bookId, bookId), eq(bookProp.type, type)))
    .orderBy(desc(bookProp.createdAt));
}

export async function getBookPropsByUserId(userId: string): Promise<BookProp[]> {
  return await db
    .select()
    .from(bookProp)
    .where(eq(bookProp.userId, userId))
    .orderBy(desc(bookProp.createdAt));
}

export async function getBookPropsByUserIdAndType(userId: string, type: string): Promise<BookProp[]> {
  return await db
    .select()
    .from(bookProp)
    .where(and(eq(bookProp.userId, userId), eq(bookProp.type, type)))
    .orderBy(desc(bookProp.createdAt));
}

export async function createBookProp(propData: {
  bookId: string;
  bookTitle: string;
  type: string;
  name: string;
  description?: string;
  metadata?: any;
  memoryId?: string;
  imageUrl?: string;
  userId: string;
}): Promise<BookProp> {
  const [newProp] = await db
    .insert(bookProp)
    .values({
      ...propData,
      metadata: propData.metadata || {},
    })
    .returning();
  
  return newProp;
}

export async function updateBookProp(
  propId: string,
  updates: Partial<Omit<BookProp, 'id' | 'userId' | 'createdAt' | 'updatedAt'>>
): Promise<BookProp | null> {
  const [updatedProp] = await db
    .update(bookProp)
    .set({
      ...updates,
      updatedAt: new Date(),
    })
    .where(eq(bookProp.id, propId))
    .returning();
  
  return updatedProp || null;
}

export async function deleteBookProp(propId: string, userId: string): Promise<boolean> {
  const result = await db
    .delete(bookProp)
    .where(and(eq(bookProp.id, propId), eq(bookProp.userId, userId)));
  
  return result.length > 0;
}

// Combined queries
export async function getBookWithDetails(bookId: string, userId: string) {
  const [chapters, props] = await Promise.all([
    getBookChaptersByBookId(bookId, userId),
    getBookPropsByBookId(bookId),
  ]);

  if (chapters.length === 0) return null;

  const bookTitle = chapters[0].bookTitle;

  return {
    bookId,
    bookTitle,
    chapters,
    props,
    characters: props.filter(p => p.type === 'character'),
    environments: props.filter(p => p.type === 'environment'),
    objects: props.filter(p => p.type === 'object'),
    illustrations: props.filter(p => p.type === 'illustration'),
    chapterCount: chapters.length,
    totalWordCount: chapters.reduce((sum, ch) => {
      if (!ch.content || ch.content.trim() === '') return sum;
      return sum + ch.content.trim().split(/\s+/).length;
    }, 0),
    lastUpdated: new Date(Math.max(...chapters.map(ch => ch.updatedAt.getTime()))),
  };
}

// Book Task Management Functions

export async function initializeBookTasks(
  bookId: string, 
  bookTitle: string, 
  userId: string, 
  isPictureBook: boolean = false
): Promise<Task[]> {
  // Define all workflow steps
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
      const [newTask] = await db
        .insert(task)
        .values({
          title: step.stepName, // Required field in new schema
          taskType: 'workflow', // Mark as workflow task
          bookId,
          bookTitle,
          stepNumber: step.stepNumber,
          stepName: step.stepName,
          toolUsed: step.toolUsed,
          isPictureBook,
          userId,
          status: 'pending',
          dependencies: [], // Initialize empty dependencies
        })
        .onConflictDoNothing() // Don't duplicate if already exists
        .returning();
      
      return newTask;
    })
  );

  return tasks.filter(Boolean); // Remove any undefined tasks from conflicts
}

export async function getBookTasks(bookId: string, userId: string): Promise<Task[]> {
  const tasks = await db
    .select()
    .from(task)
    .where(
      and(
        eq(task.bookId, bookId), 
        eq(task.userId, userId),
        eq(task.taskType, 'workflow') // Only get workflow tasks
      )
    )
    .orderBy(task.stepNumber);
  
  return tasks as Task[];
}

export async function updateBookTaskStatus(
  taskId: string,
  status: 'pending' | 'in_progress' | 'completed' | 'approved' | 'skipped',
  metadata?: any,
  notes?: string
): Promise<Task | null> {
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
    .where(eq(task.id, taskId))
    .returning();

  return updatedTask || null;
}

export async function getBookProgress(bookId: string, userId: string): Promise<{
  totalSteps: number;
  completedSteps: number;
  approvedSteps: number;
  currentStep: number | null;
  progressPercentage: number;
  tasks: Task[];
}> {
  let tasks = await getBookTasks(bookId, userId);
  
  // If no workflow tasks found, look for general tasks linked to this book
  if (tasks.length === 0) {
    console.log(`[getBookProgress] No workflow tasks found for book ${bookId}, checking general tasks`);
    try {
      const { unifiedTaskService } = await import('@/lib/db/unified-task-service');
      const generalTasks = await unifiedTaskService.getAllTasks(userId, 'general');
      
      // Filter tasks that belong to this book
      const bookTasks = generalTasks.filter(task => task.bookId === bookId);
      
      // Convert to Task format for compatibility
      tasks = bookTasks.map(task => ({
        id: task.id,
        title: task.title,
        description: task.description || null,
        status: task.status,
        stepNumber: task.stepNumber || 1,
        stepName: task.stepName || task.title,
        bookId: task.bookId!,
        bookTitle: task.bookTitle!,
        isPictureBook: task.isPictureBook || false,
        toolUsed: task.toolUsed,
        estimatedDuration: task.estimatedDuration,
        dependencies: task.dependencies || [],
        metadata: task.metadata || {},
        notes: task.notes,
        createdAt: task.createdAt,
        updatedAt: task.updatedAt,
        completedAt: task.completedAt,
        approvedAt: task.approvedAt,
        userId: task.userId,
        taskType: task.taskType,
        sessionId: task.sessionId,
        parentTaskId: task.parentTaskId,
        actualDuration: task.actualDuration,
      }));
      
      console.log(`[getBookProgress] Found ${tasks.length} general tasks for book ${bookId}`);
    } catch (error) {
      console.error('[getBookProgress] Error fetching general tasks:', error);
    }
  }
  
  const totalSteps = tasks.length;
  const completedSteps = tasks.filter(t => t.status === 'completed' || t.status === 'approved').length;
  const approvedSteps = tasks.filter(t => t.status === 'approved').length;
  
  // Find the current step (first pending or in-progress task)
  const currentTask = tasks.find(t => t.status === 'pending' || t.status === 'in_progress');
  const currentStep = currentTask?.stepNumber || null;
  
  const progressPercentage = totalSteps > 0 ? Math.round((completedSteps / totalSteps) * 100) : 0;

  return {
    totalSteps,
    completedSteps,
    approvedSteps,
    currentStep,
    progressPercentage,
    tasks,
  };
}
