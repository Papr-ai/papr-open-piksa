import type { UIMessage } from 'ai';

// Extended UI message type that includes tool_calls
export interface ExtendedUIMessage extends UIMessage {
  tool_calls?: Array<{
    function?: {
      name: string;
      output?: string;
    };
    id?: string;
  }>;
}
