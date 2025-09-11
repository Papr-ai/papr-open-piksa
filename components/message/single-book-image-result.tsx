import React from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
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
      <CardHeader className="pb-3">
        <CardTitle className="flex items-center gap-2">
          {getTypeIcon(result.imageType)}
          {result.imageType.charAt(0).toUpperCase() + result.imageType.slice(1)} Created
        </CardTitle>
        <div className="flex items-center gap-2">
          <Badge variant="outline" className="bg-white">
            {result.bookTitle}
          </Badge>
          {result.currentStep && result.totalSteps && (
            <Badge variant="secondary">
              {result.currentStep}/{result.totalSteps}
            </Badge>
          )}
        </div>
      </CardHeader>
      
      <CardContent className="space-y-4">
        {/* Image Display */}
        {result.imageUrl && (
          <div className="relative group">
            <img
              src={result.imageUrl}
              alt={`${result.imageType}: ${result.name}`}
              className="w-full rounded-lg shadow-md border-2 border-white"
              style={{ maxHeight: '300px', objectFit: 'contain' }}
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

        {/* Image Details */}
        <div className="bg-white rounded-lg p-3">
          <div className="flex items-center gap-2 mb-2">
            <CheckCircle className="w-4 h-4 text-green-600" />
            <span className="font-medium text-gray-900">{result.name}</span>
          </div>
          <p className="text-sm text-gray-600">{result.description}</p>
        </div>

        {/* Seed Images */}
        {result.seedImages && result.seedImages.length > 0 && (
          <div className="bg-white rounded-lg p-3">
            <div className="flex items-center gap-2 mb-3">
              <Image className="w-4 h-4 text-blue-600" />
              <span className="font-medium text-gray-900">Seed Images Used</span>
              {result.approach && (
                <Badge variant="outline" className="text-xs">
                  {result.approach === 'merge_edit' ? 'Merged + Edited' : 
                   result.approach === 'edit' ? 'Edited' : 'Generated'}
                </Badge>
              )}
            </div>
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
              {result.seedImages.map((seedUrl, index) => (
                <div key={index} className="relative group">
                  <img
                    src={seedUrl}
                    alt={`Seed image ${index + 1}`}
                    className="w-full h-16 object-cover rounded border hover:scale-105 transition-transform"
                  />
                  <div className="absolute inset-0 bg-black bg-opacity-0 group-hover:bg-opacity-20 rounded transition-all duration-200 flex items-center justify-center opacity-0 group-hover:opacity-100">
                    <span className="text-white text-xs font-medium bg-black bg-opacity-50 px-1 rounded">
                      {index + 1}
                    </span>
                  </div>
                </div>
              ))}
            </div>
            <p className="text-xs text-gray-500 mt-2">
              {result.seedImages.length} seed image{result.seedImages.length !== 1 ? 's' : ''} used to create this {result.imageType}
            </p>
          </div>
        )}

        {/* Storage Status */}
        <div className="flex items-center justify-between bg-white rounded-lg p-3">
          <div className="text-sm font-medium text-gray-700">Storage Status</div>
          <div className="flex items-center gap-3">
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
          <div className="bg-white rounded-lg p-3">
            <div className="flex items-center justify-between mb-2">
              <span className="text-sm font-medium text-gray-700">Progress</span>
              <span className="text-sm text-gray-600">
                {result.currentStep}/{result.totalSteps}
              </span>
            </div>
            <div className="w-full bg-gray-200 rounded-full h-2">
              <div
                className="bg-blue-600 h-2 rounded-full transition-all duration-300"
                style={{ width: `${(result.currentStep / result.totalSteps) * 100}%` }}
              />
            </div>
          </div>
        )}

        {/* Next Action */}
        <div className="bg-blue-50 rounded-lg p-3 border border-blue-200">
          <div className="flex items-center gap-2">
            <CheckCircle className="w-4 h-4 text-blue-600" />
            <span className="text-sm font-medium text-blue-900">Next</span>
          </div>
          <p className="text-sm text-blue-700 mt-1">{result.nextAction}</p>
        </div>
      </CardContent>
    </Card>
  );
}
