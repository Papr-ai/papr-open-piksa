import { memo } from 'react';
import { BookOpenIcon, FileIcon, PencilEditIcon } from '@/components/common/icons';
import { toast } from 'sonner';
import { useArtifact } from '@/hooks/use-artifact';

interface BookToolResultProps {
  result: { 
    id: string; 
    bookId?: string;
    bookTitle: string; 
    chapterTitle: string; 
    chapterNumber: number;
    content: string;
    saveError?: string;
    saved?: boolean;
  };
  isReadonly: boolean;
  chatId?: string;
}

function PureBookToolResult({
  result,
  isReadonly,
  chatId,
}: BookToolResultProps) {
  const { setArtifact } = useArtifact(chatId);

  // Safety check for result data
  if (!result?.bookTitle || !result?.chapterTitle) {
    return (
      <div className="bg-red-50 border border-red-200 rounded-xl p-3 text-sm text-red-700">
        Error: Invalid book data received
      </div>
    );
  }

  // Show error state if save failed
  if (result.saveError) {
    return (
      <div className="bg-red-50 border border-red-200 rounded-xl p-3 w-fit flex flex-row gap-3 items-start">
        <div className="text-red-600 mt-1">⚠️</div>
        <div className="text-left">
          <div className="font-medium text-red-800">Failed to Save Chapter</div>
          <div className="text-sm text-red-600">{result.chapterTitle}</div>
          <div className="text-xs text-red-500 mt-1">{result.saveError}</div>
        </div>
      </div>
    );
  }

  return (
    <button
      type="button"
      className={`bg-background cursor-pointer border py-2 px-3 rounded-xl w-fit flex flex-row gap-3 items-start ${
        result.saved ? 'border-green-200 bg-green-50' : 'border-gray-200'
      }`}
      onClick={(event) => {
        if (isReadonly) {
          toast.error(
            'Viewing books in shared chats is currently not supported.',
          );
          return;
        }

        const rect = event.currentTarget.getBoundingClientRect();

        const boundingBox = {
          top: rect.top,
          left: rect.left,
          width: rect.width,
          height: rect.height,
        };

        // Create a book artifact with the book title and content, including bookId
        const artifactContent = result.bookId 
          ? JSON.stringify({
              bookId: result.bookId,
              bookTitle: result.bookTitle,
              chapterNumber: result.chapterNumber,
              chapterTitle: result.chapterTitle,
              content: result.content
            })
          : `bookTitle: "${result.bookTitle}"\n\n# Chapter ${result.chapterNumber}: ${result.chapterTitle}\n\n${result.content}`;
        
        setArtifact({
          documentId: result.id,
          kind: 'book', // Use book kind to trigger book artifact
          content: artifactContent,
          title: result.bookTitle,
          isVisible: true,
          status: 'idle',
          boundingBox,
        });
      }}
    >
      <div className="text-muted-foreground mt-1">
        <BookOpenIcon />
      </div>
      <div className="text-left">
        <div className="font-medium">
          {result.bookTitle}
        </div>
        <div className="text-sm text-muted-foreground">
          {result.chapterTitle} (Chapter {result.chapterNumber})
        </div>
        <div className="text-xs text-muted-foreground mt-1 flex items-center gap-1">
          {result.saved && <span className="text-green-600">✓ Saved</span>}
          <span>Click to open book</span>
        </div>
      </div>
    </button>
  );
}

export const BookToolResult = memo(PureBookToolResult, (prevProps, nextProps) => 
  prevProps.result === nextProps.result && 
  prevProps.isReadonly === nextProps.isReadonly &&
  prevProps.chatId === nextProps.chatId
);

interface BookToolCallProps {
  args: { bookTitle: string; chapterTitle: string; chapterNumber: number };
  isReadonly: boolean;
}

function PureBookToolCall({
  args,
  isReadonly,
}: BookToolCallProps) {
  return (
    <div className="w-fit border py-2 px-3 rounded-xl flex flex-row items-start gap-3">
      <div className="text-zinc-500 mt-1">
        <BookOpenIcon />
      </div>
      <div className="text-left">
        <div className="font-medium">
          Creating {args.bookTitle}
        </div>
        <div className="text-sm text-muted-foreground">
          {args.chapterTitle} (Chapter {args.chapterNumber})
        </div>
      </div>
      <div className="animate-spin mt-1">
        <div className="w-4 h-4 border-2 border-gray-300 border-t-gray-600 rounded-full"></div>
      </div>
    </div>
  );
}

export const BookToolCall = memo(PureBookToolCall, () => true);
