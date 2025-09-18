import React from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { CheckCircle, Clock, Film, MapPin, Sun, Moon, Sunrise, Sunset, AlertCircle } from 'lucide-react';

interface Scene {
  sceneId: string;
  synopsis: string;
  environment: string;
  timeOfDay: string;
}

interface SceneSegmentationResultProps {
  result: {
    success: boolean;
    bookId: string;
    chapterNumber: number;
    scenesCreated: number;
    scenes: Scene[];
    nextStep: string;
    approvalRequired: boolean;
    message?: string;
  };
  isReadonly?: boolean;
}

function getTimeOfDayIcon(timeOfDay: string) {
  switch (timeOfDay.toLowerCase()) {
    case 'morning':
      return <Sunrise className="w-3 h-3 text-yellow-500" />;
    case 'midday':
    case 'noon':
      return <Sun className="w-3 h-3 text-yellow-600" />;
    case 'afternoon':
      return <Sun className="w-3 h-3 text-orange-500" />;
    case 'evening':
      return <Sunset className="w-3 h-3 text-orange-600" />;
    case 'night':
      return <Moon className="w-3 h-3 text-blue-600" />;
    default:
      return <Clock className="w-3 h-3 text-gray-500" />;
  }
}

function getTimeOfDayColor(timeOfDay: string) {
  switch (timeOfDay.toLowerCase()) {
    case 'morning':
      return 'bg-yellow-100 text-yellow-800 border-yellow-200';
    case 'midday':
    case 'noon':
      return 'bg-yellow-200 text-yellow-900 border-yellow-300';
    case 'afternoon':
      return 'bg-orange-100 text-orange-800 border-orange-200';
    case 'evening':
      return 'bg-orange-200 text-orange-900 border-orange-300';
    case 'night':
      return 'bg-blue-100 text-blue-800 border-blue-200';
    default:
      return 'bg-gray-100 text-gray-800 border-gray-200';
  }
}

export function SceneSegmentationResult({ result, isReadonly = false }: SceneSegmentationResultProps) {
  if (!result.success) {
    return (
      <Card className="border-red-200 bg-red-50">
        <CardContent className="p-4">
          <div className="flex items-center gap-2 text-red-700">
            <AlertCircle className="w-5 h-5" />
            <span className="font-medium">Scene Segmentation Failed</span>
          </div>
          <p className="text-sm text-red-600 mt-2">{result.message}</p>
        </CardContent>
      </Card>
    );
  }

  // Group scenes by environment for better organization
  const scenesByEnvironment = result.scenes.reduce((groups, scene) => {
    const env = scene.environment;
    if (!groups[env]) {
      groups[env] = [];
    }
    groups[env].push(scene);
    return groups;
  }, {} as Record<string, Scene[]>);

  return (
    <Card className="border-purple-200 bg-purple-50">
      <CardHeader className="pb-3">
        <CardTitle className="flex items-center gap-2 text-purple-900">
          <Film className="w-5 h-5" />
          Chapter {result.chapterNumber} Scene Segmentation
        </CardTitle>
        <div className="flex flex-wrap items-center gap-2">
          <Badge variant="outline" className="bg-white">
            {result.scenesCreated} scenes created
          </Badge>
          <Badge variant="secondary">
            {Object.keys(scenesByEnvironment).length} environments
          </Badge>
        </div>
      </CardHeader>
      
      <CardContent className="space-y-4">
        {/* Scene List */}
        <div className="space-y-3">
          {result.scenes.map((scene, index) => (
            <div key={scene.sceneId} className="bg-white rounded-lg p-4 border">
              <div className="flex items-start justify-between mb-3">
                <div className="flex items-center gap-2">
                  <div className="w-6 h-6 bg-purple-100 rounded-full flex items-center justify-center flex-shrink-0">
                    <span className="text-xs font-medium text-purple-700">{index + 1}</span>
                  </div>
                  <span className="font-medium text-gray-900">Scene {index + 1}</span>
                </div>
                <div className="flex items-center gap-2">
                  <Badge 
                    variant="outline" 
                    className={`text-xs ${getTimeOfDayColor(scene.timeOfDay)}`}
                  >
                    <div className="flex items-center gap-1">
                      {getTimeOfDayIcon(scene.timeOfDay)}
                      {scene.timeOfDay}
                    </div>
                  </Badge>
                </div>
              </div>

              <div className="space-y-2">
                <div className="flex items-center gap-2 text-sm text-gray-600">
                  <MapPin className="w-3 h-3" />
                  <span>{scene.environment}</span>
                </div>
                
                <p className="text-sm text-gray-700 leading-relaxed">
                  {scene.synopsis}
                </p>
                
                <div className="text-xs text-gray-500 font-mono bg-gray-50 px-2 py-1 rounded">
                  ID: {scene.sceneId}
                </div>
              </div>
            </div>
          ))}
        </div>

        {/* Environment Summary */}
        <div className="bg-white rounded-lg p-3">
          <div className="flex items-center gap-2 mb-3">
            <MapPin className="w-4 h-4 text-green-600" />
            <span className="font-medium text-gray-900">Environments Used</span>
            <Badge variant="outline">{Object.keys(scenesByEnvironment).length}</Badge>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
            {Object.entries(scenesByEnvironment).map(([environment, scenes]) => (
              <div key={environment} className="flex items-center justify-between p-2 bg-gray-50 rounded">
                <span className="text-sm text-gray-700">{environment}</span>
                <Badge variant="outline" className="text-xs">
                  {scenes.length} scene{scenes.length !== 1 ? 's' : ''}
                </Badge>
              </div>
            ))}
          </div>
        </div>

        {/* Time of Day Distribution */}
        <div className="bg-white rounded-lg p-3">
          <div className="flex items-center gap-2 mb-3">
            <Clock className="w-4 h-4 text-blue-600" />
            <span className="font-medium text-gray-900">Time Distribution</span>
          </div>
          <div className="flex flex-wrap gap-2">
            {Array.from(new Set(result.scenes.map(s => s.timeOfDay))).map(timeOfDay => {
              const count = result.scenes.filter(s => s.timeOfDay === timeOfDay).length;
              return (
                <Badge 
                  key={timeOfDay} 
                  variant="outline" 
                  className={`text-xs ${getTimeOfDayColor(timeOfDay)}`}
                >
                  <div className="flex items-center gap-1">
                    {getTimeOfDayIcon(timeOfDay)}
                    {timeOfDay} ({count})
                  </div>
                </Badge>
              );
            })}
          </div>
        </div>

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
              Approval required before proceeding to character portrait creation
            </div>
          )}
        </div>

        {/* Scene Statistics */}
        <div className="bg-gray-50 rounded-lg p-3">
          <div className="text-sm font-medium text-gray-700 mb-2">Segmentation Statistics</div>
          <div className="grid grid-cols-3 gap-4 text-sm">
            <div>
              <span className="text-gray-500">Total Scenes:</span>
              <span className="ml-1 font-medium">{result.scenesCreated}</span>
            </div>
            <div>
              <span className="text-gray-500">Environments:</span>
              <span className="ml-1 font-medium">{Object.keys(scenesByEnvironment).length}</span>
            </div>
            <div>
              <span className="text-gray-500">Time Periods:</span>
              <span className="ml-1 font-medium">{new Set(result.scenes.map(s => s.timeOfDay)).size}</span>
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
