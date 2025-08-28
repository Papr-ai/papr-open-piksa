import { memo } from 'react';
import { BookOpenIcon, ClockIcon, HashIcon } from '@/components/common/icons';

interface SearchBooksResultsProps {
  searchResult: {
    books: Array<{
      bookId: string;
      bookTitle: string;
      chapterCount: number;
      lastChapterNumber: number;
      lastUpdated: string;
    }>;
  };
}

function PureSearchBooksResults({ searchResult }: SearchBooksResultsProps) {
  const { books } = searchResult;

  if (!books || books.length === 0) {
    return (
      <div className="bg-gray-50 border border-gray-200 rounded-xl p-3 w-fit flex flex-row gap-3 items-start">
        <div className="text-gray-600 mt-1">📚</div>
        <div className="text-left">
          <div className="font-medium text-gray-800">No Books Found</div>
          <div className="text-sm text-gray-600">No existing books found for this user</div>
        </div>
      </div>
    );
  }

  return (
    <div className="bg-blue-50 border border-blue-200 rounded-xl p-3 w-fit max-w-2xl">
      <div className="flex flex-row gap-3 items-start mb-3">
        <div className="text-blue-600 mt-1">📚</div>
        <div className="text-left">
          <div className="font-medium text-blue-800">Found {books.length} Book{books.length !== 1 ? 's' : ''}</div>
          <div className="text-sm text-blue-600">Existing books in your library</div>
        </div>
      </div>
      
      <div className="space-y-2">
        {books.map((book) => (
          <div
            key={book.bookId}
            className="bg-white border border-blue-100 rounded-lg p-3 flex flex-row gap-3 items-start"
          >
            <div className="text-blue-600 mt-1">
              <BookOpenIcon />
            </div>
            <div className="flex-1 text-left">
              <div className="font-medium text-gray-900">{book.bookTitle}</div>
              <div className="text-sm text-gray-600 flex items-center gap-4 mt-1">
                <span className="flex items-center gap-1">
                  <HashIcon className="w-3 h-3" />
                  {book.chapterCount} chapter{book.chapterCount !== 1 ? 's' : ''}
                </span>
                <span className="flex items-center gap-1">
                  <ClockIcon className="w-3 h-3" />
                  Last: Ch. {book.lastChapterNumber}
                </span>
              </div>
              <div className="text-xs text-gray-500 mt-1">
                Book ID: {book.bookId}
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

export const SearchBooksResults = memo(PureSearchBooksResults, () => true);
