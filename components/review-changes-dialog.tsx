import { useEffect, useState } from 'react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { GitCommitIcon, GitBranchIcon, CheckIcon, XIcon } from 'lucide-react';
import { Skeleton } from '@/components/ui/skeleton';
import { diffLines } from 'diff';
import { toast } from 'sonner';

interface ReviewChangesDialogProps {
  isOpen: boolean;
  onClose: () => void;
  changes: Array<{
    path: string;
    content: string;
    originalContent: string;
    source: 'ai' | 'user';
  }>;
  isLoading: boolean;
  error: string | null;
  onApply: () => Promise<void>;
  branchName?: string | null;
}

export function ReviewChangesDialog({
  isOpen,
  onClose,
  changes,
  isLoading,
  error,
  onApply,
  branchName,
}: ReviewChangesDialogProps) {
  const [selectedChange, setSelectedChange] = useState<number>(0);
  const [diffView, setDiffView] = useState<Array<{ value: string; added?: boolean; removed?: boolean }>>([]);

  // Generate diff when selected change updates
  useEffect(() => {
    if (changes.length === 0) return;
    
    const change = changes[selectedChange];
    const diff = diffLines(change.originalContent || '', change.content);
    setDiffView(diff);
  }, [selectedChange, changes]);

  if (!isOpen) return null;

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-4xl max-h-[80vh] flex flex-col">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <GitCommitIcon className="w-5 h-5" />
            Review Changes
          </DialogTitle>
          <DialogDescription className="flex items-center gap-2">
            <GitBranchIcon className="w-4 h-4" />
            {branchName ? (
              <span>Changes will be staged on branch: <code className="bg-gray-100 px-1 py-0.5 rounded">{branchName}</code></span>
            ) : (
              <span>Creating new staging branch...</span>
            )}
          </DialogDescription>
        </DialogHeader>

        {error && (
          <div className="bg-red-50 border border-red-200 rounded-md p-3 mb-4">
            <p className="text-red-700">{error}</p>
          </div>
        )}

        <div className="flex-1 min-h-0 flex gap-4">
          {/* File List */}
          <div className="w-64 border-r pr-4 overflow-y-auto">
            <h3 className="font-medium mb-2">Changed Files</h3>
            {changes.map((change, index) => (
              <button
                key={change.path}
                onClick={() => setSelectedChange(index)}
                className={`w-full text-left p-2 rounded-md mb-1 text-sm ${
                  selectedChange === index
                    ? 'bg-blue-50 border border-blue-200'
                    : 'hover:bg-gray-50'
                }`}
              >
                <div className="flex items-center gap-2">
                  <span className="truncate">{change.path}</span>
                  <span className={`text-xs px-1.5 py-0.5 rounded-full ${
                    change.source === 'ai' 
                      ? 'bg-purple-100 text-purple-800'
                      : 'bg-blue-100 text-blue-800'
                  }`}>
                    {change.source}
                  </span>
                </div>
              </button>
            ))}
          </div>

          {/* Diff View */}
          <div className="flex-1 overflow-hidden flex flex-col">
            {isLoading ? (
              <div className="space-y-2">
                <Skeleton className="h-4 w-3/4" />
                <Skeleton className="h-4 w-1/2" />
                <Skeleton className="h-4 w-2/3" />
              </div>
            ) : changes.length > 0 ? (
              <>
                <div className="flex items-center justify-between mb-2">
                  <h3 className="font-medium">
                    {changes[selectedChange].path}
                  </h3>
                  <div className="text-sm text-gray-500">
                    {selectedChange + 1} of {changes.length}
                  </div>
                </div>
                <div className="flex-1 overflow-y-auto font-mono text-sm bg-gray-50 p-4 rounded-md">
                  {diffView.map((part, i) => (
                    <pre
                      key={i}
                      className={`${
                        part.added
                          ? 'bg-green-100 text-green-800'
                          : part.removed
                          ? 'bg-red-100 text-red-800'
                          : ''
                      }`}
                    >
                      {part.value}
                    </pre>
                  ))}
                </div>
              </>
            ) : (
              <div className="flex items-center justify-center h-full text-gray-500">
                No changes to review
              </div>
            )}
          </div>
        </div>

        <div className="flex justify-end gap-2 mt-4 pt-4 border-t">
          <Button
            variant="outline"
            onClick={onClose}
            disabled={isLoading}
          >
            <XIcon className="w-4 h-4 mr-2" />
            Cancel
          </Button>
          <Button
            onClick={onApply}
            disabled={isLoading || changes.length === 0 || !branchName}
          >
            <CheckIcon className="w-4 h-4 mr-2" />
            {isLoading ? 'Staging Changes...' : 'Stage Changes'}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
} 