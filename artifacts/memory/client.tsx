import { Artifact } from '@/components/create-artifact';
import { Editor } from '@/components/text-editor';

export const memoryArtifact = new Artifact<'memory'>({
  kind: 'memory',
  description: 'Used for displaying memory content.',
  initialize: async () => {
    // No initialization needed for memory artifacts
  },
  onStreamPart: ({ streamPart, setArtifact }) => {
    if (streamPart.type === 'text-delta') {
      setArtifact((draftArtifact) => ({
        ...draftArtifact,
        content: (draftArtifact.content || '') + (streamPart.content as string),
        status: 'streaming',
      }));
    }
  },
  content: ({
    content,
    status,
    isCurrentVersion,
    currentVersionIndex,
    onSaveContent,
  }) => {
    return (
      <div className="flex flex-row py-8 md:p-20 px-4">
        <Editor
          content={content || ''}
          suggestions={[]}
          isCurrentVersion={isCurrentVersion}
          currentVersionIndex={currentVersionIndex}
          status={status}
          onSaveContent={onSaveContent}
        />
      </div>
    );
  },
  actions: [],
  toolbar: [],
}); 