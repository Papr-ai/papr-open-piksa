import { tool, type Tool, type ToolCallOptions } from 'ai';
import type { DataStreamWriter } from '@/lib/types';
import { Session } from 'next-auth';
import { z } from 'zod';
import { getDocumentById, saveDocument } from '@/lib/db/queries';
import { documentHandlersByArtifactKind } from '@/lib/artifacts/server';

interface UpdateDocumentProps {
  session: Session;
  dataStream: DataStreamWriter;
}

const updateDocumentSchema = z.object({
  id: z.string().describe('The ID of the document to update'),
  description: z
    .string()
    .describe('The description of changes that need to be made'),
});

type UpdateDocumentInput = z.infer<typeof updateDocumentSchema>;
type UpdateDocumentOutput = {
  error?: string;
  id?: string;
  title?: string;
  kind?: string;
  content?: string;
};

export const updateDocument = ({ session, dataStream }: UpdateDocumentProps): Tool<UpdateDocumentInput, UpdateDocumentOutput> =>
  tool({
    description: 'Update a document with the given description.',
    inputSchema: updateDocumentSchema,
    execute: async (input: UpdateDocumentInput, options: ToolCallOptions): Promise<UpdateDocumentOutput> => {
      const { id, description } = input;
      const document = await getDocumentById({ id });

      if (!document) {
        return {
          error: 'Document not found',
        };
      }

      dataStream.write?.({
        type: 'clear',
        content: document.title,
      });

      const documentHandler = documentHandlersByArtifactKind.find(
        (documentHandlerByArtifactKind) =>
          documentHandlerByArtifactKind.kind === document.kind,
      );

      if (!documentHandler) {
        throw new Error(`No document handler found for kind: ${document.kind}`);
      }

      await documentHandler.onUpdateDocument({
        document,
        description,
        dataStream,
        session,
      });

      dataStream.write?.({ type: 'finish', content: '' });

      return {
        id,
        title: document.title,
        kind: document.kind,
        content: 'The document has been updated successfully.',
      };
    },
  } as any);
