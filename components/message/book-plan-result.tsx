import React from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { CheckCircle, Clock, BookOpen, Users, Palette, Target, AlertCircle } from 'lucide-react';

interface Character {
  name: string;
  role: string;
  personality: string;
  physicalDescription: string;
}

interface BookPlanResultProps {
  result: {
    success: boolean;
    bookId: string;
    bookTitle: string;
    genre: string;
    targetAge: string;
    premise: string;
    themes: string[];
    mainCharacters: Character[];
    styleBible: string;
    isPictureBook: boolean;
    existingContext?: {
      foundBookContext: boolean;
      foundCharacters: number;
      characterDetails: Array<{
        name: string;
        hasExistingInfo: boolean;
      }>;
    };
    documentsCreated: boolean;
    nextStep: string;
    approvalRequired: boolean;
    message?: string;
  };
  isReadonly?: boolean;
}

export function BookPlanResult({ result, isReadonly = false }: BookPlanResultProps) {
  if (!result.success) {
    return (
      <Card className="border-red-200 bg-red-50">
        <CardContent className="p-4">
          <div className="flex items-center gap-2 text-red-700">
            <AlertCircle className="w-5 h-5" />
            <span className="font-medium">Book Plan Creation Failed</span>
          </div>
          <p className="text-sm text-red-600 mt-2">{result.message}</p>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="border-green-200 bg-green-50">
      <CardHeader className="pb-3">
        <CardTitle className="flex items-center gap-2 text-green-900">
          <BookOpen className="w-5 h-5" />
          Book Plan Created
        </CardTitle>
        <div className="flex flex-wrap items-center gap-2">
          <Badge variant="outline" className="bg-white">
            {result.bookTitle}
          </Badge>
          <Badge variant="secondary">
            {result.genre}
          </Badge>
          <Badge variant="outline">
            Ages {result.targetAge}
          </Badge>
          {result.isPictureBook && (
            <Badge variant="outline" className="bg-blue-100 text-blue-800">
              Picture Book
            </Badge>
          )}
        </div>
      </CardHeader>
      
      <CardContent className="space-y-4">
        {/* Story Premise */}
        <div className="bg-white rounded-lg p-3">
          <div className="flex items-center gap-2 mb-2">
            <Target className="w-4 h-4 text-green-600" />
            <span className="font-medium text-gray-900">Story Premise</span>
          </div>
          <p className="text-sm text-gray-700">{result.premise}</p>
        </div>

        {/* Themes */}
        <div className="bg-white rounded-lg p-3">
          <div className="flex items-center gap-2 mb-2">
            <Palette className="w-4 h-4 text-purple-600" />
            <span className="font-medium text-gray-900">Themes</span>
          </div>
          <div className="flex flex-wrap gap-1">
            {result.themes.map((theme, index) => (
              <Badge key={index} variant="outline" className="text-xs">
                {theme}
              </Badge>
            ))}
          </div>
        </div>

        {/* Main Characters */}
        <div className="bg-white rounded-lg p-3">
          <div className="flex items-center gap-2 mb-3">
            <Users className="w-4 h-4 text-blue-600" />
            <span className="font-medium text-gray-900">Main Characters</span>
            <Badge variant="outline">{result.mainCharacters.length}</Badge>
          </div>
          <div className="space-y-3">
            {result.mainCharacters.map((character, index) => (
              <div key={index} className="p-3 bg-gray-50 rounded-lg">
                <div className="flex items-center gap-2 mb-1">
                  <span className="font-medium text-gray-900">{character.name}</span>
                  <Badge variant="outline" className="text-xs">
                    {character.role}
                  </Badge>
                  {result.existingContext?.characterDetails.find(c => c.name === character.name)?.hasExistingInfo && (
                    <Badge variant="outline" className="text-xs bg-green-100 text-green-700">
                      Existing Info Used
                    </Badge>
                  )}
                </div>
                <p className="text-xs text-gray-600 mb-1">{character.personality}</p>
                <p className="text-xs text-gray-500">{character.physicalDescription}</p>
              </div>
            ))}
          </div>
        </div>

        {/* Style Bible */}
        <div className="bg-white rounded-lg p-3">
          <div className="flex items-center gap-2 mb-2">
            <Palette className="w-4 h-4 text-orange-600" />
            <span className="font-medium text-gray-900">Art Style</span>
          </div>
          <p className="text-sm text-gray-700">{result.styleBible}</p>
        </div>

        {/* Existing Context Info */}
        {result.existingContext?.foundBookContext && (
          <div className="bg-blue-50 rounded-lg p-3 border border-blue-200">
            <div className="flex items-center gap-2 mb-2">
              <CheckCircle className="w-4 h-4 text-blue-600" />
              <span className="font-medium text-blue-900">Used Existing Context</span>
            </div>
            <p className="text-sm text-blue-700">
              Found and incorporated information for {result.existingContext.foundCharacters} characters from previous conversations.
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
            <div className="mt-2 text-xs text-yellow-700">
              ⚠️ Approval required before proceeding to chapter writing
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  );
}
