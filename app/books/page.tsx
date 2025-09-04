import { cookies } from 'next/headers';
import { redirect } from 'next/navigation';
import { auth } from '@/app/(auth)/auth';
import { getUser } from '@/lib/db/queries';
import { BookCreationDashboard } from '@/components/book/book-creation-dashboard';

export default async function BooksPage() {
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

  return (
    <div className="min-h-screen">
      <BookCreationDashboard />
    </div>
  );
}
