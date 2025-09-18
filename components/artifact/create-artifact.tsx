import type { Suggestion } from '@/lib/db/schema';
import type { UseChatHelpers } from '@ai-sdk/react';
import type { UIMessage } from 'ai';
import type { ComponentType, Dispatch, ReactNode, SetStateAction } from 'react';
import type { UIArtifact } from './artifact';

// Local type definition for data stream delta (previously from data-stream-handler)
export type DataStreamDelta = {
  type:
    | 'text-delta'
    | 'code-delta'
    | 'sheet-delta'
    | 'image-delta'
    | 'image-generated'
    | 'image-edited'
    | 'images-merged'
    | 'structured-book-image-start'
    | 'structured-book-image-progress'
    | 'structured-book-image-result'
    | 'structured-book-image-complete'
    | 'structured-book-image-approval'
    | 'single-book-image-start'
    | 'single-book-image-complete'
    | 'single-book-image-auto-inserted'
    | 'single-book-image-auto-insert-failed'
    | 'single-book-image-auto-insert-error'
    | 'book-creation-update'
    | 'book-creation-state'
    | 'title'
    | 'id'
    | 'suggestion'
    | 'clear'
    | 'finish'
    | 'kind'
    | 'status'
    | 'tool-call'
    | 'tool-result'
    | 'progress'
    | 'github-staged-files'
    | 'github-selection'
    | 'repository-approval-request'
    | 'repository-created'
    | 'project-creation-started';
  content: string | Suggestion | Record<string, any>;
  language?: string;
  toolCall?: {
    id: string;
    name: string;
  };
  toolResult?: {
    id: string;
    result: any;
  };
  tool_calls?: Array<{
    id: string;
    function: {
      name: string;
    };
  }>;
};

export type ArtifactActionContext<M = any> = {
  content: string;
  handleVersionChange: (type: 'next' | 'prev' | 'toggle' | 'latest') => void;
  currentVersionIndex: number;
  isCurrentVersion: boolean;
  mode: 'edit' | 'diff';
  metadata: M;
  setMetadata: Dispatch<SetStateAction<M>>;
  appendMessage?: UseChatHelpers<UIMessage>['sendMessage'];
};

type ArtifactAction<M = any> = {
  icon: ReactNode;
  label?: string;
  description: string;
  onClick: (context: ArtifactActionContext<M>) => Promise<void> | void;
  isDisabled?: (context: ArtifactActionContext<M>) => boolean;
};

export type ArtifactToolbarContext = {
  appendMessage: UseChatHelpers<UIMessage>['sendMessage'];
};

export type ArtifactToolbarItem = {
  description: string;
  icon: ReactNode;
  onClick: (context: ArtifactToolbarContext) => void;
};

export interface ArtifactContent<M = any> {
  title: string;
  content: string | null;
  mode: 'edit' | 'diff';
  isCurrentVersion: boolean;
  currentVersionIndex: number;
  status: 'streaming' | 'idle';
  suggestions: Array<Suggestion>;
  onSaveContent: (updatedContent: string, debounce: boolean) => void;
  isInline: boolean;
  getDocumentContentById: (index: number) => string;
  isLoading: boolean;
  metadata: M;
  setMetadata: Dispatch<SetStateAction<M>>;
  language?: string;
  handleVersionChange?: (type: 'next' | 'prev' | 'toggle' | 'latest') => void;
  totalVersions?: number;
}

interface InitializeParameters<M = any> {
  documentId: string;
  setMetadata: Dispatch<SetStateAction<M>>;
  setArtifact: Dispatch<SetStateAction<UIArtifact>>;
}

type ArtifactConfig<T extends string, M = any> = {
  kind: T;
  description: string;
  content: ComponentType<ArtifactContent<M>>;
  actions: Array<ArtifactAction<M>>;
  toolbar: ArtifactToolbarItem[];
  initialize?: (parameters: InitializeParameters<M>) => void;
  onStreamPart: (args: {
    setMetadata: Dispatch<SetStateAction<M>>;
    setArtifact: Dispatch<SetStateAction<UIArtifact>>;
    streamPart: DataStreamDelta;
  }) => void;
};

export class Artifact<T extends string, M = any> {
  readonly kind: T;
  readonly description: string;
  readonly content: ComponentType<ArtifactContent<M>>;
  readonly actions: Array<ArtifactAction<M>>;
  readonly toolbar: ArtifactToolbarItem[];
  readonly initialize?: (parameters: InitializeParameters) => void;
  readonly onStreamPart: (args: {
    setMetadata: Dispatch<SetStateAction<M>>;
    setArtifact: Dispatch<SetStateAction<UIArtifact>>;
    streamPart: DataStreamDelta;
  }) => void;

  constructor(config: ArtifactConfig<T, M>) {
    this.kind = config.kind;
    this.description = config.description;
    this.content = config.content;
    this.actions = config.actions || [];
    this.toolbar = config.toolbar || [];
    this.initialize = config.initialize || (async () => ({}));
    this.onStreamPart = config.onStreamPart;
  }
}
