import { z } from 'zod';
import type { Session } from 'next-auth';
import { streamObject, tool, type Tool, type ToolCallOptions } from 'ai';
import type { DataStreamWriter } from '@/lib/types';
import { getDocumentById, saveSuggestions } from '@/lib/db/queries';
import type { Suggestion } from '@/lib/db/schema';
import { generateUUID } from '@/lib/utils';
import { myProvider } from '../providers';

interface RequestSuggestionsProps {
  session: Session;
  dataStream: DataStreamWriter;
}

const requestSuggestionsSchema = z.object({
  documentId: z
    .string()
    .describe('The ID of the document to request edits'),
});

type RequestSuggestionsInput = z.infer<typeof requestSuggestionsSchema>;
type RequestSuggestionsOutput = 
  | {
      error: string;
      id?: undefined;
      title?: undefined;
      kind?: undefined;
      message?: undefined;
    }
  | {
      id: string;
      title: string;
      kind: string;
      message: string;
      error?: undefined;
    };

export const requestSuggestions = ({
  session,
  dataStream,
}: RequestSuggestionsProps): Tool<RequestSuggestionsInput, RequestSuggestionsOutput> =>
  tool({
    description: 'Request suggestions for a document',
    inputSchema: requestSuggestionsSchema,
    execute: async (input: RequestSuggestionsInput, options: ToolCallOptions): Promise<RequestSuggestionsOutput> => {
      const { documentId } = input;
      try {
        console.log(`Requesting suggestions for document: ${documentId}`);

        const document = await getDocumentById({ id: documentId });

        if (!document || !document.content) {
          console.error(`Document not found or empty content: ${documentId}`);
          return {
            error: 'Document not found or has no content',
          };
        }

        console.log(
          `Document found, content length: ${document.content.length}`,
        );

        const suggestions: Array<
          Omit<Suggestion, 'userId' | 'createdAt' | 'documentCreatedAt'>
        > = [];

        try {
          const { elementStream } = streamObject({
            model: myProvider.languageModel('artifact-model'),
            system:
              'You are a help writing assistant. Given a piece of writing, please offer suggestions to improve the piece of writing and describe the change. It is very important for the edits to contain full sentences instead of just words. Max 5 suggestions.',
            prompt: document.content,
            output: 'array',
            schema: z.object({
              originalSentence: z.string().describe('The original sentence'),
              suggestedSentence: z.string().describe('The suggested sentence'),
              description: z
                .string()
                .describe('The description of the suggestion'),
            }),
          });

          for await (const element of elementStream) {
            console.log('Received suggestion element:', element);

            const suggestion = {
              originalText: element.originalSentence,
              suggestedText: element.suggestedSentence,
              description: element.description,
              id: generateUUID(),
              documentId: documentId,
              isResolved: false,
            };

            dataStream.write?.({
              type: 'data',
              data: {
                type: 'suggestion',
                content: suggestion,
              }
            });

            suggestions.push(suggestion);
          }
        } catch (error) {
          console.error('Error streaming suggestions:', error);
          return {
            error: 'Failed to generate suggestions',
          };
        }

        console.log(`Generated ${suggestions.length} suggestions`);

        if (session.user?.id) {
          const userId = session.user.id;

          try {
            await saveSuggestions({
              suggestions: suggestions.map((suggestion) => ({
                ...suggestion,
                userId,
                createdAt: new Date(),
                documentCreatedAt: document.createdAt,
              })),
            });
            console.log('Saved suggestions to database');
          } catch (error) {
            console.error('Error saving suggestions:', error);
          }
        }

        return {
          id: documentId,
          title: document.title,
          kind: document.kind,
          message: `${suggestions.length} suggestions have been added to the document`,
        };
      } catch (error) {
        console.error('Error in request-suggestions tool:', error);
        return {
          error: 'An error occurred while generating suggestions',
        };
      }
    },
  } as any);
