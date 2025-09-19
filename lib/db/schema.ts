import type { InferSelectModel } from 'drizzle-orm';
import { sql, relations } from 'drizzle-orm';
import {
  pgTable,
  varchar,
  timestamp,
  json,
  uuid,
  text,
  primaryKey,
  foreignKey,
  boolean,
  jsonb,
  integer,
  unique,
} from 'drizzle-orm/pg-core';

export const user = pgTable('User', {
  id: uuid('id').primaryKey().notNull().defaultRandom(),
  email: varchar('email', { length: 64 }).notNull(),
  password: varchar('password', { length: 64 }),
  paprUserId: varchar('paprUserId', { length: 64 }),
  name: varchar('name', { length: 255 }),
  image: varchar('image', { length: 255 }),
  createdAt: timestamp('createdAt').notNull().defaultNow(),
  // Stripe customer ID for payment processing
  stripeCustomerId: varchar('stripeCustomerId', { length: 255 }),
  // Onboarding fields
  referredBy: varchar('referredBy', { length: 255 }),
  useCase: text('useCase'),
  onboardingCompleted: boolean('onboardingCompleted').default(false),
});

export type User = InferSelectModel<typeof user>;

export const subscription = pgTable('Subscription', {
  id: uuid('id').primaryKey().notNull().defaultRandom(),
  userId: uuid('userId')
    .notNull()
    .references(() => user.id),
  stripeSubscriptionId: varchar('stripeSubscriptionId', { length: 255 }),
  status: varchar('status', { length: 50 }).notNull().default('free'), // free, active, canceled, past_due, unpaid, trialing
  plan: varchar('plan', { length: 50 }).notNull().default('free'), // free, basic, pro
  currentPeriodStart: timestamp('currentPeriodStart'),
  currentPeriodEnd: timestamp('currentPeriodEnd'),
  cancelAtPeriodEnd: boolean('cancelAtPeriodEnd').default(false),
  trialStart: timestamp('trialStart'),
  trialEnd: timestamp('trialEnd'),
  createdAt: timestamp('createdAt').notNull().defaultNow(),
  updatedAt: timestamp('updatedAt').notNull().defaultNow(),
});

export type Subscription = InferSelectModel<typeof subscription>;

export const chat = pgTable('Chat', {
  id: uuid('id').primaryKey().notNull().defaultRandom(),
  createdAt: timestamp('createdAt').notNull(),
  title: text('title').notNull(),
  userId: uuid('userId')
    .notNull()
    .references(() => user.id),
  visibility: varchar('visibility', { enum: ['public', 'private'] })
    .notNull()
    .default('private'),
  oneSentenceSummary: text('oneSentenceSummary'),
  fullSummary: text('fullSummary'),
  insights: jsonb('insights'),
  userContext: text('userContext'), // Store fetched user context to avoid re-fetching
});

export type Chat = InferSelectModel<typeof chat>;

// Collection table to store chat collections
export const collection = pgTable('Collection', {
  id: uuid('id').primaryKey().notNull().defaultRandom(),
  title: text('title').notNull(),
  description: text('description'),
  userId: uuid('userId')
    .notNull()
    .references(() => user.id),
  createdAt: timestamp('createdAt').notNull().defaultNow(),
  updatedAt: timestamp('updatedAt').notNull().defaultNow(),
  isSystem: boolean('isSystem').notNull().default(false),
  systemType: varchar('systemType', { length: 32 }),
});

export type Collection = InferSelectModel<typeof collection>;

// Chat-collection association table
export const chatCollection = pgTable(
  'ChatCollection',
  {
    chatId: uuid('chatId')
      .notNull()
      .references(() => chat.id),
    collectionId: uuid('collectionId')
      .notNull()
      .references(() => collection.id),
    addedAt: timestamp('addedAt').notNull().defaultNow(),
  },
  (table) => {
    return {
      pk: primaryKey({ columns: [table.chatId, table.collectionId] }),
    };
  },
);

export type ChatCollection = InferSelectModel<typeof chatCollection>;

// DEPRECATED: The following schema is deprecated and will be removed in the future.
// Read the migration guide at https://github.com/vercel/ai-chatbot/blob/main/docs/04-migrate-to-parts.md
export const messageDeprecated = pgTable('Message', {
  id: uuid('id').primaryKey().notNull().defaultRandom(),
  chatId: uuid('chatId')
    .notNull()
    .references(() => chat.id),
  role: varchar('role').notNull(),
  content: json('content').notNull(),
  createdAt: timestamp('createdAt').notNull(),
});

export type MessageDeprecated = InferSelectModel<typeof messageDeprecated>;

export const message = pgTable('Message_v2', {
  id: uuid('id').primaryKey().notNull().defaultRandom(),
  chatId: uuid('chatId')
    .notNull()
    .references(() => chat.id),
  role: varchar('role').notNull(),
  parts: json('parts').notNull(),
  tool_calls: json('tool_calls').default(null),
  attachments: json('attachments').notNull(),
  memories: jsonb('memories').default(null),
  sources: jsonb('sources').default(null),
  modelId: varchar('modelId'),
  memoryDecision: jsonb('memoryDecision').default(null),
  createdAt: timestamp('createdAt').notNull(),
});

export type DBMessage = InferSelectModel<typeof message>;

// Book props table for characters, environments, objects, etc.
// This works with the existing Books table (which stores chapters)
export const bookProp = pgTable('BookProp', {
  id: uuid('id').primaryKey().notNull().defaultRandom(),
  bookId: uuid('bookId').notNull(), // References bookId from Books table, not a foreign key since Books has multiple rows per book
  bookTitle: varchar('bookTitle', { length: 255 }).notNull(), // Denormalized for easy access
  type: varchar('type', { length: 50 }).notNull(), // 'character', 'environment', 'object', 'illustration', 'prop'
  name: varchar('name', { length: 255 }).notNull(),
  description: text('description'),
  metadata: jsonb('metadata').default({}), // Store character details, physical descriptions, etc.
  memoryId: varchar('memoryId', { length: 255 }), // Reference to Papr Memory ID
  imageUrl: varchar('imageUrl', { length: 500 }), // Generated character/environment image
  userId: uuid('userId')
    .notNull()
    .references(() => user.id),
  createdAt: timestamp('createdAt').notNull().defaultNow(),
  updatedAt: timestamp('updatedAt').notNull().defaultNow(),
});

export type BookProp = InferSelectModel<typeof bookProp>;

// Unified task table for both workflow and general task tracking
export const task = pgTable('Tasks', {
  id: uuid('id').primaryKey().notNull().defaultRandom(),
  
  // Core task fields (used by both types)
  title: varchar('title', { length: 255 }).notNull(), // Task title/name
  description: text('description'), // Task description
  status: varchar('status', { length: 50 }).notNull().default('pending'), // 'pending', 'in_progress', 'completed', 'blocked', 'cancelled', 'approved', 'skipped'
  
  // Task type and context
  taskType: varchar('taskType', { length: 50 }).notNull().default('workflow'), // 'workflow' or 'general'
  sessionId: varchar('sessionId', { length: 255 }), // For general tasks tied to chat sessions
  
  // Book workflow specific fields (nullable for general tasks)
  bookId: uuid('bookId'), // References bookId from Books table (null for general tasks)
  bookTitle: varchar('bookTitle', { length: 255 }), // Denormalized for easy access (null for general tasks)
  stepNumber: integer('stepNumber'), // 1-7 based on WORKFLOW_STEPS (null for general tasks)
  stepName: varchar('stepName', { length: 100 }), // e.g., 'Story Planning', 'Chapter Drafting' (null for general tasks)
  isPictureBook: boolean('isPictureBook').default(false), // Determines which steps are applicable (false for general tasks)
  
  // Task relationships and dependencies
  parentTaskId: uuid('parentTaskId'), // For subtasks - self-reference added in relations
  dependencies: jsonb('dependencies').default('[]'), // Array of task IDs that must be completed first
  
  // Timing and tools
  toolUsed: varchar('toolUsed', { length: 100 }), // e.g., 'createBookPlan', 'draftChapter'
  estimatedDuration: varchar('estimatedDuration', { length: 50 }), // e.g., '30 minutes', '2 hours'
  actualDuration: varchar('actualDuration', { length: 50 }), // Actual time taken
  completedAt: timestamp('completedAt'),
  approvedAt: timestamp('approvedAt'),
  
  // Metadata and notes
  metadata: jsonb('metadata').default({}), // Store step-specific data, results, etc.
  notes: text('notes'), // User notes or AI-generated summaries
  
  // User and timestamps
  userId: uuid('userId')
    .notNull()
    .references(() => user.id),
  createdAt: timestamp('createdAt').notNull().defaultNow(),
  updatedAt: timestamp('updatedAt').notNull().defaultNow(),
}, (table) => {
  return {
    // Workflow tasks must have unique bookId + stepNumber combination
    uniqueBookStep: unique().on(table.bookId, table.stepNumber),
    // General tasks should have unique sessionId + title combination to prevent duplicates
    uniqueSessionTask: unique().on(table.sessionId, table.title),
  };
});

// Task relations for self-references
export const taskRelations = relations(task, ({ one, many }) => ({
  parent: one(task, {
    fields: [task.parentTaskId],
    references: [task.id],
  }),
  children: many(task),
}));

export type Task = InferSelectModel<typeof task>;

// Legacy type alias for backward compatibility
export type BookTask = Task;

// DEPRECATED: The following schema is deprecated and will be removed in the future.
// Read the migration guide at https://github.com/vercel/ai-chatbot/blob/main/docs/04-migrate-to-parts.md
export const voteDeprecated = pgTable(
  'Vote',
  {
    chatId: uuid('chatId')
      .notNull()
      .references(() => chat.id),
    messageId: uuid('messageId')
      .notNull()
      .references(() => messageDeprecated.id),
    isUpvoted: boolean('isUpvoted').notNull(),
    isSaved: boolean('isSaved').notNull().default(false),
  },
  (table) => {
    return {
      pk: primaryKey({ columns: [table.chatId, table.messageId] }),
    };
  },
);

export type VoteDeprecated = InferSelectModel<typeof voteDeprecated>;

export const vote = pgTable(
  'Vote_v2',
  {
    chatId: uuid('chatId')
      .notNull()
      .references(() => chat.id),
    messageId: uuid('messageId')
      .notNull()
      .references(() => message.id),
    isUpvoted: boolean('isUpvoted').notNull(),
    isSaved: boolean('isSaved').notNull().default(false),
  },
  (table) => {
    return {
      pk: primaryKey({ columns: [table.chatId, table.messageId] }),
    };
  },
);

export type Vote = InferSelectModel<typeof vote>;

export const document = pgTable(
  'Document',
  {
    id: uuid('id').notNull().defaultRandom(),
    createdAt: timestamp('createdAt').notNull(),
    title: text('title').notNull(),
    content: text('content'),
    kind: varchar('text', {
      enum: ['text', 'code', 'image', 'sheet', 'memory', 'book-creation'],
    })
      .notNull()
      .default('text'),
    chapterNumber: integer('chapterNumber'),
    bookTitle: text('bookTitle'),
    userId: uuid('userId')
      .notNull()
      .references(() => user.id),
    is_latest: boolean('is_latest').notNull().default(true),
    version: varchar('version').notNull().default('1'),
  },
  (table) => {
    return {
      pk: primaryKey({ columns: [table.id, table.createdAt] }),
    };
  },
);

export type Document = InferSelectModel<typeof document>;

export const suggestion = pgTable(
  'Suggestion',
  {
    id: uuid('id').notNull().defaultRandom(),
    documentId: uuid('documentId').notNull(),
    documentCreatedAt: timestamp('documentCreatedAt').notNull(),
    originalText: text('originalText').notNull(),
    suggestedText: text('suggestedText').notNull(),
    description: text('description'),
    isResolved: boolean('isResolved').notNull().default(false),
    userId: uuid('userId')
      .notNull()
      .references(() => user.id),
    createdAt: timestamp('createdAt').notNull(),
  },
  (table) => ({
    pk: primaryKey({ columns: [table.id] }),
    documentRef: foreignKey({
      columns: [table.documentId, table.documentCreatedAt],
      foreignColumns: [document.id, document.createdAt],
    }),
  }),
);

export type Suggestion = InferSelectModel<typeof suggestion>;

// Message Memories table to store associations between messages and their retrieved memories
export const messageMemory = pgTable(
  'MessageMemory',
  {
    id: uuid('id').primaryKey().notNull().defaultRandom(),
    messageId: uuid('messageId').notNull(),
    chatId: uuid('chatId').notNull(),
    memories: jsonb('memories').notNull(),
    createdAt: timestamp('createdAt').notNull().defaultNow(),
  }
);

export type MessageMemory = InferSelectModel<typeof messageMemory>;

// Usage tracking table to monitor plan limits
export const usage = pgTable('Usage', {
  id: uuid('id').primaryKey().notNull().defaultRandom(),
  userId: uuid('userId')
    .notNull()
    .references(() => user.id),
  month: varchar('month', { length: 7 }).notNull(), // YYYY-MM format
  basicInteractions: integer('basicInteractions').notNull().default(0),
  premiumInteractions: integer('premiumInteractions').notNull().default(0),
  memoriesAdded: integer('memoriesAdded').notNull().default(0),
  memoriesSearched: integer('memoriesSearched').notNull().default(0),
  voiceChats: integer('voiceChats').notNull().default(0), // Voice chat sessions per month
  videosGenerated: integer('videosGenerated').notNull().default(0), // Video generation per month
  createdAt: timestamp('createdAt').notNull().defaultNow(),
  updatedAt: timestamp('updatedAt').notNull().defaultNow(),
}, (table) => ({
  // Unique constraint on userId + month
  userMonthUnique: primaryKey({ columns: [table.userId, table.month] }),
}));

export type Usage = InferSelectModel<typeof usage>;

// Books table - separate from documents for better book management
export const Book = pgTable(
  'Books',
  {
    id: uuid('id').primaryKey().notNull().defaultRandom(),
    bookId: uuid('bookId').notNull(), // Unique identifier for the book (multiple chapters share this)
    bookTitle: text('bookTitle').notNull(),
    chapterNumber: integer('chapterNumber').notNull(),
    chapterTitle: text('chapterTitle').notNull(),
    content: text('content').notNull(),
    userId: uuid('userId')
      .notNull()
      .references(() => user.id),
    createdAt: timestamp('createdAt').notNull().defaultNow(),
    updatedAt: timestamp('updatedAt').notNull().defaultNow(),
    version: text('version').notNull().default('1'), // Version number for chapter revisions
    is_latest: boolean('is_latest').notNull().default(true), // Flag to mark the latest version
  },
  (table) => ({
    // Unique constraint to prevent duplicate chapters for the same book/user
    // This ensures only one record per (bookId, userId, chapterNumber) combination
    bookUserChapterUnique: unique("Books_bookId_userId_chapterNumber_unique").on(
      table.bookId, 
      table.userId, 
      table.chapterNumber
    ),
  })
);

export type Book = InferSelectModel<typeof Book>;
