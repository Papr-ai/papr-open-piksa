import { cookies } from 'next/headers';
import { redirect } from 'next/navigation';
import { auth } from '@/app/(auth)/auth';
import { getUser, getChatById } from '@/lib/db/queries';
import { getBookChaptersByBookId } from '@/lib/db/book-queries';
import { Chat } from '@/components/message/chat';
import { BookBreadcrumbWrapper } from '@/components/book/book-breadcrumb-wrapper';
import { DEFAULT_CHAT_MODEL } from '@/lib/ai/models';

interface BookPageProps {
  params: Promise<{
    id: string;
  }>;
}

export default async function BookPage({ params }: BookPageProps) {
  // Check authentication and onboarding status
  const session = await auth();
  
  if (!session?.user?.email) {
    redirect('/login');
  }

  const [dbUser] = await getUser(session.user.email);
  
  if (!dbUser) {
    redirect('/login');
  }

  // Check if onboarding is completed
  if (!dbUser.onboardingCompleted) {
    redirect('/onboarding');
  }

  const { id: bookId } = await params;

  // Get book details for breadcrumb
  const chapters = await getBookChaptersByBookId(bookId, dbUser.id);
  
  // If no chapters found, try to get book title from book_props
  let bookTitle = 'Unknown Book';
  if (chapters.length > 0) {
    bookTitle = chapters[0].bookTitle;
  } else {
    // Try to get book title from book_props table
    try {
      const { getBookPropsByBookId } = await import('@/lib/db/book-queries');
      const bookProps = await getBookPropsByBookId(bookId);
      if (bookProps.length > 0) {
        bookTitle = bookProps[0].bookTitle;
      }
    } catch (error) {
      console.error('Error fetching book props for title:', error);
    }
  }

  // Create or get a chat for this book
  // Use the bookId directly as the chatId since it's already a UUID
  const chatId = bookId;
  
  // Try to get existing chat, or create new one
  let chat = await getChatById({ id: chatId });
  if (!chat) {
    // Chat doesn't exist, it will be created when user sends first message
  }

  const cookieStore = await cookies();
  const modelIdFromCookie = cookieStore.get('model-id')?.value;
  const selectedModelId = modelIdFromCookie || DEFAULT_CHAT_MODEL;

  // Create initial messages to trigger book artifact if no chat exists
  const initialMessages = [
    {
      id: `book-init-${bookId}`,
      role: 'assistant' as const,
      parts: [
        {
          type: 'text' as const,
          text: chapters.length > 0 
            ? `I'll help you work on "${bookTitle}". Let me open your book for editing.`
            : `I found "${bookTitle}" but it doesn't have any chapters yet. Would you like me to help you create the first chapter?`
        }
      ],
      createdAt: new Date(),
      experimental_artifacts: chapters.length > 0 ? [
        {
          kind: 'book' as const,
          title: bookTitle,
          content: JSON.stringify({
            bookId,
            bookTitle,
            chapterNumber: 1,
            content: chapters[0].content
          })
        }
      ] : []
    }
  ];

  return (
    <BookBreadcrumbWrapper bookTitle={bookTitle}>
      <Chat
        id={chatId}
        initialMessages={initialMessages}
        selectedChatModel={selectedModelId}
        selectedVisibilityType="private"
        isReadonly={false}
        documentId={bookId} // Pass bookId as documentId for context
      />
    </BookBreadcrumbWrapper>
  );
}
