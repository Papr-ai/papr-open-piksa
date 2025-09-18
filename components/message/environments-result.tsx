import React from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { CheckCircle, Clock, MapPin, Image, Star, AlertCircle, Plus, Sun, Cloud } from 'lucide-react';

interface EnvironmentResult {
  environmentId: string;
  location: string;
  timeOfDay: string;
  weather: string;
  environmentImageUrl: string;
  existingEnvironment: boolean;
  persistentElements: string[];
}

interface EnvironmentsResultProps {
  result: {
    success: boolean;
    bookId: string;
    environmentsProcessed: number;
    results: EnvironmentResult[];
    nextStep: string;
    approvalRequired: boolean;
    canCreateMoreEnvironments: boolean;
    maxBatchSize: number;
    message?: string;
  };
  isReadonly?: boolean;
}

export function EnvironmentsResult({ result, isReadonly = false }: EnvironmentsResultProps) {
  if (!result.success) {
    return (
      <Card className="border-red-200 bg-red-50">
        <CardContent className="p-4">
          <div className="flex items-center gap-2 text-red-700">
            <AlertCircle className="w-5 h-5" />
            <span className="font-medium">Environment Creation Failed</span>
          </div>
          <p className="text-sm text-red-600 mt-2">{result.message}</p>
        </CardContent>
      </Card>
    );
  }

  const existingEnvironments = result.results.filter(env => env.existingEnvironment).length;
  const newEnvironments = result.results.filter(env => !env.existingEnvironment).length;
  const totalPersistentElements = result.results.reduce((sum, env) => sum + env.persistentElements.length, 0);

  const getTimeIcon = (timeOfDay: string) => {
    const time = timeOfDay.toLowerCase();
    if (time.includes('morning') || time.includes('dawn')) return '🌅';
    if (time.includes('noon') || time.includes('midday')) return '☀️';
    if (time.includes('afternoon')) return '🌤️';
    if (time.includes('evening') || time.includes('sunset')) return '🌇';
    if (time.includes('night') || time.includes('midnight')) return '🌙';
    return '🕐';
  };

  const getWeatherIcon = (weather: string) => {
    const w = weather.toLowerCase();
    if (w.includes('sunny') || w.includes('clear')) return '☀️';
    if (w.includes('cloudy') || w.includes('overcast')) return '☁️';
    if (w.includes('rain')) return '🌧️';
    if (w.includes('storm')) return '⛈️';
    if (w.includes('snow')) return '❄️';
    return '🌤️';
  };

  return (
    <Card className="border-green-200 bg-green-50">
      <CardHeader className="pb-3">
        <CardTitle className="flex items-center gap-2 text-green-900">
          <MapPin className="w-5 h-5" />
          Environments Created
        </CardTitle>
        <div className="flex flex-wrap items-center gap-2">
          <Badge variant="outline" className="bg-white">
            {result.environmentsProcessed} environments
          </Badge>
          {newEnvironments > 0 && (
            <Badge variant="secondary" className="bg-green-100 text-green-800">
              {newEnvironments} new
            </Badge>
          )}
          {existingEnvironments > 0 && (
            <Badge variant="outline" className="bg-yellow-100 text-yellow-800">
              {existingEnvironments} existing
            </Badge>
          )}
          {totalPersistentElements > 0 && (
            <Badge variant="outline">
              {totalPersistentElements} elements
            </Badge>
          )}
        </div>
      </CardHeader>
      
      <CardContent className="space-y-4">
        {/* Environment Gallery */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {result.results.map((environment, index) => (
            <div key={environment.environmentId} className="bg-white rounded-lg p-3 border">
              <div className="space-y-3">
                {/* Environment Image */}
                <div className="relative">
                  <img
                    src={environment.environmentImageUrl}
                    alt={`${environment.location} environment`}
                    className="w-full h-32 object-cover rounded-lg bg-gray-100"
                    onError={(e) => {
                      const target = e.target as HTMLImageElement;
                      target.src = 'data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iMjAwIiBoZWlnaHQ9IjEyOCIgeG1sbnM9Imh0dHA6Ly93d3cudzMub3JnLzIwMDAvc3ZnIj48cmVjdCB3aWR0aD0iMjAwIiBoZWlnaHQ9IjEyOCIgZmlsbD0iI2Y3ZjdmNyIvPjx0ZXh0IHg9IjUwJSIgeT0iNTAlIiBmb250LWZhbWlseT0iQXJpYWwiIGZvbnQtc2l6ZT0iMTIiIGZpbGw9IiM5OTk5OTkiIHRleHQtYW5jaG9yPSJtaWRkbGUiIGR5PSIuM2VtIj5FbnZpcm9ubWVudCBub3QgYXZhaWxhYmxlPC90ZXh0Pjwvc3ZnPg==';
                    }}
                  />
                  
                  {/* Status Indicators */}
                  <div className="absolute top-2 right-2 flex gap-1">
                    {environment.existingEnvironment ? (
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

                  {/* Time & Weather Overlay */}
                  <div className="absolute bottom-2 left-2 flex gap-1">
                    <Badge variant="outline" className="text-xs bg-white/90 backdrop-blur-sm">
                      {getTimeIcon(environment.timeOfDay)} {environment.timeOfDay}
                    </Badge>
                    <Badge variant="outline" className="text-xs bg-white/90 backdrop-blur-sm">
                      {getWeatherIcon(environment.weather)} {environment.weather}
                    </Badge>
                  </div>
                </div>

                {/* Environment Info */}
                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <h4 className="font-medium text-gray-900 text-sm">{environment.location}</h4>
                    {environment.persistentElements.length > 0 && (
                      <Badge variant="outline" className="text-xs">
                        {environment.persistentElements.length} elements
                      </Badge>
                    )}
                  </div>
                  
                  {/* Environment Details */}
                  <div className="text-xs text-gray-500 space-y-1">
                    <div className="flex items-center gap-2">
                      <MapPin className="w-3 h-3" />
                      <span>Environment {environment.existingEnvironment ? 'reused' : 'generated'}</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <Image className="w-3 h-3" />
                      <span>ID: {environment.environmentId}</span>
                    </div>
                    {environment.persistentElements.length > 0 && (
                      <div className="flex items-center gap-2">
                        <Star className="w-3 h-3" />
                        <span>{environment.persistentElements.length} persistent elements</span>
                      </div>
                    )}
                  </div>

                  {/* Persistent Elements */}
                  {environment.persistentElements.length > 0 && (
                    <div className="mt-2">
                      <div className="text-xs font-medium text-gray-700 mb-1">Elements:</div>
                      <div className="flex flex-wrap gap-1">
                        {environment.persistentElements.slice(0, 3).map((element, elemIndex) => (
                          <Badge key={elemIndex} variant="outline" className="text-xs">
                            {element}
                          </Badge>
                        ))}
                        {environment.persistentElements.length > 3 && (
                          <Badge variant="outline" className="text-xs">
                            +{environment.persistentElements.length - 3}
                          </Badge>
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
              <div className="text-lg font-semibold text-green-600">{result.environmentsProcessed}</div>
              <div className="text-xs text-gray-500">Total Environments</div>
            </div>
            <div className="text-center">
              <div className="text-lg font-semibold text-blue-600">{newEnvironments}</div>
              <div className="text-xs text-gray-500">New Created</div>
            </div>
            <div className="text-center">
              <div className="text-lg font-semibold text-yellow-600">{existingEnvironments}</div>
              <div className="text-xs text-gray-500">Existing Used</div>
            </div>
            <div className="text-center">
              <div className="text-lg font-semibold text-purple-600">{totalPersistentElements}</div>
              <div className="text-xs text-gray-500">Elements Total</div>
            </div>
          </div>
        </div>

        {/* More Environments Available */}
        {result.canCreateMoreEnvironments && (
          <div className="bg-indigo-50 rounded-lg p-3 border border-indigo-200">
            <div className="flex items-center gap-2 mb-2">
              <Plus className="w-4 h-4 text-indigo-600" />
              <span className="font-medium text-indigo-900">More Environments Available</span>
            </div>
            <p className="text-sm text-indigo-800">
              You can create more environments (up to {result.maxBatchSize} at a time) or proceed to scene creation.
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
              Approval required before proceeding to scene creation
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  );
}
