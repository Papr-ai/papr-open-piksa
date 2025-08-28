import { imageDocumentHandler } from '@/artifacts/image/server';
import { sheetDocumentHandler } from '@/artifacts/sheet/server';
import { textDocumentHandler } from '@/artifacts/text/server';
import { memoryDocumentHandler } from '@/artifacts/memory/server';
// Book functionality moved to createBook tool
import type { ArtifactKind } from '@/components/artifact/artifact';
import type { DataStreamWriter } from '@/lib/types';
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
            args.dataStream.write?.({
              type: 'status',
              content: 'idle',
            });

            // Explicitly mark completion
            args.dataStream.write?.({
              type: 'finish',
              content: '',
            });

            return draftContent;
          } catch (saveError) {
            console.error('Error saving document:', saveError);
            // On save error, signal error state but keep content
            args.dataStream.write?.({
              type: 'status',
              content: 'idle',
            });
            args.dataStream.write?.({
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
        args.dataStream.write?.({
          type: 'status',
          content: 'idle',
        });
        args.dataStream.write?.({
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
  'image',
  'sheet',
  'memory',
] as const;

/*
 * Use this array to define the document handlers for each artifact kind.
 */
export const documentHandlersByArtifactKind: Array<DocumentHandler> = [
  textDocumentHandler,
  imageDocumentHandler,
  sheetDocumentHandler,
  memoryDocumentHandler,
];
