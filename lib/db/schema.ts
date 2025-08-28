import type { InferSelectModel } from 'drizzle-orm';
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
      enum: ['text', 'code', 'image', 'sheet', 'memory', 'github-code'],
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
  },
  (table) => {
    return {
      uniqueBookChapter: primaryKey({ columns: [table.bookId, table.chapterNumber, table.userId] }),
    };
  },
);

export type Book = InferSelectModel<typeof Book>;
