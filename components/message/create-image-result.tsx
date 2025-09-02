import React from 'react';
import Image from 'next/image';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Separator } from '@/components/ui/separator';
import { CopyIcon, DownloadIcon } from '@/components/common/icons';
import { toast } from 'sonner';
import type { CreateImageOutput } from '@/lib/ai/tools/create-image';

interface CreateImageResultProps {
  result: CreateImageOutput;
  isReadonly?: boolean;
}

export function CreateImageResult({ result, isReadonly }: CreateImageResultProps) {
  const {
    imageUrl,
    approach,
    seedImagesUsed = [],
    reasoning,
    actualPrompt,
    metadata
  } = result;

  const handleDownload = () => {
    const link = document.createElement('a');
    link.href = imageUrl;
    link.download = `created-image-${approach}.png`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    toast.success('Image downloaded!');
  };

  const handleCopyImage = async () => {
    try {
      // Convert URL to blob
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
    <Card className="w-full max-w-2xl mx-auto my-4">
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <CardTitle className="text-lg font-semibold flex items-center gap-2">
            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24">
              <defs>
                <linearGradient id="image-created-gradient" x1="0%" y1="0%" x2="100%" y2="100%">
                  <stop offset="0%" stopColor="#0060E0" />
                  <stop offset="60%" stopColor="#00ACFA" />
                  <stop offset="100%" stopColor="#0BCDFF" />
                </linearGradient>
              </defs>
              <rect x="3" y="3" width="18" height="18" rx="3" stroke="url(#image-created-gradient)" strokeWidth="2" fill="none" />
              <circle cx="8.5" cy="8.5" r="1.5" fill="url(#image-created-gradient)" />
              <path d="M21 15l-5-5L5 21l5-5" stroke="url(#image-created-gradient)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
              <path d="M14 8l3 3" stroke="url(#image-created-gradient)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
            Image Created
          </CardTitle>
          <Badge variant="secondary" className="capitalize">
            {approach === 'merge_edit' ? 'Merge + Edit' : approach}
          </Badge>
        </div>
      </CardHeader>
      
      <CardContent className="space-y-4">
        {/* Main Generated Image */}
        <div className="relative w-full aspect-square max-w-md mx-auto rounded-lg overflow-hidden border group">
          <Image
            src={imageUrl}
            alt="Generated image"
            fill
            className="object-cover"
            sizes="(max-width: 768px) 100vw, (max-width: 1200px) 50vw, 33vw"
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

        {/* Actual Prompt Used */}
        {actualPrompt && (
          <div className="space-y-2">
            <h4 className="font-medium text-sm text-muted-foreground">Actual Prompt Used</h4>
            <p className="text-sm bg-blue-50 dark:bg-blue-950/30 p-3 rounded-md border border-blue-200 dark:border-blue-800">
              {actualPrompt}
            </p>
          </div>
        )}

        {/* Reasoning */}
        {reasoning && (
          <div className="space-y-2">
            <h4 className="font-medium text-sm text-muted-foreground">Approach Reasoning</h4>
            <p className="text-sm bg-muted/50 p-3 rounded-md">
              {reasoning}
            </p>
          </div>
        )}

        {/* Seed Images Used */}
        {seedImagesUsed && seedImagesUsed.length > 0 && (
          <>
            <Separator />
            <div className="space-y-3">
              <h4 className="font-medium text-sm text-muted-foreground">
                Seed Images Used ({seedImagesUsed.length})
              </h4>
              <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-2">
                {seedImagesUsed.map((seedUrl, index) => (
                  <div
                    key={index}
                    className="relative aspect-square rounded-md overflow-hidden border bg-muted/20"
                  >
                    <Image
                      src={seedUrl}
                      alt={`Seed image ${index + 1}`}
                      fill
                      className="object-cover"
                      sizes="(max-width: 768px) 25vw, 12vw"
                    />
                  </div>
                ))}
              </div>
            </div>
          </>
        )}

        {/* Metadata */}
        {metadata && (
          <>
            <Separator />
            <div className="grid grid-cols-2 gap-4 text-xs text-muted-foreground">
              <div>
                <span className="font-medium">Seeds Found:</span> {metadata.seedCount || 0}
              </div>
              <div>
                <span className="font-medium">Scene Context:</span> {metadata.hasSceneContext ? 'Yes' : 'No'}
              </div>
              <div>
                <span className="font-medium">Prior Scene:</span> {metadata.hasPriorScene ? 'Yes' : 'No'}
              </div>
              <div>
                <span className="font-medium">Approach:</span> {metadata.approach}
              </div>
            </div>
          </>
        )}

        {/* Action buttons for readonly mode */}
        {!isReadonly && (
          <>
            <Separator />
            <div className="flex gap-2">
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
          </>
        )}
      </CardContent>
    </Card>
  );
}
