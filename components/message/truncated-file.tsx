'use client';

import { useState } from 'react';
import { Button } from '../ui/button';
import { CopyIcon } from '../icons';

interface EditSuggestion {
  message: string;
  action: string;
  repository: {
    owner: string;
    name: string;
  };
  filePath: string;
}

interface TruncatedFileDisplayProps {
  file: {
    name: string;
    size: number;
    content: string;
    path?: string;
  };
  maxLines?: number;
  editSuggestion?: EditSuggestion;
}

export function TruncatedFileDisplay({ 
  file, 
  maxLines = 10,
  editSuggestion 
}: TruncatedFileDisplayProps) {
  const [isExpanded, setIsExpanded] = useState(false);
  const lines = file.content.split('\n');
  const shouldTruncate = lines.length > maxLines;
  const displayLines = isExpanded ? lines : lines.slice(0, maxLines);
  
  return (
    <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 my-4">
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2">
          <svg className="w-5 h-5 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
          </svg>
          <h4 className="font-medium text-blue-800">{file.name}</h4>
          {file.path && (
            <span className="text-xs text-blue-600 bg-blue-100 px-2 py-1 rounded">
              {file.path}
            </span>
          )}
        </div>
        <div className="flex items-center gap-2">
          <span className="text-sm text-blue-600">{file.size} bytes</span>
          <span className="text-xs text-blue-500">
            {lines.length} lines
          </span>
        </div>
      </div>

      {/* Edit suggestion banner */}
      {editSuggestion && (
        <div className="bg-green-50 border border-green-200 rounded-lg p-3 mb-3">
          <div className="flex items-start gap-2">
            <svg className="w-5 h-5 text-green-600 mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
            <div className="flex-1">
              <p className="text-sm text-green-800 font-medium mb-1">💡 Editing Suggestion</p>
              <p className="text-sm text-green-700 mb-2">{editSuggestion.message}</p>
              <Button
                size="sm"
                variant="outline"
                onClick={() => {
                  const chatInput = document.querySelector('textarea[placeholder*="Ask"]') as HTMLTextAreaElement;
                  if (chatInput) {
                    chatInput.value = `Please open the GitHub file explorer for the ${editSuggestion.repository.owner}/${editSuggestion.repository.name} repository so I can edit the ${file.name} file with the full editing interface.`;
                    chatInput.focus();
                    const event = new Event('input', { bubbles: true });
                    chatInput.dispatchEvent(event);
                  }
                }}
                className="text-green-600 hover:text-green-800 bg-green-100 hover:bg-green-200"
              >
                <svg className="w-4 h-4 mr-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 20l4-16m4 4l4 4-4 4M6 16l-4-4 4-4" />
                </svg>
                Open GitHub File Explorer
              </Button>
            </div>
          </div>
        </div>
      )}
      
      <div className="relative">
        <pre className="bg-gray-900 text-gray-100 p-3 rounded-md overflow-x-auto text-sm">
          <code>{displayLines.join('\n')}</code>
        </pre>
        
        {shouldTruncate && (
          <div className="mt-2 flex items-center justify-between">
            <Button
              size="sm"
              variant="outline"
              onClick={() => setIsExpanded(!isExpanded)}
              className="text-blue-600 hover:text-blue-800"
            >
              {isExpanded ? (
                <>
                  <svg className="w-4 h-4 mr-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 15l7-7 7 7" />
                  </svg>
                  Show Less
                </>
              ) : (
                <>
                  <svg className="w-4 h-4 mr-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                  </svg>
                  Show More ({lines.length - maxLines} more lines)
                </>
              )}
            </Button>
            
            <div className="flex gap-2">
              <Button
                size="sm"
                variant="outline"
                onClick={() => navigator.clipboard.writeText(file.content)}
                className="text-gray-600 hover:text-gray-800"
              >
                <CopyIcon size={16} />
              </Button>
              <Button
                size="sm"
                variant="outline"
                onClick={() => {
                  const chatInput = document.querySelector('textarea[placeholder*="Ask"]') as HTMLTextAreaElement;
                  if (chatInput) {
                    chatInput.value = `Please open the GitHub file explorer so I can edit the ${file.name} file.`;
                    chatInput.focus();
                    const event = new Event('input', { bubbles: true });
                    chatInput.dispatchEvent(event);
                  }
                }}
                className="text-green-600 hover:text-green-800"
              >
                <svg className="w-4 h-4 mr-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                </svg>
                Edit in GitHub
              </Button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
} 