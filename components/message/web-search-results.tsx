'use client';

import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';

interface GroundingSupport {
  segment: {
    startIndex: number;
    endIndex: number;
    text: string;
  };
  groundingChunkIndices: number[];
  confidenceScores?: number[];
}

interface GroundingMetadata {
  webSearchQueries?: string[];
  groundingSupports?: GroundingSupport[];
  searchEntryPoint?: {
    renderedContent: string;
  };
}

interface WebSearchResultsProps {
  groundingMetadata: GroundingMetadata;
}

export function WebSearchResults({ groundingMetadata }: WebSearchResultsProps) {
  const [isExpanded, setIsExpanded] = useState(false);

  if (!groundingMetadata || (!groundingMetadata.webSearchQueries && !groundingMetadata.groundingSupports)) {
    return null;
  }

  const { webSearchQueries, groundingSupports, searchEntryPoint } = groundingMetadata;

  return (
    <Card className="mt-4 border-blue-200 bg-blue-50 dark:border-blue-800 dark:bg-blue-950/30">
      <CardContent className="p-4">
        <div className="flex items-center justify-between mb-2">
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
            <span className="text-sm font-medium text-blue-700 dark:text-blue-300">
              Web Search Results
            </span>
          </div>
          <Button
            variant="ghost"
            size="sm"
            onClick={() => setIsExpanded(!isExpanded)}
            className="text-blue-600 hover:text-blue-700 dark:text-blue-400 dark:hover:text-blue-300"
          >
            {isExpanded ? 'Hide' : 'Show'} Details
          </Button>
        </div>

        {/* Search Queries */}
        {webSearchQueries && webSearchQueries.length > 0 && (
          <div className="mb-3">
            <div className="text-xs font-medium text-blue-600 dark:text-blue-400 mb-1">
              Search Queries:
            </div>
            <div className="flex flex-wrap gap-1">
              {webSearchQueries.map((query, index) => (
                <span
                  key={index}
                  className="px-2 py-1 text-xs bg-blue-100 dark:bg-blue-900/50 text-blue-800 dark:text-blue-200 rounded-md"
                >
                  &ldquo;{query}&rdquo;
                </span>
              ))}
            </div>
          </div>
        )}

        {/* Grounding Information Summary */}
        {groundingSupports && groundingSupports.length > 0 && (
          <div className="text-xs text-blue-600 dark:text-blue-400">
            Found {groundingSupports.length} source{groundingSupports.length !== 1 ? 's' : ''} to support this response
          </div>
        )}

        {/* Expanded Details */}
        {isExpanded && (
          <div className="mt-3 pt-3 border-t border-blue-200 dark:border-blue-800">
            {/* Search Entry Point */}
            {searchEntryPoint?.renderedContent && (
              <div className="mb-3">
                <div className="text-xs font-medium text-blue-600 dark:text-blue-400 mb-1">
                  Search Context:
                </div>
                <div className="text-xs text-gray-600 dark:text-gray-400 bg-white dark:bg-gray-900/50 p-2 rounded border max-h-32 overflow-y-auto">
                  {searchEntryPoint.renderedContent}
                </div>
              </div>
            )}

            {/* Grounding Supports */}
            {groundingSupports && groundingSupports.length > 0 && (
              <div>
                <div className="text-xs font-medium text-blue-600 dark:text-blue-400 mb-2">
                  Source References:
                </div>
                <div className="space-y-2">
                  {groundingSupports.map((support, index) => (
                    <div
                      key={index}
                      className="text-xs bg-white dark:bg-gray-900/50 p-2 rounded border"
                    >
                      <div className="font-medium text-gray-700 dark:text-gray-300 mb-1">
                        &ldquo;{support.segment.text}&rdquo;
                      </div>
                      {support.confidenceScores && support.confidenceScores.length > 0 && (
                        <div className="text-gray-500 dark:text-gray-400">
                          Confidence: {Math.round((support.confidenceScores[0] || 0) * 100)}%
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
