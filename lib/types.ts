import type { UIMessage, ToolUIPart, DynamicToolUIPart, TextPart } from 'ai';

// Define a compatible stream writer interface that works with our existing code
// while supporting the AI SDK 5.0 approach
export interface DataStreamWriter {
  write?: (data: {
    type: string;
    content?: any;
    data?: any;
    [key: string]: any; // Allow additional properties for flexibility
  }) => void;
}

// Use the actual AI SDK 5.0 tool UI part types - these replace ToolInvocation
export type ToolInvocation = ToolUIPart | DynamicToolUIPart;

// Export the ToolUIPart from AI SDK
export { ToolUIPart };

// Export TextPart type
export { TextPart };

// Message part types
export type MessagePart = TextPart | ToolUIPart | DynamicToolUIPart;


export interface DocumentToolOutput {
  success: boolean;
  id: string;
  title: string;
  kind: 'text' | 'image' | 'book' | 'sheet' | 'memory';
  content?: string;
  message?: string;
  error?: string;
}

export interface CreateBookOutput {
  success: boolean;
  id: string;
  bookId?: string;
  bookTitle: string;
  chapterTitle: string;
  chapterNumber: number;
  content: string;
  saveError?: string;
  saved?: boolean;
  message?: string;
  error?: string;
}

export interface SearchBooksOutput {
  books: Array<{
    bookId: string;
    bookTitle: string;
    chapterCount: number;
    lastChapterNumber: number;
    lastUpdated: string;
  }>;
  totalBooks?: number;
  message?: string;
}

export interface AddMemoryOutput {
  success: boolean;
  memoryId?: string;
  message?: string;
  error?: string;
}

export interface AddMemoryInput {
  content: string;
  category?: string;
  type?: string;
}

export interface GenerateImageOutput {
  success: boolean;
  id: string;
  imageUrl: string;
  prompt: string;
  style: string;
  context?: string;
  title?: string;
  subtitle?: string;
  message?: string;
  error?: string;
}

export interface EditImageOutput {
  success: boolean;
  id: string;
  originalImageUrl: string;
  editedImageUrl: string;
  prompt: string;
  editType: string;
  preserveOriginal: boolean;
  context?: string;
  message?: string;
  error?: string;
}

// Extended UI message type that includes additional properties needed by the app
export interface ExtendedUIMessage extends UIMessage {
  tool_calls?: Array<{
    function?: {
      name: string;
      output?: string;
    };
    id?: string;
  }>;
  toolInvocations?: Array<ToolInvocation>;
  attachments?: Array<{
    name: string;
    contentType: string;
    size: number;
    url: string;
  }>;
  memories?: Array<any>;
  modelId?: string;
  createdAt?: Date;
}
