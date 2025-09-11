import { CheckCircle, AlertTriangle } from 'lucide-react';

interface SceneImageAutoInsertedResultProps {
  imageType: 'scene';
  imageId: string;
  name: string;
  imageUrl: string;
  bookTitle: string;
  chapterNumber: number;
  sceneId: string;
  insertedSuccessfully: boolean;
  error?: string;
}

export function SceneImageAutoInsertedResult({
  imageType,
  name,
  imageUrl,
  bookTitle,
  chapterNumber,
  sceneId,
  insertedSuccessfully,
  error
}: SceneImageAutoInsertedResultProps) {
  return (
    <div className="rounded-lg border bg-white p-4 shadow-sm">
      <div className="flex items-start gap-3">
        {insertedSuccessfully ? (
          <CheckCircle className="h-6 w-6 text-green-500 flex-shrink-0 mt-0.5" />
        ) : (
          <AlertTriangle className="h-6 w-6 text-yellow-500 flex-shrink-0 mt-0.5" />
        )}
        
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 mb-2">
            <h3 className="font-semibold text-gray-900">
              {insertedSuccessfully ? '✅ Scene Image Auto-Inserted' : '⚠️ Scene Image Created (Manual Insertion Needed)'}
            </h3>
          </div>
          
          <div className="space-y-2 text-sm text-gray-600">
            <div><strong>Scene:</strong> {name}</div>
            <div><strong>Book:</strong> {bookTitle}</div>
            <div><strong>Chapter:</strong> {chapterNumber}</div>
            <div><strong>Scene ID:</strong> {sceneId}</div>
            
            {insertedSuccessfully ? (
              <div className="text-green-700 bg-green-50 p-2 rounded">
                🎉 The scene image has been automatically placed in your book! You can now see it in the scene block when editing the chapter.
              </div>
            ) : (
              <div className="text-yellow-700 bg-yellow-50 p-2 rounded">
                <div className="font-medium mb-1">Manual insertion required:</div>
                <div>{error || 'The scene image was created but could not be automatically inserted into the book.'}</div>
                <div className="mt-1 text-xs">You can manually copy and paste the image into the appropriate scene in your book editor.</div>
              </div>
            )}
          </div>
          
          {/* Display the created image */}
          <div className="mt-4">
            <img 
              src={imageUrl} 
              alt={name}
              className="max-w-full h-auto rounded-lg border shadow-sm"
              style={{ maxHeight: '300px' }}
            />
          </div>
          
          {!insertedSuccessfully && (
            <div className="mt-3 text-xs text-gray-500">
              <strong>Image URL:</strong> <code className="bg-gray-100 px-1 rounded">{imageUrl}</code>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
