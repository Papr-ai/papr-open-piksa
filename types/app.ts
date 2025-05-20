export interface App {
  id: number;
  name: string;
  path: string;
  status: 'running' | 'stopped' | 'error';
  url?: string;
}

export interface AppOutput {
  message: string;
  type: 'client-error' | 'server-error' | 'info';
  appId: number | string;
  timestamp: number;
  error?: string;
}

export interface UseRunAppReturn {
  runApp: (appId: number) => Promise<void>;
  stopApp: (appId: number) => Promise<void>;
  restartApp: (options?: { removeNodeModules?: boolean }) => Promise<void>;
  loading: boolean;
  app: App | null;
}

export interface UseLoadAppFileReturn {
  content: string | null;
  loading: boolean;
  error: Error | null;
}

export interface UseStreamChatReturn {
  streamMessage: (options: { prompt: string; chatId: string }) => Promise<void>;
}
