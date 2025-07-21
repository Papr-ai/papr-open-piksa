import { codeDocumentHandler } from '@/artifacts/code/server';
import { imageDocumentHandler } from '@/artifacts/image/server';
import { sheetDocumentHandler } from '@/artifacts/sheet/server';
import { textDocumentHandler } from '@/artifacts/text/server';
import type { ArtifactKind } from '@/components/artifact';
import type { DataStreamWriter } from 'ai';
import type { Document } from '../db/schema';
import { saveDocument } from '../db/queries';
import type { Session } from 'next-auth';

export interface SaveDocumentProps {
  id: string;
  title: string;
  kind: ArtifactKind;
  content: string;
  userId: string;
}

export interface CreateDocumentCallbackProps {
  id: string;
  title: string;
  dataStream: DataStreamWriter;
  session: Session;
}

export interface UpdateDocumentCallbackProps {
  document: Document;
  description: string;
  dataStream: DataStreamWriter;
  session: Session;
}

export interface DocumentHandler<T = ArtifactKind> {
  kind: T;
  onCreateDocument: (args: CreateDocumentCallbackProps) => Promise<void>;
  onUpdateDocument: (args: UpdateDocumentCallbackProps) => Promise<string>;
}

export function createDocumentHandler<T extends ArtifactKind>(config: {
  kind: T;
  onCreateDocument: (params: CreateDocumentCallbackProps) => Promise<string>;
  onUpdateDocument: (params: UpdateDocumentCallbackProps) => Promise<string>;
}): DocumentHandler<T> {
  return {
    kind: config.kind,
    onCreateDocument: async (args: CreateDocumentCallbackProps) => {
      const draftContent = await config.onCreateDocument({
        id: args.id,
        title: args.title,
        dataStream: args.dataStream,
        session: args.session,
      });

      if (args.session?.user?.id) {
        await saveDocument({
          id: args.id,
          title: args.title,
          content: draftContent,
          kind: config.kind,
          userId: args.session.user.id,
        });
      }

      return;
    },
    onUpdateDocument: async (args: UpdateDocumentCallbackProps) => {
      let draftContent = '';
      try {
        draftContent = await config.onUpdateDocument({
          document: args.document,
          description: args.description,
          dataStream: args.dataStream,
          session: args.session,
        });

        if (args.session?.user?.id) {
          try {
            // Force a new version to be created
            await saveDocument({
              id: args.document.id,
              title: args.document.title,
              content: draftContent,
              kind: config.kind,
              userId: args.session.user.id,
            });

            // Signal completion through the data stream
            args.dataStream.writeData({
              type: 'status',
              content: 'idle',
            });

            // Explicitly mark completion
            args.dataStream.writeData({
              type: 'finish',
              content: '',
            });

            return draftContent;
          } catch (saveError) {
            console.error('Error saving document:', saveError);
            // On save error, signal error state but keep content
            args.dataStream.writeData({
              type: 'status',
              content: 'idle',
            });
            args.dataStream.writeData({
              type: 'finish',
              content: '',
            });
            return draftContent; // Return the content even if save failed
          }
        }

        return draftContent;
      } catch (error) {
        console.error('Error in onUpdateDocument:', error);
        // On error, signal completion and return original content
        args.dataStream.writeData({
          type: 'status',
          content: 'idle',
        });
        args.dataStream.writeData({
          type: 'finish',
          content: '',
        });
        return args.document.content || '';
      }
    },
  };
}

export const artifactKinds = [
  'text',
  'code',
  'image',
  'sheet',
  'memory',
  'github-code',
] as const;

// Simple handler for GitHub code artifact
const githubCodeDocumentHandler = createDocumentHandler<'github-code'>({
  kind: 'github-code',
  onCreateDocument: async ({ title, dataStream }) => {
    // While GitHub file explorer doesn't need generated content,
    // we should actually create a basic project structure to get started
    console.log('[GITHUB ARTIFACT] Creating document with title:', title);
    
    // Signal that we want to create a code project with this title
    dataStream.writeData({
      type: 'code-project-request',
      content: {
        title,
        kind: 'web-game'
      }
    });
    
    // Let the client decide when to finish
    return '';
  },
  onUpdateDocument: async ({ document, description, dataStream }) => {
    // GitHub file explorer doesn't need updated content
    dataStream.writeData({ type: 'finish', content: '' });
    return document.content || '';
  },
});

/*
 * Use this array to define the document handlers for each artifact kind.
 */
export const documentHandlersByArtifactKind: Array<DocumentHandler> = [
  textDocumentHandler,
  codeDocumentHandler,
  imageDocumentHandler,
  sheetDocumentHandler,
  githubCodeDocumentHandler,
];
