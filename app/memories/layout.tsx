import React from 'react';
import { redirect } from 'next/navigation';
import { auth } from '@/app/(auth)/auth';
import { getUser } from '@/lib/db/queries';
import { MemoriesNav } from '@/components/memory/memories-nav';

export default async function MemoriesLayout({
  children,
}: {
  children: React.ReactNode;
}) {
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
    <div className="min-h-screen bg-gray-50">
      <MemoriesNav />
      <div className="container mx-auto py-6 px-4">
        {children}
      </div>
    </div>
  );
}
