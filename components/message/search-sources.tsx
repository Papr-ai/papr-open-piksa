'use client';

import { useState } from 'react';

interface SearchSource {
  title: string;
  url: string;
  snippet?: string;
}

interface SearchSourcesProps {
  sources: SearchSource[];
}

export function SearchSources({ sources }: SearchSourcesProps) {
  const [currentIndex, setCurrentIndex] = useState(0);
  
  if (!sources || sources.length === 0) {
    return null;
  }

  // Filter out sources with placeholder URLs and limit to reasonable number
  const validSources = sources
    .filter(source => source.url && source.url !== '#')
    .slice(0, 6); // Limit to 6 sources for better UX

  if (validSources.length === 0) {
    return null;
  }

  const nextSource = () => {
    setCurrentIndex((prev) => (prev + 1) % validSources.length);
  };

  const prevSource = () => {
    setCurrentIndex((prev) => (prev - 1 + validSources.length) % validSources.length);
  };

  const currentSource = validSources[currentIndex];

  return (
    <div className="mt-4 p-4 bg-gradient-to-r from-blue-50 to-indigo-50 dark:from-blue-950/30 dark:to-indigo-950/30 border border-blue-200 dark:border-blue-800 rounded-lg">
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2">
          <svg
            width="16"
            height="16"
            viewBox="0 0 20 20"
            fill="none"
            xmlns="http://www.w3.org/2000/svg"
            className="text-blue-600 dark:text-blue-400"
          >
            <circle cx="10" cy="10" r="8" stroke="currentColor" strokeWidth="1.5" fill="none" />
            <path
              d="M2 10h16M10 2a15.3 15.3 0 0 1 4 8 15.3 15.3 0 0 1-4 8 15.3 15.3 0 0 1-4-8 15.3 15.3 0 0 1 4-8z"
              stroke="currentColor"
              strokeWidth="1.5"
              fill="none"
            />
          </svg>
          <span className="text-sm font-semibold text-blue-700 dark:text-blue-300">
            Sources ({currentIndex + 1} of {validSources.length})
          </span>
        </div>
        
        {validSources.length > 1 && (
          <div className="flex items-center gap-1">
            <button
              onClick={prevSource}
              className="p-1 rounded-md hover:bg-blue-100 dark:hover:bg-blue-800/50 text-blue-600 dark:text-blue-400 transition-colors"
              aria-label="Previous source"
            >
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none">
                <path d="M15 18l-6-6 6-6" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
              </svg>
            </button>
            <button
              onClick={nextSource}
              className="p-1 rounded-md hover:bg-blue-100 dark:hover:bg-blue-800/50 text-blue-600 dark:text-blue-400 transition-colors"
              aria-label="Next source"
            >
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none">
                <path d="M9 18l6-6-6-6" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
              </svg>
            </button>
          </div>
        )}
      </div>
      
      <div className="bg-white dark:bg-gray-800/50 rounded-md border border-gray-200 dark:border-gray-700 p-4">
        <a
          href={currentSource.url}
          target="_blank"
          rel="noopener noreferrer"
          className="text-blue-600 dark:text-blue-400 hover:text-blue-800 dark:hover:text-blue-300 font-medium text-base leading-snug block hover:underline mb-2"
        >
          {currentSource.title}
        </a>
        
        {currentSource.snippet && currentSource.snippet !== currentSource.title && (
          <p className="text-gray-600 dark:text-gray-400 text-sm leading-relaxed mb-3">
            {currentSource.snippet.length > 200 ? `${currentSource.snippet.slice(0, 200)}...` : currentSource.snippet}
          </p>
        )}
        
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-1">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" className="text-gray-400">
              <path d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
            </svg>
            <span className="text-sm text-gray-500 dark:text-gray-400">
              {new URL(currentSource.url).hostname}
            </span>
          </div>
          
          {validSources.length > 1 && (
            <div className="flex gap-1">
              {validSources.map((_, index) => (
                <button
                  key={index}
                  onClick={() => setCurrentIndex(index)}
                  className={`w-2 h-2 rounded-full transition-colors ${
                    index === currentIndex 
                      ? 'bg-blue-500 dark:bg-blue-400' 
                      : 'bg-gray-300 dark:bg-gray-600 hover:bg-blue-300 dark:hover:bg-blue-500'
                  }`}
                  aria-label={`Go to source ${index + 1}`}
                />
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
