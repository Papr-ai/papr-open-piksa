import { Artifact } from '@/components/artifact/create-artifact';
import type { ArtifactContent } from '@/components/artifact/create-artifact';
import { DiffView } from '@/components/editor/diffview';
import { DocumentSkeleton } from '@/components/document/document-skeleton';
import { Editor } from '@/components/editor/text-editor';
import {
  ClockRewind,
  CopyIcon,
  MessageIcon,
  PenIcon,
  RedoIcon,
  UndoIcon,
  SaveIcon,
  BookOpenIcon,
  ChevronLeftIcon,
  ChevronRightIcon,
  ListIcon,
  ColumnsIcon,
  FileTextIcon,
} from '@/components/common/icons';
import type { Suggestion } from '@/lib/db/schema';
import { toast } from 'sonner';
import { getSuggestions } from '../actions';
import { useState, useEffect, useRef, useCallback } from 'react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { migrateImagesInContent, hasImagesToMigrate } from '@/lib/editor/image-migration';
import { BookContextProvider } from '@/components/book/book-context';
// Removed TextSelectionImageGenerator import

// Helper function to get book chapters from database using bookId or bookTitle
async function getBookChapters(bookIdentifier: string, isBookId: boolean = false, signal?: AbortSignal) {
  try {
    const param = isBookId ? `bookId=${encodeURIComponent(bookIdentifier)}` : `bookTitle=${encodeURIComponent(bookIdentifier)}`;
    const response = await fetch(`/api/books?${param}`, { signal });
    if (response.ok) {
      const data = await response.json();
      const chapters = Array.isArray(data) ? data : (data.books || []);
      return chapters
        .sort((a: any, b: any) => a.chapterNumber - b.chapterNumber)
        .map((chapter: any) => ({
          id: chapter.id,
          bookId: chapter.bookId,
          title: chapter.chapterTitle || chapter.title,
          content: chapter.content || '',
          wordCount: chapter.content ? chapter.content.split(/\s+/).filter((word: string) => word.length > 0).length : 0,
          chapterNumber: chapter.chapterNumber || 1,
        }));
    }
    return [];
  } catch (error) {
    // Handle AbortError gracefully - this is expected when component unmounts
    if (error instanceof Error && error.name === 'AbortError') {
      console.log('[BookArtifact] Fetch aborted (component unmounted)');
      return [];
    }
    console.error('[BookArtifact] Failed to fetch book chapters:', error);
    return [];
  }
}

interface BookArtifactMetadata {
  suggestions: Array<Suggestion>;
  chapters: Array<{
    id: string;
    title: string;
    content: string;
    wordCount: number;
  }>;
  currentChapter: number;
  bookTitle: string;
  bookId?: string;
  author: string;
  genre: string;
  totalWords: number;
}

interface ChapterDropdownProps {
  chapters: Array<{
    id: string;
    title: string;
    content: string;
    wordCount: number;
    chapterNumber: number;
  }>;
  currentChapter: number;
  onChapterSelect: (chapterIndex: number) => void;
  isOpen: boolean;
  onClose: () => void;
}

function ChapterDropdown({
  chapters,
  currentChapter,
  onChapterSelect,
  isOpen,
  onClose,
}: ChapterDropdownProps) {
  if (!isOpen) return null;

  return (
    <div 
      className="absolute top-full left-0 mt-1 w-80 bg-white dark:bg-zinc-900 border border-gray-200 dark:border-zinc-700 rounded-lg shadow-lg z-50 max-h-96 overflow-y-auto"
    >
      <div className="p-3 border-b border-gray-200 dark:border-zinc-700">
        <div className="flex items-center justify-between">
          <h3 className="text-sm font-medium text-gray-900 dark:text-gray-100">
            Chapters ({chapters.length})
          </h3>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-300"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>
      </div>
      
      <div className="py-1">
        {chapters.map((chapter, index) => (
          <button
            key={chapter.id}
            onClick={() => {
              onChapterSelect(index);
              onClose();
            }}
            className={`w-full text-left px-4 py-3 hover:bg-gray-50 dark:hover:bg-zinc-800 transition-colors ${
              index === currentChapter
                ? 'bg-blue-50 dark:bg-blue-950/30 border-r-2 border-blue-500'
                : ''
            }`}
          >
            <div className="flex justify-between items-start">
              <div className="flex-1 min-w-0">
                <div className="font-medium text-sm text-gray-900 dark:text-gray-100">
                  Chapter {chapter.chapterNumber}
                </div>
                {chapter.title && (
                  <div className="text-xs text-gray-600 dark:text-gray-400 mt-1 truncate">
                    {chapter.title}
                  </div>
                )}
              </div>
              <div className="text-xs text-gray-400 dark:text-gray-500 ml-2 flex-shrink-0">
                {chapter.wordCount.toLocaleString()}
              </div>
            </div>
          </button>
        ))}
      </div>
    </div>
  );
}

interface BookPageProps {
  content: string;
  chapterTitle: string;
  chapterNumber: number;
  totalChapters: number;
  chapters: Array<{
    id: string;
    title: string;
    content: string;
    wordCount: number;
    chapterNumber: number;
  }>;
  currentChapter: number;
  onPrevious: () => void;
  onNext: () => void;
  onChapterSelect: (chapterIndex: number) => void;
  onSaveContent?: (content: string, debounce: boolean) => void;
  isCurrentVersion: boolean;
  status?: string;
  suggestions?: Array<Suggestion>;
  metadata?: BookArtifactMetadata;
  currentVersionIndex?: number;
  totalVersions?: number;
  onVersionRestore?: () => void;
  onVersionLatest?: () => void;
}

function BookPage({
  content,
  chapterTitle,
  chapterNumber,
  totalChapters,
  chapters,
  currentChapter,
  onPrevious,
  onNext,
  onChapterSelect,
  onSaveContent,
  isCurrentVersion,
  status,
  suggestions = [],
  metadata,
  currentVersionIndex,
  totalVersions,
  onVersionRestore,
  onVersionLatest,
}: BookPageProps) {
  const [showChapterDropdown, setShowChapterDropdown] = useState(false);
  // Removed selectedText state
  const [viewMode, setViewMode] = useState<'single' | 'two-column'>('single');
  const [currentPageIndex, setCurrentPageIndex] = useState(0);
  // Removed image generation and text editing functionality
  const [windowWidth, setWindowWidth] = useState(typeof window !== 'undefined' ? window.innerWidth : 1200);
  const [debouncedSaveTimeout, setDebouncedSaveTimeout] = useState<NodeJS.Timeout | null>(null);
  // Removed selectionTimeout state

  const dropdownRef = useRef<HTMLDivElement>(null);
  const hoverTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const contentRef = useRef<HTMLDivElement>(null);

  // Function to split content into individual pages, treating images as full-page elements
  // Helper function to extract clean text from markdown content
  const extractCleanText = (markdownContent: string): string => {
    if (!markdownContent) return '';
    
    // Remove HTML comments (videoUrl, storyContext)
    let cleanContent = markdownContent
      .replace(/<!--\s*videoUrl:\s*[^>]+\s*-->/g, '')
      .replace(/<!--\s*storyContext:\s*[^>]+\s*-->/g, '');
    
    // Remove markdown image syntax but keep alt text
    cleanContent = cleanContent.replace(/!\[([^\]]*)\]\([^)]+\)/g, '$1');
    
    // Remove other markdown formatting
    cleanContent = cleanContent
      .replace(/#{1,6}\s+/g, '') // Remove headers
      .replace(/\*\*([^*]+)\*\*/g, '$1') // Remove bold
      .replace(/\*([^*]+)\*/g, '$1') // Remove italic
      .replace(/`([^`]+)`/g, '$1') // Remove inline code
      .replace(/\[([^\]]+)\]\([^)]+\)/g, '$1') // Remove links but keep text
      .trim();
    
    return cleanContent;
  };

  const splitContentIntoPages = (content: string, linesPerPage: number = 25) => {
    if (!content) return [];
    
    const pages: string[] = [];
    
    // First, split content by images to identify image boundaries
    // Updated regex to capture images with optional HTML comments (videoUrl, storyContext)
    const imageRegex = /!\[([^\]]*)\]\(([^)]+)\)(\s*<!--\s*videoUrl:\s*([^>]+)\s*-->)?(\s*<!--\s*storyContext:\s*([^>]+)\s*-->)?/g;
    const parts: Array<{ type: 'text' | 'image', content: string, alt?: string, src?: string }> = [];
    
    let lastIndex = 0;
    let match;
    
    // Parse content and separate text from images
    while ((match = imageRegex.exec(content)) !== null) {
      // Add text content before the image (if any)
      const textBefore = content.slice(lastIndex, match.index).trim();
      if (textBefore) {
        parts.push({ type: 'text', content: textBefore });
      }
      
      // Add the image as a separate part (including any HTML comments)
      parts.push({
        type: 'image',
        content: match[0], // Full markdown image syntax with HTML comments
        alt: match[1],
        src: match[2]
      });
      
      lastIndex = match.index + match[0].length;
    }
    
    // Add remaining text after the last image (if any)
    const remainingText = content.slice(lastIndex).trim();
    if (remainingText) {
      parts.push({ type: 'text', content: remainingText });
    }
    
    // If no images found, fall back to text-only pagination
    if (parts.length === 0) {
      parts.push({ type: 'text', content: content });
    }
    
    // Now process each part
    for (const part of parts) {
      if (part.type === 'image') {
        // Images get their own full page
        pages.push(part.content);
      } else {
        // Split text content into pages based on line count
        const paragraphs = part.content.split(/\n\s*\n/).filter(p => p.trim().length > 0);
        let currentPage = '';
        let currentLineCount = 0;
        
        for (const paragraph of paragraphs) {
          // Estimate lines in this paragraph (assuming ~80 chars per line)
          const estimatedLines = Math.max(1, Math.ceil(paragraph.length / 80)) + 1; // +1 for paragraph spacing
          
          // If adding this paragraph would exceed the line limit, start a new page
          if (currentPage && currentLineCount + estimatedLines > linesPerPage) {
            pages.push(currentPage.trim());
            currentPage = paragraph;
            currentLineCount = estimatedLines;
          } else {
            // Add paragraph to current page
            if (currentPage) {
              currentPage += '\n\n' + paragraph;
            } else {
              currentPage = paragraph;
            }
            currentLineCount += estimatedLines;
          }
        }
        
        // Add the last page if it has content
        if (currentPage.trim()) {
          pages.push(currentPage.trim());
        }
      }
    }
    
    return pages.length > 0 ? pages : [''];
  };

  // Determine if we should force single column based on window width
  const minWidthForTwoColumn = 1024; // Minimum width to show two columns
  const shouldForceSingleColumn = windowWidth < minWidthForTwoColumn;
  const effectiveViewMode = shouldForceSingleColumn ? 'single' : viewMode;

  // Helper function to check if a page contains only an image
  const isImageOnlyPage = (pageContent: string) => {
    const trimmedContent = pageContent.trim();
    const imageRegex = /^!\[([^\]]*)\]\(([^)]+)\)$/;
    return imageRegex.test(trimmedContent);
  };

  // Get pages for two-column view
  const pages = effectiveViewMode === 'two-column' ? splitContentIntoPages(content) : [content];
  const totalPages = pages.length;
  
  // Window resize listener
  useEffect(() => {
    const handleResize = () => {
      setWindowWidth(window.innerWidth);
    };

    window.addEventListener('resize', handleResize);
    return () => {
      window.removeEventListener('resize', handleResize);
    };
  }, []);

  // Cleanup effect for all timeouts
  useEffect(() => {
    return () => {
      // Clear any pending timeouts on component unmount
      if (debouncedSaveTimeout) {
        clearTimeout(debouncedSaveTimeout);
      }
      if (hoverTimeoutRef.current) {
        clearTimeout(hoverTimeoutRef.current);
      }
    };
  }, [debouncedSaveTimeout]);
  
  // Reset page index when switching chapters, view modes, or content changes
  useEffect(() => {
    setCurrentPageIndex(0);
  }, [chapterNumber, effectiveViewMode]);

  // Auto-adjust page index when content changes and total pages change
  useEffect(() => {
    if (effectiveViewMode === 'two-column' && currentPageIndex >= totalPages && totalPages > 0) {
      // If current page index is beyond available pages, go to last valid page pair
      const maxPageIndex = Math.max(0, totalPages - 2);
      setCurrentPageIndex(maxPageIndex);
    }
  }, [totalPages, currentPageIndex, effectiveViewMode]);
  
  // Simple page navigation function
  const goToPage = useCallback((newPageIndex: number) => {
    setCurrentPageIndex(newPageIndex);
  }, []);
  
  // Enhanced navigation handlers with animation - book spread navigation
  const maxSpreadIndex = Math.ceil(totalPages / 2) - 1; // Maximum spread index
  
  const handlePreviousPage = useCallback(() => {
    if (currentPageIndex > 0) {
      const newIndex = currentPageIndex - 1;
      goToPage(newIndex);
    } else if (currentPageIndex === 0 && chapterNumber > 1) {
      // Go to previous chapter and navigate to its last page
      
      // Get the previous chapter's content to calculate its last page
      if (metadata && metadata.chapters && metadata.chapters[chapterNumber - 2]) {
        const prevChapterContent = metadata.chapters[chapterNumber - 2].content || '';
        const prevChapterPages = splitContentIntoPages(prevChapterContent);
        const lastPageIndex = Math.max(0, Math.ceil(prevChapterPages.length / 2) - 1);
        
        // Navigate to previous chapter
        onPrevious();
        
        // Set a flag to navigate to the last page after chapter change
        setTimeout(() => {
          setCurrentPageIndex(lastPageIndex);
        }, 50);
      } else {
        // Fallback to regular chapter navigation
        onPrevious();
      }
    }
  }, [currentPageIndex, chapterNumber, totalPages, goToPage, onPrevious, metadata, splitContentIntoPages, setCurrentPageIndex]);
  
  const handleNextPage = useCallback(() => {
    if (currentPageIndex < maxSpreadIndex) {
      const newIndex = currentPageIndex + 1;
      goToPage(newIndex);
    } else if (chapterNumber < totalChapters) {
      // Go to next chapter and start from first page
      
      // Navigate to next chapter
      onNext();
      
      // Reset to first page after chapter change
      setTimeout(() => {
        setCurrentPageIndex(0);
      }, 50);
    }
  }, [currentPageIndex, maxSpreadIndex, chapterNumber, totalChapters, goToPage, onNext, setCurrentPageIndex]);
  
  // Calculate which pages to show based on real book layout
  // Real books: left pages = odd numbers (1, 3, 5...), right pages = even numbers (2, 4, 6...)
  // First spread: left=page 1, right=page 2
  // Second spread: left=page 3, right=page 4, etc.
  const getPageLayout = (pageIndex: number) => {
    // Convert pageIndex to actual page spreads
    // pageIndex 0 = pages 1-2, pageIndex 1 = pages 3-4, etc.
    const leftPageNumber = (pageIndex * 2) + 1; // 1, 3, 5, 7...
    const rightPageNumber = (pageIndex * 2) + 2; // 2, 4, 6, 8...
    
    return {
      leftPageIndex: pageIndex * 2, // 0, 2, 4, 6... (maps to pages 1, 3, 5, 7...)
      rightPageIndex: (pageIndex * 2) + 1 < totalPages ? (pageIndex * 2) + 1 : -1, // 1, 3, 5, 7... (maps to pages 2, 4, 6, 8...)
      leftPageNumber: leftPageNumber <= totalPages ? leftPageNumber : null,
      rightPageNumber: rightPageNumber <= totalPages ? rightPageNumber : null
    };
  };
  
  const pageLayout = getPageLayout(currentPageIndex);
  
  // Debounced save function for content updates with image migration
  const handleSaveContent = useCallback(async (updatedContent: string, debounce: boolean) => {
    
    // Clear any existing timeout
    if (debouncedSaveTimeout) {
      clearTimeout(debouncedSaveTimeout);
      setDebouncedSaveTimeout(null);
    }

    const saveWithMigration = async () => {
      let contentToSave = updatedContent;
      
      // Check if content has images that need migration
      if (hasImagesToMigrate(updatedContent)) {
        console.log('[BookPage] Migrating images in content...');
        try {
          contentToSave = await migrateImagesInContent(updatedContent);
          console.log('[BookPage] Image migration completed');
        } catch (error) {
          console.error('[BookPage] Image migration failed:', error);
          // Continue with original content if migration fails
        }
      }
      
      if (onSaveContent) {
        onSaveContent(contentToSave, false);
      }
    };

    if (debounce) {
      // Save with 1000ms debounce
      const timeout = setTimeout(saveWithMigration, 1000);
      setDebouncedSaveTimeout(timeout);
    } else {
      // Save immediately
      await saveWithMigration();
    }
  }, [debouncedSaveTimeout, onSaveContent]);

  // Close dropdown when clicking outside
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      const target = event.target as Node;
      
      // Only handle clicks if the dropdown is actually open
      if (!showChapterDropdown) return;
      
      // Don't interfere with other components' click handlers
      // Only close if clicking outside the dropdown AND not on context menu elements
      if (dropdownRef.current && 
          !dropdownRef.current.contains(target) &&
          !(target as Element).closest('[data-context-menu]') &&
          !(target as Element).closest('[data-context-selector]')) {
        setShowChapterDropdown(false);
      }
    }

    if (showChapterDropdown) {
      document.addEventListener('mousedown', handleClickOutside);
    }
    
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [showChapterDropdown]);

  // Handle hover with proper delays
  const handleMouseEnter = () => {
    if (hoverTimeoutRef.current) {
      clearTimeout(hoverTimeoutRef.current);
    }
    setShowChapterDropdown(true);
  };

  const handleMouseLeave = () => {
    hoverTimeoutRef.current = setTimeout(() => {
      setShowChapterDropdown(false);
    }, 150);
  };

  // Removed text selection handling

  // Removed handleGenerateImage function

  // Removed handleEditText function

  return (
    <div className="flex flex-col h-full bg-white dark:bg-zinc-900">
      {/* Custom CSS for 3D perspective and page flip animations */}
      <style jsx>{`

        

        
        .bg-cream {
          background-color: #fefdfb;
        }
        
        .z-5 {
          z-index: 5;
        }
        
        /* Book shadow effect */
        .book-shadow {
          filter: drop-shadow(0 25px 50px rgba(0, 0, 0, 0.25));
        }
        
        /* Page hover effects */
        .page-hover:hover {
          transform: translateY(-2px);
          box-shadow: 0 8px 25px rgba(0, 0, 0, 0.15);
        }
        
        /* Subtle page texture */
        .page-texture {
          background-image: 
            radial-gradient(circle at 20% 80%, rgba(120, 119, 198, 0.1) 0%, transparent 50%),
            radial-gradient(circle at 80% 20%, rgba(255, 255, 255, 0.8) 0%, transparent 50%),
            radial-gradient(circle at 40% 40%, rgba(120, 119, 198, 0.05) 0%, transparent 50%);
        }
      `}</style>
      
      {/* Minimal Top Bar - Apple Style */}
      <div className="flex items-center justify-between px-6 py-3 border-b border-gray-200 dark:border-zinc-800">
        <div 
          className="relative" 
          ref={dropdownRef}
          onMouseEnter={handleMouseEnter}
          onMouseLeave={handleMouseLeave}
        >
          <Button
            variant="ghost"
            size="sm"
            onClick={() => setShowChapterDropdown(!showChapterDropdown)}
            className="flex items-center gap-2 text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-gray-100"
          >
            <ListIcon size={16} />
            Chapters
          </Button>
          
          <ChapterDropdown
            chapters={chapters}
            currentChapter={currentChapter}
            onChapterSelect={onChapterSelect}
            isOpen={showChapterDropdown}
            onClose={() => setShowChapterDropdown(false)}
          />
        </div>
        
        <div className="flex items-center gap-3">
          <Button
            variant="ghost"
            size="sm"
            onClick={() => setViewMode(viewMode === 'single' ? 'two-column' : 'single')}
            disabled={shouldForceSingleColumn}
            className="flex items-center gap-2 text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-gray-100 disabled:opacity-50 disabled:cursor-not-allowed"
            title={
              shouldForceSingleColumn 
                ? 'Two-column view requires wider screen (min 1024px)' 
                : viewMode === 'single' 
                  ? 'Switch to two-column view' 
                  : 'Switch to single-column view'
            }
          >
            {effectiveViewMode === 'single' ? <ColumnsIcon size={16} /> : <FileTextIcon size={16} />}
            {effectiveViewMode === 'single' ? 'Two Pages' : 'Single Page'}
            {shouldForceSingleColumn && <span className="text-xs opacity-60">(Screen too small)</span>}
          </Button>
          
          {effectiveViewMode === 'single' ? (
            <>
              <span className="text-sm text-gray-500 dark:text-gray-400">
                {chapterNumber} of {totalChapters}
              </span>
              
              <div className="flex items-center gap-1">
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={onPrevious}
                  disabled={chapterNumber <= 1}
                  className="h-8 w-8 p-0 text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-gray-100 disabled:opacity-30"
                >
                  <ChevronLeftIcon size={16} />
                </Button>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={onNext}
                  disabled={chapterNumber >= totalChapters}
                  className="h-8 w-8 p-0 text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-gray-100 disabled:opacity-30"
                >
                  <ChevronRightIcon size={16} />
                </Button>
              </div>
            </>
          ) : (
            <>
              <div className="flex items-center gap-1">
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={handlePreviousPage}
                  disabled={(currentPageIndex <= 0 && chapterNumber <= 1) }
                  className="h-8 w-8 p-0 text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-gray-100 disabled:opacity-30"
                >
                  <ChevronLeftIcon size={16} />
                </Button>
                
                <Button
                  variant="ghost"
                  size="sm"
                  className="text-sm text-gray-600 dark:text-gray-400 px-3 h-8 cursor-default"
                >
                  {pageLayout.leftPageNumber && pageLayout.rightPageNumber 
                    ? `${pageLayout.leftPageNumber}-${pageLayout.rightPageNumber}` 
                    : pageLayout.rightPageNumber || pageLayout.leftPageNumber || '1'
                  } / {totalPages}
                </Button>
                
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={handleNextPage}
                  disabled={(currentPageIndex >= maxSpreadIndex && chapterNumber >= totalChapters) }
                  className="h-8 w-8 p-0 text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-gray-100 disabled:opacity-30"
                >
                  <ChevronRightIcon size={16} />
                </Button>
              </div>
            </>
          )}
        </div>
      </div>

      {/* Content Area - Single or Two-Column */}
      <div className="flex-1 overflow-y-auto" ref={contentRef}>
        {effectiveViewMode === 'single' ? (
          // Single Column View (Original)
          <div className="max-w-4xl mx-auto px-8 py-12">
            {/* Subtle Chapter Header */}
            {(chapterNumber || chapterTitle) && (
              <div className="mb-12">
                <div className="flex items-center gap-3 mb-4">
                  <div className="h-px bg-gray-200 dark:bg-zinc-700 flex-1"></div>
                  <span className="text-sm font-medium text-gray-400 dark:text-gray-500 uppercase tracking-wider">
                    Chapter {chapterNumber}
                  </span>
                  <div className="h-px bg-gray-200 dark:bg-zinc-700 flex-1"></div>
                </div>
                {chapterTitle && (
                  <h1 className="text-2xl font-serif font-semibold text-gray-900 dark:text-gray-100 text-center">
                    {chapterTitle}
                  </h1>
                )}
              </div>
            )}


            {/* Editor */}
            <div className="prose prose-lg max-w-none font-serif leading-relaxed text-gray-900 dark:text-gray-100 prose-headings:text-gray-900 dark:prose-headings:text-gray-100" style={{ minHeight: '500px' }}>
              <Editor
                content={isCurrentVersion ? (chapters[Math.max(0, (metadata?.currentChapter ?? 1) - 1)]?.content || content || '') : (content || '')}
                suggestions={suggestions}
                isCurrentVersion={isCurrentVersion}
                currentVersionIndex={currentVersionIndex || 0}
                status={(status as 'streaming' | 'idle') || 'idle'}
                onSaveContent={handleSaveContent}
              />
            </div>
          </div>
        ) : (
          // Two Column View (Realistic Book with Flip Animation)
          <div className="h-full flex items-center justify-center bg-gradient-to-b from-stone-100 to-stone-200 dark:from-zinc-900 dark:to-zinc-800 p-8">
            <div className="flex items-center gap-12 max-w-7xl w-full">
              {/* Left Navigation Button */}
              <div className="flex-shrink-0">
                <Button
                  variant="ghost"
                  size="lg"
                  onClick={handlePreviousPage}
                  disabled={(currentPageIndex <= 0 && chapterNumber <= 1) }
                  className="h-16 w-16 rounded-full flex items-center justify-center text-stone-600 dark:text-stone-400 hover:text-stone-900 dark:hover:text-stone-100 disabled:opacity-30 hover:bg-white/80 dark:hover:bg-zinc-800/80 shadow-lg transition-all duration-200"
                >
                  <ChevronLeftIcon size={28} />
                </Button>
              </div>

              {/* Book Container */}
              <div className="relative flex-1 max-w-5xl perspective-1000">
                {/* Book Base Shadow */}
                <div className="absolute inset-x-0 bottom-0 h-12 bg-black/30 rounded-full blur-3xl scale-110 transform translate-y-4"></div>
                
                {/* Book Container with Realistic Appearance */}
                <div className="relative bg-gradient-to-r from-amber-900 via-amber-800 to-amber-900 dark:from-amber-950 dark:via-amber-900 dark:to-amber-950 rounded-lg shadow-2xl book-shadow" style={{ transformStyle: 'preserve-3d' }}>
                  {/* Book Spine */}
                  <div className="absolute left-1/2 top-0 bottom-0 w-8 bg-gradient-to-r from-amber-800 via-amber-700 to-amber-800 dark:from-amber-900 dark:via-amber-800 dark:to-amber-900 transform -translate-x-1/2 z-30 shadow-lg rounded-sm">
                    <div className="h-full w-full bg-gradient-to-b from-transparent via-black/20 to-transparent"></div>
                    <div className="absolute inset-y-0 left-1 w-px bg-amber-900/60 dark:bg-amber-950/60"></div>
                    <div className="absolute inset-y-0 right-1 w-px bg-amber-600/40 dark:bg-amber-700/40"></div>
                    <div className="absolute left-1/2 top-4 bottom-4 w-px bg-amber-500/30 transform -translate-x-1/2"></div>
                  </div>

                  {/* Book Pages Container */}
                  <div className="relative flex bg-white dark:bg-zinc-100 rounded-lg overflow-hidden shadow-inner" style={{ height: 'calc(100% - 170px)' }}>
                    {/* Left Page Container */}
                    <div className="relative w-1/2 bg-cream">
                      {/* Main Left Page */}
                      <div className="relative w-full h-full bg-cream dark:bg-stone-50 border-2 border-stone-300 dark:border-stone-400 border-r-stone-400 dark:border-r-stone-500 rounded-r-sm p-8 pr-12 z-10">
                        {/* Paper Texture */}
                        <div className="absolute inset-0 opacity-10 page-texture pointer-events-none"></div>
                        
                        {/* Binding Holes */}
                        <div className="absolute right-6 top-16 w-1.5 h-1.5 bg-stone-400 dark:bg-stone-600 rounded-full opacity-60"></div>
                        <div className="absolute right-6 top-32 w-1.5 h-1.5 bg-stone-400 dark:bg-stone-600 rounded-full opacity-60"></div>
                        <div className="absolute right-6 bottom-32 w-1.5 h-1.5 bg-stone-400 dark:bg-stone-600 rounded-full opacity-60"></div>
                        <div className="absolute right-6 bottom-16 w-1.5 h-1.5 bg-stone-400 dark:bg-stone-600 rounded-full opacity-60"></div>
                        
                        {/* Page Content */}
                        <div className="relative h-full overflow-hidden flex flex-col">
                          {pageLayout.leftPageIndex >= 0 ? (
                            <>
                              <div className={`prose prose-sm max-w-none font-serif leading-relaxed text-gray-800 overflow-hidden ${
                                isImageOnlyPage(pages[pageLayout.leftPageIndex] || '') 
                                  ? 'flex items-center justify-center p-0 m-0 absolute inset-0' 
                                  : 'text-justify'
                              }`} style={{ 
                                height: isImageOnlyPage(pages[pageLayout.leftPageIndex] || '') 
                                  ? '100%' 
                                  : 'calc(100% - 40px)', 
                                minHeight: isImageOnlyPage(pages[pageLayout.leftPageIndex] || '') 
                                  ? '100%' 
                                  : '400px',
                                maxHeight: isImageOnlyPage(pages[pageLayout.leftPageIndex] || '') 
                                  ? '100%' 
                                  : 'calc(100% - 40px)',
                                width: isImageOnlyPage(pages[pageLayout.leftPageIndex] || '') 
                                  ? '100%' 
                                  : 'auto'
                              }}>
                                <BookContextProvider 
                                  isFullPageImage={isImageOnlyPage(pages[pageLayout.leftPageIndex] || '')}
                                  bookId={metadata?.bookId}
                                  bookTitle={metadata?.bookTitle}
                                  storyContext={(() => {
                                    // Include prior pages for better story context
                                    const currentIndex = pageLayout.leftPageIndex;
                                    const contextPages = [];
                                    
                                    // Include previous 2-3 pages for context
                                    for (let i = Math.max(0, currentIndex - 2); i <= currentIndex; i++) {
                                      if (pages[i] && pages[i].trim()) {
                                        const cleanText = extractCleanText(pages[i]);
                                        if (cleanText) {
                                          contextPages.push(cleanText);
                                        }
                                      }
                                    }
                                    
                                    return contextPages.join('\n\n');
                                  })()}
                                >
                                  <Editor
                                    content={pages[pageLayout.leftPageIndex] || ''}
                                    suggestions={[]}
                                    isCurrentVersion={isCurrentVersion}
                                    currentVersionIndex={0}
                                    status={(status as 'streaming' | 'idle') || 'idle'}
                                    storyContext={(() => {
                                      // Include prior pages for better story context
                                      const currentIndex = pageLayout.leftPageIndex;
                                      const contextPages = [];
                                      for (let i = Math.max(0, currentIndex - 2); i <= currentIndex; i++) {
                                        if (pages[i] && pages[i].trim()) {
                                          const cleanText = extractCleanText(pages[i]);
                                          if (cleanText) {
                                            contextPages.push(cleanText);
                                          }
                                        }
                                      }
                                      return contextPages.join('\n\n');
                                    })()}
                                    onSaveContent={(updatedContent, debounce) => {
                                    console.log('🔥 [TWO-COLUMN] LEFT PAGE SAVE TRIGGERED 🔥', { 
                                      debounce, 
                                      pageIndex: pageLayout.leftPageIndex, 
                                      contentLength: updatedContent.length,
                                      currentChapter: metadata?.currentChapter,
                                      chapterNumber: chapterNumber,
                                      viewMode: effectiveViewMode
                                    });
                                    const updatedPages = [...pages];
                                    updatedPages[pageLayout.leftPageIndex] = updatedContent;
                                    const combinedContent = updatedPages.join('\n\n');
                                    console.log('[TWO-COLUMN] Combined content length:', combinedContent.length);
                                    console.log('[TWO-COLUMN] This will save to metadata.currentChapter:', metadata?.currentChapter);
                                    console.log('🔧 [TWO-COLUMN LEFT] CHAPTER CONSISTENCY CHECK', {
                                      actualCurrentChapter: currentChapter,
                                      metadataCurrentChapter: metadata?.currentChapter,
                                      isConsistent: (metadata?.currentChapter ?? 1) === currentChapter
                                    });
                                    
                                    handleSaveContent(combinedContent, debounce);
                                  }}
                                  />
                                </BookContextProvider>
                              </div>
                              {pageLayout.leftPageNumber && !isImageOnlyPage(pages[pageLayout.leftPageIndex] || '') && (
                                <div className="flex-shrink-0 text-center text-xs text-gray-500 mt-4 font-serif">
                                  {pageLayout.leftPageNumber}
                                </div>
                              )}
                            </>
                          ) : (
                            <div className="flex items-center justify-center text-gray-400" style={{ height: 'calc(100% - 40px)', maxHeight: 'calc(100% - 40px)' }}>
                              <div className="text-center opacity-50">
                                <BookOpenIcon size={64} />
                                <p className="text-sm font-serif italic mt-4">Beginning of chapter</p>
                              </div>
                            </div>
                          )}
                        </div>
                      </div>
                    </div>

                    {/* Right Page Container */}
                    <div className="relative w-1/2">
                      {/* Multiple Page Stack Effect - Right Side Only (showing remaining pages) */}
                      {currentPageIndex < maxSpreadIndex && (
                        <>
                          <div className="absolute left-0.5 top-0.5 w-full h-full bg-stone-200 dark:bg-stone-300 border border-stone-300 dark:border-stone-400 rounded-l-sm shadow-sm z-[1]"></div>
                          <div className="absolute left-1 top-1 w-full h-full bg-stone-100 dark:bg-stone-200 border border-stone-300 dark:border-stone-400 rounded-l-sm shadow-sm z-[2]"></div>
                          <div className="absolute left-1.5 top-1.5 w-full h-full bg-stone-50 dark:bg-stone-100 border border-stone-300 dark:border-stone-400 rounded-l-sm shadow-sm z-[3]"></div>
                          <div className="absolute left-2 top-2 w-full h-full bg-stone-50 dark:bg-stone-100 border border-stone-300 dark:border-stone-400 rounded-l-sm shadow-sm z-[4]"></div>
                          <div className="absolute left-2.5 top-2.5 w-full h-full bg-stone-50 dark:bg-stone-100 border border-stone-300 dark:border-stone-400 rounded-l-sm shadow-sm z-[5]"></div>
                        </>
                      )}
                      
                      {/* Main Right Page */}
                      <div className="relative w-full h-full bg-cream dark:bg-stone-50 border-2 border-stone-300 dark:border-stone-400 border-l-stone-400 dark:border-l-stone-500 rounded-l-sm p-8 pl-12 z-10">
                        {/* Paper Texture */}
                        <div className="absolute inset-0 opacity-10 page-texture pointer-events-none"></div>
                        
                        {/* Binding Holes */}
                        <div className="absolute left-6 top-16 w-1.5 h-1.5 bg-stone-400 dark:bg-stone-600 rounded-full opacity-60"></div>
                        <div className="absolute left-6 top-32 w-1.5 h-1.5 bg-stone-400 dark:bg-stone-600 rounded-full opacity-60"></div>
                        <div className="absolute left-6 bottom-32 w-1.5 h-1.5 bg-stone-400 dark:bg-stone-600 rounded-full opacity-60"></div>
                        <div className="absolute left-6 bottom-16 w-1.5 h-1.5 bg-stone-400 dark:bg-stone-600 rounded-full opacity-60"></div>
                        
                        {/* Page Content */}
                        <div className="relative h-full overflow-hidden flex flex-col">
                          {/* Chapter header on first page */}
                          {pageLayout.rightPageIndex === 0 && (chapterNumber || chapterTitle) && (
                            <div className="flex-shrink-0 mb-8">
                              <div className="flex items-center gap-3 mb-4">
                                <div className="h-px bg-stone-300 flex-1"></div>
                                <span className="text-xs font-medium text-stone-500 uppercase tracking-wider">
                                  Chapter {chapterNumber}
                                </span>
                                <div className="h-px bg-stone-300 flex-1"></div>
                              </div>
                              {chapterTitle && (
                                <h1 className="text-lg font-serif font-semibold text-gray-900 text-center leading-tight">
                                  {chapterTitle}
                                </h1>
                              )}
                            </div>
                          )}
                          
                          <div className={`prose prose-sm max-w-none font-serif leading-relaxed text-gray-800 overflow-hidden ${
                            pageLayout.rightPageIndex >= 0 && isImageOnlyPage(pages[pageLayout.rightPageIndex] || '') 
                              ? 'flex items-center justify-center p-0 m-0 absolute inset-0' 
                              : 'text-justify'
                          }`} style={{ 
                            height: pageLayout.rightPageIndex >= 0 && isImageOnlyPage(pages[pageLayout.rightPageIndex] || '') 
                              ? '100%' 
                              : (pageLayout.rightPageIndex === 0 && (chapterNumber || chapterTitle) ? 'calc(100% - 140px)' : 'calc(100% - 40px)'), 
                            minHeight: pageLayout.rightPageIndex >= 0 && isImageOnlyPage(pages[pageLayout.rightPageIndex] || '') 
                              ? '100%' 
                              : '400px',
                            maxHeight: pageLayout.rightPageIndex >= 0 && isImageOnlyPage(pages[pageLayout.rightPageIndex] || '') 
                              ? '100%' 
                              : (pageLayout.rightPageIndex === 0 && (chapterNumber || chapterTitle) ? 'calc(100% - 140px)' : 'calc(100% - 40px)'),
                            width: pageLayout.rightPageIndex >= 0 && isImageOnlyPage(pages[pageLayout.rightPageIndex] || '') 
                              ? '100%' 
                              : 'auto'
                          }}>
                            {pageLayout.rightPageIndex >= 0 ? (
                              <BookContextProvider 
                                isFullPageImage={isImageOnlyPage(pages[pageLayout.rightPageIndex] || '')}
                                bookId={metadata?.bookId}
                                bookTitle={metadata?.bookTitle}
                                storyContext={(() => {
                                  // Include prior pages for better story context
                                  const currentIndex = pageLayout.rightPageIndex;
                                  const contextPages = [];
                                  
                                  // Include previous 2-3 pages for context
                                  for (let i = Math.max(0, currentIndex - 2); i <= currentIndex; i++) {
                                    if (pages[i] && pages[i].trim()) {
                                      const cleanText = extractCleanText(pages[i]);
                                      if (cleanText) {
                                        contextPages.push(cleanText);
                                      }
                                    }
                                  }
                                  
                                  return contextPages.join('\n\n');
                                })()}
                              >
                                <Editor
                                  content={pages[pageLayout.rightPageIndex]}
                                  suggestions={[]}
                                  isCurrentVersion={isCurrentVersion}
                                  currentVersionIndex={0}
                                  status={(status as 'streaming' | 'idle') || 'idle'}
                                  storyContext={(() => {
                                    // Include prior pages for better story context
                                    const currentIndex = pageLayout.rightPageIndex;
                                    const contextPages = [];
                                    for (let i = Math.max(0, currentIndex - 2); i <= currentIndex; i++) {
                                      if (pages[i] && pages[i].trim()) {
                                        const cleanText = extractCleanText(pages[i]);
                                        if (cleanText) {
                                          contextPages.push(cleanText);
                                        }
                                      }
                                    }
                                    return contextPages.join('\n\n');
                                  })()}
                                  onSaveContent={(updatedContent, debounce) => {
                                    console.log('🔥 [TWO-COLUMN] RIGHT PAGE SAVE TRIGGERED 🔥', { 
                                      debounce, 
                                      pageIndex: pageLayout.rightPageIndex, 
                                      contentLength: updatedContent.length,
                                      currentChapter: metadata?.currentChapter,
                                      chapterNumber: chapterNumber,
                                      viewMode: effectiveViewMode
                                    });
                                    const updatedPages = [...pages];
                                    updatedPages[pageLayout.rightPageIndex] = updatedContent;
                                    const combinedContent = updatedPages.join('\n\n');
                                    console.log('[TWO-COLUMN] This will save to metadata.currentChapter:', metadata?.currentChapter);
                                    console.log('🔧 [TWO-COLUMN RIGHT] CHAPTER CONSISTENCY CHECK', {
                                      actualCurrentChapter: currentChapter,
                                      metadataCurrentChapter: metadata?.currentChapter,
                                      isConsistent: (metadata?.currentChapter ?? 1) === currentChapter
                                    });
                                    
                                    handleSaveContent(combinedContent, debounce);
                                  }}
                                />
                              </BookContextProvider>
                            ) : (
                              <div className="flex items-center justify-center h-full text-gray-400">
                                <div className="text-center">
                                  <div className="mx-auto mb-4 opacity-50">
                                    <BookOpenIcon size={48} />
                                  </div>
                                  <p className="text-sm font-serif italic">End of chapter</p>
                                  {chapterNumber < totalChapters && (
                                    <Button
                                      variant="outline"
                                      size="sm"
                                      onClick={onNext}
                                      className="mt-4 font-serif"
                                    >
                                      Next Chapter
                                    </Button>
                                  )}
                                </div>
                              </div>
                            )}
                          </div>
                          
                          {pageLayout.rightPageNumber && !(pageLayout.rightPageIndex >= 0 && isImageOnlyPage(pages[pageLayout.rightPageIndex] || '')) && (
                            <div className="flex-shrink-0 text-center text-xs text-gray-500 mt-4 font-serif">
                              {pageLayout.rightPageNumber}
                            </div>
                          )}
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              </div>

              {/* Right Navigation Button */}
              <div className="flex-shrink-0">
                <Button
                  variant="ghost"
                  size="lg"
                  onClick={handleNextPage}
                  disabled={(currentPageIndex >= maxSpreadIndex && chapterNumber >= totalChapters) }
                  className="h-16 w-16 rounded-full flex items-center justify-center text-stone-600 dark:text-stone-400 hover:text-stone-900 dark:hover:text-stone-100 disabled:opacity-30 hover:bg-white/80 dark:hover:bg-zinc-800/80 shadow-lg transition-all duration-200"
                >
                  <ChevronRightIcon size={28} />
                </Button>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Version Control Banner - Bottom Position */}
      {effectiveViewMode === 'single' && !isCurrentVersion && totalVersions && totalVersions > 1 && (
        <div className="bg-amber-50 dark:bg-amber-950/30 border-t border-amber-200 dark:border-amber-800 p-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="flex items-center justify-center w-8 h-8 bg-amber-100 dark:bg-amber-900 rounded-full">
                  <ClockRewind size={16} />
                </div>
                <div>
                  <p className="text-sm font-medium text-amber-800 dark:text-amber-200">
                    Viewing Previous Version
                  </p>
                  <p className="text-xs text-amber-600 dark:text-amber-400">
                    Version {totalVersions - (currentVersionIndex || 0)} of {totalVersions} 
                    {currentVersionIndex === 0 ? ' (Latest)' : ' (Older)'}
                  </p>
                </div>
              </div>
              <div className="flex items-center gap-2">
                {currentVersionIndex !== 0 && onVersionRestore && (
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={onVersionRestore}
                    className="text-amber-700 dark:text-amber-300 border-amber-300 dark:border-amber-700 hover:bg-amber-100 dark:hover:bg-amber-900"
                  >
                    Restore This Version
                  </Button>
                )}
                {onVersionLatest && (
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={onVersionLatest}
                    className="text-amber-600 dark:text-amber-400 hover:text-amber-800 dark:hover:text-amber-200"
                  >
                    Back to Latest
                  </Button>
                )}
              </div>
            </div>
        </div>
      )}

      {/* Bottom Status Bar - Single Column Only */}
      {effectiveViewMode === 'single' && (
        <div className="flex justify-between items-center px-6 py-3 border-t border-gray-200 dark:border-zinc-800 bg-gray-50/50 dark:bg-zinc-900/50">
          <Button
            variant="ghost"
            size="sm"
            onClick={onPrevious}
            disabled={chapterNumber <= 1}
            className="flex items-center gap-2 text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-gray-100 disabled:opacity-30"
          >
            <ChevronLeftIcon size={14} />
            Previous Chapter
          </Button>
          
          <div className="text-xs text-gray-400 dark:text-gray-500">
            {content ? `${content.split(' ').filter(word => word.length > 0).length} words` : '0 words'}
          </div>
          
          <Button
            variant="ghost"
            size="sm"
            onClick={onNext}
            disabled={chapterNumber >= totalChapters}
            className="flex items-center gap-2 text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-gray-100 disabled:opacity-30"
          >
            Next Chapter
            <ChevronRightIcon size={14} />
          </Button>
        </div>
      )}

            {/* Removed all text selection and image generation UI components */}
    </div>
  );
}



export const bookArtifact = new Artifact<'book', BookArtifactMetadata>({
  kind: 'book',
  description: 'Specialized for book writing with chapter navigation, table of contents, and book-like styling.',
  initialize: async ({ documentId, setMetadata }) => {
    const suggestions = await getSuggestions({ documentId });

          // Initialize with basic book structure - chapters will be loaded from content
      // USING 1-BASED INDEXING to match database
      setMetadata({
        suggestions,
        chapters: [],
        currentChapter: 1, // Start with Chapter 1 (1-based)
        bookTitle: 'Untitled Book',
        author: '',
        genre: '',
        totalWords: 0,
      });
  },
  onStreamPart: ({ streamPart, setMetadata, setArtifact }) => {
    if (streamPart.type === 'suggestion') {
      try {
        setMetadata((metadata) => {
          const existingSuggestions = metadata?.suggestions || [];
          const newSuggestion = streamPart.content as Suggestion;

          const suggestionExists = existingSuggestions.some(
            (suggestion) => suggestion.id === newSuggestion.id,
          );

          if (suggestionExists) {
            return metadata;
          }

          return {
            ...metadata,
            suggestions: [...existingSuggestions, newSuggestion],
          };
        });
      } catch (error) {
        console.error('Error handling suggestion:', error);
      }
    }

    if (streamPart.type === 'text-delta') {
      try {
        let newContent = '';
        
        setArtifact((draftArtifact) => {
          if (!draftArtifact) return draftArtifact;

          newContent = draftArtifact.content + (streamPart.content as string);

          return {
            ...draftArtifact,
            content: newContent,
            isVisible:
              draftArtifact.status === 'streaming' &&
              newContent.length > 400 &&
              newContent.length < 450
                ? true
                : draftArtifact.isVisible,
            status: 'streaming',
          };
        });

        // Update word count
        setMetadata((metadata) => {
          if (!metadata) return metadata;
          
          const wordCount = newContent
            .split(' ')
            .filter((word: string) => word.length > 0).length;
          
          const updatedChapters = [...metadata.chapters];
          const idx = Math.max(0, (metadata.currentChapter ?? 1) - 1); // convert 1-based -> 0-based
          if (updatedChapters[idx]) {
            updatedChapters[idx] = {
              ...updatedChapters[idx],
              wordCount,
            };
          }

          return {
            ...metadata,
            chapters: updatedChapters,
            totalWords: updatedChapters.reduce((total, chapter) => total + chapter.wordCount, 0),
          };
        });
      } catch (error) {
        console.error('Error handling text delta:', error);
      }
    }
  },
  content: ({
    mode,
    status,
    content,
    isCurrentVersion,
    currentVersionIndex,
    onSaveContent,
    getDocumentContentById,
    isLoading,
    metadata,
    setMetadata,
    handleVersionChange,
    totalVersions,
  }: ArtifactContent<BookArtifactMetadata>) => {
    // Extract book title from content and load chapters from database
    useEffect(() => {
      const abortController = new AbortController();
      
      const loadBookChapters = async () => {
        if (!content || !setMetadata) return;
        
        // Check if component is still mounted
        if (abortController.signal.aborted) return;

        // Try to extract book title from content - handle both JSON and text formats
        let extractedBookTitle = 'Untitled Book';
        
        // Check if content is JSON from createBook tool
        try {
          const jsonContent = JSON.parse(content);
          if (jsonContent.bookTitle) {
            extractedBookTitle = jsonContent.bookTitle;
          }
        } catch {
          // Not JSON, try text patterns
          const titleMatch = content.match(/^#\s*(.+)$/m) || 
                            content.match(/^(.+)\s*-\s*(?:A\s+)?(?:Children's\s+)?Book/m) ||
                            content.match(/bookTitle:\s*"([^"]+)"/);
          
          if (titleMatch) {
            extractedBookTitle = titleMatch[1].trim();
          }
        }
        
        // Try to get bookId from content first, fallback to bookTitle
        let bookId = null;
        let targetChapterNumber = null;
        try {
          const parsedContent = JSON.parse(content);
          if (parsedContent.bookId) {
            bookId = parsedContent.bookId;
            // Also get the target chapter number for navigation
            if (parsedContent.chapterNumber) {
              targetChapterNumber = parsedContent.chapterNumber;
            }
          }
        } catch {}
        
        // Check if component is still mounted before async operation
        if (abortController.signal.aborted) return;
        
        // Load chapters for this book
        const chapters = bookId 
          ? await getBookChapters(bookId, true, abortController.signal)
          : await getBookChapters(extractedBookTitle, false, abortController.signal);
        
        // Check again after async operation
        if (abortController.signal.aborted) return;
        
        if (chapters.length > 0) {
          const totalWords = chapters.reduce((sum: number, chapter: any) => sum + chapter.wordCount, 0);
          
          // Navigate to the target chapter if specified, otherwise go to the first chapter
          // USING 1-BASED INDEXING to match database
          let targetChapterNumber1Based = 1;
          if (targetChapterNumber) {
            // Use the target chapter number directly (1-based)
            targetChapterNumber1Based = targetChapterNumber;
            console.log(`[BookArtifact] Navigating to chapter ${targetChapterNumber} (1-based)`);
          } else {
            // Default to the first chapter (Chapter 1)
            targetChapterNumber1Based = 1;
            console.log(`[BookArtifact] No target chapter specified, navigating to Chapter 1`);
          }
          
          setMetadata((prev: BookArtifactMetadata | undefined) => ({
            ...prev,
            bookTitle: extractedBookTitle,
            bookId: bookId || undefined,
            chapters: chapters,
            totalWords: totalWords,
            currentChapter: targetChapterNumber1Based, // Now using 1-based indexing
          } as BookArtifactMetadata));
        } else {
          // If no chapters found, set the book title from content
          setMetadata((prev: BookArtifactMetadata | undefined) => ({
            ...prev,
            bookTitle: extractedBookTitle,
            bookId: bookId || undefined,
          } as BookArtifactMetadata));
        }
      };
      
      loadBookChapters().catch(error => {
        if (!abortController.signal.aborted) {
          console.error('[BookArtifact] Error loading book chapters:', error);
        } else {
          console.log('[BookArtifact] Book chapters load was aborted (expected)');
        }
      });
      
      // Cleanup function
      return () => {
        console.log('[BookArtifact] 🧹 CLEANUP: Aborting book chapters load');
        console.log('[BookArtifact] Content length:', content?.length || 0);
        console.log('[BookArtifact] Has setMetadata:', !!setMetadata);
        
        try {
          abortController.abort();
          console.log('[BookArtifact] ✅ AbortController.abort() completed successfully');
        } catch (abortError) {
          console.error('[BookArtifact] ❌ Error during abort:', abortError);
        }
        
        console.log('[BookArtifact] 🏁 Cleanup completed');
      };
    }, [content]); // Removed setMetadata from dependencies to prevent infinite loop

    // Initialize currentChapter to 1 if not set (in useEffect to avoid render-time setState)
    useEffect(() => {
      if (!metadata?.currentChapter && setMetadata && metadata?.chapters && metadata.chapters.length > 0) {
        console.log('🔍 [BOOK ARTIFACT] INITIALIZING METADATA CURRENTCHAPTER TO 1 (FIRST CHAPTER)');
        setMetadata((prev: BookArtifactMetadata | undefined) => ({ 
          ...prev, 
          currentChapter: 1 
        } as BookArtifactMetadata));
      }
    }, [metadata?.chapters, metadata?.currentChapter, setMetadata]);

    // Show loading skeleton if loading or if we only have JSON content without chapters loaded
    const hasOnlyJsonContent = (() => {
      try {
        JSON.parse(content || '');
        return true;
      } catch {
        return false;
      }
    })();

    if (isLoading || (hasOnlyJsonContent && (!metadata?.chapters || metadata.chapters.length === 0))) {
      return <DocumentSkeleton artifactKind="book" />;
    }

    if (mode === 'diff') {
      const oldContent = getDocumentContentById(currentVersionIndex - 1);
      const newContent = getDocumentContentById(currentVersionIndex);

      return <DiffView oldContent={oldContent} newContent={newContent} />;
    }

    const rawChapters = metadata?.chapters || [];
    const chapters = rawChapters.map((chapter: any, index: number) => ({
      id: chapter.id || `chapter-${index}`,
      title: chapter.title || `Chapter ${index + 1}`,
      content: chapter.content || '',
      wordCount: chapter.wordCount || 0,
      chapterNumber: chapter.chapterNumber || index + 1,
    }));
    // Using 1-based indexing to match database
    // CRITICAL FIX: Always start with Chapter 1 as the visible chapter unless explicitly set
    // The key is to ensure metadata.currentChapter always reflects what's actually visible
    let currentChapter = metadata?.currentChapter || 1;
    
    // Initialize currentChapter to 1 if not set (moved to useEffect to avoid render-time setState)
    
    console.log('🔍 [BOOK ARTIFACT] CHAPTER STATE TRACKING:', {
      metadataCurrentChapter: metadata?.currentChapter,
      displayingCurrentChapter: currentChapter,
      chaptersAvailable: chapters.length,
      firstChapterDBNumber: chapters[0]?.chapterNumber || 'none',
      secondChapterDBNumber: chapters[1]?.chapterNumber || 'none',
      NOTE: 'currentChapter represents which chapter UI is showing, not which DB record'
    });
    const bookTitle = metadata?.bookTitle || 'Untitled Book';
    const author = metadata?.author || '';
    const totalWords = metadata?.totalWords || 0;

    // Convert 1-based currentChapter to 0-based array index with bounds checking
    const chapterArrayIndex = currentChapter - 1;
    
    // Runtime guard for array access
    if (chapterArrayIndex < 0 || chapterArrayIndex >= chapters.length) {
      console.warn(`🚨 [BOOK ARTIFACT] Invalid chapter index: ${chapterArrayIndex} (currentChapter: ${currentChapter}, total chapters: ${chapters.length})`);
    }
    
    const currentChapterData = chapters[chapterArrayIndex] || chapters[0];
    
    console.log('🚨 [BOOK ARTIFACT] CRITICAL DISPLAY STATE DEBUG 🚨', {
      currentChapter1Based: currentChapter,
      chapterArrayIndex: chapterArrayIndex,
      metadataCurrentChapter: metadata?.currentChapter,
      currentChapterData: currentChapterData ? {
        id: currentChapterData.id,
        title: currentChapterData.title,
        chapterNumber: currentChapterData.chapterNumber,
        contentLength: currentChapterData.content?.length || 0,
        contentPreview: currentChapterData.content?.substring(0, 50) || 'empty'
      } : 'none',
      totalChapters: chapters.length,
      bookTitle,
      MISMATCH_DETECTED: currentChapter !== (metadata?.currentChapter || 1) ? '❌ METADATA MISMATCH!' : '✅ metadata matches'
    });

    // Don't render JSON content directly - only show formatted chapter content
    const getDisplayContent = () => {
      let displayContent = '';
      
      // If we have chapter data from database, use it (highest priority)
      if (currentChapterData?.content) {
        displayContent = currentChapterData.content;
      } else {
        // If content looks like JSON from createBook tool, extract the actual content
        try {
          const parsedContent = JSON.parse(content || '');
          if (parsedContent.content && typeof parsedContent.content === 'string') {
            displayContent = parsedContent.content;
          }
        } catch {
          // Not JSON, continue to fallback logic
        }
        
        if (!displayContent) {
          // Fallback to original content, but avoid displaying raw JSON
          const fallbackContent = content || '';
          
          // Check if content is JSON - if so, don't display it directly
          try {
            JSON.parse(fallbackContent);
            // If it's valid JSON but we couldn't extract meaningful content, 
            // return empty string to show loading/skeleton state
            return '';
          } catch {
            // Not JSON, safe to display as-is
            displayContent = fallbackContent;
          }
        }
      }
      
      // Check if content has images that need migration and show a notice
      if (displayContent && hasImagesToMigrate(displayContent)) {
        // Add a notice about image migration at the top
        const migrationNotice = `> 🔄 **Image Migration Available**: This chapter contains images that can be optimized for better performance. The images will be automatically migrated when you edit this chapter.\n\n`;
        return migrationNotice + displayContent;
      }
      
      return displayContent;
    };

    return (
      <BookPage
        content={getDisplayContent()}
        chapterTitle={currentChapterData?.title || ''}
        chapterNumber={currentChapter} // Already 1-based, no conversion needed
        totalChapters={chapters.length}
        chapters={chapters}
        currentChapter={currentChapter} // RIGHT: 1-based, matching metadata.currentChapter
        onPrevious={() => {
          if (currentChapter > 1) { // Chapter 1 is the minimum (1-based)
            setMetadata?.((prev: BookArtifactMetadata | undefined) => ({
              ...prev,
              currentChapter: currentChapter - 1, // Decrement 1-based chapter
            } as BookArtifactMetadata));
          }
        }}
        onNext={() => {
          if (currentChapter < chapters.length) { // Can go up to chapters.length (1-based)
            setMetadata?.((prev: BookArtifactMetadata | undefined) => ({
              ...prev,
              currentChapter: currentChapter + 1, // Increment 1-based chapter
            } as BookArtifactMetadata));
          }
        }}
        onChapterSelect={(chapterIndex) => {
          // Convert 0-based chapterIndex to 1-based chapter number
          const chapterNumber1Based = chapterIndex + 1;
          
          console.log('🔥 [BOOK ARTIFACT] CHAPTER SELECTION (1-BASED) 🔥', {
            selectedIndex0Based: chapterIndex,
            selectedChapterNumber1Based: chapterNumber1Based,
            previousChapter1Based: metadata?.currentChapter,
            totalChapters: chapters.length,
            selectedChapter: chapters[chapterIndex],
            selectedChapterTitle: chapters[chapterIndex]?.title
          });
          
          // CRITICAL: Update metadata with 1-based chapter number
          setMetadata?.((prev: BookArtifactMetadata | undefined) => {
            const newMetadata = {
              ...prev,
              currentChapter: chapterNumber1Based, // Store 1-based chapter number
            };
            console.log('🔥 [BOOK ARTIFACT] METADATA UPDATED (1-BASED) 🔥', {
              oldCurrentChapter1Based: prev?.currentChapter,
              newCurrentChapter1Based: chapterNumber1Based,
              chapterNumberSelected: chapters[chapterIndex]?.chapterNumber
            });
            return newMetadata as BookArtifactMetadata;
          });
        }}
        onSaveContent={(content, debounce) => {
          console.log('🔥 [BOOK ARTIFACT] CHAPTER-AWARE SAVE (1-BASED) 🔥', {
            currentChapter1Based: currentChapter,
            metadataCurrentChapter1Based: metadata?.currentChapter,
            chapterMismatch: (metadata?.currentChapter ?? 1) !== currentChapter,
            contentPreview: content.substring(0, 100),
            willSaveToChapter: currentChapter
          });
          
          // CRITICAL FIX: Ensure metadata matches actual chapter before save
          if (setMetadata && (metadata?.currentChapter ?? 1) !== currentChapter) {
            console.log('🔧 [BOOK ARTIFACT] FIXING METADATA MISMATCH (1-BASED)', {
              oldMetadataCurrentChapter: metadata?.currentChapter,
              newCurrentChapter: currentChapter,
              chapterNumberToSave: currentChapter
            });
            
            // Update metadata synchronously before calling save
            setMetadata((prev: BookArtifactMetadata | undefined) => ({ ...prev, currentChapter } as BookArtifactMetadata));
            
            // Give React a moment to update the metadata, then save
            setTimeout(() => {
              console.log('🔧 [BOOK ARTIFACT] CALLING SAVE AFTER METADATA FIX');
              onSaveContent(content, debounce);
            }, 50);
          } else {
            console.log('✅ [BOOK ARTIFACT] METADATA MATCHES (1-BASED), SAVING DIRECTLY');
            onSaveContent(content, debounce);
          }
        }}
        isCurrentVersion={isCurrentVersion}
        status={status}
        suggestions={metadata?.suggestions || []}
        metadata={metadata}
        currentVersionIndex={currentVersionIndex}
        totalVersions={totalVersions}
        onVersionRestore={() => {
          // Restore the currently viewed version by copying its content to a new version
          const currentContent = getDocumentContentById?.(currentVersionIndex || 0);
          if (currentContent && onSaveContent) {
            console.log('[BOOK ARTIFACT] Restoring version', currentVersionIndex, 'as new latest version');
            onSaveContent(currentContent, false); // Save immediately without debounce
            // Navigate back to latest after restore
            setTimeout(() => {
              handleVersionChange?.('latest');
            }, 100);
          }
        }}
        onVersionLatest={() => {
          // Navigate back to the latest version
          console.log('[BOOK ARTIFACT] Returning to latest version');
          handleVersionChange?.('latest');
        }}
      />
    );
  },
  actions: [
    {
      icon: <BookOpenIcon size={18} />,
      description: 'Table of contents',
      onClick: ({ setMetadata }) => {
        // This will be handled by the component's state
      },
    },
    // Version control for book chapters
    {
      icon: <ClockRewind size={18} />,
      description: 'View changes',
      onClick: ({ handleVersionChange }) => {
        handleVersionChange('toggle');
      },
      isDisabled: () => false, // Enable for books
    },
    {
      icon: <UndoIcon size={18} />,
      description: 'Previous version',
      onClick: ({ handleVersionChange }) => {
        handleVersionChange('prev');
      },
      isDisabled: () => false, // Enable for books
    },
    {
      icon: <RedoIcon size={18} />,
      description: 'Next version',
      onClick: ({ handleVersionChange }) => {
        handleVersionChange('next');
      },
      isDisabled: () => false, // Enable for books
    },
    {
      icon: <SaveIcon size={18} />,
      description: 'Save to memory',
      onClick: async ({ content, metadata }) => {
        try {
          const response = await fetch('/api/memory/save', {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
            },
            body: JSON.stringify({
              content,
              type: 'document',
              metadata: {
                kind: 'book',
                bookTitle: metadata?.bookTitle,
                author: metadata?.author,
                genre: metadata?.genre,
                totalWords: metadata?.totalWords,
                chapters: metadata?.chapters?.length,
              },
            }),
          });

          if (!response.ok) {
            throw new Error('Failed to save to memory');
          }

          toast.success('Book saved to memory!');
        } catch (error) {
          console.error('Error saving book to memory:', error);
          toast.error('Failed to save book to memory');
        }
      },
    },
    {
      icon: <CopyIcon size={18} />,
      description: 'Copy chapter to clipboard',
      onClick: ({ content }) => {
        navigator.clipboard.writeText(content);
        toast.success('Chapter copied to clipboard!');
      },
    },
  ],
  toolbar: [
    {
      icon: <PenIcon />,
      description: 'Improve writing',
      onClick: ({ appendMessage }) => {
        appendMessage({
          role: 'user',
          parts: [{ type: 'text', text: 'Please improve the writing in this chapter by enhancing the prose, dialogue, and pacing. Make it more engaging and polished.' }],
        });
      },
    },
    {
      icon: <MessageIcon />,
      description: 'Add new chapter',
      onClick: ({ appendMessage }) => {
        appendMessage({
          role: 'user',
          parts: [{ type: 'text', text: 'Please create the next chapter of this book, continuing the story naturally from where we left off. Use the createBook tool to add the new chapter.' }],
        });
      },
    },
  ],
});
