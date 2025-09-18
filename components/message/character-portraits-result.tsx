import React from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { CheckCircle, Clock, Users, Image, Star, AlertCircle, Plus } from 'lucide-react';

interface CharacterResult {
  characterName: string;
  portraitUrl: string;
  existingPortrait: boolean;
  propsCreated: number;
  seedImages?: string[];
}

interface CharacterPortraitsResultProps {
  result: {
    success: boolean;
    bookId: string;
    charactersProcessed: number;
    results: CharacterResult[];
    nextStep: string;
    approvalRequired: boolean;
    canCreateMoreCharacters: boolean;
    maxBatchSize: number;
    message?: string;
  };
  isReadonly?: boolean;
}

export function CharacterPortraitsResult({ result, isReadonly = false }: CharacterPortraitsResultProps) {
  if (!result.success) {
    return (
      <Card className="border-red-200 bg-red-50">
        <CardContent className="p-4">
          <div className="flex items-center gap-2 text-red-700">
            <AlertCircle className="w-5 h-5" />
            <span className="font-medium">Character Portrait Creation Failed</span>
          </div>
          <p className="text-sm text-red-600 mt-2">{result.message}</p>
        </CardContent>
      </Card>
    );
  }

  const totalPropsCreated = result.results.reduce((sum, char) => sum + char.propsCreated, 0);
  const existingPortraits = result.results.filter(char => char.existingPortrait).length;
  const newPortraits = result.results.filter(char => !char.existingPortrait).length;

  return (
    <Card className="border-blue-200 bg-blue-50">
      <CardHeader className="pb-3">
        <CardTitle className="flex items-center gap-2 text-blue-900">
          <Users className="w-5 h-5" />
          Character Portraits Created
        </CardTitle>
        <div className="flex flex-wrap items-center gap-2">
          <Badge variant="outline" className="bg-white">
            {result.charactersProcessed} characters
          </Badge>
          {newPortraits > 0 && (
            <Badge variant="secondary" className="bg-green-100 text-green-800">
              {newPortraits} new
            </Badge>
          )}
          {existingPortraits > 0 && (
            <Badge variant="outline" className="bg-yellow-100 text-yellow-800">
              {existingPortraits} existing
            </Badge>
          )}
          {totalPropsCreated > 0 && (
            <Badge variant="outline">
              {totalPropsCreated} props
            </Badge>
          )}
        </div>
      </CardHeader>
      
      <CardContent className="space-y-4">
        {/* Character Portrait Gallery */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {result.results.map((character, index) => (
            <div key={character.characterName} className="bg-white rounded-lg p-3 border">
              <div className="space-y-3">
                {/* Character Image */}
                <div className="relative">
                  <img
                    src={character.portraitUrl}
                    alt={`${character.characterName} portrait`}
                    className="w-full h-48 object-cover rounded-lg bg-gray-100"
                    onError={(e) => {
                      const target = e.target as HTMLImageElement;
                      target.src = 'data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iMjAwIiBoZWlnaHQ9IjIwMCIgeG1sbnM9Imh0dHA6Ly93d3cudzMub3JnLzIwMDAvc3ZnIj48cmVjdCB3aWR0aD0iMjAwIiBoZWlnaHQ9IjIwMCIgZmlsbD0iI2Y3ZjdmNyIvPjx0ZXh0IHg9IjUwJSIgeT0iNTAlIiBmb250LWZhbWlseT0iQXJpYWwiIGZvbnQtc2l6ZT0iMTQiIGZpbGw9IiM5OTk5OTkiIHRleHQtYW5jaG9yPSJtaWRkbGUiIGR5PSIuM2VtIj5JbWFnZSBub3QgYXZhaWxhYmxlPC90ZXh0Pjwvc3ZnPg==';
                    }}
                  />
                  
                  {/* Status Indicators */}
                  <div className="absolute top-2 right-2 flex gap-1">
                    {character.existingPortrait ? (
                      <Badge variant="outline" className="text-xs bg-yellow-100 text-yellow-800 border-yellow-300">
                        <Star className="w-3 h-3 mr-1" />
                        Existing
                      </Badge>
                    ) : (
                      <Badge variant="outline" className="text-xs bg-green-100 text-green-800 border-green-300">
                        <CheckCircle className="w-3 h-3 mr-1" />
                        New
                      </Badge>
                    )}
                  </div>
                </div>

                {/* Character Info */}
                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <h4 className="font-medium text-gray-900">{character.characterName}</h4>
                    {character.propsCreated > 0 && (
                      <Badge variant="outline" className="text-xs">
                        {character.propsCreated} props
                      </Badge>
                    )}
                  </div>
                  
                  {/* Character Details */}
                  <div className="text-xs text-gray-500 space-y-1">
                    <div className="flex items-center gap-2">
                      <Image className="w-3 h-3" />
                      <span>Portrait {character.existingPortrait ? 'reused' : 'generated'}</span>
                    </div>
                    {character.propsCreated > 0 && (
                      <div className="flex items-center gap-2">
                        <Star className="w-3 h-3" />
                        <span>{character.propsCreated} props created</span>
                      </div>
                    )}
                    {character.seedImages && character.seedImages.length > 0 && (
                      <div className="flex items-center gap-2">
                        <Star className="w-3 h-3" />
                        <span>{character.seedImages.length} seed image{character.seedImages.length > 1 ? 's' : ''} used</span>
                      </div>
                    )}
                  </div>

                  {/* Seed Images Section */}
                  {character.seedImages && character.seedImages.length > 0 && (
                    <div className="mt-3">
                      <div className="text-xs font-medium text-gray-700 mb-2 flex items-center gap-1">
                        <Star className="w-3 h-3" />
                        Seed Images Used:
                      </div>
                      <div className="grid grid-cols-3 gap-1">
                        {character.seedImages.slice(0, 6).map((seedUrl, seedIndex) => (
                          <div key={seedIndex} className="relative">
                            <img
                              src={seedUrl}
                              alt={`Seed ${seedIndex + 1} for ${character.characterName}`}
                              className="w-full h-12 object-cover rounded border border-gray-200"
                              onError={(e) => {
                                const target = e.target as HTMLImageElement;
                                target.style.display = 'none';
                              }}
                            />
                          </div>
                        ))}
                        {character.seedImages.length > 6 && (
                          <div className="w-full h-12 bg-gray-100 rounded border border-gray-200 flex items-center justify-center text-xs text-gray-500">
                            +{character.seedImages.length - 6}
                          </div>
                        )}
                      </div>
                    </div>
                  )}
                </div>
              </div>
            </div>
          ))}
        </div>

        {/* Creation Summary */}
        <div className="bg-white rounded-lg p-3">
          <div className="flex items-center gap-2 mb-3">
            <CheckCircle className="w-4 h-4 text-green-600" />
            <span className="font-medium text-gray-900">Creation Summary</span>
          </div>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
            <div className="text-center">
              <div className="text-lg font-semibold text-blue-600">{result.charactersProcessed}</div>
              <div className="text-xs text-gray-500">Total Characters</div>
            </div>
            <div className="text-center">
              <div className="text-lg font-semibold text-green-600">{newPortraits}</div>
              <div className="text-xs text-gray-500">New Portraits</div>
            </div>
            <div className="text-center">
              <div className="text-lg font-semibold text-yellow-600">{existingPortraits}</div>
              <div className="text-xs text-gray-500">Existing Used</div>
            </div>
            <div className="text-center">
              <div className="text-lg font-semibold text-purple-600">{totalPropsCreated}</div>
              <div className="text-xs text-gray-500">Props Created</div>
            </div>
          </div>
        </div>

        {/* More Characters Available */}
        {result.canCreateMoreCharacters && (
          <div className="bg-indigo-50 rounded-lg p-3 border border-indigo-200">
            <div className="flex items-center gap-2 mb-2">
              <Plus className="w-4 h-4 text-indigo-600" />
              <span className="font-medium text-indigo-900">More Characters Available</span>
            </div>
            <p className="text-sm text-indigo-800">
              You can create more characters (up to {result.maxBatchSize} at a time) or proceed to environment creation.
            </p>
          </div>
        )}

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
              Approval required before proceeding to environment creation
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  );
}
