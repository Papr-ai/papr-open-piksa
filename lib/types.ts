import type { UIMessage, ToolUIPart, DynamicToolUIPart } from 'ai';

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
