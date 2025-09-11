import { tool } from 'ai';
import { z } from 'zod';
import type { Session } from 'next-auth';
import type { DataStreamWriter } from '@/lib/types';
import { getBookPropsByBookId, getBookPropsByUserIdAndType } from '@/lib/db/book-queries';

interface SearchBookPropsProps {
  session: Session;
  dataStream?: DataStreamWriter;
}

const searchBookPropsSchema = z.object({
  bookId: z.string().optional().describe('Specific book ID to search props for. If provided, returns all props for that book.'),
  bookTitle: z.string().optional().describe('Book title to search props for. Alternative to bookId.'),
  type: z.enum(['character', 'environment', 'object', 'illustration', 'prop']).optional().describe('Filter by prop type. If not provided, returns all types.'),
});

type SearchBookPropsInput = z.infer<typeof searchBookPropsSchema>;

type SearchBookPropsOutput = {
  props: Array<{
    id: string;
    bookId: string;
    bookTitle: string;
    type: string;
    name: string;
    description?: string;
    hasImage: boolean;
    imageUrl?: string;
    metadata?: any;
    createdAt: string;
  }>;
  summary: {
    totalProps: number;
    characters: number;
    illustrations: number;
    environments: number;
    objects: number;
    other: number;
  };
};

export const searchBookProps = ({ session, dataStream }: SearchBookPropsProps) =>
  tool({
    description: `Search for book props (characters, illustrations, environments, objects) for existing books. 
    This is useful to:
    - See what characters exist for a book before creating new ones
    - Find existing illustrations for a book
    - Check available environments and objects
    - Get context about book assets before generating new content
    
    Use this when working on books to understand what assets already exist.`,
    inputSchema: searchBookPropsSchema,
    execute: async (input: SearchBookPropsInput): Promise<SearchBookPropsOutput> => {
      const { bookId, bookTitle, type } = input;

      if (!session?.user?.id) {
        console.error('[searchBookProps] Unauthorized: No user session');
        return { props: [], summary: { totalProps: 0, characters: 0, illustrations: 0, environments: 0, objects: 0, other: 0 } };
      }

      try {
        console.log(`[searchBookProps] Searching props for user ${session.user.id}`, { bookId, bookTitle, type });

        // Send search start update
        dataStream?.write?.({
          type: 'search-book-props-start',
          content: {
            searchType: bookId ? 'bookId' : bookTitle ? 'bookTitle' : type ? 'type' : 'all',
            searchValue: bookId || bookTitle || type || 'all props',
            userId: session.user.id
          }
        });

        let props: any[] = [];

        if (bookId) {
          // Get props for specific book
          props = await getBookPropsByBookId(bookId);
          console.log(`[searchBookProps] Found ${props.length} props for bookId: ${bookId}`);
        } else if (bookTitle) {
          // First find books with this title, then get their props
          const { searchBooks } = await import('./search-books');
          const searchBooksTool = searchBooks({ session });
          
          if (!searchBooksTool.execute) {
            console.error('[searchBookProps] Search books tool execute method not available');
            return { 
              props: [], 
              summary: { totalProps: 0, characters: 0, illustrations: 0, environments: 0, objects: 0, other: 0 } 
            };
          }
          
          const searchBooksResult = await searchBooksTool.execute({ bookTitle }, { toolCallId: 'search-' + Date.now(), messages: [] });
          
          if (searchBooksResult && 'books' in searchBooksResult && searchBooksResult.books.length > 0) {
            // Get props for the first matching book
            const matchingBook = searchBooksResult.books[0];
            props = await getBookPropsByBookId(matchingBook.bookId);
            console.log(`[searchBookProps] Found ${props.length} props for bookTitle: "${bookTitle}"`);
          }
        } else if (type) {
          // Get all props of specific type for user
          props = await getBookPropsByUserIdAndType(session.user.id, type);
          console.log(`[searchBookProps] Found ${props.length} props of type: ${type}`);
        } else {
          // Get all props for user (this might be expensive, so we limit it)
          const { getBookPropsByUserId } = await import('@/lib/db/book-queries');
          props = await getBookPropsByUserId(session.user.id);
          console.log(`[searchBookProps] Found ${props.length} total props for user`);
        }

        // Filter by type if specified
        if (type && (bookId || bookTitle)) {
          props = props.filter(prop => prop.type === type);
          console.log(`[searchBookProps] Filtered to ${props.length} props of type: ${type}`);
        }

        // Format the response
        const formattedProps = props.map(prop => ({
          id: prop.id,
          bookId: prop.bookId,
          bookTitle: prop.bookTitle,
          type: prop.type,
          name: prop.name,
          description: prop.description || undefined,
          hasImage: !!prop.imageUrl,
          imageUrl: prop.imageUrl || undefined,
          metadata: prop.metadata || undefined,
          createdAt: prop.createdAt.toISOString(),
        }));

        // Calculate summary
        const summary = {
          totalProps: formattedProps.length,
          characters: formattedProps.filter(p => p.type === 'character').length,
          illustrations: formattedProps.filter(p => p.type === 'illustration').length,
          environments: formattedProps.filter(p => p.type === 'environment').length,
          objects: formattedProps.filter(p => p.type === 'object').length,
          other: formattedProps.filter(p => !['character', 'illustration', 'environment', 'object'].includes(p.type)).length,
        };

        console.log(`[searchBookProps] Summary:`, summary);

        // Send completion update
        dataStream?.write?.({
          type: 'search-book-props-complete',
          content: {
            totalProps: formattedProps.length,
            summary,
            searchType: bookId ? 'bookId' : bookTitle ? 'bookTitle' : type ? 'type' : 'all',
            searchValue: bookId || bookTitle || type || 'all props'
          }
        });

        return {
          props: formattedProps,
          summary
        };
      } catch (error) {
        console.error('[searchBookProps] Error:', error);
        return { 
          props: [], 
          summary: { totalProps: 0, characters: 0, illustrations: 0, environments: 0, objects: 0, other: 0 } 
        };
      }
    },
  });
