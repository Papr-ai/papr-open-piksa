'use client';

import React, { createContext, useContext, ReactNode } from 'react';

interface BookContextType {
  isFullPageImage: boolean;
  storyContext?: string;
  bookId?: string;
  bookTitle?: string;
}

const BookContext = createContext<BookContextType>({
  isFullPageImage: false,
  storyContext: undefined,
  bookId: undefined,
  bookTitle: undefined,
});

interface BookContextProviderProps {
  children: ReactNode;
  isFullPageImage?: boolean;
  storyContext?: string;
  bookId?: string;
  bookTitle?: string;
}

export function BookContextProvider({ 
  children, 
  isFullPageImage = false,
  storyContext,
  bookId,
  bookTitle
}: BookContextProviderProps) {
  return (
    <BookContext.Provider value={{ isFullPageImage, storyContext, bookId, bookTitle }}>
      {children}
    </BookContext.Provider>
  );
}

export function useBookContext() {
  return useContext(BookContext);
}
