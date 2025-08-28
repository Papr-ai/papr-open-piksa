'use client';

import { memo } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { DownloadIcon, CopyIcon } from '@/components/common/icons';
import { toast } from 'sonner';

interface ImageEditResultProps {
  result: {
    id: string;
    originalImageUrl: string;
    editedImageUrl: string;
    prompt: string;
    editType: string;
    preserveOriginal: boolean;
    context?: string;
  };
  isReadonly?: boolean;
}

function PureImageEditResult({ result, isReadonly = false }: ImageEditResultProps) {
  const { originalImageUrl, editedImageUrl, prompt, editType, preserveOriginal, context } = result;

  const handleDownload = () => {
    const link = document.createElement('a');
    link.href = editedImageUrl;
    link.download = `edited-image-${editType}.png`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    toast.success('Edited image downloaded!');
  };

  const handleCopyImage = async () => {
    try {
      // Convert base64 to blob
      const response = await fetch(editedImageUrl);
      const blob = await response.blob();
      
      await navigator.clipboard.write([
        new ClipboardItem({ 'image/png': blob })
      ]);
      
      toast.success('Edited image copied to clipboard!');
    } catch (error) {
      console.error('Failed to copy image:', error);
      toast.error('Failed to copy image');
    }
  };

  const getEditTypeEmoji = (type: string) => {
    const emojis = {
      modify: '✏️',
      add: '➕',
      remove: '➖',
      replace: '🔄',
      'style-change': '🎨'
    };
    return emojis[type as keyof typeof emojis] || '✨';
  };

  const getEditTypeLabel = (type: string) => {
    const labels = {
      modify: 'Modified',
      add: 'Added Elements',
      remove: 'Removed Elements',
      replace: 'Replaced Elements',
      'style-change': 'Style Changed'
    };
    return labels[type as keyof typeof labels] || 'Edited';
  };

  return (
    <Card className="w-full max-w-4xl mx-auto bg-white dark:bg-zinc-900 border border-gray-200 dark:border-zinc-700 shadow-sm">
      <CardContent className="p-4 space-y-4">
        {/* Header */}
        <div className="flex items-start justify-between">
          <div className="space-y-1">
            <div className="text-sm font-medium text-gray-900 dark:text-gray-100">
              {getEditTypeEmoji(editType)} Image Edit - {getEditTypeLabel(editType)}
            </div>
            {preserveOriginal && (
              <div className="text-xs text-gray-600 dark:text-gray-400">
                Original composition preserved
              </div>
            )}
          </div>
          <Badge variant="secondary" className="text-xs">
            {editType}
          </Badge>
        </div>

        {/* Before/After Images */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {/* Original Image */}
          <div className="space-y-2">
            <div className="text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wide">
              Original
            </div>
            <div className="relative group">
              <img
                src={originalImageUrl}
                alt="Original image"
                className="w-full rounded-lg shadow-md border border-gray-200 dark:border-zinc-700"
                style={{ maxHeight: '400px', objectFit: 'contain' }}
              />
            </div>
          </div>

          {/* Edited Image */}
          <div className="space-y-2">
            <div className="text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wide">
              Edited Result
            </div>
            <div className="relative group">
              <img
                src={editedImageUrl}
                alt="Edited image"
                className="w-full rounded-lg shadow-md border-2 border-blue-200 dark:border-blue-700"
                style={{ maxHeight: '400px', objectFit: 'contain' }}
              />
              
              {/* Action buttons overlay */}
              {!isReadonly && (
                <div className="absolute top-2 right-2 opacity-0 group-hover:opacity-100 transition-opacity duration-200 flex gap-2">
                  <Button
                    size="sm"
                    variant="secondary"
                    onClick={handleCopyImage}
                    className="bg-white/90 dark:bg-zinc-800/90 backdrop-blur-sm"
                  >
                    <CopyIcon size={14} />
                  </Button>
                  <Button
                    size="sm"
                    variant="secondary"
                    onClick={handleDownload}
                    className="bg-white/90 dark:bg-zinc-800/90 backdrop-blur-sm"
                  >
                    <DownloadIcon size={14} />
                  </Button>
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Edit Details */}
        <div className="space-y-2">
          <div>
            <div className="text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wide mb-1">
              Edit Instructions
            </div>
            <div className="text-sm text-gray-700 dark:text-gray-300 bg-gray-50 dark:bg-zinc-800 rounded-md p-3">
              {prompt}
            </div>
          </div>
          
          {context && (
            <div>
              <div className="text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wide mb-1">
                Context
              </div>
              <div className="text-sm text-gray-700 dark:text-gray-300 bg-gray-50 dark:bg-zinc-800 rounded-md p-3">
                {context}
              </div>
            </div>
          )}
        </div>

        {/* Action buttons for readonly mode */}
        {!isReadonly && (
          <div className="flex gap-2 pt-2 border-t border-gray-200 dark:border-zinc-700">
            <Button
              size="sm"
              variant="outline"
              onClick={handleCopyImage}
              className="flex-1"
            >
              <CopyIcon size={14} className="mr-2" />
              Copy Edited Image
            </Button>
            <Button
              size="sm"
              variant="outline"
              onClick={handleDownload}
              className="flex-1"
            >
              <DownloadIcon size={14} className="mr-2" />
              Download Edited
            </Button>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

export const ImageEditResult = memo(PureImageEditResult, (prevProps, nextProps) => 
  prevProps.result === nextProps.result && prevProps.isReadonly === nextProps.isReadonly
);
