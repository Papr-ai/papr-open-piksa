"use client";

import React from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';

export function MemoriesNav() {
  const pathname = usePathname();
  
  const tabs = [
    { name: 'All', href: '/memories' },
    { name: 'Chats', href: '/memories/chats' },
    { name: 'Collections', href: '/memories/collections' },
    { name: 'Pages', href: '/memories/pages' },
    { name: 'Code Projects', href: '/memories/code' },
  ];

  return (
    <div className="border-b">
      <div className="container mx-auto px-4">
        <div className="flex items-center justify-between py-4">
          <h1 className="text-2xl font-bold">Memories</h1>
        </div>
        <nav className="flex space-x-4">
          {tabs.map((tab) => {
            const isActive = pathname === tab.href;
            return (
              <Link
                key={tab.name}
                href={tab.href}
                className={`px-3 py-2 text-sm font-medium rounded-md ${
                  isActive
                    ? 'bg-gray-100 text-gray-900'
                    : 'text-gray-600 hover:text-gray-900'
                }`}
              >
                {tab.name}
              </Link>
            );
          })}
        </nav>
      </div>
    </div>
  );
} 