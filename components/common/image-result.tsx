'use client';

import { memo } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { DownloadIcon, CopyIcon } from '@/components/common/icons';
import { toast } from 'sonner';

interface ImageResultProps {
  result: {
    id: string;
    imageUrl: string;
    prompt: string;
    style: string;
    context?: string;
    title?: string;
    subtitle?: string;
  };
  isReadonly?: boolean;
}

function PureImageResult({ result, isReadonly = false }: ImageResultProps) {
  const { imageUrl, prompt, style, context, title, subtitle } = result;

  const handleDownload = () => {
    const link = document.createElement('a');
    link.href = imageUrl;
    link.download = `${title || 'generated'}-${subtitle || 'image'}.png`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    toast.success('Image downloaded!');
  };

  const handleCopyImage = async () => {
    try {
      // Convert base64 to blob
      const response = await fetch(imageUrl);
      const blob = await response.blob();
      
      await navigator.clipboard.write([
        new ClipboardItem({ 'image/png': blob })
      ]);
      
      toast.success('Image copied to clipboard!');
    } catch (error) {
      console.error('Failed to copy image:', error);
      toast.error('Failed to copy image');
    }
  };

  return (
    <Card className="w-full max-w-2xl mx-auto bg-white dark:bg-zinc-900 border border-gray-200 dark:border-zinc-700 shadow-sm">
      <CardContent className="p-4 space-y-4">
        {/* Header with context */}
        <div className="flex items-start justify-between">
          <div className="space-y-1">
            {title && (
              <div className="text-sm font-medium text-gray-900 dark:text-gray-100">
                🎨 {title}
              </div>
            )}
            {subtitle && (
              <div className="text-sm text-gray-600 dark:text-gray-400">
                {subtitle}
              </div>
            )}
          </div>
          <Badge variant="secondary" className="text-xs">
            {style}
          </Badge>
        </div>

        {/* Generated Image */}
        <div className="relative group">
          <img
            src={imageUrl}
            alt={prompt}
            className="w-full rounded-lg shadow-md hover:shadow-lg transition-shadow duration-200"
            style={{ maxHeight: '512px', objectFit: 'contain' }}
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

        {/* Prompt and Context */}
        <div className="space-y-2">
          <div>
            <div className="text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wide mb-1">
              Image Prompt
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
              Copy Image
            </Button>
            <Button
              size="sm"
              variant="outline"
              onClick={handleDownload}
              className="flex-1"
            >
              <DownloadIcon size={14} className="mr-2" />
              Download
            </Button>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

export const ImageResult = memo(PureImageResult, (prevProps, nextProps) => 
  prevProps.result === nextProps.result && prevProps.isReadonly === nextProps.isReadonly
);
