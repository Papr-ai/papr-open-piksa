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
  conversationContext: z.string().optional().describe('IMPORTANT: Full context from the chat conversation including character details, plot points, and story elements discussed. This ensures the document content matches what was established in the conversation.'),
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
      'Create a document artifact for writing or content creation. Parameters: "title" (string) for the document title, "kind" (string) which must be one of: "text", "image", "sheet", or "memory". NOTE: For books and chapters, use the createBook tool instead.',
    inputSchema: createDocumentSchema,
    execute: async (input: CreateDocumentInput, options: ToolCallOptions): Promise<CreateDocumentOutput> => {
      const { title, kind, conversationContext } = input;
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

      // Validate and enhance title with conversation context if provided
      if (conversationContext) {
        console.log(`[createDocument] ✅ Using conversation context for "${title}" (${conversationContext.length} chars)`);
        console.log(`[createDocument] Context preview: ${conversationContext.substring(0, 200)}...`);
      } else {
        console.error(`[createDocument] 🚨 CRITICAL ERROR: No conversation context provided for "${title}"`);
        console.error('[createDocument] This will result in character details being lost or changed!');
        console.error('[createDocument] The AI should extract conversation context before calling this tool.');
        console.error('[createDocument] Document may not match what was discussed in chat.');
      }

      const enhancedTitle = conversationContext 
        ? `${title}\n\nContext from conversation: ${conversationContext}`
        : title;

      await documentHandler.onCreateDocument({
        id,
        title: enhancedTitle,
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
