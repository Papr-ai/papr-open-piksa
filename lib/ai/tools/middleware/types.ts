import type { Tool, ToolCallOptions } from 'ai';

// Define a compatible stream interface that works with our existing code
export interface DataStream {
  write?: (data: {
    type: string;
    content?: any;
    data?: any;
    [key: string]: any; // Allow additional properties for flexibility
  }) => void;
}

// Re-export SDK types
export type { Tool };

// Error handling configuration
export interface ToolErrorConfig {
  // If true, errors will be handled gracefully and won't stop execution
  nonFatal?: boolean;
  // Custom error message to show in the stream
  errorMessage?: string;
}

// Tool configuration by name
export interface ToolConfig {
  // Error handling configuration for this tool
  errorHandling?: ToolErrorConfig;
}

// Middleware options
export interface ToolMiddlewareOptions {
  // Tool-specific configuration
  toolConfig?: Record<string, ToolConfig>;
  // Abort signal for cancellation
  signal?: AbortSignal;
} 