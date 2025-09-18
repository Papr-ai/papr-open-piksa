import React from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { CheckCircle, Clock, Film, AlertCircle, Users, MapPin, Star, XCircle } from 'lucide-react';

interface ContinuityCheck {
  item: string;
  requirement: string;
  status: 'verified' | 'missing' | 'inconsistent';
}

interface SceneManifestResultProps {
  result: {
    success: boolean;
    bookId: string;
    sceneId: string;
    environmentId: string;
    assetsFound: {
      environment: boolean;
      charactersFound: number;
      charactersRequired: number;
      propsFound: number;
      propsRequired: number;
    };
    missingAssets: string[];
    continuityChecks: ContinuityCheck[];
    nextStep: string;
    approvalRequired: boolean;
    canProceedToRender: boolean;
    message?: string;
  };
  isReadonly?: boolean;
}

export function SceneManifestResult({ result, isReadonly = false }: SceneManifestResultProps) {
  if (!result.success) {
    return (
      <Card className="border-red-200 bg-red-50">
        <CardContent className="p-4">
          <div className="flex items-center gap-2 text-red-700">
            <AlertCircle className="w-5 h-5" />
            <span className="font-medium">Scene Manifest Creation Failed</span>
          </div>
          <p className="text-sm text-red-600 mt-2">{result.message}</p>
        </CardContent>
      </Card>
    );
  }

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'verified': return <CheckCircle className="w-4 h-4 text-green-600" />;
      case 'missing': return <XCircle className="w-4 h-4 text-red-600" />;
      case 'inconsistent': return <AlertCircle className="w-4 h-4 text-yellow-600" />;
      default: return <Clock className="w-4 h-4 text-gray-600" />;
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'verified': return 'bg-green-100 text-green-800 border-green-300';
      case 'missing': return 'bg-red-100 text-red-800 border-red-300';
      case 'inconsistent': return 'bg-yellow-100 text-yellow-800 border-yellow-300';
      default: return 'bg-gray-100 text-gray-800 border-gray-300';
    }
  };

  return (
    <Card className="border-indigo-200 bg-indigo-50">
      <CardHeader className="pb-3">
        <CardTitle className="flex items-center gap-2 text-indigo-900">
          <Film className="w-5 h-5" />
          Scene Manifest Created
        </CardTitle>
        <div className="flex flex-wrap items-center gap-2">
          <Badge variant="outline" className="bg-white">
            {result.sceneId}
          </Badge>
          {result.canProceedToRender ? (
            <Badge variant="secondary" className="bg-green-100 text-green-800">
              Ready to Render
            </Badge>
          ) : (
            <Badge variant="outline" className="bg-yellow-100 text-yellow-800">
              Missing Assets
            </Badge>
          )}
        </div>
      </CardHeader>
      
      <CardContent className="space-y-4">
        {/* Scene Details */}
        <div className="bg-white rounded-lg p-3">
          <div className="flex items-center gap-2 mb-3">
            <MapPin className="w-4 h-4 text-indigo-600" />
            <span className="font-medium text-gray-900">Scene Details</span>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3 text-sm">
            <div>
              <div className="text-xs text-gray-500">Scene ID</div>
              <div className="font-medium">{result.sceneId}</div>
            </div>
            <div>
              <div className="text-xs text-gray-500">Environment</div>
              <div className="font-medium">{result.environmentId}</div>
            </div>
          </div>
        </div>

        {/* Asset Status */}
        <div className="bg-white rounded-lg p-3">
          <div className="flex items-center gap-2 mb-3">
            <Star className="w-4 h-4 text-indigo-600" />
            <span className="font-medium text-gray-900">Asset Status</span>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-sm">
            <div className="text-center">
              <div className={`text-lg font-semibold ${result.assetsFound.environment ? 'text-green-600' : 'text-red-600'}`}>
                {result.assetsFound.environment ? '✓' : '✗'}
              </div>
              <div className="text-xs text-gray-500">Environment</div>
            </div>
            <div className="text-center">
              <div className={`text-lg font-semibold ${result.assetsFound.charactersFound === result.assetsFound.charactersRequired ? 'text-green-600' : 'text-yellow-600'}`}>
                {result.assetsFound.charactersFound}/{result.assetsFound.charactersRequired}
              </div>
              <div className="text-xs text-gray-500">Characters</div>
            </div>
            <div className="text-center">
              <div className={`text-lg font-semibold ${result.assetsFound.propsFound === result.assetsFound.propsRequired ? 'text-green-600' : 'text-yellow-600'}`}>
                {result.assetsFound.propsFound}/{result.assetsFound.propsRequired}
              </div>
              <div className="text-xs text-gray-500">Props</div>
            </div>
          </div>
        </div>

        {/* Missing Assets Warning */}
        {result.missingAssets.length > 0 && (
          <div className="bg-yellow-50 rounded-lg p-3 border border-yellow-200">
            <div className="flex items-center gap-2 mb-2">
              <AlertCircle className="w-4 h-4 text-yellow-600" />
              <span className="font-medium text-yellow-900">Missing Assets</span>
            </div>
            <div className="flex flex-wrap gap-1">
              {result.missingAssets.map((asset, index) => (
                <Badge key={index} variant="outline" className="bg-yellow-100 text-yellow-800 border-yellow-300">
                  {asset}
                </Badge>
              ))}
            </div>
          </div>
        )}

        {/* Continuity Checks */}
        {result.continuityChecks.length > 0 && (
          <div className="bg-white rounded-lg p-3">
            <div className="flex items-center gap-2 mb-3">
              <Users className="w-4 h-4 text-indigo-600" />
              <span className="font-medium text-gray-900">Continuity Checks</span>
            </div>
            <div className="space-y-2">
              {result.continuityChecks.map((check, index) => (
                <div key={index} className="flex items-start gap-3 p-2 rounded border">
                  {getStatusIcon(check.status)}
                  <div className="flex-1">
                    <div className="font-medium text-sm">{check.item}</div>
                    <div className="text-xs text-gray-600">{check.requirement}</div>
                  </div>
                  <Badge variant="outline" className={`text-xs ${getStatusColor(check.status)}`}>
                    {check.status}
                  </Badge>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Next Steps */}
        <div className={`rounded-lg p-3 border ${result.canProceedToRender ? 'bg-green-50 border-green-200' : 'bg-yellow-50 border-yellow-200'}`}>
          <div className="flex items-center gap-2 mb-2">
            <Clock className={`w-4 h-4 ${result.canProceedToRender ? 'text-green-600' : 'text-yellow-600'}`} />
            <span className={`font-medium ${result.canProceedToRender ? 'text-green-900' : 'text-yellow-900'}`}>Next Step</span>
          </div>
          <p className={`text-sm ${result.canProceedToRender ? 'text-green-800' : 'text-yellow-800'}`}>
            {result.nextStep}
          </p>
          {result.approvalRequired && (
            <div className="mt-2 flex items-center gap-2 text-xs text-gray-700">
              <CheckCircle className="w-3 h-3" />
              Approval required before proceeding to scene rendering
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  );
}
