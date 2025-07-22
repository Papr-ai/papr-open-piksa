export interface ToolFeedbackMessages {
  getStartMessage: (args: Record<string, any>) => string;
  getResultMessage: (result: Record<string, any>) => string;
}

export class ToolRegistry {
  private registry: Map<string, ToolFeedbackMessages> = new Map();

  constructor() {
    this.registerDefaults();
  }

  register(toolName: string, messages: ToolFeedbackMessages): void {
    this.registry.set(toolName, messages);
  }

  getStartMessage(toolName: string, args: Record<string, any>): string {
    const messages = this.registry.get(toolName);
    if (!messages) {
      return `🔧 Running ${toolName}`;
    }
    return messages.getStartMessage(args);
  }

  getResultMessage(toolName: string, result: Record<string, any>): string {
    const messages = this.registry.get(toolName);
    if (!messages) {
      return `✅ ${toolName} completed`;
    }
    return messages.getResultMessage(result);
  }

  private registerDefaults(): void {
    // Register default message handlers for common tools
    this.register('searchMemories', {
      getStartMessage: (args) => `🔍 Searching memories for: "${args.query}"`,
      getResultMessage: (result) => {
        const memoryCount = result.memories?.length || 0;
        return memoryCount > 0 
          ? `✅ Found ${memoryCount} relevant ${memoryCount === 1 ? 'memory' : 'memories'}`
          : `📭 No relevant memories found`;
      }
    });

    // Add more default handlers as needed
  }
} 