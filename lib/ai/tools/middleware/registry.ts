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

    // Register the addMemory tool
    this.register('addMemory', {
      getStartMessage: (args) => `💾 Saving ${args.category} memory: "${args.content.substring(0, 30)}${args.content.length > 30 ? '...' : ''}"`,
      getResultMessage: (result) => {
        return result.success
          ? `✅ Added ${result.category} memory successfully`
          : `❌ Failed to add memory: ${result.error || 'Unknown error'}`;
      }
    });

    // Register the updateMemory tool
    this.register('updateMemory', {
      getStartMessage: (args) => `🔄 Updating memory: ${args.memory_id}`,
      getResultMessage: (result) => {
        if (result.success && result.updated_fields) {
          const fields = result.updated_fields.join(', ');
          return `✅ Updated memory (${fields}) successfully`;
        }
        return result.success
          ? `✅ Updated memory successfully`
          : `❌ Failed to update memory: ${result.error || 'Unknown error'}`;
      }
    });

    // Register the deleteMemory tool
    this.register('deleteMemory', {
      getStartMessage: (args) => `🗑️ Deleting memory: ${args.memory_id}${args.reason ? ` (${args.reason})` : ''}`,
      getResultMessage: (result) => {
        return result.success
          ? `✅ Deleted memory successfully`
          : `❌ Failed to delete memory: ${result.error || 'Unknown error'}`;
      }
    });

    // Add more default handlers as needed
  }
} 