import React from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { CheckCircle, Clock, BookOpen, FileText, List, AlertCircle } from 'lucide-react';

interface ChapterDraftResultProps {
  result: {
    success: boolean;
    bookId: string;
    chapterNumber: number;
    chapterTitle: string;
    content: string;
    wordCount: number;
    keyEvents: string[];
    nextStep: string;
    approvalRequired: boolean;
    message?: string;
  };
  isReadonly?: boolean;
}

export function ChapterDraftResult({ result, isReadonly = false }: ChapterDraftResultProps) {
  if (!result.success) {
    return (
      <Card className="border-red-200 bg-red-50">
        <CardContent className="p-4">
          <div className="flex items-center gap-2 text-red-700">
            <AlertCircle className="w-5 h-5" />
            <span className="font-medium">Chapter Draft Failed</span>
          </div>
          <p className="text-sm text-red-600 mt-2">{result.message}</p>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="border-blue-200 bg-blue-50">
      <CardHeader className="pb-3">
        <CardTitle className="flex items-center gap-2 text-blue-900">
          <FileText className="w-5 h-5" />
          Chapter {result.chapterNumber} Draft Created
        </CardTitle>
        <div className="flex flex-wrap items-center gap-2">
          <Badge variant="outline" className="bg-white">
            {result.chapterTitle}
          </Badge>
          <Badge variant="secondary">
            {result.wordCount} words
          </Badge>
        </div>
      </CardHeader>
      
      <CardContent className="space-y-4">
        {/* Chapter Content */}
        <div className="bg-white rounded-lg p-4 border">
          <div className="flex items-center gap-2 mb-3">
            <BookOpen className="w-4 h-4 text-blue-600" />
            <span className="font-medium text-gray-900">Chapter Content</span>
          </div>
          <div className="prose prose-sm max-w-none">
            <div className="text-gray-700 leading-relaxed whitespace-pre-wrap">
              {result.content}
            </div>
          </div>
        </div>

        {/* Key Events */}
        <div className="bg-white rounded-lg p-3">
          <div className="flex items-center gap-2 mb-3">
            <List className="w-4 h-4 text-green-600" />
            <span className="font-medium text-gray-900">Key Story Events</span>
            <Badge variant="outline">{result.keyEvents.length}</Badge>
          </div>
          <div className="space-y-2">
            {result.keyEvents.map((event, index) => (
              <div key={index} className="flex items-start gap-2 p-2 bg-gray-50 rounded">
                <div className="w-5 h-5 bg-green-100 rounded-full flex items-center justify-center flex-shrink-0 mt-0.5">
                  <span className="text-xs font-medium text-green-700">{index + 1}</span>
                </div>
                <span className="text-sm text-gray-700">{event}</span>
              </div>
            ))}
          </div>
        </div>

        {/* Next Steps */}
        <div className="bg-yellow-50 rounded-lg p-3 border border-yellow-200">
          <div className="flex items-center gap-2 mb-2">
            <Clock className="w-4 h-4 text-yellow-600" />
            <span className="font-medium text-yellow-900">Next Step</span>
          </div>
          <p className="text-sm text-yellow-800">{result.nextStep}</p>
          {result.approvalRequired && (
            <div className="mt-2 flex items-center gap-2 text-xs text-yellow-700">
              <CheckCircle className="w-3 h-3" />
              Approval required before proceeding to scene segmentation
            </div>
          )}
        </div>

        {/* Chapter Statistics */}
        <div className="bg-gray-50 rounded-lg p-3">
          <div className="text-sm font-medium text-gray-700 mb-2">Chapter Statistics</div>
          <div className="grid grid-cols-2 gap-4 text-sm">
            <div>
              <span className="text-gray-500">Word Count:</span>
              <span className="ml-1 font-medium">{result.wordCount}</span>
            </div>
            <div>
              <span className="text-gray-500">Key Events:</span>
              <span className="ml-1 font-medium">{result.keyEvents.length}</span>
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
