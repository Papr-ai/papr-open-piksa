import React from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { CheckCircle, Clock, Image, Users, MapPin, Film } from 'lucide-react';

interface BookImagePlanResultProps {
  result: {
    success: boolean;
    planId: string;
    bookId: string;
    bookTitle: string;
    totalImages: number;
    phases: {
      characters: {
        count: number;
        items: Array<{
          id: string;
          name: string;
          description: string;
          physicalDescription: string;
          priority: number;
        }>;
      };
      environments: {
        count: number;
        items: Array<{
          id: string;
          name: string;
          description: string;
          timeOfDay?: string;
          weather?: string;
          priority: number;
        }>;
      };
      scenes?: {
        count: number;
        items: Array<{
          id: string;
          sceneId: string;
          description: string;
          characters: string[];
          environment: string;
          priority: number;
        }>;
      };
    };
    styleBible: string;
    nextAction: string;
    message: string;
  };
  isReadonly?: boolean;
}

export function BookImagePlanResult({ result, isReadonly = false }: BookImagePlanResultProps) {
  if (!result.success) {
    return (
      <Card className="border-red-200 bg-red-50">
        <CardContent className="p-4">
          <div className="flex items-center gap-2 text-red-700">
            <div className="w-2 h-2 bg-red-500 rounded-full" />
            <span className="font-medium">Plan Creation Failed</span>
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
          <Image className="w-5 h-5" />
          Book Image Creation Plan
        </CardTitle>
        <div className="flex items-center gap-2">
          <Badge variant="outline" className="bg-white">
            {result.bookTitle}
          </Badge>
          <Badge variant="secondary">
            {result.totalImages} images planned
          </Badge>
        </div>
      </CardHeader>
      
      <CardContent className="space-y-4">
        {/* Style Bible */}
        <div className="bg-white rounded-lg p-3">
          <div className="text-sm font-medium text-gray-700 mb-1">Art Style</div>
          <div className="text-sm text-gray-600">{result.styleBible}</div>
        </div>

        {/* Phases */}
        <div className="space-y-3">
          {/* Characters Phase */}
          {result.phases.characters.count > 0 && (
            <div className="bg-white rounded-lg p-3">
              <div className="flex items-center gap-2 mb-2">
                <Users className="w-4 h-4 text-blue-600" />
                <span className="font-medium text-gray-900">
                  Phase 1: Character Portraits
                </span>
                <Badge variant="outline">{result.phases.characters.count}</Badge>
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
                {result.phases.characters.items.map((character) => (
                  <div key={character.id} className="flex items-center gap-2 p-2 bg-gray-50 rounded">
                    <Clock className="w-3 h-3 text-gray-400" />
                    <div className="flex-1 min-w-0">
                      <div className="text-sm font-medium text-gray-900 truncate">
                        {character.name}
                      </div>
                      <div className="text-xs text-gray-500 truncate">
                        {character.description}
                      </div>
                    </div>
                    <Badge variant="outline" className="text-xs">
                      #{character.priority}
                    </Badge>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Environments Phase */}
          {result.phases.environments.count > 0 && (
            <div className="bg-white rounded-lg p-3">
              <div className="flex items-center gap-2 mb-2">
                <MapPin className="w-4 h-4 text-green-600" />
                <span className="font-medium text-gray-900">
                  Phase 2: Environment Images
                </span>
                <Badge variant="outline">{result.phases.environments.count}</Badge>
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
                {result.phases.environments.items.map((environment) => (
                  <div key={environment.id} className="flex items-center gap-2 p-2 bg-gray-50 rounded">
                    <Clock className="w-3 h-3 text-gray-400" />
                    <div className="flex-1 min-w-0">
                      <div className="text-sm font-medium text-gray-900 truncate">
                        {environment.name}
                      </div>
                      <div className="text-xs text-gray-500 truncate">
                        {environment.timeOfDay && `${environment.timeOfDay} • `}
                        {environment.weather && `${environment.weather} • `}
                        {environment.description}
                      </div>
                    </div>
                    <Badge variant="outline" className="text-xs">
                      #{environment.priority}
                    </Badge>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Scenes Phase */}
          {result.phases.scenes && result.phases.scenes.count > 0 && (
            <div className="bg-white rounded-lg p-3">
              <div className="flex items-center gap-2 mb-2">
                <Film className="w-4 h-4 text-purple-600" />
                <span className="font-medium text-gray-900">
                  Phase 3: Scene Compositions
                </span>
                <Badge variant="outline">{result.phases.scenes.count}</Badge>
              </div>
              <div className="grid grid-cols-1 gap-2">
                {result.phases.scenes.items.map((scene) => (
                  <div key={scene.id} className="flex items-center gap-2 p-2 bg-gray-50 rounded">
                    <Clock className="w-3 h-3 text-gray-400" />
                    <div className="flex-1 min-w-0">
                      <div className="text-sm font-medium text-gray-900 truncate">
                        {scene.sceneId}
                      </div>
                      <div className="text-xs text-gray-500">
                        Characters: {scene.characters.join(', ')} • Environment: {scene.environment}
                      </div>
                    </div>
                    <Badge variant="outline" className="text-xs">
                      #{scene.priority}
                    </Badge>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* Next Action */}
        <div className="bg-green-50 rounded-lg p-3 border border-green-200">
          <div className="flex items-center gap-2">
            <CheckCircle className="w-4 h-4 text-green-600" />
            <span className="text-sm font-medium text-green-900">Next Step</span>
          </div>
          <p className="text-sm text-green-700 mt-1">{result.nextAction}</p>
        </div>
      </CardContent>
    </Card>
  );
}
