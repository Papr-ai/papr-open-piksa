import React from 'react';
import { redirect } from 'next/navigation';
import { auth } from '@/app/(auth)/auth';
import { MemoriesNav } from '@/components/memory/memories-nav';

export default async function MemoriesLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const session = await auth();

  if (!session?.user) {
    redirect('/login');
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
