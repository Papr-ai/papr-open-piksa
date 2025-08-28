import { tool } from 'ai';
import { z } from 'zod';
import type { Session } from 'next-auth';
import { db } from '@/lib/db/db';
import { sql } from 'drizzle-orm';

interface SearchBooksProps {
  session: Session;
}

const searchBooksSchema = z.object({
  bookTitle: z.string().optional().describe('Optional book title to search for. If not provided, returns all books for the user.'),
});

type SearchBooksInput = z.infer<typeof searchBooksSchema>;
type SearchBooksOutput = {
  books: Array<{
    bookId: string;
    bookTitle: string;
    chapterCount: number;
    lastChapterNumber: number;
    lastUpdated: string;
  }>;
};

export const searchBooks = ({ session }: SearchBooksProps) =>
  tool({
    description:
      'Search for existing books by the user. Use this before creating book chapters to check if a book already exists. This ensures chapters are added to the correct existing book rather than creating duplicate books.',
    inputSchema: searchBooksSchema,
    execute: async (input: SearchBooksInput): Promise<SearchBooksOutput> => {
      const { bookTitle } = input;

      if (!session?.user?.id) {
        console.error('[searchBooks] Unauthorized: No user session');
        return { books: [] };
      }

      try {
        console.log(`[searchBooks] Searching books for user ${session.user.id}, title: "${bookTitle || 'all'}"`);

        if (bookTitle) {
          // Get all latest chapters for a specific book by title
          const chapters = await db.execute(
            sql`SELECT * FROM "Books" 
                WHERE "bookTitle" = ${bookTitle} 
                AND "userId" = ${session.user.id} 
                AND "is_latest" = true
                ORDER BY "chapterNumber"`
          );

          console.log(`[searchBooks] Found ${chapters.length} chapters for "${bookTitle}"`);

          if (chapters.length > 0) {
            // Group chapters by bookId
            const bookGroups = chapters.reduce((acc: any, chapter: any) => {
              const key = String(chapter.bookId);
              if (!acc[key]) {
                acc[key] = {
                  bookId: String(chapter.bookId),
                  bookTitle: String(chapter.bookTitle),
                  chapters: [],
                };
              }
              acc[key].chapters.push(chapter);
              return acc;
            }, {});

            // Convert to result format
            const books = Object.values(bookGroups).map((book: any) => ({
              bookId: String(book.bookId),
              bookTitle: String(book.bookTitle),
              chapterCount: book.chapters.length,
              lastChapterNumber: Math.max(...book.chapters.map((c: any) => c.chapterNumber || 1)),
              lastUpdated: new Date(Math.max(...book.chapters.map((c: any) => new Date(c.updatedAt || c.createdAt).getTime()))).toISOString(),
            }));

            return { books };
          }
        } else {
          // Get all books (distinct book titles with their bookIds)
          const books = await db.execute(
            sql`SELECT DISTINCT "bookId", "bookTitle", MAX("createdAt") as "createdAt",
                       COUNT(*) as "chapterCount", 
                       MAX("chapterNumber") as "lastChapterNumber"
                FROM "Books" 
                WHERE "userId" = ${session.user.id} 
                AND "is_latest" = true
                GROUP BY "bookId", "bookTitle"
                ORDER BY "createdAt" DESC`
          );

          console.log(`[searchBooks] Found ${books.length} books for user`);

          const formattedBooks = books.map((item: any) => ({
            bookId: String(item.bookId),
            bookTitle: String(item.bookTitle),
            chapterCount: Number(item.chapterCount) || 1,
            lastChapterNumber: Number(item.lastChapterNumber) || 1,
            lastUpdated: new Date(item.createdAt).toISOString(),
          }));

          return { books: formattedBooks };
        }

        return { books: [] };
      } catch (error) {
        console.error('[searchBooks] Error:', error);
        return { books: [] };
      }
    },
  });
