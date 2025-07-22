import type { Tool, ToolExecutionOptions as BaseToolExecutionOptions } from 'ai';

export interface DataStream {
  writeData: (data: {
    type: string;
    content: string;
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