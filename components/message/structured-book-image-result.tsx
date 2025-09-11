'use client';

import { useState } from 'react';
import Image from 'next/image';
import { Card, CardContent, CardHeader } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Progress } from '@/components/ui/progress';
import { 
  CheckCircleIcon, 
  XCircleIcon, 
  ClockIcon,
  ChevronDownIcon,
  ChevronRightIcon,
  CopyIcon,
  DownloadIcon,
  ImageIcon
} from 'lucide-react';
import { Separator } from '@/components/ui/separator';

interface StructuredBookImageStartProps {
  content: {
    bookTitle: string;
    bookId: string;
    pipeline: {
      characters: number;
      environments: number;
      scenes: number;
      totalSteps: number;
    };
  };
}

interface StructuredBookImageProgressProps {
  content: {
    step: 'character_portrait' | 'environment' | 'scene';
    stepNumber: number;
    totalSteps: number;
    action: string;
    item: string;
    description: string;
  };
}

interface StructuredBookImageResultProps {
  content: {
    step: 'character_portrait' | 'environment' | 'scene';
    success: boolean;
    item: string;
    imageUrl?: string;
    prompt?: string;
    approach?: string;
    seedImagesUsed?: string[];
    reasoning?: string;
    error?: string;
    existingAsset?: boolean;
  };
  isReadonly?: boolean;
}

interface StructuredBookImageCompleteProps {
  content: {
    success: boolean;
    bookId: string;
    bookTitle: string;
    summary: {
      charactersCreated: number;
      environmentsCreated: number;
      scenesCreated: number;
      totalImagesCreated: number;
    };
    results: {
      characterPortraits: number;
      environments: number;
      scenes: number;
      totalImagesCreated: number;
    };
    nextSteps: string;
  };
}

const stepIcons = {
  character_portrait: '👤',
  environment: '🏞️',
  scene: '🎬'
};

const stepLabels = {
  character_portrait: 'Character Portrait',
  environment: 'Environment',
  scene: 'Scene Composition'
};

export function StructuredBookImageStart({ content }: StructuredBookImageStartProps) {
  return (
    <Card className="w-fit max-w-full">
      <CardHeader className="pb-3">
        <div className="flex items-center gap-3">
          <div className="text-2xl">🎨</div>
          <div>
            <h3 className="font-semibold text-sm">Starting Structured Image Creation</h3>
            <p className="text-xs text-muted-foreground">{content.bookTitle}</p>
          </div>
        </div>
      </CardHeader>
      <CardContent className="pt-2">
        <div className="space-y-3">
          <div className="grid grid-cols-3 gap-4 text-center">
            <div className="space-y-1">
              <div className="text-lg font-semibold text-blue-600">{content.pipeline.characters}</div>
              <div className="text-xs text-muted-foreground">Characters</div>
            </div>
            <div className="space-y-1">
              <div className="text-lg font-semibold text-green-600">{content.pipeline.environments}</div>
              <div className="text-xs text-muted-foreground">Environments</div>
            </div>
            <div className="space-y-1">
              <div className="text-lg font-semibold text-purple-600">{content.pipeline.scenes}</div>
              <div className="text-xs text-muted-foreground">Scenes</div>
            </div>
          </div>
          <div className="text-xs text-center text-muted-foreground">
            Creating {content.pipeline.totalSteps} assets systematically
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

export function StructuredBookImageProgress({ content }: StructuredBookImageProgressProps) {
  const progress = (content.stepNumber / content.totalSteps) * 100;
  
  return (
    <Card className="w-fit max-w-full">
      <CardContent className="py-3">
        <div className="flex items-center gap-3">
          <div className="text-lg">{stepIcons[content.step]}</div>
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 mb-1">
              <span className="text-sm font-medium">{stepLabels[content.step]}</span>
              <Badge variant="outline" className="text-xs">
                {content.stepNumber}/{content.totalSteps}
              </Badge>
            </div>
            <p className="text-xs text-muted-foreground truncate">{content.description}</p>
            <div className="mt-2">
              <Progress value={progress} className="h-1.5" />
            </div>
          </div>
          <ClockIcon className="w-4 h-4 text-muted-foreground animate-spin" />
        </div>
      </CardContent>
    </Card>
  );
}

export function StructuredBookImageResult({ content, isReadonly = false }: StructuredBookImageResultProps) {
  const [isExpanded, setIsExpanded] = useState(false);

  const handleCopyImage = async () => {
    if (!content.imageUrl) return;
    try {
      await navigator.clipboard.writeText(content.imageUrl);
    } catch (error) {
      console.error('Failed to copy image URL:', error);
    }
  };

  const handleDownload = () => {
    if (!content.imageUrl) return;
    const link = document.createElement('a');
    link.href = content.imageUrl;
    link.download = `${content.step}_${content.item}.png`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  return (
    <Card className="w-fit max-w-full">
      <CardHeader className="pb-2">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="text-base">{stepIcons[content.step]}</div>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="font-semibold text-sm">{stepLabels[content.step]} Created</h3>
                {content.success ? (
                  <CheckCircleIcon className="w-4 h-4 text-green-500" />
                ) : (
                  <XCircleIcon className="w-4 h-4 text-red-500" />
                )}
                {content.existingAsset && (
                  <Badge variant="secondary" className="text-xs">Existing</Badge>
                )}
                {content.approach && (
                  <Badge variant="outline" className="text-xs capitalize">
                    {content.approach === 'merge_edit' ? 'Merge + Edit' : content.approach}
                  </Badge>
                )}
              </div>
              <p className="text-xs text-muted-foreground">{content.item}</p>
            </div>
          </div>
          
          {(content.prompt || content.reasoning) && (
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setIsExpanded(!isExpanded)}
              className="p-1"
            >
              {isExpanded ? (
                <ChevronDownIcon className="w-4 h-4" />
              ) : (
                <ChevronRightIcon className="w-4 h-4" />
              )}
            </Button>
          )}
        </div>
      </CardHeader>
      
      <CardContent className="space-y-2">
        {content.success && content.imageUrl && (
          <div className="relative w-full aspect-square max-w-sm mx-auto rounded-lg overflow-hidden border group">
            <Image
              src={content.imageUrl}
              alt={`${stepLabels[content.step]}: ${content.item}`}
              fill
              className="object-cover"
              sizes="(max-width: 768px) 100vw, (max-width: 1200px) 50vw, 33vw"
            />
            
            {!isReadonly && (
              <div className="absolute top-2 right-2 opacity-0 group-hover:opacity-100 transition-opacity duration-200 flex gap-2">
                <Button
                  size="sm"
                  variant="secondary"
                  onClick={handleCopyImage}
                  className="bg-white/90 dark:bg-zinc-800/90 backdrop-blur-sm"
                >
                  <CopyIcon className="w-3 h-3" />
                </Button>
                <Button
                  size="sm"
                  variant="secondary"
                  onClick={handleDownload}
                  className="bg-white/90 dark:bg-zinc-800/90 backdrop-blur-sm"
                >
                  <DownloadIcon className="w-3 h-3" />
                </Button>
              </div>
            )}
          </div>
        )}

        {/* Seed Images - Show outside expanded section for better visibility */}
        {content.success && content.seedImagesUsed && content.seedImagesUsed.length > 0 && (
          <>
            <Separator />
            <div>
              <h4 className="font-medium text-xs text-muted-foreground mb-2 flex items-center gap-1">
                <ImageIcon className="w-3 h-3" />
                Seed Images Used ({content.seedImagesUsed.length})
              </h4>
              <div className="grid grid-cols-3 sm:grid-cols-4 gap-2">
                {content.seedImagesUsed.map((seedUrl, index) => (
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

        {!content.success && content.error && (
          <div className="p-3 bg-red-50 dark:bg-red-950/30 border border-red-200 dark:border-red-800 rounded-md">
            <p className="text-sm text-red-600 dark:text-red-400">
              <span className="font-medium">Error: </span>
              {content.error}
            </p>
          </div>
        )}

        {isExpanded && (
          <div className="space-y-2 border-t pt-2">
            {content.reasoning && (
              <div>
                <h4 className="font-medium text-xs text-muted-foreground mb-1">Reasoning</h4>
                <p className="text-sm bg-muted/50 p-2 rounded text-muted-foreground">
                  {content.reasoning}
                </p>
              </div>
            )}

            {content.prompt && (
              <div>
                <h4 className="font-medium text-xs text-muted-foreground mb-1">Prompt Used</h4>
                <p className="text-sm bg-blue-50 dark:bg-blue-950/30 p-2 rounded border border-blue-200 dark:border-blue-800">
                  {content.prompt}
                </p>
              </div>
            )}

            {content.approach && (
              <div>
                <h4 className="font-medium text-xs text-muted-foreground mb-1">Approach</h4>
                <Badge variant="outline" className="text-xs">
                  {content.approach}
                </Badge>
              </div>
            )}

          </div>
        )}
      </CardContent>
    </Card>
  );
}

export function StructuredBookImageComplete({ content }: StructuredBookImageCompleteProps) {
  return (
    <Card className="w-fit max-w-full">
      <CardHeader className="pb-3">
        <div className="flex items-center gap-3">
          <div className="text-2xl">✅</div>
          <div>
            <h3 className="font-semibold text-sm">Structured Image Creation Complete</h3>
            <p className="text-xs text-muted-foreground">{content.bookTitle}</p>
          </div>
        </div>
      </CardHeader>
      <CardContent className="pt-2">
        <div className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <div className="text-xs text-muted-foreground">Created</div>
              <div className="space-y-1">
                <div className="flex justify-between text-sm">
                  <span>Characters:</span>
                  <span className="font-medium">{content.summary.charactersCreated}</span>
                </div>
                <div className="flex justify-between text-sm">
                  <span>Environments:</span>
                  <span className="font-medium">{content.summary.environmentsCreated}</span>
                </div>
                <div className="flex justify-between text-sm">
                  <span>Scenes:</span>
                  <span className="font-medium">{content.summary.scenesCreated}</span>
                </div>
              </div>
            </div>
            <div className="space-y-2">
              <div className="text-xs text-muted-foreground">Total Assets</div>
              <div className="space-y-1">
                <div className="flex justify-between text-sm">
                  <span>Portraits:</span>
                  <span className="font-medium">{content.results.characterPortraits}</span>
                </div>
                <div className="flex justify-between text-sm">
                  <span>Environments:</span>
                  <span className="font-medium">{content.results.environments}</span>
                </div>
                <div className="flex justify-between text-sm">
                  <span>Scenes:</span>
                  <span className="font-medium">{content.results.scenes}</span>
                </div>
              </div>
            </div>
          </div>
          
          <div className="text-center p-3 bg-green-50 dark:bg-green-950/30 border border-green-200 dark:border-green-800 rounded-md">
            <div className="text-lg font-semibold text-green-600 dark:text-green-400">
              {content.results.totalImagesCreated}
            </div>
            <div className="text-xs text-green-600 dark:text-green-400">
              Total Images Created
            </div>
          </div>

          {content.nextSteps && (
            <div className="space-y-2">
              <h4 className="font-medium text-xs text-muted-foreground">Next Steps</h4>
              <div className="text-sm bg-muted/50 p-3 rounded whitespace-pre-line">
                {content.nextSteps}
              </div>
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  );
}
