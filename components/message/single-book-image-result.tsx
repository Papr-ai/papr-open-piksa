import React from 'react';
import NextImage from 'next/image';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Separator } from '@/components/ui/separator';
import { CheckCircle, XCircle, Image, Users, MapPin, Film, Database, Brain, Download, Copy } from 'lucide-react';
import { toast } from 'sonner';

interface SingleBookImageResultProps {
  result: {
    success: boolean;
    imageType: 'character' | 'environment' | 'scene';
    imageId: string;
    name: string;
    imageUrl?: string;
    description: string;
    bookId: string;
    bookTitle: string;
    savedToMemory: boolean;
    savedToDatabase: boolean;
    currentStep?: number;
    totalSteps?: number;
    nextAction: string;
    message: string;
    error?: string;
    seedImages?: string[];
    approach?: string;
  };
  isReadonly?: boolean;
}

const getTypeIcon = (type: 'character' | 'environment' | 'scene') => {
  switch (type) {
    case 'character':
      return <Users className="w-4 h-4" />;
    case 'environment':
      return <MapPin className="w-4 h-4" />;
    case 'scene':
      return <Film className="w-4 h-4" />;
    default:
      return <Image className="w-4 h-4" />;
  }
};

const getTypeColor = (type: 'character' | 'environment' | 'scene') => {
  switch (type) {
    case 'character':
      return 'text-blue-600 bg-blue-50 border-blue-200';
    case 'environment':
      return 'text-green-600 bg-green-50 border-green-200';
    case 'scene':
      return 'text-purple-600 bg-purple-50 border-purple-200';
    default:
      return 'text-gray-600 bg-gray-50 border-gray-200';
  }
};

export function SingleBookImageResult({ result, isReadonly = false }: SingleBookImageResultProps) {
  const handleCopyImage = async () => {
    if (!result.imageUrl) return;
    
    try {
      await navigator.clipboard.writeText(result.imageUrl);
      toast.success('Image URL copied to clipboard');
    } catch (error) {
      toast.error('Failed to copy image URL');
    }
  };

  const handleDownload = () => {
    if (!result.imageUrl) return;
    
    const link = document.createElement('a');
    link.href = result.imageUrl;
    link.download = `${result.bookTitle}-${result.imageType}-${result.name}.png`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  if (!result.success) {
    return (
      <Card className="border-red-200 bg-red-50">
        <CardHeader className="pb-3">
          <CardTitle className="flex items-center gap-2 text-red-900">
            <XCircle className="w-5 h-5" />
            Image Creation Failed
          </CardTitle>
          <div className="flex items-center gap-2">
            <Badge variant="outline" className="bg-white">
              {result.imageType}
            </Badge>
            <Badge variant="outline" className="bg-white">
              {result.name}
            </Badge>
          </div>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-red-700">{result.error || 'Unknown error occurred'}</p>
          {result.currentStep && result.totalSteps && (
            <div className="mt-2 text-xs text-red-600">
              Step {result.currentStep} of {result.totalSteps}
            </div>
          )}
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className={`${getTypeColor(result.imageType)}`}>
      <CardHeader className="pb-2">
        <div className="flex items-center justify-between">
          <CardTitle className="flex items-center gap-2 text-base">
            {getTypeIcon(result.imageType)}
            {result.imageType.charAt(0).toUpperCase() + result.imageType.slice(1)} Created
          </CardTitle>
          <div className="flex items-center gap-2">
            {result.approach && (
              <Badge variant="secondary" className="text-xs capitalize">
                {result.approach === 'merge_edit' ? 'Merge + Edit' : result.approach}
              </Badge>
            )}
            {result.currentStep && result.totalSteps && (
              <Badge variant="outline" className="text-xs">
                {result.currentStep}/{result.totalSteps}
              </Badge>
            )}
          </div>
        </div>
        <div className="flex items-center gap-2">
          <Badge variant="outline" className="bg-white text-xs">
            {result.bookTitle}
          </Badge>
          <span className="text-sm font-medium text-gray-900">{result.name}</span>
        </div>
      </CardHeader>
      
      <CardContent className="space-y-3">
        {/* Image Display */}
        {result.imageUrl && (
          <div className="relative group">
            <img
              src={result.imageUrl}
              alt={`${result.imageType}: ${result.name}`}
              className="w-full rounded-lg shadow-md border-2 border-white"
              style={{ maxHeight: '250px', objectFit: 'contain' }}
            />
            
            {/* Action buttons overlay */}
            {!isReadonly && (
              <div className="absolute top-2 right-2 opacity-0 group-hover:opacity-100 transition-opacity duration-200 flex gap-2">
                <Button
                  size="sm"
                  variant="secondary"
                  onClick={handleCopyImage}
                  className="bg-white/90 backdrop-blur-sm"
                >
                  <Copy className="w-3 h-3" />
                </Button>
                <Button
                  size="sm"
                  variant="secondary"
                  onClick={handleDownload}
                  className="bg-white/90 backdrop-blur-sm"
                >
                  <Download className="w-3 h-3" />
                </Button>
              </div>
            )}
          </div>
        )}

        {/* Description */}
        <p className="text-sm text-gray-600 bg-white rounded-lg p-2">{result.description}</p>

        {/* Seed Images */}
        {result.seedImages && result.seedImages.length > 0 && (
          <>
            <Separator />
            <div className="space-y-2">
              <h4 className="font-medium text-sm text-muted-foreground flex items-center gap-2">
                <Image className="w-4 h-4" />
                Seed Images Used ({result.seedImages.length})
              </h4>
              <div className="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-5 gap-2">
                {result.seedImages.map((seedUrl, index) => (
                  <div
                    key={index}
                    className="relative aspect-square rounded-md overflow-hidden border bg-muted/20"
                  >
                    <NextImage
                      src={seedUrl}
                      alt={`Seed image ${index + 1}`}
                      fill
                      className="object-cover"
                      sizes="(max-width: 768px) 20vw, 12vw"
                    />
                  </div>
                ))}
              </div>
            </div>
          </>
        )}

        {/* Storage Status */}
        <div className="flex items-center justify-between bg-white rounded-lg p-2">
          <div className="text-xs font-medium text-gray-700">Saved to:</div>
          <div className="flex items-center gap-2">
            <div className="flex items-center gap-1">
              <Brain className={`w-3 h-3 ${result.savedToMemory ? 'text-green-600' : 'text-gray-400'}`} />
              <span className={`text-xs ${result.savedToMemory ? 'text-green-600' : 'text-gray-400'}`}>
                Memory
              </span>
            </div>
            <div className="flex items-center gap-1">
              <Database className={`w-3 h-3 ${result.savedToDatabase ? 'text-green-600' : 'text-gray-400'}`} />
              <span className={`text-xs ${result.savedToDatabase ? 'text-green-600' : 'text-gray-400'}`}>
                Database
              </span>
            </div>
          </div>
        </div>

        {/* Progress & Next Action */}
        {result.currentStep && result.totalSteps && (
          <div className="bg-white rounded-lg p-2">
            <div className="flex items-center justify-between mb-1">
              <span className="text-xs font-medium text-gray-700">Progress</span>
              <span className="text-xs text-gray-600">
                {result.currentStep}/{result.totalSteps}
              </span>
            </div>
            <div className="w-full bg-gray-200 rounded-full h-1.5">
              <div
                className="bg-blue-600 h-1.5 rounded-full transition-all duration-300"
                style={{ width: `${(result.currentStep / result.totalSteps) * 100}%` }}
              />
            </div>
          </div>
        )}

        {/* Next Action */}
        <div className="bg-blue-50 rounded-lg p-2 border border-blue-200">
          <div className="flex items-center gap-2">
            <CheckCircle className="w-3 h-3 text-blue-600" />
            <span className="text-xs font-medium text-blue-900">Next</span>
          </div>
          <p className="text-xs text-blue-700 mt-1">{result.nextAction}</p>
        </div>
      </CardContent>
    </Card>
  );
}
