import { cn } from '@/lib/utils';
import { CheckCircleFillIcon, CopyIcon, DownloadIcon } from '../common/icons';
import { useState } from 'react';

interface MergedImagesResultProps {
  mergedImageUrl: string;
  gridLayout: Array<{
    position: string;
    spanRows: number;
    spanCols: number;
    dimensions?: { width: number; height: number; x: number; y: number };
    originalUrl?: string;
    imageUrl?: string; // For input format
  }>;
  dimensions: { width: number; height: number };
  processedImages: number;
  format: string;
  className?: string;
}

export function MergedImagesResult({
  mergedImageUrl,
  gridLayout,
  dimensions,
  processedImages,
  format,
  className,
}: MergedImagesResultProps) {
  const [copied, setCopied] = useState(false);

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(mergedImageUrl);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch (error) {
      console.error('Failed to copy URL:', error);
    }
  };

  const handleDownload = () => {
    const link = document.createElement('a');
    link.href = mergedImageUrl;
    link.download = `merged-image-${Date.now()}.${format}`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  return (
    <div className={cn('border rounded-lg overflow-hidden bg-white dark:bg-gray-900', className)}>
      {/* Header */}
      <div className="border-b p-4 bg-gray-50 dark:bg-gray-800">
        <div className="flex items-center justify-between">
          <div>
            <h3 className="font-semibold text-gray-900 dark:text-white">
              🎨 Images Merged Successfully
            </h3>
            <p className="text-sm text-gray-600 dark:text-gray-400">
              Combined {processedImages} images into {dimensions.width}×{dimensions.height} {format.toUpperCase()}
            </p>
          </div>
          <div className="flex gap-2">
            <button
              onClick={handleCopy}
              className="flex items-center gap-1 px-3 py-1 text-xs bg-blue-100 hover:bg-blue-200 dark:bg-blue-900 dark:hover:bg-blue-800 text-blue-700 dark:text-blue-300 rounded-md transition-colors"
            >
              {copied ? <CheckCircleFillIcon size={12} /> : <CopyIcon size={12} />}
              {copied ? 'Copied!' : 'Copy URL'}
            </button>
            <button
              onClick={handleDownload}
              className="flex items-center gap-1 px-3 py-1 text-xs bg-green-100 hover:bg-green-200 dark:bg-green-900 dark:hover:bg-green-800 text-green-700 dark:text-green-300 rounded-md transition-colors"
            >
              <DownloadIcon size={12} />
              Download
            </button>
          </div>
        </div>
      </div>

      {/* Main Content */}
      <div className="p-4">
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          {/* Merged Result */}
          <div className="space-y-2">
            <h4 className="font-medium text-gray-900 dark:text-white">Final Result</h4>
            <div className="border rounded-lg overflow-hidden">
              <img
                src={mergedImageUrl}
                alt="Merged result"
                className="w-full h-auto max-h-80 object-contain bg-gray-50 dark:bg-gray-800"
                loading="lazy"
              />
            </div>
            <div className="text-xs text-gray-500 dark:text-gray-400">
              Format: {format.toUpperCase()} • Size: {dimensions.width}×{dimensions.height}px
            </div>
          </div>

          {/* Input Images Grid */}
          <div className="space-y-2">
            <h4 className="font-medium text-gray-900 dark:text-white">Input Images ({processedImages})</h4>
            <div className="grid grid-cols-2 gap-2">
              {gridLayout.map((item, index) => {
                const imageUrl = item.originalUrl || item.imageUrl;
                return (
                  <div key={index} className="space-y-1">
                    <div className="border rounded-lg overflow-hidden">
                      <img
                        src={imageUrl}
                        alt={`Input image at ${item.position}`}
                        className="w-full h-24 object-cover bg-gray-50 dark:bg-gray-800"
                        loading="lazy"
                      />
                    </div>
                    <div className="text-xs text-gray-500 dark:text-gray-400">
                      Position: {item.position}
                      {(item.spanRows > 1 || item.spanCols > 1) && (
                        <span> • Span: {item.spanRows}×{item.spanCols}</span>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </div>

        {/* Grid Layout Visualization */}
        <div className="mt-4 pt-4 border-t">
          <h4 className="font-medium text-gray-900 dark:text-white mb-2">Grid Layout (4×4)</h4>
          <div className="grid grid-cols-4 gap-1 w-32 h-32 border rounded">
            {Array.from({ length: 16 }, (_, i) => {
              const row = Math.floor(i / 4) + 1;
              const col = (i % 4) + 1;
              const position = `${row}x${col}`;
              const hasImage = gridLayout.some(item => item.position === position);
              
              return (
                <div
                  key={i}
                  className={cn(
                    'border border-gray-200 dark:border-gray-700 text-xs flex items-center justify-center',
                    hasImage 
                      ? 'bg-blue-100 dark:bg-blue-900 text-blue-700 dark:text-blue-300' 
                      : 'bg-gray-50 dark:bg-gray-800 text-gray-400'
                  )}
                >
                  {hasImage ? '📷' : ''}
                </div>
              );
            })}
          </div>
        </div>

        {/* Usage Note */}
        <div className="mt-4 p-3 bg-blue-50 dark:bg-blue-900/20 rounded-lg">
          <p className="text-sm text-blue-700 dark:text-blue-300">
            💡 <strong>Ready for editing:</strong> This merged {format.toUpperCase()} image can now be used with the <code>editImage</code> tool to make further modifications, add effects, or change styles. The AI will automatically use the appropriate format for editing.
          </p>
        </div>
      </div>
    </div>
  );
}
