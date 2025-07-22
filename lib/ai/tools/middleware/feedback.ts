import type { Tool, ToolExecutionOptions } from 'ai';
import { DataStream, ToolMiddlewareOptions } from './types';
import { ToolRegistry } from './registry';

export interface ToolFeedbackOptions extends ToolMiddlewareOptions {
  toolName: string;
  dataStream: DataStream;
  registry: ToolRegistry;
}

/**
 * Creates a tool wrapper that provides inline feedback during tool execution
 */
export function createToolFeedbackMiddleware(options: ToolFeedbackOptions) {
  const { toolName, dataStream, registry, toolConfig, signal } = options;

  // Get tool-specific configuration
  const config = toolConfig?.[toolName];
  const isNonFatal = config?.errorHandling?.nonFatal ?? false;

  return {
    wrapTool: (originalTool: Tool): Tool => {
      if (!originalTool.execute) {
        throw new Error(`Tool ${toolName} does not have an execute function`);
      }

      // After the check, we know execute exists and is a function
      const tool = originalTool as Required<Tool>;

      return {
        ...originalTool,
        execute: async (args, options: ToolExecutionOptions) => {
          // Check for abort before starting
          if (signal?.aborted) {
            const error = new Error('Operation cancelled by user');
            error.name = 'AbortError';
            throw error;
          }

          // Get feedback messages from registry
          const startMessage = registry.getStartMessage(toolName, args);
          
          // Send tool call start message
          console.log(`[CHAT API] Tool call started: ${toolName}`);
          dataStream.writeData({
            type: 'tool',
            content: startMessage,
          });

          try {
            // Execute the original tool
            const result = await tool.execute(args, options);

            // Check for abort after execution
            if (signal?.aborted) {
              const error = new Error('Operation cancelled by user');
              error.name = 'AbortError';
              throw error;
            }

            // Get result message from registry
            const resultMessage = registry.getResultMessage(toolName, result);

            // Send tool call result message
            dataStream.writeData({
              type: 'tool',
              content: resultMessage,
            });

            return result;
          } catch (error) {
            // Handle error case
            console.error(`[CHAT API] Tool call error: ${toolName}`, error);

            // Check if operation was cancelled
            if (error instanceof Error && (error.name === 'AbortError' || signal?.aborted)) {
              dataStream.writeData({
                type: 'tool',
                content: `⏹️ ${toolName} cancelled`,
              });
              throw error; // Re-throw abort errors to stop the stream
            }

            // Get custom error message if configured
            const errorMessage = config?.errorHandling?.errorMessage ?? 
              `❌ Error running ${toolName}: ${error instanceof Error ? error.message : 'Unknown error'}`;

            dataStream.writeData({
              type: 'tool',
              content: isNonFatal ? `⚠️ ${errorMessage} (continuing)` : `❌ ${errorMessage}`,
            });

            if (isNonFatal) {
              // Return empty result for non-fatal errors
              return {} as any;
            }
            
            throw error;
          }
        }
      };
    }
  };
} 