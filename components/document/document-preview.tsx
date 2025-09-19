'use client';

import {
  memo,
  useCallback,
  useEffect,
  useMemo,
  useRef,
  type MouseEvent,
} from 'react';
import type { ArtifactKind, UIArtifact } from '@/components/artifact/artifact';
import { FileIcon, FullscreenIcon, ImageIcon, LoaderIcon } from '@/components/common/icons';
import { cn, fetcher } from '@/lib/utils';
import type { Document } from '@/lib/db/schema';
import { InlineDocumentSkeleton } from '@/components/document/document-skeleton';
import useSWR from 'swr';
import { Editor } from '@/components/editor/text-editor';
import { DocumentToolCall, DocumentToolResult } from './document';
import { useArtifact } from '@/hooks/use-artifact';
import equal from 'fast-deep-equal';
import { SpreadsheetEditor } from '@/components/editor/sheet-editor';
import { ImageEditor } from '@/components/editor/image-editor';

// Helper function to map database document kinds to valid artifact kinds
function mapDocumentKindToArtifactKind(kind: string): ArtifactKind {
  // Map old kinds to new valid ones
  if (kind === 'code') {
    return 'text';
  }
  
  // Return as-is for valid kinds
  return kind as ArtifactKind;
}

interface DocumentPreviewProps {
  isReadonly: boolean;
  result?: any;
  args?: any;
}

export function DocumentPreview({
  isReadonly,
  result,
  args,
}: DocumentPreviewProps) {
  const { artifact, setArtifact } = useArtifact();

  const { data: documents, isLoading: isDocumentsFetching } = useSWR<
    Array<Document>
  >(result ? `/api/document?id=${result.id}` : null, fetcher);

  const previewDocument = useMemo(() => documents?.[0], [documents]);
  const hitboxRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const boundingBox = hitboxRef.current?.getBoundingClientRect();

    if (artifact.documentId && boundingBox) {
      setArtifact((artifact) => ({
        ...artifact,
        boundingBox: {
          left: boundingBox.x,
          top: boundingBox.y,
          width: boundingBox.width,
          height: boundingBox.height,
        },
      }));
    }
  }, [artifact.documentId, setArtifact]);

  if (artifact.isVisible) {
    if (result) {
      return (
        <DocumentToolResult
          type="create"
          result={{ id: result.id, title: result.title, kind: result.kind }}
          isReadonly={isReadonly}
        />
      );
    }

    if (args) {
      return (
        <DocumentToolCall
          type="create"
          args={{ title: args.title }}
          isReadonly={isReadonly}
        />
      );
    }
  }

  if (isDocumentsFetching) {
    return <LoadingSkeleton artifactKind={mapDocumentKindToArtifactKind(result.kind ?? args.kind)} />;
  }

  const document: Document | null = previewDocument
    ? previewDocument
    : artifact.status === 'streaming' || artifact.content
      ? {
          title: artifact.title,
          kind: artifact.kind === 'book' ? 'text' : artifact.kind, // Convert book to text for Document type
          content:
            typeof artifact.content === 'string'
              ? artifact.content
              : JSON.stringify(artifact.content),
          id: artifact.documentId,
          createdAt: new Date(),
          userId: 'noop',
          is_latest: true,
          version: '1',
          chapterNumber: null,
          bookTitle: null,
        }
      : null;

  if (!document) return <LoadingSkeleton artifactKind={artifact.kind} />;

  return (
    <div className="relative w-full cursor-pointer">
      <HitboxLayer
        hitboxRef={hitboxRef}
        result={result}
        setArtifact={setArtifact}
      />
      <DocumentHeader
        title={document.title}
        kind={mapDocumentKindToArtifactKind(document.kind)}
        isStreaming={artifact.status === 'streaming'}
      />
      <DocumentContent document={{...document, kind: mapDocumentKindToArtifactKind(document.kind) as any}} />
    </div>
  );
}

const LoadingSkeleton = ({ artifactKind }: { artifactKind: ArtifactKind }) => (
  <div className="w-full">
    <div className="p-4 border rounded-t-2xl flex flex-row gap-2 items-center justify-between dark:bg-muted h-[57px] dark:border-zinc-700 border-b-0">
      <div className="flex flex-row items-center gap-3">
        <div className="text-muted-foreground">
          <div className="animate-pulse rounded-md size-4 bg-muted-foreground/20" />
        </div>
        <div className="animate-pulse rounded-lg h-4 bg-muted-foreground/20 w-24" />
      </div>
      <div>
        <FullscreenIcon />
      </div>
    </div>
    {artifactKind === 'image' ? (
      <div className="overflow-y-scroll border rounded-b-2xl bg-muted border-t-0 dark:border-zinc-700">
        <div className="animate-pulse h-[257px] bg-muted-foreground/20 w-full" />
      </div>
    ) : (
      <div className="overflow-y-scroll border rounded-b-2xl p-8 pt-4 bg-muted border-t-0 dark:border-zinc-700">
        <InlineDocumentSkeleton />
      </div>
    )}
  </div>
);

const PureHitboxLayer = ({
  hitboxRef,
  result,
  setArtifact,
}: {
  hitboxRef: React.RefObject<HTMLDivElement>;
  result: any;
  setArtifact: (
    updaterFn: UIArtifact | ((currentArtifact: UIArtifact) => UIArtifact),
  ) => void;
}) => {
  const handleClick = useCallback(
    (event: MouseEvent<HTMLElement>) => {
      const boundingBox = event.currentTarget.getBoundingClientRect();

      setArtifact((artifact) => {
        // If it's already streaming, just make it visible
        if (artifact.status === 'streaming') {
          return { ...artifact, isVisible: true };
        }

        // For other artifacts, update with result properties
        return {
          ...artifact,
          title: result.title,
          documentId: result.id,
          kind: result.kind,
          isVisible: true,
          boundingBox: {
            left: boundingBox.x,
            top: boundingBox.y,
            width: boundingBox.width,
            height: boundingBox.height,
          },
        };
      });
    },
    [setArtifact, result],
  );

  return (
    <div
      className="size-full absolute top-0 left-0 rounded-xl z-10"
      ref={hitboxRef}
      onClick={handleClick}
      role="presentation"
      aria-hidden="true"
    >
      <div className="w-full p-4 flex justify-end items-center">
        <div className="absolute right-[9px] top-[13px] p-2 hover:dark:bg-zinc-700 rounded-md hover:bg-zinc-100">
          <FullscreenIcon />
        </div>
      </div>
    </div>
  );
};

const HitboxLayer = memo(PureHitboxLayer, (prevProps, nextProps) => {
  if (!equal(prevProps.result, nextProps.result)) return false;
  return true;
});

const PureDocumentHeader = ({
  title,
  kind,
  isStreaming,
}: {
  title: string;
  kind: ArtifactKind;
  isStreaming: boolean;
}) => {
  // Filter out unsupported kinds
  const displayKind = kind === 'memory' ? 'text' : kind;

  return (
    <div className="p-4 border rounded-t-2xl flex flex-row gap-2 items-start sm:items-center justify-between dark:bg-muted border-b-0 dark:border-zinc-700">
      <div className="flex flex-row items-start sm:items-center gap-3">
        <div className="text-muted-foreground">
          {isStreaming ? (
            <div className="animate-spin">
              <LoaderIcon />
            </div>
          ) : displayKind === 'image' ? (
            <ImageIcon />
          ) : (
            <FileIcon />
          )}
        </div>
        <div className="-translate-y-1 sm:translate-y-0 font-medium">{title}</div>
      </div>
      <div className="w-8" />
    </div>
  );
};

const DocumentHeader = memo(PureDocumentHeader, (prevProps, nextProps) => {
  if (prevProps.title !== nextProps.title) return false;
  if (prevProps.isStreaming !== nextProps.isStreaming) return false;

  return true;
});

const DocumentContent = ({ document }: { document: Document }) => {
  const { artifact } = useArtifact();

  const containerClassName = cn(
    'h-[257px] overflow-y-scroll border rounded-b-2xl dark:bg-muted border-t-0 dark:border-zinc-700',
    {
      'p-4 sm:px-14 sm:py-16': document.kind === 'text',
      'p-0': false, // Removed code artifact kind check
    },
  );

  const commonProps = {
    content: document.content ?? '',
    isCurrentVersion: true,
    currentVersionIndex: 0,
    status: artifact.status,
    saveContent: () => {},
    suggestions: [],
  };

  return (
    <div className={containerClassName}>
      {document.kind === 'text' ? (
        <Editor {...commonProps} onSaveContent={() => {}} />
      ) : document.kind === 'sheet' ? (
        <div className="flex flex-1 relative size-full p-4">
          <div className="absolute inset-0">
            <SpreadsheetEditor {...commonProps} />
          </div>
        </div>
      ) : document.kind === 'image' ? (
        <ImageEditor
          title={document.title}
          content={document.content ?? ''}
          isCurrentVersion={true}
          currentVersionIndex={0}
          status={artifact.status}
          isInline={true}
        />
      ) : null}
    </div>
  );
};
