import { generateUUID } from '@/lib/utils';
import { tool, type Tool, type ToolCallOptions } from 'ai';
import type { DataStreamWriter } from '@/lib/types';
import { z } from 'zod';
import type { Session } from 'next-auth';
import {
  artifactKinds,
  documentHandlersByArtifactKind,
} from '@/lib/artifacts/server';

interface CreateDocumentProps {
  session: Session;
  dataStream: DataStreamWriter;
}

const createDocumentSchema = z.object({
  title: z.string(),
  kind: z.enum(artifactKinds),
});

type CreateDocumentInput = z.infer<typeof createDocumentSchema>;
type CreateDocumentOutput = {
  id: string;
  title: string;
  kind: string;
  content: string;
};

export const createDocument = ({ session, dataStream }: CreateDocumentProps): Tool<CreateDocumentInput, CreateDocumentOutput> =>
  tool({
    description:
      'Create a document artifact for writing or content creation. This tool takes exactly two parameters: "title" (string) for the document title, and "kind" (string) which must be one of: "text", "image", "sheet", or "memory". The tool will generate the document content and display it as an interactive artifact.',
    inputSchema: createDocumentSchema,
    execute: async (input: CreateDocumentInput, options: ToolCallOptions): Promise<CreateDocumentOutput> => {
      const { title, kind } = input;
      const id = generateUUID();

      dataStream.write?.({
        type: 'kind',
        content: kind,
      });

      dataStream.write?.({
        type: 'id',
        content: id,
      });

      dataStream.write?.({
        type: 'title',
        content: title,
      });

      dataStream.write?.({
        type: 'clear',
        content: '',
      });

      const documentHandler = documentHandlersByArtifactKind.find(
        (documentHandlerByArtifactKind) =>
          documentHandlerByArtifactKind.kind === kind,
      );

      if (!documentHandler) {
        throw new Error(`No document handler found for kind: ${kind}`);
      }

      await documentHandler.onCreateDocument({
        id,
        title,
        dataStream,
        session,
      });

      dataStream.write?.({ type: 'finish', content: '' });

      return {
        id,
        title,
        kind,
        content: 'A document was created and is now visible to the user.',
      };
    },
  });
