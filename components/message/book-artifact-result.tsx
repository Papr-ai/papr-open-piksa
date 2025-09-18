import React from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { 
  BookOpen, 
  CheckCircle, 
  Clock, 
  ArrowRight,
  Sparkles,
  RefreshCw,
  AlertCircle
} from 'lucide-react';

interface BookArtifactResultProps {
  result: {
    success: boolean;
    action: string;
    bookId: string;
    artifactCreated?: boolean;
    currentStep?: number;
    stepNumber?: number;
    stepUpdated?: boolean;
    stepApproved?: boolean;
    awaitingUserApproval?: boolean;
    needsRevision?: boolean;
    regenerating?: boolean;
    bookFinalized?: boolean;
    nextAction?: string;
    message: string;
    userFeedback?: string;
    error?: string;
  };
}

const ACTION_ICONS = {
  initialize: BookOpen,
  update_step: Clock,
  approve_step: CheckCircle,
  regenerate: RefreshCw,
  finalize: Sparkles
};

const ACTION_COLORS = {
  initialize: 'bg-blue-50 border-blue-200 text-blue-700',
  update_step: 'bg-orange-50 border-orange-200 text-orange-700',
  approve_step: 'bg-green-50 border-green-200 text-green-700',
  regenerate: 'bg-purple-50 border-purple-200 text-purple-700',
  finalize: 'bg-emerald-50 border-emerald-200 text-emerald-700'
};

export function BookArtifactResult({ result }: BookArtifactResultProps) {
  const { 
    success, 
    action, 
    bookId, 
    artifactCreated, 
    currentStep, 
    stepNumber,
    stepUpdated,
    stepApproved,
    awaitingUserApproval,
    needsRevision,
    regenerating,
    bookFinalized,
    nextAction, 
    message,
    userFeedback,
    error
  } = result;

  const IconComponent = ACTION_ICONS[action as keyof typeof ACTION_ICONS] || BookOpen;
  const colorClass = ACTION_COLORS[action as keyof typeof ACTION_COLORS] || ACTION_COLORS.initialize;

  if (!success && error) {
    return (
      <Card className="w-fit border-red-200 bg-red-50">
        <CardContent className="p-4">
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-full bg-red-100">
              <AlertCircle className="w-5 h-5 text-red-600" />
            </div>
            <div>
              <div className="font-medium text-red-900">Book Creation Error</div>
              <div className="text-sm text-red-700">{error}</div>
            </div>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className={`w-fit border ${colorClass}`}>
      <CardHeader className="pb-3">
        <div className="flex items-center gap-3">
          <div className="p-2 rounded-full bg-white/50">
            <IconComponent className="w-5 h-5" />
          </div>
          <div>
            <CardTitle className="text-base">
              {action === 'initialize' && 'Book Creation Initialized'}
              {action === 'update_step' && `Step ${stepNumber || '?'} Updated`}
              {action === 'approve_step' && stepApproved && `Step ${stepNumber || '?'} Approved`}
              {action === 'approve_step' && needsRevision && `Step ${stepNumber || '?'} Needs Revision`}
              {action === 'regenerate' && `Step ${stepNumber || '?'} Regenerating`}
              {action === 'finalize' && 'Book Creation Complete'}
            </CardTitle>
            <div className="flex items-center gap-2 mt-1">
              <Badge variant="outline" className="text-xs">
                Book ID: {bookId.slice(0, 8)}...
              </Badge>
              {currentStep && (
                <Badge variant="secondary" className="text-xs">
                  Step {currentStep}/6
                </Badge>
              )}
            </div>
          </div>
        </div>
      </CardHeader>

      <CardContent className="pt-0">
        <div className="space-y-3">
          {/* Main message */}
          <p className="text-sm">{message}</p>

          {/* Status indicators */}
          <div className="flex flex-wrap gap-2">
            {artifactCreated && (
              <div className="flex items-center gap-1 text-xs text-green-600">
                <CheckCircle className="w-3 h-3" />
                Artifact Created
              </div>
            )}
            {stepUpdated && (
              <div className="flex items-center gap-1 text-xs text-blue-600">
                <Clock className="w-3 h-3" />
                Step Updated
              </div>
            )}
            {awaitingUserApproval && (
              <div className="flex items-center gap-1 text-xs text-orange-600">
                <Clock className="w-3 h-3" />
                Awaiting Approval
              </div>
            )}
            {regenerating && (
              <div className="flex items-center gap-1 text-xs text-purple-600">
                <RefreshCw className="w-3 h-3 animate-spin" />
                Regenerating
              </div>
            )}
            {bookFinalized && (
              <div className="flex items-center gap-1 text-xs text-emerald-600">
                <Sparkles className="w-3 h-3" />
                Book Complete
              </div>
            )}
          </div>

          {/* User feedback */}
          {userFeedback && (
            <div className="p-2 bg-gray-50 rounded text-xs">
              <div className="font-medium text-gray-700 mb-1">User Feedback:</div>
              <div className="text-gray-600">{userFeedback}</div>
            </div>
          )}

          {/* Next action */}
          {nextAction && (
            <div className="flex items-start gap-2 p-2 bg-white/50 rounded text-xs">
              <ArrowRight className="w-3 h-3 mt-0.5 text-gray-500" />
              <div>
                <div className="font-medium text-gray-700 mb-1">Next:</div>
                <div className="text-gray-600">{nextAction}</div>
              </div>
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  );
}
