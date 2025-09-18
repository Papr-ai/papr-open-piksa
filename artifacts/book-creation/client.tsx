import { Artifact } from '@/components/artifact/create-artifact';
import type { ArtifactContent } from '@/components/artifact/create-artifact';
import { BookCreationArtifact } from '@/components/artifact/book-creation-artifact';
import type { BookArtifactState } from '@/lib/ai/tools/book-creation-constants';
import { BOOK_CREATION_STEPS } from '@/lib/ai/tools/book-creation-constants';
import { RefreshCw, CheckCircle, Edit3, BookOpen } from 'lucide-react';

// Helper function to parse story content and extract structured data
function parseStoryContent(content: string) {
  // Try to extract themes from content
  const themes = [];
  const themePatterns = [
    /themes?:?\s*([^\n]+)/i,
    /topics?:?\s*([^\n]+)/i,
    /(adventure|family|friendship|learning|exploration|discovery)/gi
  ];
  
  for (const pattern of themePatterns) {
    const match = content.match(pattern);
    if (match) {
      if (match[1]) {
        // Extract from explicit theme section
        themes.push(...match[1].split(/[,;]/).map(t => t.trim()).filter(Boolean));
      } else if (match[0]) {
        // Extract individual theme words
        themes.push(match[0]);
      }
    }
  }
  
  // Extract premise/concept (first paragraph or title)
  const lines = content.split('\n').filter(line => line.trim());
  const title = lines.find(line => line.startsWith('#'))?.replace(/^#+\s*/, '') || '';
  const premise = lines.find(line => !line.startsWith('#') && line.length > 50) || 
                  lines.slice(0, 3).join(' ').substring(0, 200) + '...';
  
  // Extract style guide information
  const styleGuide = content.includes('style') || content.includes('picture book') 
    ? 'Children\'s picture book style with vibrant illustrations'
    : 'Family-friendly storytelling style';
  
  return {
    premise: premise || 'Story concept to be developed',
    themes: [...new Set(themes)].slice(0, 5) || ['Adventure', 'Family'],
    styleGuide,
    fullContent: content
  };
}

export const bookCreationArtifact = new Artifact<'book-creation', BookArtifactState>({
  kind: 'book-creation',
  description: 'Interactive book creation workflow with step-by-step guidance and approval process.',
  
  
  content: ({ content, metadata, isCurrentVersion, onSaveContent }: ArtifactContent<BookArtifactState>) => {
    console.log('[BookCreationArtifact] Rendering with onSaveContent:', !!onSaveContent);
    
    // Try to parse content as JSON first (from stream events)
    let state: BookArtifactState | null = null;
    
    if (typeof content === 'string' && content.trim()) {
      try {
        // Try to parse as JSON (from stream events)
        const parsedState = JSON.parse(content);
        if (parsedState.bookId && parsedState.steps) {
          // Debug logging removed to prevent infinite loops
          state = parsedState;
        }
      } catch (error) {
        // Debug logging removed to prevent infinite loops
        // Parse content to extract structured data
        const parsedContent = parseStoryContent(content);
        
        state = {
          bookId: (metadata as any)?.bookId || '',
          bookTitle: (metadata as any)?.bookTitle || 'New Book',
          bookConcept: '', // Keep this empty, content goes in step data
          targetAge: '3-8 years',
          currentStep: 1,
          steps: [
            {
              stepNumber: 1,
              stepName: 'Story Planning',
              status: 'in_progress',
              data: parsedContent ? { 
                content: parsedContent.fullContent,
                premise: parsedContent.premise,
                themes: parsedContent.themes,
                styleBible: parsedContent.styleGuide
              } : undefined
            }
          ],
          createdAt: new Date(),
          updatedAt: new Date()
        };
      }
    }
    
    // Fallback to default state if no content or metadata
    if (!state) {
      console.log('[BookCreationArtifact] Using default state');
      state = {
        bookId: (metadata as any)?.bookId || '',
        bookTitle: (metadata as any)?.bookTitle || 'New Book',
        bookConcept: '',
        targetAge: '3-8 years',
        currentStep: 1,
        steps: [
          {
            stepNumber: 1,
            stepName: 'Story Planning',
            status: 'pending',
            data: undefined
          }
        ],
        createdAt: new Date(),
        updatedAt: new Date()
      };
    }
    
    const handleApprove = async (stepNumber: number, approved: boolean, feedback?: string) => {
      console.log('[BookCreationArtifact] User approval:', { stepNumber, approved, feedback });
      // TODO: Implement communication back to AI agent
    };

    const handleRegenerate = async (stepNumber: number) => {
      console.log('[BookCreationArtifact] User regenerate request:', stepNumber);
      // TODO: Implement communication back to AI agent
    };

    return (
      <BookCreationArtifact
        state={state}
        onApprove={handleApprove}
        onRegenerate={handleRegenerate}
        onUpdateState={(() => {
          let step5DebounceTimeout: NodeJS.Timeout | null = null;
          let workflowDebounceTimeout: NodeJS.Timeout | null = null;
          
          return async (updatedState, changedStepNumber?: number) => {
            console.log('[BookCreationArtifact] State updated:', {
              currentStep: updatedState.currentStep,
              changedStepNumber,
              bookId: updatedState.bookId
            });
            
            // Only handle Step 5 saves - workflow saves are handled by AI tools
            if (changedStepNumber === 5) {
              console.log('[BookCreationArtifact] Step 5 content changed, saving chapters to database...');
              
              // Clear existing timeout
              if (step5DebounceTimeout) {
                clearTimeout(step5DebounceTimeout);
              }
              
              // Debounce Step 5 saves
              step5DebounceTimeout = setTimeout(async () => {
                try {
                  const step5 = updatedState.steps.find(s => s.stepNumber === 5);
                  if (step5?.data?.chapters && step5.data.chapters.length > 0) {
                    // Save each chapter to its correct chapter number
                    for (const chapter of step5.data.chapters) {
                      const chapterContent = chapter.scenes?.map((scene: any) => scene.text).join('\n\n') || '';
                      const chapterTitle = chapter.title || `Chapter ${chapter.chapterNumber}`;
                      const chapterNumber = chapter.chapterNumber || 1;
                      
                      console.log('[BookCreationArtifact] Saving chapter:', {
                        chapterNumber,
                        chapterTitle,
                        contentLength: chapterContent.length
                      });
                      
                      const response = await fetch('/api/book/save', {
                        method: 'POST',
                        headers: {
                          'Content-Type': 'application/json',
                        },
                        body: JSON.stringify({
                          bookId: updatedState.bookId,
                          content: chapterContent,
                          currentChapter: chapterNumber,
                        }),
                      });

                      if (response.ok) {
                        console.log(`[BookCreationArtifact] Chapter ${chapterNumber} saved successfully`);
                      } else {
                        const errorText = await response.text();
                        console.error(`[BookCreationArtifact] Failed to save chapter ${chapterNumber}:`, errorText);
                        
                        // If chapter doesn't exist, create it first
                        if (errorText.includes('BOOK_NOT_FOUND')) {
                          console.log(`[BookCreationArtifact] Creating chapter ${chapterNumber} first...`);
                          const createResponse = await fetch('/api/book/chapters', {
                            method: 'POST',
                            headers: {
                              'Content-Type': 'application/json',
                            },
                            body: JSON.stringify({
                              bookId: updatedState.bookId,
                              chapterNumber: chapterNumber,
                              chapterTitle: chapterTitle,
                              content: chapterContent,
                            }),
                          });
                          
                          if (createResponse.ok) {
                            console.log(`[BookCreationArtifact] Chapter ${chapterNumber} created successfully`);
                            
                            // Retry saving after creation
                            const retryResponse = await fetch('/api/book/save', {
                              method: 'POST',
                              headers: {
                                'Content-Type': 'application/json',
                              },
                              body: JSON.stringify({
                                bookId: updatedState.bookId,
                                content: chapterContent,
                                currentChapter: chapterNumber,
                              }),
                            });
                            
                            if (retryResponse.ok) {
                              console.log(`[BookCreationArtifact] Chapter ${chapterNumber} saved after creation`);
                            } else {
                              console.error(`[BookCreationArtifact] Failed to save chapter ${chapterNumber} after creation:`, await retryResponse.text());
                            }
                          } else {
                            console.error(`[BookCreationArtifact] Failed to create chapter ${chapterNumber}:`, await createResponse.text());
                          }
                        }
                      }
                    }
                  }
                } catch (error) {
                  console.error('[BookCreationArtifact] Error saving Step 5 content:', error);
                }
              }, 1000); // 1 second debounce for Step 5 content
              
            } else {
              // Steps 1-4 changes need to be saved to Chapter 0 (workflow metadata)
              console.log('[BookCreationArtifact] Workflow state change, saving to Chapter 0...');
              
              // Clear existing workflow timeout
              if (workflowDebounceTimeout) {
                clearTimeout(workflowDebounceTimeout);
              }
              
              // Debounce workflow saves
              workflowDebounceTimeout = setTimeout(async () => {
                try {
                  // Create workflow summary in the same format as unified-book-creation.ts
                  const completedSteps = updatedState.steps.filter(step => step.status === 'completed' || step.status === 'approved');
                  const currentStepName = updatedState.steps.find(step => step.stepNumber === updatedState.currentStep)?.stepName || `Step ${updatedState.currentStep}`;
                  
                  const workflowSummary = `Book Creation Workflow Progress:
- Book: ${updatedState.bookTitle}
- Target Age: ${updatedState.targetAge}
- Current Step: ${updatedState.currentStep}/6 (${currentStepName})
- Completed Steps: ${completedSteps.length}/6
- Progress: ${Math.round((completedSteps.length / 6) * 100)}%

Book Concept: ${updatedState.bookConcept}

Workflow Data: ${JSON.stringify(updatedState, null, 2)}`;

                  // Try to update existing Chapter 0 first
                  let response = await fetch('/api/book/save', {
                    method: 'POST',
                    headers: {
                      'Content-Type': 'application/json',
                    },
                    body: JSON.stringify({
                      bookId: updatedState.bookId,
                      currentChapter: 0, // Chapter 0 for workflow metadata
                      content: workflowSummary
                    }),
                  });

                  // If Chapter 0 doesn't exist, create it
                  if (!response.ok && response.status === 404) {
                    console.log('[BookCreationArtifact] Chapter 0 not found, creating new chapter...');
                    response = await fetch('/api/book/chapters', {
                      method: 'POST',
                      headers: {
                        'Content-Type': 'application/json',
                      },
                      body: JSON.stringify({
                        bookId: updatedState.bookId,
                        chapterNumber: 0,
                        chapterTitle: `${updatedState.bookTitle} - Workflow`,
                        content: workflowSummary
                      }),
                    });
                  }

                  if (response.ok) {
                    console.log('[BookCreationArtifact] ✅ Workflow state saved to Chapter 0');
                  } else {
                    console.error('[BookCreationArtifact] ❌ Failed to save workflow state:', response.statusText);
                  }
                } catch (error) {
                  console.error('[BookCreationArtifact] ❌ Error saving workflow state:', error);
                }
              }, 500); // 500ms debounce for workflow changes
            }
          };
        })()}
        isReadonly={false}
        isCurrentVersion={isCurrentVersion}
        onSaveContent={onSaveContent}
      />
    );
  },

  actions: [
    {
      icon: <RefreshCw className="w-4 h-4" />,
      description: 'Regenerate current step',
      onClick: async ({ metadata }) => {
        console.log('Regenerate clicked for step:', metadata?.currentStep);
        // TODO: Implement regeneration
      },
      isDisabled: ({ metadata }) => !metadata?.currentStep || metadata.currentStep > 6,
    },
    {
      icon: <CheckCircle className="w-4 h-4" />,
      description: 'Approve current step and continue',
      onClick: async ({ metadata }) => {
        console.log('Approve clicked for step:', metadata?.currentStep);
        // TODO: Implement approval
      },
      isDisabled: ({ metadata }) => {
        const currentStepData = metadata?.steps?.find(s => s.stepNumber === metadata.currentStep);
        return !currentStepData || currentStepData.status !== 'completed';
      },
    },
    {
      icon: <Edit3 className="w-4 h-4" />,
      description: 'Request changes to current step',
      onClick: async ({ metadata }) => {
        const feedback = prompt('Please describe what changes you would like:');
        if (feedback) {
          console.log('Request changes for step:', metadata?.currentStep, 'Feedback:', feedback);
          // TODO: Implement feedback submission
        }
      },
      isDisabled: ({ metadata }) => {
        const currentStepData = metadata?.steps?.find(s => s.stepNumber === metadata.currentStep);
        return !currentStepData || currentStepData.status !== 'completed';
      },
    },
  ],

  toolbar: [
    {
      description: 'Start new book creation workflow',
      icon: <BookOpen className="w-4 h-4" />,
      onClick: async () => {
        console.log('Start new book creation workflow');
        // TODO: Implement new workflow start
      },
    },
  ],

  initialize: async ({ setMetadata }) => {
    // Initialize with default book creation state
    setMetadata({
      bookId: '',
      bookTitle: 'New Book',
      bookConcept: '',
      targetAge: '3-8 years',
      currentStep: 1,
      steps: [],
      createdAt: new Date(),
      updatedAt: new Date()
    });
  },

  onStreamPart: ({ setMetadata, setArtifact, streamPart }) => {
    console.log('[BookCreationArtifact] Stream event received:', streamPart.type);
    
    // Handle book-creation-state updates (the original way)
    if ((streamPart as any).type === 'book-creation-state') {
      const workflowState = (streamPart as any).content as BookArtifactState;
      console.log('[BookCreationArtifact] 🚀 Book creation state update received:', workflowState);
      
      // Update metadata
      setMetadata(workflowState);
      
      // Update artifact content
      setArtifact(prevArtifact => ({
        ...prevArtifact,
        content: JSON.stringify(workflowState),
        isVisible: true,
        status: 'idle' as const,
      }));
      return;
    }
    
    // Legacy support for text-delta fallback
    if (streamPart.type === 'text-delta') {
      const content = streamPart.content as string;
      console.log('[BookCreationArtifact] Text-delta received:', content);
      
      // Try to parse as JSON (complete state update)
      try {
        const updateData = JSON.parse(content);
        if (updateData.bookId && updateData.steps) {
          console.log('[BookCreationArtifact] 🚀 Complete state update via text-delta:', updateData);
          
          // Update metadata
          setMetadata(updateData);
          
          // Update artifact content
          setArtifact(prevArtifact => ({
            ...prevArtifact,
            content: JSON.stringify(updateData),
            isVisible: true,
            status: 'streaming' as const,
          }));
          return;
        }
      } catch (error) {
        // Not JSON, treat as regular text delta
        console.log('[BookCreationArtifact] Text-delta is not JSON, appending as text');
        
        // Just append text content - no JSON parsing
        setArtifact(prevArtifact => ({
          ...prevArtifact,
          content: (prevArtifact?.content || '') + content
        }));
      }
    }
  },
});
