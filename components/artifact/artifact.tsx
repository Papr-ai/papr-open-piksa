import type { FileUIPart, UIMessage } from 'ai';
import { formatDistance } from 'date-fns';
import { AnimatePresence, motion } from 'framer-motion';
import {
  type Dispatch,
  memo,
  type SetStateAction,
  useCallback,
  useEffect,
  useState,
} from 'react';
import useSWR, { useSWRConfig } from 'swr';
import { useDebounceCallback, useWindowSize } from 'usehooks-ts';
import type { Document, Vote } from '@/lib/db/schema';
import { fetcher } from '@/lib/utils';
import { MultimodalInput } from '../message/multimodal-input';
import { Toolbar } from '../layout/toolbar';
import { VersionFooter } from '../layout/version-footer';
import { ArtifactActions } from './artifact-actions';
import { ArtifactCloseButton } from './artifact-close-button';
import { ArtifactMessages } from './artifact-messages';
import { useSidebar } from '../ui/sidebar';
import { useArtifact } from '@/hooks/use-artifact';
import { imageArtifact } from '@/artifacts/image/client';
import { sheetArtifact } from '@/artifacts/sheet/client';
import { textArtifact } from '@/artifacts/text/client';
import { memoryArtifact } from '@/artifacts/memory/client';
import { bookArtifact } from '@/artifacts/book/client';
import equal from 'fast-deep-equal';
import type { UseChatHelpers } from '@ai-sdk/react';
import type { VisibilityType } from '@/components/message/visibility-selector';
import { UsageWarning } from '@/components/subscription/usage-warning';

export interface ArtifactContentProps {
  content: any;
  mode?: 'edit' | 'diff';
  status?: string;
  currentVersionIndex?: number;
  suggestions?: any[];
  onSaveContent?: (content: string, debounce: boolean) => void;
  isInline?: boolean;
  isCurrentVersion?: boolean;
  getDocumentContentById?: (index: number) => string;
  isLoading?: boolean;
  metadata?: any;
  setMetadata?: (metadata: any) => void;
  language?: string;
  handleVersionChange?: (type: 'next' | 'prev' | 'toggle' | 'latest') => void;
  totalVersions?: number;
}

export const artifactDefinitions = [
  textArtifact,
  imageArtifact,
  sheetArtifact,
  memoryArtifact,
  bookArtifact,
];
export type ArtifactKind = (typeof artifactDefinitions)[number]['kind'];

export interface UIArtifact {
  title: string;
  documentId: string;
  kind: ArtifactKind;
  content: string | null;
  isVisible: boolean;
  status: 'streaming' | 'idle';
  boundingBox: {
    top: number;
    left: number;
    width: number;
    height: number;
  };
  language?: string;
}

function PureArtifact({
  chatId,
  input,
  setInput,
  handleSubmit,
  status,
  stop,
  attachments,
  setAttachments,
  append,
  messages,
  setMessages,
  reload,
  votes,
  isReadonly,
  selectedModelId,
  selectedVisibilityType,
}: {
  chatId: string;
  input: string;
  setInput: (input: string) => void;
  status: UseChatHelpers<UIMessage>['status'];
  stop: UseChatHelpers<UIMessage>['stop'];
  attachments: Array<FileUIPart>;
  setAttachments: Dispatch<SetStateAction<Array<FileUIPart>>>;
  messages: UseChatHelpers<UIMessage>['messages'];
  setMessages: UseChatHelpers<UIMessage>['setMessages'];
  votes: Array<Vote> | undefined;
  append: UseChatHelpers<UIMessage>['sendMessage'];
  handleSubmit: (event?: any) => void;
  reload: UseChatHelpers<UIMessage>['regenerate'];
  isReadonly: boolean;
  selectedModelId: string;
  selectedVisibilityType: VisibilityType;
}) {
  const { artifact, setArtifact, metadata, setMetadata } = useArtifact(chatId);

  // Add global error handler for debugging freezes
  useEffect(() => {
    const handleUnhandledError = (event: ErrorEvent) => {
      console.error('[ARTIFACT] 🚨 Unhandled error detected:', {
        message: event.message,
        filename: event.filename,
        lineno: event.lineno,
        colno: event.colno,
        error: event.error,
        artifactState: {
          isVisible: artifact.isVisible,
          status: artifact.status,
          documentId: artifact.documentId
        }
      });
    };

    const handleUnhandledRejection = (event: PromiseRejectionEvent) => {
      console.error('[ARTIFACT] 🚨 Unhandled promise rejection:', {
        reason: event.reason,
        artifactState: {
          isVisible: artifact.isVisible,
          status: artifact.status,
          documentId: artifact.documentId
        }
      });
    };

    window.addEventListener('error', handleUnhandledError);
    window.addEventListener('unhandledrejection', handleUnhandledRejection);

    return () => {
      window.removeEventListener('error', handleUnhandledError);
      window.removeEventListener('unhandledrejection', handleUnhandledRejection);
    };
  }, [artifact.isVisible, artifact.status, artifact.documentId]);

  // Handle chat stop - ensure artifact status is updated when chat is stopped
  useEffect(() => {
    if (status !== 'streaming' && artifact.status === 'streaming') {
      console.log('[ARTIFACT] Chat stopped, updating artifact status to idle');
      setArtifact((currentArtifact) => ({
        ...currentArtifact,
        status: 'idle',
      }));
    }
  }, [status, artifact.status, setArtifact]);

  // Cleanup effect when artifact is hidden or unmounted
  useEffect(() => {
    console.log('[ARTIFACT] 👁️ Visibility changed:', {
      isVisible: artifact.isVisible,
      status: artifact.status,
      documentId: artifact.documentId
    });
    
    return () => {
      console.log('[ARTIFACT] 🧹 CLEANUP EFFECT TRIGGERED');
      console.log('[ARTIFACT] Artifact state during cleanup:', {
        isVisible: artifact.isVisible,
        status: artifact.status,
        documentId: artifact.documentId
      });
      
      // Cancel any pending operations when artifact is unmounted
      if (!artifact.isVisible) {
        console.log('[ARTIFACT] 🔄 Artifact hidden, performing cleanup operations');
        // Note: SWR cleanup will be handled by the separate effect below
      }
      
      console.log('[ARTIFACT] ✅ Cleanup effect completed');
    };
  }, [artifact.isVisible, artifact.documentId]);

  // For book artifacts, don't try to fetch document versions
  // Books have their own versioning system in the Books table
  const shouldFetchDocuments = artifact.documentId !== 'init' && artifact.status !== 'streaming' && artifact.kind !== 'book';
  
  console.log('[ARTIFACT] Document fetch condition:', {
    documentId: artifact.documentId,
    status: artifact.status,
    shouldFetch: shouldFetchDocuments,
    artifactKind: artifact.kind,
    fetchUrl: shouldFetchDocuments ? `/api/document?id=${artifact.documentId}` : null
  });

  const {
    data: documents,
    isLoading: isDocumentsFetching,
    mutate: mutateDocuments,
  } = useSWR<Array<Document>>(
    shouldFetchDocuments ? `/api/document?id=${artifact.documentId}` : null,
    fetcher,
    {
      // Prevent automatic revalidation when component unmounts
      revalidateOnFocus: false,
      revalidateOnReconnect: false,
      shouldRetryOnError: false,
    }
  );

  // For book artifacts, fetch chapter versions
  const shouldFetchBookVersions = artifact.documentId !== 'init' && artifact.status !== 'streaming' && artifact.kind === 'book';
  const currentChapter = metadata?.currentChapter || 1;
  
  console.log('[ARTIFACT] Book versions fetch condition:', {
    documentId: artifact.documentId,
    status: artifact.status,
    shouldFetch: shouldFetchBookVersions,
    artifactKind: artifact.kind,
    currentChapter: currentChapter,
    fetchUrl: shouldFetchBookVersions ? `/api/books/${artifact.documentId}?versions=true&chapter=${currentChapter}` : null
  });

  const {
    data: bookVersions,
    isLoading: isBookVersionsFetching,
    mutate: mutateBookVersions,
  } = useSWR<Array<Document>>(
    shouldFetchBookVersions ? `/api/books/${artifact.documentId}?versions=true&chapter=${currentChapter}` : null,
    fetcher,
    {
      // Prevent automatic revalidation when component unmounts
      revalidateOnFocus: false,
      revalidateOnReconnect: false,
      shouldRetryOnError: false,
    }
  );

  const [mode, setMode] = useState<'edit' | 'diff'>('edit');
  const [document, setDocument] = useState<Document | null>(null);
  const [currentVersionIndex, setCurrentVersionIndex] = useState(-1);

  const { open: isSidebarOpen } = useSidebar();

  useEffect(() => {
    console.log('[ARTIFACT] Documents effect triggered:', {
      hasDocuments: !!documents,
      documentsLength: documents?.length || 0,
      isLoading: isDocumentsFetching
    });
    
    if (documents && documents.length > 0) {
      const mostRecentDocument = documents.at(-1);

      if (mostRecentDocument) {
        console.log('[ARTIFACT] Setting document from loaded data:', {
          documentId: mostRecentDocument.id,
          contentLength: mostRecentDocument.content?.length || 0
        });
        setDocument(mostRecentDocument);
        setCurrentVersionIndex(documents.length - 1);
        setArtifact((currentArtifact) => {
          console.log('[ARTIFACT COMPONENT] Setting content from document:', {
            documentId: mostRecentDocument.id,
            contentLength: mostRecentDocument.content?.length || 0,
            preview: mostRecentDocument.content?.substring(0, 30) || 'empty',
            currentArtifactKind: currentArtifact.kind,
            currentArtifactVisible: currentArtifact.isVisible,
          });
          return {
            ...currentArtifact,
            content: mostRecentDocument.content ?? '',
          };
        });
      }
    } else {
      console.log('[ARTIFACT] No documents available to set');
    }
  }, [documents, setArtifact, isDocumentsFetching]);

  // Handle book versions (similar to documents but for book chapters)
  useEffect(() => {
    console.log('[ARTIFACT] Book versions effect triggered:', {
      hasBookVersions: !!bookVersions,
      bookVersionsLength: bookVersions?.length || 0,
      isLoading: isBookVersionsFetching,
      currentChapter: currentChapter,
      bookVersionsData: bookVersions?.map(v => ({ 
        id: v.id, 
        createdAt: v.createdAt, 
        contentLength: v.content?.length || 0,
        contentPreview: v.content?.substring(0, 50) + '...'
      }))
    });
    
    if (bookVersions && bookVersions.length > 0) {
      const mostRecentVersion = bookVersions.at(0); // Book versions are ordered newest first

      if (mostRecentVersion) {
        console.log('[ARTIFACT] Setting document from book version:', {
          versionId: mostRecentVersion.id,
          contentLength: mostRecentVersion.content?.length || 0,
          chapter: currentChapter
        });
        setDocument(mostRecentVersion);
        setCurrentVersionIndex(0); // Most recent is at index 0
        // Note: We don't update artifact content here for books since they manage their own content
      }
    }
  }, [bookVersions, isBookVersionsFetching, currentChapter]);

  useEffect(() => {
    // Only mutate documents if artifact is visible and not in the process of closing
    if (artifact.isVisible) {
      mutateDocuments();
      // Also mutate book versions for book artifacts
      if (artifact.kind === 'book') {
        mutateBookVersions();
      }
    }
  }, [artifact.status, artifact.isVisible, mutateDocuments, mutateBookVersions, artifact.kind]);

  // Separate cleanup effect for SWR (after mutateDocuments is defined)
  useEffect(() => {
    return () => {
      // Cancel any pending SWR requests when artifact is closed
      if (!artifact.isVisible && artifact.documentId && artifact.documentId !== 'init') {
        console.log('[ARTIFACT] 🔄 Cancelling pending SWR requests');
        mutateDocuments(undefined, { revalidate: false });
      }
    };
  }, [artifact.isVisible, artifact.documentId, mutateDocuments]);

  const { mutate } = useSWRConfig();
  const [isContentDirty, setIsContentDirty] = useState(false);
  const [isSaving, setIsSaving] = useState(false);

  const handleContentChange = useCallback(
    (updatedContent: string) => {
      if (!artifact || !artifact.documentId || artifact.documentId === 'init') {
        console.log('Cannot update document: invalid artifact state');
        return;
      }

      console.log('Handling content change:', {
        documentId: artifact.documentId,
        contentLength: updatedContent?.length || 0,
        preview: updatedContent?.substring?.(0, 30) || '',
      });

      mutate<Array<Document>>(
        `/api/document?id=${artifact.documentId}`,
        async (currentDocuments) => {
          if (!currentDocuments) return undefined;

          const currentDocument = currentDocuments.at(-1);

          if (!currentDocument) {
            console.log('No current document found, creating new one');
            setIsContentDirty(false);
            return currentDocuments;
          }

          // Only update if content has actually changed
          if (currentDocument.content !== updatedContent) {
            console.log('Content changed, sending update request');

            const requestBody = {
              title: artifact.title,
              content: updatedContent,
              kind: artifact.kind,
            };
            console.log('[ARTIFACT] Making API request to /api/document:', {
              url: `/api/document?id=${artifact.documentId}`,
              method: 'POST',
              bodyPreview: {
                title: requestBody.title,
                kind: requestBody.kind,
                contentLength: requestBody.content?.length || 0
              }
            });

            const response = await fetch(
              `/api/document?id=${artifact.documentId}`,
              {
                method: 'POST',
                headers: {
                  'Content-Type': 'application/json',
                },
                body: JSON.stringify(requestBody),
              },
            );

            console.log('[ARTIFACT] API response received:', {
              status: response.status,
              statusText: response.statusText,
              ok: response.ok
            });

            if (!response.ok) {
              console.error(
                'Failed to update document:',
                await response.text(),
              );
              return currentDocuments;
            }

            setIsContentDirty(false);
            console.log('Document updated successfully');

            // Fetch the updated documents instead of using getDocumentsById
            const updatedResponse = await fetch(
              `/api/document?id=${artifact.documentId}`,
            );
            if (updatedResponse.ok) {
              return await updatedResponse.json();
            }
            return currentDocuments;
          } else {
            console.log('Content unchanged, skipping update');
            return currentDocuments;
          }
        },
        { revalidate: true },
      );
    },
    [artifact, mutate],
  );

  const debouncedHandleContentChange = useDebounceCallback(
    handleContentChange,
    2000,
  );

  const saveContent = useCallback(
    (updatedContent: string, debounce: boolean) => {
      console.log('🔥 [ARTIFACT] SAVE CONTENT CALLED 🔥', {
        artifactKind: artifact.kind,
        hasDocument: !!document,
        contentChanged: document ? updatedContent !== document.content : 'no document',
        debounce,
        contentLength: updatedContent.length,
        currentContentLength: document?.content?.length || 0,
        metadataCurrentChapter: metadata?.currentChapter,
        contentPreview: updatedContent.substring(0, 100),
        bookTitle: metadata?.bookTitle,
        totalChapters: metadata?.chapters?.length,
        currentChapterData: metadata?.chapters?.[metadata?.currentChapter ?? 0],
        contentContainsChapter1: updatedContent.toLowerCase().includes('chapter 1'),
        contentContainsChapter2: updatedContent.toLowerCase().includes('chapter 2')
      });
      
      // Special handling for book artifacts - they don't use the Document table
      if (artifact.kind === 'book') {
        console.log('[ARTIFACT] Book artifact detected - using book-specific save');
        
        // Prevent multiple simultaneous saves
        if (isSaving) {
          console.log('[ARTIFACT] Save already in progress, skipping');
          return;
        }
        
        // Update artifact content immediately
        setArtifact((currentArtifact) => ({
          ...currentArtifact,
          content: updatedContent,
        }));
        
        // Save to Books table via API
        const saveToDatabase = async () => {
          setIsSaving(true);
          try {
            // Using 1-based indexing throughout - no conversion needed!
            const chapterToSave = metadata?.currentChapter ?? 1;
            console.log('🔥 [ARTIFACT] CRITICAL DEBUG - SAVE OPERATION STARTING 🔥');
            console.log('[ARTIFACT] Saving book to database via /api/book/save');
            console.log('[ARTIFACT] Debug - metadata?.currentChapter:', metadata?.currentChapter);
            console.log('[ARTIFACT] Debug - chapterToSave:', chapterToSave);
            console.log('[ARTIFACT] Debug - bookId:', artifact.documentId);
            console.log('[ARTIFACT] Debug - Expected: Chapter 2 should have currentChapter=1, chapterToSave=2');
            console.log('[ARTIFACT] Debug - chapters array:', metadata?.chapters?.map(ch => ({ 
              chapterNumber: ch.chapterNumber, 
              title: ch.title,
              id: ch.id 
            })));
            console.log('[ARTIFACT] Debug - currentChapterData:', metadata?.chapters?.[metadata?.currentChapter ?? 0]);
            const response = await fetch('/api/book/save', {
              method: 'POST',
              headers: {
                'Content-Type': 'application/json',
              },
              body: JSON.stringify({
                bookId: artifact.documentId,
                content: updatedContent,
                currentChapter: chapterToSave, // Use the debug variable
              }),
            });

            if (!response.ok) {
              const errorText = await response.text();
              console.error('[ARTIFACT] Failed to save book:', errorText);
              
              // If book doesn't exist (404), create it first
              if (response.status === 404) {
                console.log('[ARTIFACT] Book not found, creating new book record...');
                try {
                  const createResponse = await fetch('/api/books', {
                    method: 'POST',
                    headers: {
                      'Content-Type': 'application/json',
                    },
                    body: JSON.stringify({
                      bookId: artifact.documentId,
                      bookTitle: metadata?.bookTitle || 'Untitled Book',
                      chapterTitle: metadata?.chapters?.[metadata?.currentChapter - 1]?.title || 'Chapter 1',
                      chapterNumber: metadata?.currentChapter || 1,
                      content: updatedContent,
                    }),
                  });
                  
                  if (createResponse.ok) {
                    console.log('[ARTIFACT] Book created successfully');
                  } else {
                    const createErrorText = await createResponse.text();
                    console.error('[ARTIFACT] Failed to create book:', createErrorText);
                  }
                } catch (createError) {
                  console.error('[ARTIFACT] Error creating book:', createError);
                }
              }
            } else {
              console.log('[ARTIFACT] Book saved successfully to database');
              
              // Update local metadata to reflect the saved content
              setMetadata?.((prev) => {
                if (!prev) return prev;
                
                // CRITICAL FIX: Convert 1-based currentChapter to 0-based array index
                const currentChapterIndex = Math.max(0, (prev.currentChapter ?? 1) - 1);
                const updatedChapters = [...(prev.chapters || [])];
                
                console.log('🔄 [ARTIFACT] UPDATING LOCAL STATE AFTER SAVE', {
                  currentChapter1Based: prev.currentChapter,
                  arrayIndex0Based: currentChapterIndex,
                  totalChapters: updatedChapters.length,
                  updatingChapter: updatedChapters[currentChapterIndex]?.chapterNumber
                });
                
                // Update the current chapter's content in local state
                if (updatedChapters[currentChapterIndex]) {
                  updatedChapters[currentChapterIndex] = {
                    ...updatedChapters[currentChapterIndex],
                    content: updatedContent,
                    wordCount: updatedContent.trim().split(/\s+/).filter(word => word.length > 0).length
                  };
                } else {
                  console.warn('🚨 [ARTIFACT] Invalid chapter index for local state update:', {
                    currentChapterIndex,
                    availableChapters: updatedChapters.length
                  });
                }
                
                return {
                  ...prev,
                  chapters: updatedChapters,
                  totalWords: updatedChapters.reduce((sum, chapter) => sum + (chapter.wordCount || 0), 0)
                };
              });
              
              // Also update the main artifact content to keep it in sync
              setArtifact?.((currentArtifact) => ({
                ...currentArtifact,
                content: updatedContent,
              }));
            }
          } catch (error) {
            console.error('[ARTIFACT] Error saving book:', error);
          } finally {
            setIsSaving(false);
          }
        };

        if (debounce) {
          // Use a simple timeout for debouncing book saves
          const timeoutId = setTimeout(saveToDatabase, 1000);
          console.log('[ARTIFACT] Scheduled debounced book save with timeout:', timeoutId);
        } else {
          console.log('[ARTIFACT] Executing immediate book save');
          saveToDatabase();
        }
        
        return;
      }
      
      if (document && updatedContent !== document.content) {
        setIsContentDirty(true);

        if (debounce) {
          console.log('[ARTIFACT] Using debounced save');
          debouncedHandleContentChange(updatedContent);
        } else {
          console.log('[ARTIFACT] Using immediate save');
          handleContentChange(updatedContent);
        }
      } else {
        console.log('[ARTIFACT] Save skipped - no document or content unchanged');
      }
    },
    [artifact.kind, document, debouncedHandleContentChange, handleContentChange, setArtifact],
  );

  function getDocumentContentById(index: number) {
    // Use book versions for book artifacts, documents for others
    const versionsToUse = artifact.kind === 'book' ? bookVersions : documents;
    
    if (!versionsToUse) return '';
    if (!versionsToUse[index]) return '';
    return versionsToUse[index].content ?? '';
  }

  const handleVersionChange = (type: 'next' | 'prev' | 'toggle' | 'latest') => {
    // Use book versions for book artifacts, documents for others
    const versionsToUse = artifact.kind === 'book' ? bookVersions : documents;
    const isLoadingVersions = artifact.kind === 'book' ? isBookVersionsFetching : isDocumentsFetching;
    
    if (!versionsToUse) {
      console.log('[ARTIFACT] No versions available for version control (artifact kind:', artifact.kind, ')');
      return;
    }

    console.log('[ARTIFACT] Version change requested:', {
      type,
      documentId: artifact.documentId,
      currentIndex: currentVersionIndex,
      totalVersions: versionsToUse.length,
      artifactKind: artifact.kind,
      versionsToUse: versionsToUse?.map(v => ({ id: v.id, createdAt: v.createdAt, contentLength: v.content?.length || 0 }))
    });

    try {
      if (type === 'latest') {
        if (versionsToUse.length === 0) {
          console.log('[ARTIFACT] No versions available to navigate to');
          return;
        }

        // For books, latest is at index 0 (newest first), for documents it's at the end
        const latestIndex = artifact.kind === 'book' ? 0 : versionsToUse.length - 1;
        console.log('[ARTIFACT] Setting to latest version:', latestIndex);
        setCurrentVersionIndex(latestIndex);
        setMode('edit');

        // Update artifact content with the latest document
        const latestDoc = versionsToUse[latestIndex];
        if (latestDoc?.content) {
          console.log('[ARTIFACT] Updating content with latest version', {
            contentLength: latestDoc.content.length,
            timestamp: latestDoc.createdAt,
          });

          setArtifact((current) => ({
            ...current,
            content: latestDoc.content || '',
            status: 'idle',
          }));
        } else {
          console.error('[ARTIFACT] Latest document has no content');
        }
        return;
      }

      if (type === 'toggle') {
        const newMode = mode === 'edit' ? 'diff' : 'edit';
        console.log('[ARTIFACT] Toggling mode from', mode, 'to', newMode);
        setMode(newMode);
        return;
      }

      if (type === 'prev') {
        // For books: higher index = older version, for documents: lower index = older version
        const canGoPrev = artifact.kind === 'book' ? 
          currentVersionIndex < versionsToUse.length - 1 : 
          currentVersionIndex > 0;
        
        if (canGoPrev) {
          const newIndex = artifact.kind === 'book' ? 
            currentVersionIndex + 1 : 
            currentVersionIndex - 1;
          console.log('[ARTIFACT] Moving to previous version:', newIndex);
          setCurrentVersionIndex(newIndex);

          // Update artifact content with the selected document
          const selectedDoc = versionsToUse[newIndex];
          if (selectedDoc?.content) {
            console.log('[ARTIFACT] Updated content with previous version', {
              index: newIndex,
              contentLength: selectedDoc.content.length,
              timestamp: selectedDoc.createdAt,
            });

            setArtifact((current) => ({
              ...current,
              content: selectedDoc.content || '',
              status: 'idle',
            }));
          } else {
            console.error('[ARTIFACT] Selected document has no content');
          }
        } else {
          console.log(
            '[ARTIFACT] Already at oldest version, cannot go back further',
          );
        }
        return;
      }

      if (type === 'next') {
        // For books: lower index = newer version, for documents: higher index = newer version
        const canGoNext = artifact.kind === 'book' ? 
          currentVersionIndex > 0 : 
          currentVersionIndex < versionsToUse.length - 1;
        
        if (canGoNext) {
          const newIndex = artifact.kind === 'book' ? 
            currentVersionIndex - 1 : 
            currentVersionIndex + 1;
          console.log('[ARTIFACT] Moving to next version:', newIndex);
          setCurrentVersionIndex(newIndex);

          // Update artifact content with the selected document
          const selectedDoc = versionsToUse[newIndex];
          if (selectedDoc?.content) {
            console.log('[ARTIFACT] Updated content with next version', {
              index: newIndex,
              contentLength: selectedDoc.content.length,
              timestamp: selectedDoc.createdAt,
            });

            setArtifact((current) => ({
              ...current,
              content: selectedDoc.content || '',
              status: 'idle',
            }));
          } else {
            console.error('[ARTIFACT] Selected document has no content');
          }
        } else {
          console.log(
            '[ARTIFACT] Already at latest version, cannot go forward',
          );
        }
        return;
      }
    } catch (error) {
      console.error('[ARTIFACT] Error during version change:', error);
    }
  };

  const [isToolbarVisible, setIsToolbarVisible] = useState(false);

  /*
   * NOTE: if there are no versions, or if
   * the versions are being fetched, then
   * we mark it as the current version.
   */

  const isCurrentVersion = (() => {
    if (artifact.kind === 'book') {
      // For books: current version is at index 0 (newest first)
      return bookVersions && bookVersions.length > 0
        ? currentVersionIndex === 0
        : true;
    } else {
      // For documents: current version is at the end (oldest first)
      return documents && documents.length > 0
        ? currentVersionIndex === documents.length - 1
        : true;
    }
  })();

  const { width: windowWidth, height: windowHeight } = useWindowSize();
  const isMobile = windowWidth ? windowWidth < 768 : false;

  const artifactDefinition = artifactDefinitions.find(
    (definition) => definition.kind === artifact.kind,
  );

  if (!artifactDefinition) {
    throw new Error('Artifact definition not found!');
  }

  useEffect(() => {
    if (artifact.documentId !== 'init') {
      if (artifactDefinition.initialize) {
        artifactDefinition.initialize({
          documentId: artifact.documentId,
          setMetadata,
          setArtifact,
        });
      }
    }
  }, [artifact.documentId, artifactDefinition, setMetadata]);

  return (
    <AnimatePresence>
      {artifact.isVisible && (
        <motion.div
          data-testid="artifact"
          className={`flex flex-row h-dvh w-dvw fixed top-0 left-0 z-50 bg-transparent ${
            !artifact.isVisible ? 'pointer-events-none' : ''
          }`}
          initial={{ opacity: 1 }}
          animate={{ opacity: 1 }}
          exit={{ 
            opacity: 0, 
            pointerEvents: 'none',
            transition: { delay: 0.0, duration: 0.12 } 
          }}
          style={{ pointerEvents: artifact.isVisible ? 'auto' : 'none' }}
        >
          {!isMobile && (
            <motion.div
              className="fixed bg-background h-dvh"
              initial={{
                width: isSidebarOpen ? windowWidth - 256 : windowWidth,
                right: 0,
              }}
              animate={{ width: windowWidth, right: 0 }}
              exit={{
                opacity: 0,
                pointerEvents: 'none',
                transition: { duration: 0.1 }
              }}
            />
          )}

          {!isMobile && (
            <motion.div
              className="fixed w-[400px] bg-muted dark:bg-background h-dvh shrink-0"
              initial={{ opacity: 0, x: windowWidth, scale: 1 }}
              animate={{
                opacity: 1,
                x: windowWidth - 400,
                scale: 1,
                transition: {
                  delay: 0.2,
                  type: 'spring',
                  stiffness: 200,
                  damping: 30,
                },
              }}
              exit={{
                opacity: 0,
                x: windowWidth,
                pointerEvents: 'none',
                transition: { duration: 0.0 },
              }}
            >
              <AnimatePresence>
                {!isCurrentVersion && (
                  <motion.div
                    className="left-0 absolute h-dvh w-[400px] top-0 bg-zinc-900/50 z-50"
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    exit={{ opacity: 0 }}
                  />
                )}
              </AnimatePresence>

              <div className="flex flex-col h-full justify-between items-center">
                <ArtifactMessages
                  chatId={chatId}
                  status={status}
                  votes={votes}
                  messages={messages}
                  setMessages={setMessages}
                  reload={reload}
                  isReadonly={isReadonly}
                  artifactStatus={artifact.status}
                  selectedModelId={selectedModelId}
                  setInput={setInput}
                  handleSubmit={handleSubmit}
                />

                {/* Usage Warning positioned right above the input */}
                <div className="w-[95%] mx-auto px-4">
                  <UsageWarning />
                </div>

                <div className="flex flex-row gap-2 relative items-end w-[95%] mx-auto px-4 pb-4">
                  <MultimodalInput
                    chatId={chatId}
                    input={input}
                    setInput={setInput}
                    handleSubmit={handleSubmit}
                    status={status}
                    stop={stop}
                    attachments={attachments}
                    setAttachments={setAttachments}
                    messages={messages}
                    append={append}
                    className="bg-background dark:bg-muted"
                    setMessages={setMessages}
                    selectedModelId={selectedModelId}
                    selectedVisibilityType={selectedVisibilityType}
                  />
                </div>
              </div>
            </motion.div>
          )}

          <motion.div
            className="fixed dark:bg-muted bg-background h-dvh flex flex-col overflow-y-scroll md:border-r dark:border-zinc-700 border-zinc-200 w-full"
            initial={
              isMobile
                ? {
                    opacity: 1,
                    x: artifact.boundingBox.left,
                    y: artifact.boundingBox.top,
                    height: artifact.boundingBox.height,
                    width: artifact.boundingBox.width,
                    borderRadius: 50,
                  }
                : {
                    opacity: 1,
                    x: artifact.boundingBox.left,
                    y: artifact.boundingBox.top,
                    height: artifact.boundingBox.height,
                    width: artifact.boundingBox.width,
                    borderRadius: 50,
                  }
            }
            animate={
              isMobile
                ? {
                    opacity: 1,
                    x: 0,
                    y: 0,
                    height: windowHeight,
                    width: windowWidth ? windowWidth : 'calc(100dvw)',
                    borderRadius: 0,
                    transition: {
                      type: 'spring',
                      stiffness: 200,
                      damping: 30,
                    },
                  }
                : {
                    opacity: 1,
                    x: 0,
                    y: 0,
                    height: windowHeight,
                    width: windowWidth
                      ? windowWidth - 400
                      : 'calc(100dvw-400px)',
                    borderRadius: 0,
                    transition: {
                      type: 'spring',
                      stiffness: 200,
                      damping: 30,
                    },
                  }
            }
            exit={{
              opacity: 0,
              scale: 0.95,
              pointerEvents: 'none',
              transition: { duration: 0.12 },
            }}
          >
            <div className="p-2 flex flex-row justify-between items-start w-full">
              <div className="w-full mx-auto flex flex-row justify-between items-start">
                <div className="flex flex-row gap-4 items-start">
                  <ArtifactCloseButton chatId={chatId} />

                  <div className="flex flex-col">
                    <div className="font-medium">{artifact.title}</div>

                    {isContentDirty ? (
                      <div className="text-sm text-muted-foreground">
                        Saving changes...
                      </div>
                    ) : document ? (
                      <div className="text-sm text-muted-foreground">
                        {`Updated ${formatDistance(
                          new Date(document.createdAt),
                          new Date(),
                          {
                            addSuffix: true,
                          },
                        )}`}
                      </div>
                    ) : (
                      <div className="w-32 h-3 mt-2 bg-muted-foreground/20 rounded-md animate-pulse" />
                    )}
                  </div>
                </div>

                <ArtifactActions
                  artifact={artifact}
                  currentVersionIndex={currentVersionIndex}
                  handleVersionChange={handleVersionChange}
                  isCurrentVersion={isCurrentVersion}
                  mode={mode}
                  metadata={metadata}
                  setMetadata={setMetadata}
                  appendMessage={append}
                />
              </div>
            </div>

            <div className="dark:bg-muted bg-background h-full overflow-y-scroll !max-w-full items-center">
              <artifactDefinition.content
                title={artifact.title}
                content={
                  isCurrentVersion
                    ? artifact.content
                    : getDocumentContentById(currentVersionIndex)
                }
                mode={mode}
                status={artifact.status}
                currentVersionIndex={currentVersionIndex}
                suggestions={[]}
                onSaveContent={saveContent}
                isInline={false}
                isCurrentVersion={isCurrentVersion}
                getDocumentContentById={getDocumentContentById}
                isLoading={isDocumentsFetching && !artifact.content}
                metadata={metadata}
                setMetadata={setMetadata}
                language={artifact.language}
                handleVersionChange={handleVersionChange}
                totalVersions={artifact.kind === 'book' ? bookVersions?.length : documents?.length}
              />

              <AnimatePresence>
                {isCurrentVersion && (
                  <Toolbar
                    isToolbarVisible={isToolbarVisible}
                    setIsToolbarVisible={setIsToolbarVisible}
                    append={append}
                    status={status}
                    stop={stop}
                    setMessages={setMessages}
                    artifactKind={artifact.kind}
                  />
                )}
              </AnimatePresence>
            </div>

            <AnimatePresence>
              {!isCurrentVersion && (
                <VersionFooter
                  currentVersionIndex={currentVersionIndex}
                  documents={documents}
                  handleVersionChange={handleVersionChange}
                />
              )}
            </AnimatePresence>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}

export const Artifact = memo(PureArtifact, (prevProps, nextProps) => {
  if (prevProps.status !== nextProps.status) return false;
  if (!equal(prevProps.votes, nextProps.votes)) return false;
  if (prevProps.input !== nextProps.input) return false;
  if (!equal(prevProps.messages, nextProps.messages.length)) return false;
  if (prevProps.selectedModelId !== nextProps.selectedModelId) return false;
  if (prevProps.selectedVisibilityType !== nextProps.selectedVisibilityType) return false;

  return true;
});
