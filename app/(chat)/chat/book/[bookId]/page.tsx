import { redirect } from 'next/navigation';
import { auth } from '@/app/(auth)/auth';
import { getUser } from '@/lib/db/queries';
import { Chat } from '@/components/message/chat';
import { DEFAULT_CHAT_MODEL } from '@/lib/ai/models';
import { ChatBreadcrumb } from '@/components/chat/chat-breadcrumb';
import { generateUUID } from '@/lib/utils';

type PageProps = {
  params: Promise<{ bookId: string }>;
};

export default async function BookChatPage({ params }: PageProps) {
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

  const resolvedParams = await params;
  const { bookId } = resolvedParams;

  console.log('[BookChatPage] Resolved params:', { bookId, resolvedParams });

  // Create a new chat for the book workflow
  const chatId = generateUUID();
  const selectedModel = DEFAULT_CHAT_MODEL;

  // Get book details for the title
  let bookTitle = 'Book Workflow';
  try {
    const { getWorkflowFromDatabase } = await import('@/lib/ai/tools/unified-book-creation');
    const workflowState = await getWorkflowFromDatabase(bookId, session);
    if (workflowState?.bookTitle) {
      bookTitle = workflowState.bookTitle;
    }
  } catch (error) {
    console.error('Error fetching book details:', error);
  }

  return (
    <>
      <ChatBreadcrumb title={`${bookTitle} - Workflow`} chatId={chatId} />
      <Chat
        id={chatId}
        initialMessages={[]}
        selectedChatModel={selectedModel}
        selectedVisibilityType="private"
        isReadonly={false}
        documentId={undefined}
        bookId={bookId} // This will trigger automatic artifact opening
      />
    </>
  );
}
