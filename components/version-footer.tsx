'use client';

import { motion } from 'framer-motion';
import { useState } from 'react';
import { useSWRConfig } from 'swr';
import { useWindowSize } from 'usehooks-ts';

import type { Document } from '@/lib/db/schema';
import { getDocumentTimestampByIndex } from '@/lib/utils';

import { LoaderIcon } from './icons';
import { Button } from './ui/button';
import { useArtifact } from '@/hooks/use-artifact';

interface VersionFooterProps {
  handleVersionChange: (type: 'next' | 'prev' | 'toggle' | 'latest') => void;
  documents: Array<Document> | undefined;
  currentVersionIndex: number;
}

export const VersionFooter = ({
  handleVersionChange,
  documents,
  currentVersionIndex,
}: VersionFooterProps) => {
  const { artifact } = useArtifact();

  const { width } = useWindowSize();
  const isMobile = width < 768;

  const { mutate } = useSWRConfig();
  const [isMutating, setIsMutating] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (!documents) return null;

  const handleRestoreVersion = async () => {
    try {
      setError(null);
      setIsMutating(true);
      console.log('[VERSION FOOTER] Restoring version', {
        documentId: artifact.documentId,
        currentVersionIndex,
        totalVersions: documents.length,
      });

      const timestamp = getDocumentTimestampByIndex(
        documents,
        currentVersionIndex,
      );

      if (!timestamp) {
        throw new Error('Invalid timestamp for selected version');
      }

      const response = await fetch(`/api/document?id=${artifact.documentId}`, {
        method: 'PATCH',
        body: JSON.stringify({
          timestamp,
        }),
      });

      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`Failed to restore version: ${errorText}`);
      }

      // Update local cache with the optimistic result
      await mutate(
        `/api/document?id=${artifact.documentId}`,
        async () => {
          // Filter to keep only documents up to current version
          const filteredDocuments = documents.filter(
            (doc, index) => index <= currentVersionIndex,
          );

          console.log('[VERSION FOOTER] Version restored successfully', {
            documentId: artifact.documentId,
            remainingVersions: filteredDocuments.length,
          });

          return filteredDocuments;
        },
        { revalidate: true },
      );

      // Navigate to latest version after restore
      handleVersionChange('latest');
    } catch (err) {
      console.error('[VERSION FOOTER] Error restoring version:', err);
      setError(
        err instanceof Error ? err.message : 'Failed to restore version',
      );
    } finally {
      setIsMutating(false);
    }
  };

  return (
    <motion.div
      className="absolute flex flex-col gap-4 lg:flex-row bottom-0 bg-background p-4 w-full border-t z-50 justify-between"
      initial={{ y: isMobile ? 200 : 77 }}
      animate={{ y: 0 }}
      exit={{ y: isMobile ? 200 : 77 }}
      transition={{ type: 'spring', stiffness: 140, damping: 20 }}
    >
      <div>
        <div>You are viewing a previous version</div>
        <div className="text-muted-foreground text-sm">
          {error ? (
            <span className="text-red-500">{error}</span>
          ) : (
            <span>
              Version {currentVersionIndex + 1} of {documents.length} - Restore
              this version to make edits
            </span>
          )}
        </div>
      </div>

      <div className="flex flex-row gap-4">
        <Button disabled={isMutating} onClick={handleRestoreVersion}>
          <div>{isMutating ? 'Restoring...' : 'Restore this version'}</div>
          {isMutating && (
            <div className="ml-2 animate-spin">
              <LoaderIcon />
            </div>
          )}
        </Button>
        <Button
          variant="outline"
          onClick={() => {
            handleVersionChange('latest');
          }}
        >
          Back to latest version
        </Button>
      </div>
    </motion.div>
  );
};
