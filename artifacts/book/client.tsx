import { Artifact } from '@/components/artifact/create-artifact';
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
import { TextSelectionImageGenerator } from '@/components/book/text-selection-image-generator';

// Helper function to get book chapters from database using bookId or bookTitle
async function getBookChapters(bookIdentifier: string, isBookId: boolean = false) {
  try {
    const param = isBookId ? `bookId=${encodeURIComponent(bookIdentifier)}` : `bookTitle=${encodeURIComponent(bookIdentifier)}`;
    const response = await fetch(`/api/books?${param}`);
    if (response.ok) {
      const chapters = await response.json();
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
    console.error('Failed to fetch book chapters:', error);
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
}: BookPageProps) {
  const [showChapterDropdown, setShowChapterDropdown] = useState(false);
  const [selectedText, setSelectedText] = useState('');
  const [viewMode, setViewMode] = useState<'single' | 'two-column'>('single');
  const [currentPageIndex, setCurrentPageIndex] = useState(0);
  const [showImageGenerator, setShowImageGenerator] = useState(false);
  const [isGeneratingImage, setIsGeneratingImage] = useState(false);
  const [windowWidth, setWindowWidth] = useState(typeof window !== 'undefined' ? window.innerWidth : 1200);
  const [debouncedSaveTimeout, setDebouncedSaveTimeout] = useState<NodeJS.Timeout | null>(null);
  const dropdownRef = useRef<HTMLDivElement>(null);
  const hoverTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const contentRef = useRef<HTMLDivElement>(null);

  // Function to split content into pages for two-column view with better height-based pagination
  const splitContentIntoPages = (content: string, wordsPerPage: number = 120) => {
    if (!content) return [];
    
    // Split by paragraphs first to maintain better formatting
    const paragraphs = content.split(/\n\s*\n/).filter(p => p.trim().length > 0);
    const pages: string[] = [];
    let currentPage = '';
    let currentWordCount = 0;
    
    for (const paragraph of paragraphs) {
      const paragraphWords = paragraph.split(/\s+/).filter(word => word.length > 0);
      const paragraphWordCount = paragraphWords.length;
      
      // If adding this paragraph would exceed the word limit, start a new page
      if (currentWordCount > 0 && currentWordCount + paragraphWordCount > wordsPerPage) {
        pages.push(currentPage.trim());
        currentPage = paragraph;
        currentWordCount = paragraphWordCount;
      } else {
        // Add paragraph to current page
        if (currentPage) {
          currentPage += '\n\n' + paragraph;
        } else {
          currentPage = paragraph;
        }
        currentWordCount += paragraphWordCount;
      }
    }
    
    // Add the last page if it has content
    if (currentPage.trim()) {
      pages.push(currentPage.trim());
    }
    
    return pages.length > 0 ? pages : [''];
  };

  // Determine if we should force single column based on window width
  const minWidthForTwoColumn = 1024; // Minimum width to show two columns
  const shouldForceSingleColumn = windowWidth < minWidthForTwoColumn;
  const effectiveViewMode = shouldForceSingleColumn ? 'single' : viewMode;

  // Get pages for two-column view
  const pages = effectiveViewMode === 'two-column' ? splitContentIntoPages(content) : [content];
  const totalPages = pages.length;
  
  // Window resize listener
  useEffect(() => {
    const handleResize = () => {
      setWindowWidth(window.innerWidth);
    };

    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);
  
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
  
  // Debounced save function for content updates
  const handleSaveContent = useCallback((updatedContent: string, debounce: boolean) => {
    // Clear any existing timeout
    if (debouncedSaveTimeout) {
      clearTimeout(debouncedSaveTimeout);
      setDebouncedSaveTimeout(null);
    }

    if (debounce) {
      // Save with 1000ms debounce
      const timeout = setTimeout(() => {
        console.log('Saving content with debounce');
        if (onSaveContent) {
          onSaveContent(updatedContent, false);
        }
      }, 1000);
      
      setDebouncedSaveTimeout(timeout);
    } else {
      // Save immediately
      console.log('Saving content immediately');
      if (onSaveContent) {
        onSaveContent(updatedContent, false);
      }
    }
  }, [debouncedSaveTimeout, onSaveContent]);

  // Close dropdown when clicking outside
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setShowChapterDropdown(false);
      }
    }

    document.addEventListener('mousedown', handleClickOutside);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, []);

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

  // Handle text selection for image generation
  useEffect(() => {
    const handleSelectionChange = () => {
      const selection = window.getSelection();
      if (selection && selection.toString().trim()) {
        const text = selection.toString().trim();
        // Only show image generator for substantial text selections (more than 10 characters)
        if (text.length > 10) {
          setSelectedText(text);
          setShowImageGenerator(true);
        }
      } else {
        setShowImageGenerator(false);
        setSelectedText('');
      }
    };

    document.addEventListener('selectionchange', handleSelectionChange);
    return () => {
      document.removeEventListener('selectionchange', handleSelectionChange);
    };
  }, []);

  const handleGenerateImage = async (params: {
    prompt: string;
    context: string;
    style: string;
    title?: string;
    subtitle?: string;
  }) => {
    setIsGeneratingImage(true);
    try {
      // This would typically call the AI tool through the chat interface
      // For now, we'll show a toast indicating the feature is working
      toast.success('Image generation started! Check the chat for results.');
      console.log('Generate image params:', params);
      
      // Close the generator after starting
      setShowImageGenerator(false);
      setSelectedText('');
      
      // Clear text selection
      window.getSelection()?.removeAllRanges();
    } catch (error) {
      console.error('Error generating image:', error);
      toast.error('Failed to generate image');
    } finally {
      setIsGeneratingImage(false);
    }
  };
  return (
    <div className="flex flex-col h-full bg-white dark:bg-zinc-900">
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
            <div className="prose prose-lg max-w-none font-serif leading-relaxed text-gray-900 dark:text-gray-100 prose-headings:text-gray-900 dark:prose-headings:text-gray-100">
              <Editor
                content={content || ''}
                suggestions={suggestions}
                isCurrentVersion={isCurrentVersion}
                currentVersionIndex={0}
                status={(status as 'streaming' | 'idle') || 'idle'}
                onSaveContent={handleSaveContent}
              />
            </div>
          </div>
        ) : (
          // Two Column View (Book Pages)
          <div className="h-full flex flex-col">
            {/* Book Pages with Side Navigation */}
            <div className="flex-1 flex items-center justify-center p-4">
              <div className="flex items-center gap-8 max-w-screen-2xl w-full h-full">
                {/* Left Navigation Button */}
                {totalPages > 1 && (
                  <div className="flex-shrink-0">
                    <Button
                      variant="ghost"
                      size="lg"
                      onClick={() => {
                        const newIndex = Math.max(0, currentPageIndex - 2);
                        console.log(`Previous: currentPageIndex=${currentPageIndex}, newIndex=${newIndex}`);
                        setCurrentPageIndex(newIndex);
                      }}
                      disabled={currentPageIndex <= 0}
                      className="h-16 w-16 rounded-full flex items-center justify-center text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-gray-100 disabled:opacity-30 hover:bg-gray-100 dark:hover:bg-zinc-800"
                    >
                      <ChevronLeftIcon size={24} />
                    </Button>
                  </div>
                )}
                
                {/* Book Pages Container */}
                <div className="flex gap-6 flex-1 h-full justify-center">
                {/* Left Page */}
                <div className="w-1/2 bg-white dark:bg-zinc-800 rounded-lg shadow-lg border border-gray-200 dark:border-zinc-700 p-6 h-[calc(100%-170px)] max-h-[700px] overflow-hidden">
                  <div className="h-full flex flex-col">
                    {/* Left Page Header */}
                    {currentPageIndex === 0 && (chapterNumber || chapterTitle) && (
                      <div className="mb-8">
                        <div className="flex items-center gap-3 mb-4">
                          <div className="h-px bg-gray-200 dark:bg-zinc-700 flex-1"></div>
                          <span className="text-sm font-medium text-gray-400 dark:text-gray-500 uppercase tracking-wider">
                            Chapter {chapterNumber}
                          </span>
                          <div className="h-px bg-gray-200 dark:bg-zinc-700 flex-1"></div>
                        </div>
                        {chapterTitle && (
                          <h1 className="text-xl font-serif font-semibold text-gray-900 dark:text-gray-100 text-center">
                            {chapterTitle}
                          </h1>
                        )}
                      </div>
                    )}
                    
                    {/* Left Page Content */}
                    <div className="flex-1 prose prose-sm max-w-none w-full font-serif leading-relaxed text-gray-800 dark:text-gray-200 text-justify overflow-hidden">
                      <Editor
                        content={pages[currentPageIndex] || ''}
                        suggestions={[]}
                        isCurrentVersion={isCurrentVersion}
                        currentVersionIndex={0}
                        status="idle"
                        onSaveContent={(updatedContent, debounce) => {
                          // For two-column view, we need to update the specific page
                          // and then combine all pages into a single content string
                          const updatedPages = [...pages];
                          updatedPages[currentPageIndex] = updatedContent;
                          const combinedContent = updatedPages.join('\n\n');
                          handleSaveContent(combinedContent, debounce);
                        }}
                      />
                    </div>
                    
                    {/* Left Page Number */}
                    <div className="text-center text-xs text-gray-400 dark:text-gray-500 mt-4">
                      {currentPageIndex * 2 + 1}
                    </div>
                  </div>
                </div>

                {/* Right Page */}
                <div className="w-1/2 bg-white dark:bg-zinc-800 rounded-lg shadow-lg border border-gray-200 dark:border-zinc-700 p-6 h-[calc(100%-170px)] max-h-[700px] overflow-hidden">
                  <div className="h-full flex flex-col">
                    {/* Right Page Content */}
                    <div className="flex-1 prose prose-sm max-w-none w-full font-serif leading-relaxed text-gray-800 dark:text-gray-200 text-justify overflow-hidden">
                      {pages[currentPageIndex + 1] ? (
                        <Editor
                          content={pages[currentPageIndex + 1]}
                          suggestions={[]}
                          isCurrentVersion={isCurrentVersion}
                          currentVersionIndex={0}
                          status="idle"
                          onSaveContent={(updatedContent, debounce) => {
                            // For two-column view, we need to update the specific page
                            // and then combine all pages into a single content string
                            const updatedPages = [...pages];
                            updatedPages[currentPageIndex + 1] = updatedContent;
                            const combinedContent = updatedPages.join('\n\n');
                            handleSaveContent(combinedContent, debounce);
                          }}
                        />
                      ) : (
                        <div className="flex items-center justify-center h-full text-gray-400 dark:text-gray-500">
                          <div className="text-center">
                            <BookOpenIcon size={48} />
                            <p className="text-sm mt-4">End of chapter</p>
                          </div>
                        </div>
                      )}
                    </div>
                    
                    {/* Right Page Number */}
                    {pages[currentPageIndex + 1] && (
                      <div className="text-center text-xs text-gray-400 dark:text-gray-500 mt-4">
                        {currentPageIndex * 2 + 2}
                      </div>
                    )}
                  </div>
                </div>
                </div>
                
                {/* Right Navigation Button */}
                {totalPages > 1 && (
                  <div className="flex-shrink-0">
                    <Button
                      variant="ghost"
                      size="lg"
                      onClick={() => {
                        if (currentPageIndex + 2 < totalPages) {
                          const newIndex = currentPageIndex + 2;
                          console.log(`Next: currentPageIndex=${currentPageIndex}, newIndex=${newIndex}`);
                          setCurrentPageIndex(newIndex);
                        } else {
                          console.log(`Next chapter: currentPageIndex=${currentPageIndex}, totalPages=${totalPages}`);
                          onNext();
                        }
                      }}
                      disabled={currentPageIndex + 2 >= totalPages && chapterNumber >= totalChapters}
                      className="h-16 w-16 rounded-full flex items-center justify-center text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-gray-100 disabled:opacity-30 hover:bg-gray-100 dark:hover:bg-zinc-800"
                    >
                      <ChevronRightIcon size={24} />
                    </Button>
                  </div>
                )}
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Bottom Navigation Bar */}
      <div className="flex justify-between items-center px-6 py-3 border-t border-gray-200 dark:border-zinc-800 bg-gray-50/50 dark:bg-zinc-900/50">
        {effectiveViewMode === 'single' ? (
          // Single Column Navigation (Chapter-based)
          <>
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
          </>
        ) : (
          // Two Column Navigation (Chapter-based)
          <>
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
            
            <div className="text-xs text-gray-400 dark:text-gray-500 text-center">
              <div>Chapter {chapterNumber} of {totalChapters}</div>
              {totalPages > 1 && (
                <div className="mt-1">
                  Pages {currentPageIndex + 1}-{Math.min(currentPageIndex + 2, totalPages)} of {totalPages}
                </div>
              )}
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
          </>
        )}
      </div>

      {/* Text Selection Image Generator */}
      {showImageGenerator && selectedText && (
        <TextSelectionImageGenerator
          selectedText={selectedText}
          bookTitle={metadata?.bookTitle}
          chapterTitle={chapterTitle}
          onClose={() => {
            setShowImageGenerator(false);
            setSelectedText('');
            window.getSelection()?.removeAllRanges();
          }}
          onGenerateImage={handleGenerateImage}
          isGenerating={isGeneratingImage}
        />
      )}
    </div>
  );
}



export const bookArtifact = new Artifact<'book', BookArtifactMetadata>({
  kind: 'book',
  description: 'Specialized for book writing with chapter navigation, table of contents, and book-like styling.',
  initialize: async ({ documentId, setMetadata }) => {
    const suggestions = await getSuggestions({ documentId });

    // Initialize with basic book structure - chapters will be loaded from content
    setMetadata({
      suggestions,
      chapters: [],
      currentChapter: 0,
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
          updatedChapters[metadata.currentChapter] = {
            ...updatedChapters[metadata.currentChapter],
            wordCount,
          };

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
  }) => {
    // Extract book title from content and load chapters from database
    useEffect(() => {
      const loadBookChapters = async () => {
        if (!content || !setMetadata) return;

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
        try {
          const parsedContent = JSON.parse(content);
          if (parsedContent.bookId) {
            bookId = parsedContent.bookId;
          }
        } catch {}
        
        // Load chapters for this book
        const chapters = bookId 
          ? await getBookChapters(bookId, true)
          : await getBookChapters(extractedBookTitle, false);
        
        if (chapters.length > 0) {
          const totalWords = chapters.reduce((sum: number, chapter: any) => sum + chapter.wordCount, 0);
          
          // Check if content contains a specific chapter number to navigate to
          let targetChapterIndex = 0;
          try {
            const parsedContent = JSON.parse(content);
            if (parsedContent.chapterNumber) {
              // Find the chapter with the specified chapter number
              const chapterIndex = chapters.findIndex((ch: any) => ch.chapterNumber === parsedContent.chapterNumber);
              if (chapterIndex >= 0) {
                targetChapterIndex = chapterIndex;
                console.log(`[BookArtifact] Navigating to chapter ${parsedContent.chapterNumber} (index ${targetChapterIndex})`);
              }
            }
          } catch {
            // If not JSON or no specific chapter, default to the last chapter (newest)
            targetChapterIndex = chapters.length - 1;
            console.log(`[BookArtifact] Navigating to newest chapter (index ${targetChapterIndex})`);
          }
          
          setMetadata((prev) => ({
            ...prev,
            bookTitle: extractedBookTitle,
            chapters: chapters,
            totalWords: totalWords,
            currentChapter: targetChapterIndex,
          }));
        } else {
          // If no chapters found, set the book title from content
          setMetadata((prev) => ({
            ...prev,
            bookTitle: extractedBookTitle,
          }));
        }
      };
      
      loadBookChapters();
    }, [content, setMetadata]);

    if (isLoading) {
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
    const currentChapter = metadata?.currentChapter || 0;
    const bookTitle = metadata?.bookTitle || 'Untitled Book';
    const author = metadata?.author || '';
    const totalWords = metadata?.totalWords || 0;

    const currentChapterData = chapters[currentChapter] || chapters[0];

    return (
      <BookPage
        content={currentChapterData?.content || content || ''}
        chapterTitle={currentChapterData?.title || ''}
        chapterNumber={currentChapter + 1}
        totalChapters={chapters.length}
        chapters={chapters}
        currentChapter={currentChapter}
        onPrevious={() => {
          if (currentChapter > 0) {
            setMetadata?.((prev) => ({
              ...prev,
              currentChapter: currentChapter - 1,
            }));
          }
        }}
        onNext={() => {
          if (currentChapter < chapters.length - 1) {
            setMetadata?.((prev) => ({
              ...prev,
              currentChapter: currentChapter + 1,
            }));
          }
        }}
        onChapterSelect={(chapterIndex) => {
          setMetadata?.((prev) => ({
            ...prev,
            currentChapter: chapterIndex,
          }));
        }}
        onSaveContent={onSaveContent}
        isCurrentVersion={isCurrentVersion}
        status={status}
        suggestions={metadata?.suggestions || []}
        metadata={metadata}
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
    {
      icon: <ClockRewind size={18} />,
      description: 'View changes',
      onClick: ({ handleVersionChange }) => {
        handleVersionChange('toggle');
      },
      isDisabled: ({ currentVersionIndex }) => {
        return currentVersionIndex === 0;
      },
    },
    {
      icon: <UndoIcon size={18} />,
      description: 'Previous version',
      onClick: ({ handleVersionChange }) => {
        handleVersionChange('prev');
      },
      isDisabled: ({ currentVersionIndex }) => {
        return currentVersionIndex === 0;
      },
    },
    {
      icon: <RedoIcon size={18} />,
      description: 'Next version',
      onClick: ({ handleVersionChange }) => {
        handleVersionChange('next');
      },
      isDisabled: ({ isCurrentVersion }) => {
        return isCurrentVersion;
      },
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
