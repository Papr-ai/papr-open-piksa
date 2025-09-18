import React, { useState, useMemo, useRef, useCallback, useEffect } from 'react';
import dynamic from 'next/dynamic';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Markdown } from '@/components/common/markdown';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Editor } from '@/components/editor/text-editor';
import { Progress } from '@/components/ui/progress';
import { Textarea } from '@/components/ui/textarea';
import { 
  CheckCircle, 
  Clock, 
  AlertCircle, 
  BookOpen, 
  Users, 
  FileText, 
  MapPin, 
  Film, 
  Star,
  Edit3,
  RefreshCw,
  ChevronRight,
  ChevronLeft,
  ChevronDown,
  Eye,
  Download,
  X,
  History
} from 'lucide-react';
import type { BookArtifactState, BookCreationStep } from '@/lib/ai/tools/book-creation-constants';

// Dynamically import HTMLFlipBook to avoid SSR issues
const HTMLFlipBook = dynamic(() => import('react-pageflip').then(mod => mod.default), {
  ssr: false,
  loading: () => <div className="animate-pulse bg-gray-200 w-full h-96 rounded-lg" />
});

interface BookCreationArtifactProps {
  state: BookArtifactState;
  onApprove: (stepNumber: number, approved: boolean, feedback?: string) => void;
  onRegenerate: (stepNumber: number) => void;
  onUpdateState?: (updatedState: BookArtifactState, changedStepNumber?: number) => void;
  isReadonly?: boolean;
  isCurrentVersion?: boolean;
  onSaveContent?: (content: string, debounce: boolean) => void;
}

const STEP_ICONS = {
  1: BookOpen,
  2: Users,
  3: FileText,
  4: MapPin,
  5: Film,
  6: Star
};

const STEP_COLORS = {
  pending: 'text-gray-400 bg-gray-100',
  in_progress: 'text-blue-600 bg-blue-100',
  completed: 'text-green-600 bg-green-100',
  approved: 'text-emerald-600 bg-emerald-100',
  needs_revision: 'text-red-600 bg-red-100'
};

export function BookCreationArtifact({ 
  state, 
  onApprove, 
  onRegenerate, 
  onUpdateState,
  isReadonly = false,
  isCurrentVersion = true,
  onSaveContent
}: BookCreationArtifactProps) {
  
  console.log('[BookCreationArtifact] Component mounted with props:', {
    hasOnSaveContent: !!onSaveContent,
    bookId: state.bookId,
    currentStep: state.currentStep,
    isReadonly,
    isCurrentVersion
  });
  const [expandedStep, setExpandedStep] = useState<number>(state.currentStep);
  const [feedback, setFeedback] = useState<string>('');
  const [showFeedback, setShowFeedback] = useState<number | null>(null);
  const [showPreview, setShowPreview] = useState(false);
  // Initialize currentChapter to the first available chapter number
  const [currentChapter, setCurrentChapter] = useState<number>(1);
  const [showVersionHistory, setShowVersionHistory] = useState(false);
  const [chapterVersions, setChapterVersions] = useState<any[]>([]);
  const [loadingVersions, setLoadingVersions] = useState(false);
  
  // Refs to prevent infinite update loops and store latest state
  const isUpdatingRef = useRef(false);
  const stateRef = useRef(state);
  
  // Keep state ref updated
  stateRef.current = state;

  // Load Step 5 content from database (chapterNumber = 1+) if not already loaded
  useEffect(() => {
    const loadStep5ContentFromDatabase = async () => {
      if (!state.bookId) return;
      
      console.log('[BookCreationArtifact] DEBUG - Current state:', {
        bookId: state.bookId,
        bookTitle: state.bookTitle,
        currentStep: state.currentStep,
        steps: state.steps.map(s => ({ 
          stepNumber: s.stepNumber, 
          stepName: s.stepName, 
          status: s.status, 
          hasData: !!s.data,
          dataKeys: s.data ? Object.keys(s.data) : []
        }))
      });
      
      // Only load Step 5 content if it exists and doesn't already have chapters from database
      const step5 = state.steps.find(s => s.stepNumber === 5);
      if (!step5 || step5.status === 'pending') return;
      
      // Skip if we've already loaded database content (prevent infinite loop)
      if (step5.data?.chapters && step5.data.chapters.length > 1 && step5.data?.dbContentLoaded) {
        console.log('[BookCreationArtifact] Database content already loaded, skipping...');
        return;
      }
      
      // For migrated books, always load content even if step5 has empty chapters
      const isMigratedBook = state.bookConcept?.includes('Migrated from old book format');
      if (!isMigratedBook && step5.data?.dbContentLoaded) {
        console.log('[BookCreationArtifact] Database content processing already completed, skipping...');
        return;
      }
      
      console.log('[BookCreationArtifact] Loading database content...');
      
      // ALSO try loading workflow state from the workflow-progress API
      console.log('[BookCreationArtifact] Testing workflow-progress API...');
      let workflowData: any = null;
      try {
        const workflowResponse = await fetch(`/api/books/${state.bookId}/workflow-progress`);
        if (workflowResponse.ok) {
          workflowData = await workflowResponse.json();
          console.log('[BookCreationArtifact] Workflow progress data:', workflowData);
          if (workflowData.workflowState) {
            console.log('[BookCreationArtifact] Workflow state steps:', workflowData.workflowState.steps?.map((s: any) => ({
              stepNumber: s.stepNumber,
              stepName: s.stepName,
              status: s.status,
              hasData: !!s.data
            })));
            
            // Update Steps 1-4 with proper status messaging
            if (onUpdateState) {
              const updatedState = { ...state };
              let stateChanged = false;
              
              // Update Steps 1-4 to show they're approved but have no data
              for (let stepNum = 1; stepNum <= 4; stepNum++) {
                const workflowStep = workflowData.workflowState.steps?.find((s: any) => s.stepNumber === stepNum);
                const stepIndex = updatedState.steps.findIndex(s => s.stepNumber === stepNum);
                
                if (stepIndex !== -1 && workflowStep && !workflowStep.data) {
                  updatedState.steps[stepIndex] = {
                    ...updatedState.steps[stepIndex],
                    status: workflowStep.status,
                    data: {
                      message: `This step was marked as "${workflowStep.status}" but contains no content data.`,
                      stepName: workflowStep.stepName,
                      isEmpty: true
                    }
                  };
                  stateChanged = true;
                }
              }
              
              if (stateChanged) {
                console.log('[BookCreationArtifact] Updated Steps 1-4 with status messaging');
                onUpdateState(updatedState);
              }
            }
          }
        }
      } catch (error) {
        console.error('[BookCreationArtifact] Error loading workflow progress:', error);
      }
      
      console.log('[BookCreationArtifact] Loading Step 5 content from database...');
      
      try {
        // Load ALL chapters from the database for debugging
        const response = await fetch(`/api/books?bookId=${encodeURIComponent(state.bookId)}`);
        if (response.ok) {
          const chapters = await response.json();
          console.log('[BookCreationArtifact] DEBUG - All chapters from database:', chapters);
          
          // Check for workflow data in Chapter 0
          const workflowChapter = chapters.find((ch: any) => ch.chapterNumber === 0);
          console.log('[BookCreationArtifact] DEBUG - Chapter 0 (workflow):', workflowChapter ? {
            chapterNumber: workflowChapter.chapterNumber,
            chapterTitle: workflowChapter.chapterTitle,
            contentLength: workflowChapter.content?.length,
            contentPreview: workflowChapter.content?.substring(0, 200) + '...'
          } : 'NOT FOUND');
          
          // Process Chapter 0 to extract workflow state for Steps 1-4
          if (workflowChapter && workflowChapter.content && onUpdateState) {
            try {
              console.log('[BookCreationArtifact] Processing Chapter 0 content for Steps 1-4...');
              
              // Parse the workflow state from Chapter 0 content
              let workflowStateFromDb: any = null;
              if (workflowChapter.content.includes('Workflow Data: ')) {
                const jsonStart = workflowChapter.content.indexOf('Workflow Data: ') + 'Workflow Data: '.length;
                const jsonContent = workflowChapter.content.substring(jsonStart);
                workflowStateFromDb = JSON.parse(jsonContent);
                console.log('[BookCreationArtifact] Parsed workflow state from Chapter 0:', workflowStateFromDb);
              } else {
                // Try parsing the entire content as JSON
                workflowStateFromDb = JSON.parse(workflowChapter.content);
                console.log('[BookCreationArtifact] Parsed entire Chapter 0 content as JSON:', workflowStateFromDb);
              }
              
              if (workflowStateFromDb && workflowStateFromDb.steps) {
                console.log('[BookCreationArtifact] Updating Steps 1-4 with Chapter 0 data...');
                console.log('[BookCreationArtifact] Full workflowStateFromDb.steps:', workflowStateFromDb.steps);
                
                const updatedState = { ...state };
                let stateChanged = false;
                
                // Update Steps 1-4 with data from Chapter 0
                for (let stepNum = 1; stepNum <= 4; stepNum++) {
                  const dbStep = workflowStateFromDb.steps.find((s: any) => s.stepNumber === stepNum);
                  const stepIndex = updatedState.steps.findIndex(s => s.stepNumber === stepNum);
                  
                  if (stepIndex !== -1 && dbStep) {
                    console.log(`[BookCreationArtifact] Updating Step ${stepNum} with:`, {
                      stepNumber: dbStep.stepNumber,
                      stepName: dbStep.stepName,
                      status: dbStep.status,
                      hasData: !!dbStep.data,
                      dataKeys: dbStep.data ? Object.keys(dbStep.data) : [],
                      dataPreview: dbStep.data ? JSON.stringify(dbStep.data).substring(0, 200) : 'NO DATA'
                    });
                    
                    updatedState.steps[stepIndex] = {
                      ...updatedState.steps[stepIndex],
                      status: dbStep.status || 'completed',
                      data: dbStep.data || updatedState.steps[stepIndex].data
                    };
                    stateChanged = true;
                  }
                }
                
                if (stateChanged) {
                  console.log('[BookCreationArtifact] Calling onUpdateState with updated Steps 1-4');
                  onUpdateState(updatedState);
                }
              }
            } catch (error) {
              console.error('[BookCreationArtifact] Error parsing Chapter 0 workflow state:', error);
            }
          }
          
          const contentChapters = chapters.filter((ch: any) => ch.chapterNumber > 0);
          console.log('[BookCreationArtifact] DEBUG - Content chapters (1+):', contentChapters.map((ch: any) => ({
            chapterNumber: ch.chapterNumber,
            chapterTitle: ch.chapterTitle,
            contentLength: ch.content?.length
          })));
          
          if (contentChapters.length > 0) {
            console.log('[BookCreationArtifact] Found chapters in database:', contentChapters.map((ch: any) => ({ 
              chapterNumber: ch.chapterNumber, 
              title: ch.chapterTitle,
              contentLength: ch.content?.length 
            })));
            
            // Merge database chapters with workflow state chapters
            const workflowStep5 = workflowData?.workflowState?.steps?.find((s: any) => s.stepNumber === 5);
            const workflowChapters = workflowStep5?.data?.chapters || [];
            
            console.log('[BookCreationArtifact] Workflow Step 5 chapters:', workflowChapters.map((ch: any) => ({
              chapterNumber: ch.chapterNumber,
              title: ch.title,
              scenesCount: ch.scenes?.length
            })));
            
            // Create combined chapters array
            const combinedChapters = [];
            
            // Add database chapters (Chapter 1)
            for (const dbChapter of contentChapters) {
              combinedChapters.push({
                chapterNumber: dbChapter.chapterNumber,
                title: dbChapter.chapterTitle,
                scenes: [{
                  sceneNumber: 1,
                  title: `${dbChapter.chapterTitle} Content`,
                  text: dbChapter.content,
                  characters: [],
                  illustrationNotes: ''
                }]
              });
            }
            
            // Add workflow chapters (Chapter 2+) that aren't already in database
            for (const workflowChapter of workflowChapters) {
              const existsInDb = combinedChapters.some(ch => ch.chapterNumber === workflowChapter.chapterNumber);
              if (!existsInDb) {
                combinedChapters.push(workflowChapter);
              }
            }
            
            console.log('[BookCreationArtifact] Combined chapters for Step 5:', combinedChapters.map((ch: any) => ({
              chapterNumber: ch.chapterNumber,
              title: ch.title,
              source: contentChapters.some((dbChapter: any) => dbChapter.chapterNumber === ch.chapterNumber) ? 'database' : 'workflow'
            })));
            
            // Get Step 3 data for chapter titles
            const step3 = state.steps.find(s => s.stepNumber === 3);
            
            // Use the combined chapters instead of just database chapters
            const loadedChapters = combinedChapters.map((chapter: any) => {
              // For database chapters, try to get original title from Step 3
              if (contentChapters.some((dbChapter: any) => dbChapter.chapterNumber === chapter.chapterNumber)) {
                const step3Chapter = step3?.data?.chapters?.find((ch: any) => ch.chapterNumber === chapter.chapterNumber);
                const originalChapterTitle = step3Chapter?.title || chapter.title || `Chapter ${chapter.chapterNumber}`;
                
                return {
                  ...chapter,
                  title: originalChapterTitle
                };
              }
              
              // For workflow chapters, use as-is
              return chapter;
            });
            
            // Update Step 5 with all loaded chapters
            if (onUpdateState) {
              const updatedState = { ...state };
              const stepIndex = updatedState.steps.findIndex(s => s.stepNumber === 5);
              
              console.log('[BookCreationArtifact] About to update Step 5:', {
                stepIndex,
                loadedChaptersCount: loadedChapters.length,
                loadedChapters: loadedChapters.map((ch: any) => ({ chapterNumber: ch.chapterNumber, title: ch.title }))
              });
              
              if (stepIndex !== -1) {
                updatedState.steps[stepIndex].data = {
                  ...updatedState.steps[stepIndex].data,
                  chapters: loadedChapters,
                  dbContentLoaded: true  // Flag to prevent re-processing
                };
                updatedState.updatedAt = new Date();
                console.log('[BookCreationArtifact] Calling onUpdateState for Step 5 with chapters:', loadedChapters.length);
                onUpdateState(updatedState);
              } else {
                console.error('[BookCreationArtifact] Step 5 not found in state!');
              }
            } else {
              console.error('[BookCreationArtifact] onUpdateState not available!');
            }
          }
        }
      } catch (error) {
        console.error('[BookCreationArtifact] Error loading Step 5 content from database:', error);
      }
    };
    
    loadStep5ContentFromDatabase();
  }, [state.bookId, onUpdateState]);

  // Initialize currentChapter when Step 5 data first loads (only once)
  useEffect(() => {
    const step5 = state.steps.find(s => s.stepNumber === 5);
    if (step5?.data?.chapters && step5.data.chapters.length > 0) {
      const firstChapter = step5.data.chapters[0];
      // Only set if currentChapter is still the default (1) and we have a different first chapter
      if (firstChapter?.chapterNumber && currentChapter === 1 && firstChapter.chapterNumber !== 1) {
        console.log('[BookCreationArtifact] Initializing currentChapter to first available:', firstChapter.chapterNumber);
        setCurrentChapter(firstChapter.chapterNumber);
      }
    }
  }, [state.steps]);

  // Build book pages from workflow data
  const buildPhysicalPages = (state: BookArtifactState) => {
    if (!state.steps) return [];
    
    const storyStep = state.steps.find(s => s.stepNumber === 3);
    const finalStep = state.steps.find(s => s.stepNumber === 5);
    
    // Check if we have content from Step 5 - support both new chapters format and legacy scenes
    const hasChapters = finalStep?.data?.chapters && finalStep.data.chapters.length > 0;
    const hasLegacyScenes = finalStep?.data?.scenes && finalStep.data.scenes.length > 0;
    
    if (!hasChapters && !hasLegacyScenes) return [];
    
    const pages = [];
    
          // For non-picture books with chapters, create text-based pages
          if (hasChapters) {
            // Get characters and environments for cover design
            const charactersStep = state.steps.find(s => s.stepNumber === 2);
            const environmentsStep = state.steps.find(s => s.stepNumber === 4);
            const storyStep = state.steps.find(s => s.stepNumber === 1);
            
            // Add cover page with better design
            pages.push({
              kind: 'cover',
              data: {
                title: state.bookTitle,
                subtitle: state.bookConcept,
                characters: charactersStep?.data?.characters?.slice(0, 3) || [], // Main characters for cover
                genre: storyStep?.data?.genre,
                targetAudience: storyStep?.data?.targetAudience,
                // Use first character image if available, checking multiple possible field names
                image: (() => {
                  const firstCharacter = charactersStep?.data?.characters?.[0];
                  if (!firstCharacter) return '/api/placeholder/400/500';
                  
                  console.log('[BookPreview] First character data:', firstCharacter);
                  
                  // Check all possible image field names (same logic as character rendering)
                  return firstCharacter.portraitUrl || 
                         firstCharacter.imageUrl || 
                         firstCharacter.existingPortraitUrl || 
                         firstCharacter.image ||
                         // Extract image URL from physicalDescription if it contains a URL
                         (firstCharacter.physicalDescription?.match(/https:\/\/[^\s)]+/)?.[0]) ||
                         '/api/placeholder/400/500';
                })()
              }
            });
      
      // Track overall page numbering (excluding cover page)
      let globalPageNumber = 1;
      
      // Add each chapter as full text pages
      finalStep.data.chapters.forEach((chapter: any, chapterIndex: number) => {
        // Chapter title page
        pages.push({
          kind: 'chapter-title',
          data: {
            chapterNumber: chapter.chapterNumber,
            title: chapter.title,
            summary: chapter.summary,
            pageNumber: globalPageNumber
          }
        });
        globalPageNumber++;
        
        // Combine all scene text, removing scene headers and metadata
        const cleanSceneTexts = chapter.scenes?.map((scene: any) => {
          if (!scene.text) return '';
          
          // Remove scene headers, metadata, and formatting artifacts
          let cleanText = scene.text
            .replace(/^#{1,6}\s*Scene\s+\d+[^\n]*\n*/gim, '') // Remove scene headers like "## Scene 1"
            .replace(/^#{1,6}\s*[^\n]*\n*/gim, '') // Remove other markdown headers
            .replace(/^\s*---\s*$/gm, '') // Remove horizontal rules
            .replace(/^\s*\*\*[^*]+\*\*\s*$/gm, '') // Remove standalone bold text (like scene titles)
            .replace(/^Illustration Notes?:.*$/gim, '') // Remove illustration notes
            .replace(/^\*Illustration Notes?:.*\*$/gim, '') // Remove italic illustration notes
            .replace(/^Characters?:.*$/gim, '') // Remove character lines
            .replace(/^\*Characters?:.*\*$/gim, '') // Remove italic character lines
            .replace(/\n{3,}/g, '\n\n') // Normalize multiple line breaks to double
            .trim();
          
          return cleanText;
        }).filter((text: string) => text.length > 0) || [];
        
        // Combine all scenes into flowing chapter text
        const fullChapterText = cleanSceneTexts.join('\n\n');
        
        if (fullChapterText.trim()) {
          // ProseMirror-optimized page size - allows for better content fitting
          const maxCharsPerPage = 1200; // Optimized for ProseMirror editor height
          const sentences = fullChapterText.split(/(?<=[.!?])\s+/); // Split by sentences for better breaks
          let currentPageContent = '';
          
          for (let i = 0; i < sentences.length; i++) {
            const sentence = sentences[i];
            const potentialContent = currentPageContent + (currentPageContent ? ' ' : '') + sentence;
            
            // Check if adding this sentence would exceed the page limit
            if (potentialContent.length > maxCharsPerPage && currentPageContent.length > 200) { // Minimum 200 chars per page
              // Save current page
              pages.push({
                kind: 'chapter-content',
                data: {
                  chapterNumber: chapter.chapterNumber,
                  title: chapter.title,
                  text: currentPageContent.trim(),
                  pageNumber: globalPageNumber
                }
              });
              globalPageNumber++;
              
              // Start new page with current sentence
              currentPageContent = sentence;
            } else {
              // Add sentence to current page
              currentPageContent = potentialContent;
            }
          }
          
          // Add the final page if there's remaining content
          if (currentPageContent.trim()) {
            pages.push({
              kind: 'chapter-content',
              data: {
                chapterNumber: chapter.chapterNumber,
                title: chapter.title,
                text: currentPageContent.trim(),
                pageNumber: globalPageNumber
              }
            });
            globalPageNumber++;
          }
        }
      });
      
      // Add back cover with summary
      pages.push({
        kind: 'back-cover',
        data: {
          title: state.bookTitle,
          summary: storyStep?.data?.premise || state.bookConcept,
          characters: charactersStep?.data?.characters || [],
          totalChapters: finalStep.data.chapters.length,
          genre: storyStep?.data?.genre,
          targetAudience: storyStep?.data?.targetAudience
        }
      });
      
      console.log('[BookPreview] Generated pages for text-only book:', pages.length, pages.map(p => ({ 
        kind: p.kind, 
        chapterNumber: (p.data as any).chapterNumber || 'N/A', 
        textLength: (p.data as any).text?.length || 0 
      })));
      return pages;
    }
    
    // Legacy picture book format
    const scenes = finalStep.data.scenes;
    
    // Add cover page
    pages.push({
      kind: 'cover',
      data: {
        title: state.bookTitle,
        subtitle: state.bookConcept,
        image: scenes[0]?.imageUrl || '/api/placeholder/400/500'
      }
    });
    
    // If we have spreads from Step 3, use them; otherwise create pages from scenes
    if (storyStep?.data?.spreads && Array.isArray(storyStep.data.spreads)) {
      // Use existing spreads structure
      storyStep.data.spreads.forEach((spread: any, index: number) => {
        const scene = scenes.find((s: any) => s.spread === spread.spread || s.name?.includes(spread.title));
        
        pages.push({
          kind: 'text',
          data: {
            page: spread.spread + 1,
            title: spread.title,
            text: Array.isArray(spread.text) ? spread.text.join('\n\n') : spread.text,
            image: scene?.imageUrl || '/api/placeholder/400/300'
          }
        });
        
        pages.push({
          kind: 'image',
          data: {
            page: spread.spread + 1,
            title: spread.title,
            text: Array.isArray(spread.text) ? spread.text.join('\n\n') : spread.text,
            image: scene?.imageUrl || '/api/placeholder/400/300'
          }
        });
      });
    } else {
      // Create pages directly from scenes, but try to get story text from Step 3
      const chapterScenes = storyStep?.data?.chapters?.[0]?.scenes || [];
      
      console.log('🔍 Chapter scenes from Step 3:', chapterScenes);
      console.log('🔍 Scene images from Step 5:', scenes);
      
      scenes.forEach((scene: any, index: number) => {
        // Try multiple matching strategies to find the corresponding story content
        let storyScene = null;
        
        // Strategy 1: Match by scene number (index + 1)
        storyScene = chapterScenes.find((s: any) => s.sceneNumber === (index + 1));
        
        // Strategy 2: Match by similar title/name
        if (!storyScene) {
          storyScene = chapterScenes.find((s: any) => 
            s.title && scene.name && 
            (s.title.toLowerCase().includes(scene.name.toLowerCase()) || 
             scene.name.toLowerCase().includes(s.title.toLowerCase()))
          );
        }
        
        // Strategy 3: Just use the scene at the same index
        if (!storyScene && chapterScenes[index]) {
          storyScene = chapterScenes[index];
        }
        
        // PRIORITY 1: Use actual story text from Step 3 chapter content (if available)
        let storyText = storyScene?.text;
        
        // FALLBACK: Only generate story text if no chapter content exists
        if (!storyText) {
          // Create a simple narrative based on the scene name and context
          const sceneName = scene.name || `Scene ${index + 1}`;
          
          // Create age-appropriate story text based on scene names
          if (sceneName.includes('Window')) {
            storyText = "Aya looked out her bedroom window as the stars began to twinkle. Something magical was happening in the alley below.";
          } else if (sceneName.includes('Thread')) {
            storyText = "A shimmering silver thread caught Aya's eye. It seemed to glow with its own special light, calling to her.";
          } else if (sceneName.includes('Following')) {
            storyText = "Quietly, Aya slipped on her slippers and followed the magical thread down the moonlit alley.";
          } else if (sceneName.includes('Meeting') || sceneName.includes('Spidey')) {
            storyText = "On the rooftop, Aya met a tiny, friendly spider who could weave threads of starlight. 'Hello,' whispered Aya.";
          } else if (sceneName.includes('Puzzle') || sceneName.includes('Alley')) {
            storyText = "Together, Aya and Spidey discovered a little firefly trapped behind a fence. They had to work as a team to help.";
          } else if (sceneName.includes('Firefly') || sceneName.includes('Helping')) {
            storyText = "With gentle hands, Aya helped free the tiny firefly. It glowed with gratitude and danced around them both.";
          } else if (sceneName.includes('Surprise')) {
            storyText = "Suddenly, strange shadows appeared on the rooftop. Aya felt scared, but Spidey was right there beside her.";
          } else if (sceneName.includes('Steps') || sceneName.includes('Brave')) {
            storyText = "Aya had to be brave and climb up using the laundry line. With Spidey's encouragement, she found her courage.";
          } else if (sceneName.includes('Glow') || sceneName.includes('Garden')) {
            storyText = "In the secret garden, magical lights danced everywhere. Aya, Spidey, and the firefly celebrated their friendship.";
          } else if (sceneName.includes('Home') || sceneName.includes('Time')) {
            storyText = "It was time to go home. Spidey's magical thread guided Aya safely back through the quiet streets.";
          } else if (sceneName.includes('Back') || sceneName.includes('Bed')) {
            storyText = "Back in her cozy room, Aya tucked a tiny glowing thread into a jar. She would always remember this magical night.";
          } else if (sceneName.includes('Activity') || sceneName.includes('Endpaper')) {
            storyText = "The end. Now you can draw your own magical night adventure and connect the dots to make Spidey's special thread!";
          } else {
            storyText = `In this part of the story, ${sceneName.toLowerCase()}.`;
          }
        }
        
        console.log(`📖 Scene ${index + 1}: "${scene.name}" - Using ${storyScene?.text ? 'REAL CHAPTER CONTENT' : 'GENERATED FALLBACK'} story text:`, storyText?.substring(0, 50) + '...');
        
        pages.push({
          kind: 'text',
          data: {
            page: index + 1,
            title: scene.name || storyScene?.title || `Scene ${index + 1}`,
            text: storyText,
            image: scene.imageUrl || '/api/placeholder/400/300'
          }
        });
        
        pages.push({
          kind: 'image',
          data: {
            page: index + 1,
            title: scene.name || storyScene?.title || `Scene ${index + 1}`,
            text: storyText,
            image: scene.imageUrl || '/api/placeholder/400/300'
          }
        });
      });
    }
    
    return pages;
  };

  const bookPages = useMemo(() => buildPhysicalPages(state), [
    state.steps, 
    state.bookTitle, 
    state.bookConcept
  ]);

  // Memoized callback to prevent infinite re-renders
  const handleStepContentUpdate = useCallback((stepNumber: number, updatedContent: string) => {
    if (isUpdatingRef.current || !onUpdateState) return;
    
    isUpdatingRef.current = true;
    
    try {
      // Use state ref to access latest state without dependency
      const currentState = stateRef.current;
      const updatedState = { ...currentState };
      const stepIndex = updatedState.steps.findIndex(s => s.stepNumber === stepNumber);
      
      if (stepIndex !== -1) {
        updatedState.steps[stepIndex].data = {
          ...updatedState.steps[stepIndex].data,
          content: updatedContent
        };
        updatedState.updatedAt = new Date();
        onUpdateState(updatedState);
      }
    } finally {
      // Reset the flag after a short delay to allow the update to propagate
      setTimeout(() => {
        isUpdatingRef.current = false;
      }, 100);
    }
  }, [onUpdateState]); // Stable dependencies only

  // Handler for updating individual scene content in Step 5
  const handleSceneContentUpdate = useCallback((stepNumber: number, chapterIndex: number, sceneIndex: number, updatedContent: string) => {
    if (isUpdatingRef.current) return;
    
    // If we have the book artifact save handler, use it for proper versioning
    if (onSaveContent) {
      // Convert the scene update to a full chapter content string for the book artifact
      const currentState = stateRef.current;
      const step = currentState.steps.find(s => s.stepNumber === stepNumber);
      if (step?.data?.chapters) {
        const chapters = [...step.data.chapters];
        if (chapters[chapterIndex] && chapters[chapterIndex].scenes && chapters[chapterIndex].scenes[sceneIndex]) {
          chapters[chapterIndex].scenes[sceneIndex].text = updatedContent;
          
          // Convert chapter to markdown content for book artifact saving
          const chapter = chapters[chapterIndex];
          const chapterContent = `# ${chapter.title}\n\n` + 
            chapter.scenes.map((scene: any, idx: number) => 
              `## Scene ${idx + 1}${scene.title ? `: ${scene.title}` : ''}\n\n${scene.text || ''}`
            ).join('\n\n---\n\n');
          
          console.log(`[BookCreation] Saving chapter ${chapterIndex + 1} content via book artifact handler`);
          onSaveContent(chapterContent, true); // Use debouncing
        }
      }
    }
    
    // Also update the internal state
    if (!onUpdateState) return;
    
    isUpdatingRef.current = true;
    
    try {
      // Use state ref to access latest state without dependency
      const currentState = stateRef.current;
      const updatedState = { ...currentState };
      const stepIndex = updatedState.steps.findIndex(s => s.stepNumber === stepNumber);
      
      if (stepIndex !== -1 && updatedState.steps[stepIndex].data?.chapters) {
        // Deep copy the chapters array
        const chapters = JSON.parse(JSON.stringify(updatedState.steps[stepIndex].data.chapters));
        
        // Update the specific scene text
        if (chapters[chapterIndex] && chapters[chapterIndex].scenes && chapters[chapterIndex].scenes[sceneIndex]) {
          chapters[chapterIndex].scenes[sceneIndex].text = updatedContent;
          
          // Update the step data
          updatedState.steps[stepIndex].data = {
            ...updatedState.steps[stepIndex].data,
            chapters
          };
          updatedState.updatedAt = new Date();
          onUpdateState(updatedState);
        }
      }
    } finally {
      // Reset the flag after a short delay to allow the update to propagate
      setTimeout(() => {
        isUpdatingRef.current = false;
      }, 100);
    }
  }, [onUpdateState, onSaveContent]); // Stable dependencies only

  // Handler for Step 5 chapter saving to database
  const handleStep5ChapterSave = useCallback(async (
    bookId: string, 
    chapterNumber: number, 
    chapterTitle: string, 
    content: string, 
    debounce: boolean = true
  ) => {
    if (!bookId) {
      console.error('[Step5] No bookId available for saving');
      return;
    }

    console.log(`[Step5] Saving chapter ${chapterNumber} to database:`, {
      bookId,
      chapterNumber,
      chapterTitle,
      contentLength: content.length,
      debounce
    });

    try {
      // Save to the Books table using the book API
      const response = await fetch('/api/book/save', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          bookId,
          content,
          currentChapter: chapterNumber,
        }),
      });

      if (!response.ok) {
        const errorData = await response.text();
        console.error('[Step5] Failed to save chapter:', errorData);
        
        // If the book chapter doesn't exist, create it first
        if (errorData.includes('BOOK_NOT_FOUND')) {
          console.log('[Step5] Chapter not found, creating new chapter...');
          
          const createResponse = await fetch('/api/book/chapters', {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
            },
            body: JSON.stringify({
              bookId,
              chapterNumber,
              chapterTitle,
              content,
            }),
          });
          
          if (!createResponse.ok) {
            console.error('[Step5] Failed to create chapter:', await createResponse.text());
            return;
          }
          
          const createResult = await createResponse.json();
          console.log('[Step5] Chapter created successfully:', createResult);
          
          // Now try to save again
          const retryResponse = await fetch('/api/book/save', {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
            },
            body: JSON.stringify({
              bookId,
              content,
              currentChapter: chapterNumber,
            }),
          });
          
          if (retryResponse.ok) {
            const retryResult = await retryResponse.json();
            console.log('[Step5] Chapter saved successfully after creation:', retryResult);
          } else {
            console.error('[Step5] Failed to save chapter after creation:', await retryResponse.text());
          }
        }
        return;
      }

      const result = await response.json();
      console.log('[Step5] Chapter saved successfully:', result);
      
      // Trigger book preview update by updating the state timestamp
      if (onUpdateState) {
        const currentState = stateRef.current;
        onUpdateState({
          ...currentState,
          updatedAt: new Date()
        });
      }
      
    } catch (error) {
      console.error('[Step5] Error saving chapter:', error);
    }
  }, [onUpdateState]);

  // Fetch version history for a chapter
  const fetchChapterVersions = useCallback(async (bookId: string, chapterNumber: number) => {
    if (!bookId) return;

    setLoadingVersions(true);
    try {
      const response = await fetch(`/api/books/${bookId}?versions=true&chapter=${chapterNumber}`);
      if (response.ok) {
        const versions = await response.json();
        setChapterVersions(versions);
        setShowVersionHistory(true);
      } else {
        console.error('Failed to fetch chapter versions:', response.statusText);
      }
    } catch (error) {
      console.error('Error fetching chapter versions:', error);
    } finally {
      setLoadingVersions(false);
    }
  }, []);

  // Restore a specific version
  const restoreVersion = useCallback(async (versionId: string, content: string) => {
    if (!state.bookId || !currentChapter) return;

    try {
      // Save the restored content as a new version
      await handleStep5ChapterSave(
        state.bookId,
        currentChapter,
        `Chapter ${currentChapter}`,
        content,
        false // Don't debounce for version restore
      );

      // Refresh the version history
      await fetchChapterVersions(state.bookId, currentChapter);
      
      // Update the UI state to show the restored content
      if (onUpdateState) {
        const currentState = stateRef.current;
        const updatedState = { ...currentState };
        const stepIndex = updatedState.steps.findIndex(s => s.stepNumber === 5);
        
        if (stepIndex !== -1 && updatedState.steps[stepIndex].data?.chapters) {
          const chapters = [...updatedState.steps[stepIndex].data.chapters];
          const chapterIndex = chapters.findIndex(ch => (ch.chapterNumber || chapters.indexOf(ch) + 1) === currentChapter);
          
          if (chapterIndex !== -1) {
            chapters[chapterIndex].scenes = [{
              sceneNumber: 1,
              title: `Chapter ${currentChapter} Content`,
              text: content,
              characters: chapters[chapterIndex].scenes?.[0]?.characters || [],
              illustrationNotes: chapters[chapterIndex].scenes?.[0]?.illustrationNotes || ''
            }];
            
            updatedState.steps[stepIndex].data = {
              ...updatedState.steps[stepIndex].data,
              chapters
            };
            updatedState.updatedAt = new Date();
            onUpdateState(updatedState);
          }
        }
      }

      setShowVersionHistory(false);
    } catch (error) {
      console.error('Error restoring version:', error);
    }
  }, [state.bookId, currentChapter, handleStep5ChapterSave, fetchChapterVersions, onUpdateState]);

  // The workflow already creates a bookId (saved as chapterNumber = 0)
  // We should use that existing bookId for chapters 1, 2, etc.
  const ensureBookIdExists = useCallback((): string | null => {
    if (state.bookId) {
      console.log('[Step5] Using existing workflow bookId:', state.bookId);
      return state.bookId;
    }
    
    console.error('[Step5] No bookId found in workflow state. This should not happen as workflow should have created one.');
    return null;
  }, [state.bookId]);

  const getStepStatus = (step: BookCreationStep) => {
    if (step.stepNumber < state.currentStep) return 'approved';
    if (step.stepNumber === state.currentStep) return step.status;
    return 'pending';
  };

  const getStepIcon = (stepNumber: number, status: string) => {
    const IconComponent = STEP_ICONS[stepNumber as keyof typeof STEP_ICONS];
    if (status === 'approved') return <CheckCircle className="w-5 h-5" />;
    if (status === 'in_progress') return <Clock className="w-5 h-5" />;
    if (status === 'needs_revision') return <AlertCircle className="w-5 h-5" />;
    return <IconComponent className="w-5 h-5" />;
  };

  const progressPercentage = ((state.steps.filter(s => getStepStatus(s) === 'approved').length) / state.steps.length) * 100;

  const handleApprove = (stepNumber: number, approved: boolean) => {
    if (showFeedback === stepNumber && !approved && feedback.trim()) {
      // Request changes with feedback
      const updatedState = { ...state };
      const stepIndex = updatedState.steps.findIndex(s => s.stepNumber === stepNumber);
      if (stepIndex !== -1) {
        updatedState.steps[stepIndex].status = 'needs_revision';
        updatedState.updatedAt = new Date();
      }
      
      onUpdateState?.(updatedState);
      onApprove(stepNumber, approved, feedback);
      setFeedback('');
      setShowFeedback(null);
    } else if (!approved) {
      // Show feedback input for request changes
      setShowFeedback(stepNumber);
    } else {
      // Approve and continue
      const updatedState = { ...state };
      const stepIndex = updatedState.steps.findIndex(s => s.stepNumber === stepNumber);
      
      if (stepIndex !== -1) {
        // Mark current step as approved
        updatedState.steps[stepIndex].status = 'approved';
        
        // Move to next step if not at the end
        if (stepNumber < 6) {
          updatedState.currentStep = stepNumber + 1;
          
          // Initialize next step if it doesn't exist
          const nextStepIndex = updatedState.steps.findIndex(s => s.stepNumber === stepNumber + 1);
          if (nextStepIndex === -1) {
            updatedState.steps.push({
              stepNumber: stepNumber + 1,
              stepName: getStepName(stepNumber + 1),
              status: 'pending'
            });
          } else {
            updatedState.steps[nextStepIndex].status = 'in_progress';
          }
          
          // Auto-expand next step
          setExpandedStep(stepNumber + 1);
        }
        
        updatedState.updatedAt = new Date();
      }
      
      onUpdateState?.(updatedState);
      onApprove(stepNumber, approved);
    }
  };

  const getStepName = (stepNumber: number): string => {
    const stepNames = {
      1: 'Story Planning',
      2: 'Character Creation', 
      3: 'Chapter Writing',
      4: 'Environment Design',
      5: 'Final Chapter Content', // Complete chapters with expanded scenes
      6: 'Final Review'
    };
    return stepNames[stepNumber as keyof typeof stepNames] || `Step ${stepNumber}`;
  };

  const renderStepContent = (step: BookCreationStep) => {
    if (!step.data) {
      return (
        <div className="text-center py-8 text-gray-500">
          <Clock className="w-8 h-8 mx-auto mb-2" />
          <p>Waiting for AI agent to generate content...</p>
        </div>
      );
    }

    // Render different content based on step type
    switch (step.stepNumber) {
      case 1: // Story Planning
        // Check if step is empty/incomplete
        if (step.data?.isEmpty) {
          return (
            <div className="space-y-4">
              <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4">
                <div className="flex items-center gap-2 mb-2">
                  <AlertCircle size={16} className="text-yellow-600" />
                  <span className="font-medium text-yellow-800">Step Incomplete</span>
                </div>
                <p className="text-yellow-700 text-sm mb-3">{step.data.message}</p>
                <p className="text-yellow-600 text-xs">
                  This step needs to be completed with actual content data to display properly.
                </p>
              </div>
            </div>
          );
        }
        
        return (
          <div className="space-y-4">
            {step.data.content && (
              <div>
                <h4 className="font-medium mb-4">Story Content</h4>
                <div className="border rounded-lg p-4 bg-white">
                  <Editor
                    content={step.data.content}
                    onSaveContent={(updatedContent, debounce) => {
                      // Update the step content in real-time using memoized callback
                      console.log('Story content changed:', updatedContent);
                      handleStepContentUpdate(step.stepNumber, updatedContent);
                    }}
                    status="idle"
                    isCurrentVersion={true}
                    currentVersionIndex={0}
                    suggestions={[]}
                    storyContext={`Book: ${state.bookTitle}`}
                  />
                </div>
              </div>
            )}
            <div>
              <h4 className="font-medium mb-2">Story Concept</h4>
              <Textarea
                value={step.data.premise || ''}
                onChange={(e) => {
                  // Update premise in real-time
                  console.log('Premise changed:', e.target.value);
                  
                  if (onUpdateState) {
                    const updatedState = { ...state };
                    const stepIndex = updatedState.steps.findIndex(s => s.stepNumber === step.stepNumber);
                    
                    if (stepIndex !== -1) {
                      updatedState.steps[stepIndex].data = {
                        ...updatedState.steps[stepIndex].data,
                        premise: e.target.value
                      };
                      updatedState.updatedAt = new Date();
                      onUpdateState(updatedState);
                    }
                  }
                }}
                className="text-sm resize-none"
                rows={3}
                placeholder="Describe the main story concept and premise..."
                disabled={isReadonly}
              />
            </div>
            <div>
              <h4 className="font-medium mb-2">Themes</h4>
              <div className="space-y-2">
                <div className="flex flex-wrap gap-1">
                  {step.data.themes?.map((theme: string, index: number) => (
                    <Badge key={index} variant="outline" className="cursor-pointer">
                      {theme}
                      {!isReadonly && (
                        <button
                          onClick={() => {
                            // Remove theme
                            console.log('Remove theme:', theme);
                            
                            if (onUpdateState) {
                              const updatedState = { ...state };
                              const stepIndex = updatedState.steps.findIndex(s => s.stepNumber === step.stepNumber);
                              
                              if (stepIndex !== -1) {
                                const currentThemes = updatedState.steps[stepIndex].data?.themes || [];
                                updatedState.steps[stepIndex].data = {
                                  ...updatedState.steps[stepIndex].data,
                                  themes: currentThemes.filter((t: string) => t !== theme)
                                };
                                updatedState.updatedAt = new Date();
                                onUpdateState(updatedState);
                              }
                            }
                          }}
                          className="ml-1 text-xs hover:text-red-500"
                        >
                          ×
                        </button>
                      )}
                    </Badge>
                  ))}
                </div>
                {!isReadonly && (
                  <input
                    type="text"
                    placeholder="Add a theme and press Enter..."
                    className="text-sm border rounded px-2 py-1 w-full"
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') {
                        const value = (e.target as HTMLInputElement).value.trim();
                        if (value) {
                          // Add new theme
                          console.log('Add theme:', value);
                          
                          if (onUpdateState) {
                            const updatedState = { ...state };
                            const stepIndex = updatedState.steps.findIndex(s => s.stepNumber === step.stepNumber);
                            
                            if (stepIndex !== -1) {
                              const currentThemes = updatedState.steps[stepIndex].data?.themes || [];
                              if (!currentThemes.includes(value)) {
                                updatedState.steps[stepIndex].data = {
                                  ...updatedState.steps[stepIndex].data,
                                  themes: [...currentThemes, value]
                                };
                                updatedState.updatedAt = new Date();
                                onUpdateState(updatedState);
                              }
                            }
                          }
                          
                          (e.target as HTMLInputElement).value = '';
                        }
                      }
                    }}
                  />
                )}
              </div>
            </div>
            <div>
              <h4 className="font-medium mb-2">Style Bible</h4>
              <Textarea
                value={step.data.styleBible || ''}
                onChange={(e) => {
                  // Update style bible in real-time
                  console.log('Style bible changed:', e.target.value);
                  
                  if (onUpdateState) {
                    const updatedState = { ...state };
                    const stepIndex = updatedState.steps.findIndex(s => s.stepNumber === step.stepNumber);
                    
                    if (stepIndex !== -1) {
                      updatedState.steps[stepIndex].data = {
                        ...updatedState.steps[stepIndex].data,
                        styleBible: e.target.value
                      };
                      updatedState.updatedAt = new Date();
                      onUpdateState(updatedState);
                    }
                  }
                }}
                className="text-sm resize-none"
                rows={2}
                placeholder="Describe the visual style, tone, and artistic direction..."
                disabled={isReadonly}
              />
            </div>
          </div>
        );

      case 2: // Character Creation
        // Check if step is empty/incomplete
        if (step.data?.isEmpty) {
          return (
            <div className="space-y-4">
              <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4">
                <div className="flex items-center gap-2 mb-2">
                  <AlertCircle size={16} className="text-yellow-600" />
                  <span className="font-medium text-yellow-800">Step Incomplete</span>
                </div>
                <p className="text-yellow-700 text-sm mb-3">{step.data.message}</p>
                <p className="text-yellow-600 text-xs">
                  This step needs to be completed with actual content data to display properly.
                </p>
              </div>
            </div>
          );
        }
        
        return (
          <div className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {step.data.characters?.map((character: any, index: number) => (
                <Card key={index} className="p-3">
                  {/* Check multiple possible image field names */}
                  {(character.portraitUrl || character.imageUrl || character.existingPortraitUrl || character.image || character.physicalDescription?.includes('https://')) && (
                    <img 
                      src={
                        character.portraitUrl || 
                        character.imageUrl || 
                        character.existingPortraitUrl || 
                        character.image ||
                        // Extract image URL from physicalDescription if it contains a URL
                        (character.physicalDescription?.match(/https:\/\/[^\s)]+/)?.[0])
                      } 
                      alt={character.name || character.characterName}
                      className="w-full h-44 object-contain bg-gray-50 rounded mb-2"
                      onError={(e) => {
                        const target = e.target as HTMLImageElement;
                        target.src = 'data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iMjAwIiBoZWlnaHQ9IjIwMCIgeG1sbnM9Imh0dHA6Ly93d3cudzMub3JnLzIwMDAvc3ZnIj48cmVjdCB3aWR0aD0iMjAwIiBoZWlnaHQ9IjIwMCIgZmlsbD0iI2Y3ZjdmNyIvPjx0ZXh0IHg9IjUwJSIgeT0iNTAlIiBmb250LWZhbWlseT0iQXJpYWwiIGZvbnQtc2l6ZT0iMTQiIGZpbGw9IiM5OTk5OTkiIHRleHQtYW5jaG9yPSJtaWRkbGUiIGR5PSIuM2VtIj5JbWFnZSBub3QgYXZhaWxhYmxlPC90ZXh0Pjwvc3ZnPg==';
                      }}
                    />
                  )}
                  <h5 className="font-medium">{character.name || character.characterName}</h5>
                  <p className="text-xs text-gray-600 mb-2">
                    {character.role} {character.age && `• Age ${character.age}`}
                  </p>
                  
                  {/* Main personality description */}
                  {character.personality && (
                    <p className="text-xs text-gray-700 mb-2">
                      {character.personality}
                    </p>
                  )}
                  
                  {/* Physical description */}
                  {character.physicalDescription && (
                    <div className="text-xs text-gray-600 mb-2">
                      <span className="font-medium">Appearance:</span> {character.physicalDescription.replace(/https:\/\/[^\s)]+/g, '').trim()}
                    </div>
                  )}
                  
                  {/* Sample lines */}
                  {character.sampleLines && character.sampleLines.length > 0 && (
                    <div className="text-xs text-gray-600 mb-2">
                      <span className="font-medium">Sample Lines:</span>
                      <div className="mt-1 space-y-1">
                        {character.sampleLines.map((line: string, i: number) => (
                          <div key={i} className="italic text-gray-500">"{line}"</div>
                        ))}
                      </div>
                    </div>
                  )}
                  
                  {/* Other character details */}
                  <div className="text-xs text-gray-500 space-y-1 mt-2">
                    {character.emotionalArc && (
                      <div><span className="font-medium">Arc:</span> {character.emotionalArc}</div>
                    )}
                    {character.movementStyle && (
                      <div><span className="font-medium">Movement:</span> {character.movementStyle}</div>
                    )}
                    {character.strengths && (
                      <div><span className="font-medium">Strengths:</span> {character.strengths}</div>
                    )}
                    {character.weaknesses && (
                      <div><span className="font-medium">Weaknesses:</span> {character.weaknesses}</div>
                    )}
                    {character.importance && (
                      <div><span className="font-medium">Importance:</span> {character.importance}</div>
                    )}
                    {character.visualNotes && (
                      <div><span className="font-medium">Visual Notes:</span> {character.visualNotes}</div>
                    )}
                  </div>
                </Card>
              ))}
            </div>
          </div>
        );

      case 3: // Chapter Writing
        // Check if step is empty/incomplete
        if (step.data?.isEmpty) {
          return (
            <div className="space-y-4">
              <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4">
                <div className="flex items-center gap-2 mb-2">
                  <AlertCircle size={16} className="text-yellow-600" />
                  <span className="font-medium text-yellow-800">Step Incomplete</span>
                </div>
                <p className="text-yellow-700 text-sm mb-3">{step.data.message}</p>
                <p className="text-yellow-600 text-xs">
                  This step needs to be completed with actual content data to display properly.
                </p>
              </div>
            </div>
          );
        }
        
        return (
          <div className="space-y-4">
            <div>
              <h4 className="font-medium mb-2">{step.data.title || 'Chapter Content'}</h4>
              {step.data.storySummary && (
                <div className="bg-blue-50 border border-blue-200 rounded p-3 mb-4">
                  <p className="text-sm text-blue-800">{step.data.storySummary}</p>
                </div>
              )}
            </div>
            
            {/* Handle new structure with chapters[0].scenes */}
            {step.data.chapters?.[0]?.scenes && (
              <div>
                <h4 className="font-medium mb-3">Chapter Scenes ({step.data.chapters[0].scenes.length})</h4>
                <div className="space-y-3 max-h-96 overflow-y-auto">
                  {step.data.chapters[0].scenes.map((scene: any, index: number) => (
                    <Card key={index} className="p-3">
                      <div className="flex items-start justify-between mb-2">
                        <h5 className="font-medium text-sm">
                          Scene {scene.sceneNumber}
                          {scene.title && (
                            <span className="text-xs text-gray-500 ml-2 font-normal">• {scene.title}</span>
                          )}
                        </h5>
                      </div>
                      
                      {/* Scene content as markdown */}
                      {scene.text && (
                        <div className="bg-gray-50 p-3 rounded">
                          <div className="prose prose-sm max-w-none">
                            <Markdown>{scene.text}</Markdown>
                          </div>
                        </div>
                      )}
                      
                      {/* Characters in scene */}
                      {scene.characters && scene.characters.length > 0 && (
                        <div className="text-xs text-blue-600 bg-blue-50 p-2 rounded mt-2">
                          <strong>Characters:</strong> {scene.characters.join(', ')}
                        </div>
                      )}
                      
                      {/* Show illustration notes */}
                      {scene.illustrationNotes && (
                        <div className="text-xs text-purple-600 border-l-2 border-purple-300 pl-2 bg-purple-50 p-2 rounded-r mt-2">
                          <strong>🎨 Illustration Notes:</strong> {scene.illustrationNotes}
                        </div>
                      )}
                      
                      {/* Fallback for old data structure */}
                      {!scene.illustrationNotes && scene.spreadDescription && (
                        <div className="text-xs text-gray-500 border-l-2 border-gray-300 pl-2 mt-2">
                          <strong>Illustration:</strong> {scene.spreadDescription}
                        </div>
                      )}
                    </Card>
                  ))}
                </div>
              </div>
            )}

            {/* Handle old structure with spreads */}
            {!step.data.chapters && step.data.spreads && (
              <div>
                <h4 className="font-medium mb-3">Story Spreads ({step.data.spreads.length})</h4>
                <div className="space-y-3 max-h-96 overflow-y-auto">
                  {step.data.spreads.map((spread: any, index: number) => (
                    <Card key={index} className="p-3">
                      <div className="flex items-start justify-between mb-2">
                        <h5 className="font-medium text-sm">Spread {spread.spread}: {spread.title}</h5>
                      </div>
                      
                      {spread.text && spread.text.length > 0 && (
                        <div className="bg-gray-50 p-2 rounded mb-2">
                          <div className="text-xs text-gray-600 mb-1">Story Text:</div>
                          {spread.text.map((line: string, lineIndex: number) => (
                            <p key={lineIndex} className="text-sm mb-1 italic">"{line}"</p>
                          ))}
                        </div>
                      )}
                      
                      {spread.illustrationNotes && (
                        <div className="text-xs text-gray-500 border-l-2 border-gray-300 pl-2">
                          <strong>Illustration:</strong> {spread.illustrationNotes}
                        </div>
                      )}
                    </Card>
                  ))}
                </div>
              </div>
            )}

            {/* Show illustrator style guide if present */}
            {step.data.illustratorStyleGuide && (
              <div className="mt-4">
                <h4 className="font-medium mb-3">Illustrator Style Guide</h4>
                <div className="bg-purple-50 border border-purple-200 rounded p-3 space-y-3">
                  {step.data.illustratorStyleGuide.overallStyle && (
                    <div>
                      <h5 className="font-medium text-sm mb-1">Overall Style</h5>
                      <p className="text-xs text-purple-700">
                        {step.data.illustratorStyleGuide.overallStyle.artisticMedium} • {step.data.illustratorStyleGuide.overallStyle.paletteTone}
                      </p>
                    </div>
                  )}
                  
                  {step.data.illustratorStyleGuide.characterConsistency && (
                    <div>
                      <h5 className="font-medium text-sm mb-2">Character References</h5>
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
                        {Object.entries(step.data.illustratorStyleGuide.characterConsistency).map(([key, char]: [string, any]) => (
                          <div key={key} className="flex items-center space-x-2 text-xs">
                            {char.image && (
                              <img src={char.image} alt={key} className="w-8 h-8 object-cover rounded" />
                            )}
                            <div>
                              <div className="font-medium">{key.replace(/_/g, ' ')}</div>
                              <div className="text-gray-600">{char.notes}</div>
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              </div>
            )}

            {/* Fallback for old data structure - render full markdown content */}
            {step.data.content && !step.data.spreads && !step.data.chapters && (
              <div className="bg-white border rounded-lg p-4">
                <h4 className="font-medium mb-3 text-gray-700">Chapter Content</h4>
                <div className="prose prose-sm max-w-none">
                  <Markdown>{step.data.content}</Markdown>
                </div>
              </div>
            )}

            {step.data.scenes && (
              <div>
                <h4 className="font-medium mb-2">Scenes ({step.data.scenes.length})</h4>
                <div className="space-y-2">
                  {step.data.scenes.map((scene: any, index: number) => (
                    <div key={index} className="border rounded p-2">
                      <p className="text-sm font-medium">{scene.synopsis}</p>
                      <p className="text-xs text-gray-500">{scene.environment.location}</p>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        );

      case 4: // Environment Design
        // Check if step is empty/incomplete
        if (step.data?.isEmpty) {
          return (
            <div className="space-y-4">
              <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4">
                <div className="flex items-center gap-2 mb-2">
                  <AlertCircle size={16} className="text-yellow-600" />
                  <span className="font-medium text-yellow-800">Step Incomplete</span>
                </div>
                <p className="text-yellow-700 text-sm mb-3">{step.data.message}</p>
                <p className="text-yellow-600 text-xs">
                  This step needs to be completed with actual content data to display properly.
                </p>
              </div>
            </div>
          );
        }
        
        return (
          <div className="space-y-4">
            {/* Step Title and Summary */}
            {step.data.stepTitle && (
              <div>
                <h4 className="font-medium mb-2">{step.data.stepTitle}</h4>
                {step.data.nextSteps && step.data.nextSteps.length > 0 && (
                  <div className="bg-blue-50 border border-blue-200 rounded p-3 mb-4">
                    <h5 className="font-medium text-sm mb-2">Next Steps:</h5>
                    <ul className="text-xs text-blue-800 space-y-1">
                      {step.data.nextSteps.map((step: string, index: number) => (
                        <li key={index}>• {step}</li>
                      ))}
                    </ul>
                  </div>
                )}
              </div>
            )}

            {/* Environment Cards */}
            <div>
              <h4 className="font-medium mb-3">
                Key Environments ({step.data.environments?.length || 0})
              </h4>
              
              {/* Handle text-only books or missing environments */}
              {(!step.data.environments || step.data.environments.length === 0) && (
                <div className="bg-gray-50 border border-gray-200 rounded p-4 text-center">
                  <div className="text-gray-600 mb-2">
                    {step.data.environmentDesign || step.data.note || "No environment images needed for this book"}
                  </div>
                  <div className="text-sm text-gray-500">
                    This story relies on descriptive prose to set the scenes
                  </div>
                </div>
              )}
              
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {step.data.environments?.map((env: any, index: number) => (
                  <Card key={index} className="p-4">
                    {/* Environment Image */}
                    {(env.environmentImageUrl || env.imageUrl || env.environmentUrl || env.existingReference || env.masterPlate) ? (
                      <img 
                        src={env.environmentImageUrl || env.imageUrl || env.environmentUrl || env.existingReference || env.masterPlate} 
                        alt={env.location || env.name}
                        className="w-full h-40 object-contain bg-gray-50 rounded mb-3"
                        onError={(e) => {
                          const target = e.target as HTMLImageElement; 
                          target.src = 'data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iMjAwIiBoZWlnaHQ9IjIwMCIgeG1sbnM9Imh0dHA6Ly93d3cudzMub3JnLzIwMDAvc3ZnIj48cmVjdCB3aWR0aD0iMjAwIiBoZWlnaHQ9IjIwMCIgZmlsbD0iI2Y3ZjdmNyIvPjx0ZXh0IHg9IjUwJSIgeT0iNTAlIiBmb250LWZhbWlseT0iQXJpYWwiIGZvbnQtc2l6ZT0iMTQiIGZpbGw9IiM5OTk5OTkiIHRleHQtYW5jaG9yPSJtaWRkbGUiIGR5PSIuM2VtIj5JbWFnZSBub3QgYXZhaWxhYmxlPC90ZXh0Pjwvc3ZnPg==';
                        }}
                      />
                    ) : (
                      <div className="w-full h-40 bg-gray-100 rounded mb-3 flex items-center justify-center border-2 border-dashed border-gray-300">
                        <div className="text-center">
                          <div className="text-gray-400 text-sm mb-1">🎨</div>
                          <div className="text-xs text-gray-500">Image pending</div>
                        </div>
                      </div>
                    )}

                    {/* Environment Details */}
                    <div className="space-y-2">
                      <h5 className="font-medium text-sm">{env.location || env.name}</h5>
                      
                      {/* Time of Day */}
                      {env.timeOfDay && (
                        <div className="flex items-center space-x-2">
                          <span className="text-xs px-2 py-1 bg-orange-100 text-orange-700 rounded">
                            {env.timeOfDay}
                          </span>
                          {env.weather && (
                            <span className="text-xs px-2 py-1 bg-blue-100 text-blue-700 rounded">
                              {env.weather}
                            </span>
                          )}
                        </div>
                      )}

                      {/* Description */}
                      {env.description && (
                        <p className="text-xs text-gray-600 leading-relaxed">
                          {env.description}
                        </p>
                      )}

                      {/* Additional Details */}
                      {env.atmosphere && (
                        <div className="text-xs text-gray-500">
                          <span className="font-medium">Atmosphere:</span> {env.atmosphere}
                        </div>
                      )}

                      {env.keyElements && (
                        <div className="text-xs text-gray-500">
                          <span className="font-medium">Key Elements:</span> {env.keyElements.join(', ')}
                        </div>
                      )}

                      {/* Style Notes */}
                      {(env.styleNotes || env.visualStyle) && (
                        <div className="bg-purple-50 border border-purple-200 rounded p-2 mt-2">
                          <p className="text-xs text-purple-700">
                            <span className="font-medium">Style:</span> {env.styleNotes || env.visualStyle}
                          </p>
                        </div>
                      )}
                    </div>
                </Card>
              ))}
              </div>
            </div>
          </div>
        );

      case 5: // Final Chapter Content
        return (
          <div className="space-y-4">
            {/* Step Title and Summary */}
            {step.data.stepTitle && (
              <div>
                <h4 className="font-medium mb-2">{step.data.stepTitle}</h4>
              </div>
            )}

            {/* Main content: Final chapters with complete scenes */}
            {step.data.chapters && (
              <div>
                {/* Enhanced Editing Info */}
                {step.data.chapters.length > 1 && (
                  <div className="bg-blue-50 border border-blue-200 rounded-lg p-3 mb-4">
                    <div className="flex items-center gap-2 text-blue-800">
                      <BookOpen size={16} />
                      <span className="font-medium">Multi-Chapter Book</span>
                    </div>
                    <p className="text-blue-700 text-sm mt-1">
                      Navigate between chapters to edit them individually. Each chapter is automatically saved with version history.
                    </p>
                  </div>
                )}
                
                <div className="flex items-center justify-between mb-4">
                  <h4 className="font-medium">
                    Final Chapters ({step.data.chapters?.length || 0})
                  </h4>
                  
                  {/* Chapter Navigation - Always show for better UX */}
                  <div className="flex items-center gap-2">
                    {step.data.chapters.length > 1 ? (
                      <>
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => {
                            const chapterNumbers = step.data.chapters.map((ch: any) => ch.chapterNumber).sort((a: number, b: number) => a - b);
                            const currentIndex = chapterNumbers.indexOf(currentChapter);
                            if (currentIndex > 0) {
                              setCurrentChapter(chapterNumbers[currentIndex - 1]);
                            }
                          }}
                          disabled={(() => {
                            const chapterNumbers = step.data.chapters.map((ch: any) => ch.chapterNumber).sort((a: number, b: number) => a - b);
                            return chapterNumbers.indexOf(currentChapter) <= 0;
                          })()}
                        >
                          <ChevronLeft size={16} />
                          Previous
                        </Button>
                        
                        <select
                          value={currentChapter}
                          onChange={(e) => setCurrentChapter(parseInt(e.target.value))}
                          className="px-3 py-1 border rounded text-sm"
                        >
                          {step.data.chapters.map((chapter: any) => (
                            <option key={chapter.chapterNumber} value={chapter.chapterNumber}>
                              Chapter {chapter.chapterNumber}: {chapter.title}
                            </option>
                          ))}
                        </select>
                        
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => {
                            const chapterNumbers = step.data.chapters.map((ch: any) => ch.chapterNumber).sort((a: number, b: number) => a - b);
                            const currentIndex = chapterNumbers.indexOf(currentChapter);
                            if (currentIndex < chapterNumbers.length - 1) {
                              setCurrentChapter(chapterNumbers[currentIndex + 1]);
                            }
                          }}
                          disabled={(() => {
                            const chapterNumbers = step.data.chapters.map((ch: any) => ch.chapterNumber).sort((a: number, b: number) => a - b);
                            return chapterNumbers.indexOf(currentChapter) >= chapterNumbers.length - 1;
                          })()}
                        >
                          Next
                          <ChevronRight size={16} />
                        </Button>
                      </>
                    ) : (
                      <div className="text-sm text-gray-500">
                        Single Chapter Book • 
                        <span className="ml-1 text-blue-600">Ask AI to add more chapters if needed</span>
                      </div>
                    )}
                  </div>
                </div>
                <div className="space-y-4">
                  {step.data.chapters?.filter((chapter: any) => chapter.chapterNumber === currentChapter).map((chapter: any) => {
                    const actualIndex = step.data.chapters.findIndex((ch: any) => ch.chapterNumber === currentChapter);
                    return (
                    <Card key={actualIndex} className="p-4">
                      <h5 className="font-medium mb-2">Chapter {chapter.chapterNumber}: {chapter.title}</h5>
                      {chapter.summary && (
                        <p className="text-sm text-gray-600 mb-3">{chapter.summary}</p>
                      )}
                      {chapter.approxWords && (
                        <p className="text-xs text-gray-500 mb-3">Approx. {chapter.approxWords} words</p>
                      )}
                      
                      {/* Enhanced Chapter Editor with Database Integration */}
                      <div className="space-y-3">
                        {/* Version Control and Auto-save Info */}
                        <div className="bg-green-50 border border-green-200 rounded p-3">
                          <div className="flex items-center justify-between">
                            <div className="flex items-center gap-2 text-green-800">
                              <CheckCircle size={16} />
                              <span className="font-medium">Auto-save & Version Control</span>
                            </div>
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={async () => {
                                // Use the existing workflow bookId
                                const effectiveBookId = ensureBookIdExists();
                                if (!effectiveBookId) {
                                  console.error('[Step5] Cannot fetch version history without bookId from workflow');
                                  return;
                                }
                                fetchChapterVersions(effectiveBookId, currentChapter);
                              }}
                              disabled={loadingVersions}
                              className="text-xs"
                            >
                              {loadingVersions ? (
                                <RefreshCw size={14} className="mr-1 animate-spin" />
                              ) : (
                                <History size={14} className="mr-1" />
                              )}
                              Version History
                            </Button>
                          </div>
                          <p className="text-green-700 text-sm mt-1">
                            Your changes are automatically saved. Use "Version History" to view or restore previous versions.
                          </p>
                        </div>
                        
                        {/* Combined Chapter Editor */}
                        <div className="border rounded-lg bg-white">
                          <div className="p-3 border-b bg-gray-50">
                            <div className="flex items-center justify-between">
                              <span className="text-sm font-medium">Chapter Editor</span>
                              <span className="text-xs text-gray-500">Auto-save enabled</span>
                            </div>
                          </div>
                          
                          <div className="p-4">
                            <Editor
                              content={(() => {
                                // Combine all scene content into a single editable chapter
                                const chapterContent = chapter.scenes?.map((scene: any, sceneIndex: number) => {
                                  let content = '';
                                  
                                  // Add scene header if it has a title
                                  if (scene.title) {
                                    content += `## Scene ${scene.sceneNumber || sceneIndex + 1}: ${scene.title}\n\n`;
                                  } else if (chapter.scenes.length > 1) {
                                    content += `## Scene ${scene.sceneNumber || sceneIndex + 1}\n\n`;
                                  }
                                  
                                  // Add character info if present
                                  if (scene.characters && scene.characters.length > 0) {
                                    content += `*Characters: ${scene.characters.join(', ')}*\n\n`;
                                  }
                                  
                                  // Add the main scene text
                                  if (scene.text) {
                                    content += scene.text + '\n\n';
                                  }
                                  
                                  // Add illustration notes if present
                                  if (scene.illustrationNotes) {
                                    content += `---\n*Illustration Notes: ${scene.illustrationNotes}*\n\n`;
                                  }
                                  
                                  return content;
                                }).join('\n---\n\n') || '';
                                
                                return chapterContent;
                              })()}
                              onSaveContent={async (updatedContent, debounce) => {
                                console.log(`[Step5] Chapter ${currentChapter} content changed...`, {
                                  hasStandardSave: !!onSaveContent,
                                  bookId: state.bookId,
                                  chapterNumber: chapter.chapterNumber || currentChapter,
                                  contentLength: updatedContent.length
                                });
                                
                                console.log('[Step5] DEBUGGING: onSaveContent prop received from artifact system:', typeof onSaveContent, !!onSaveContent);
                                
                                // Use the existing workflow bookId (should already exist from chapterNumber = 0)
                                const effectiveBookId = ensureBookIdExists();
                                if (!effectiveBookId) {
                                  console.error('[Step5] Cannot save without valid bookId from workflow');
                                  return;
                                }
                                
                                // Step 5 uses unified onUpdateState approach
                                console.log('[Step5] Content changed, updating state and triggering save to chapter 1');
                                
                                // Update the internal state for immediate UI feedback
                                const updatedScenes = [{
                                  sceneNumber: 1,
                                  title: `Chapter ${chapter.chapterNumber || currentChapter} Content`,
                                  text: updatedContent,
                                  characters: chapter.scenes?.[0]?.characters || [],
                                  illustrationNotes: chapter.scenes?.[0]?.illustrationNotes || ''
                                }];
                                
                                // Update internal state and trigger appropriate save via onUpdateState
                                if (onUpdateState && !isUpdatingRef.current) {
                                  isUpdatingRef.current = true;
                                  
                                  try {
                                    const currentState = stateRef.current;
                                    const updatedState = { ...currentState };
                                    const stepIndex = updatedState.steps.findIndex(s => s.stepNumber === step.stepNumber);
                                    
                                    if (stepIndex !== -1 && updatedState.steps[stepIndex].data?.chapters) {
                                      const chapters = [...updatedState.steps[stepIndex].data.chapters];
                                      chapters[actualIndex] = {
                                        ...chapters[actualIndex],
                                        scenes: updatedScenes
                                      };
                                      
                                      updatedState.steps[stepIndex].data = {
                                        ...updatedState.steps[stepIndex].data,
                                        chapters
                                      };
                                      updatedState.updatedAt = new Date();
                                      
                                      // Call onUpdateState with step number to trigger appropriate save
                                      // Step 5 -> saves to chapter 1+, Steps 1-4 -> saves to chapter 0
                                      onUpdateState(updatedState, step.stepNumber);
                                    }
                                  } finally {
                                    setTimeout(() => {
                                      isUpdatingRef.current = false;
                                    }, 100);
                                  }
                                }
                              }}
                              status="idle"
                              isCurrentVersion={isCurrentVersion}
                              currentVersionIndex={0}
                              suggestions={[]}
                              storyContext={`${state.bookTitle} - Chapter ${chapter.chapterNumber}: ${chapter.title}`}
                            />
                          </div>
                        </div>
                        
                        {/* Chapter Metadata */}
                        <div className="text-xs text-gray-500 bg-gray-50 rounded p-2">
                          <div className="flex justify-between items-center">
                            <div className="flex gap-4">
                              <span><strong>Scenes:</strong> {chapter.scenes?.length || 0}</span>
                              {chapter.approxWords && (
                                <span><strong>Est. Words:</strong> {chapter.approxWords}</span>
                              )}
                            </div>
                            <span className="text-green-600">✓ Auto-saved</span>
                          </div>
                        </div>
                      </div>
                    </Card>
                    );
                  })}
                </div>
              </div>
            )}

            {/* Legacy format fallback */}
            {!step.data.chapters && (step.data.expandedChapters || step.data.scenes || step.data.scenesToCompose) && (
            <div>
              <h4 className="font-medium mb-3">
                Scene Compositions ({step.data.scenesToCompose?.length || step.data.scenes?.length || 0})
              </h4>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {(step.data.scenesToCompose || step.data.scenes)?.map((scene: any, index: number) => {
                // Function to find matching environment master plate
                const findEnvironmentPlate = (sceneName: string) => {
                  if (!step.data.seedsAndAssets?.environments) return null;
                  
                  // Map scene names to environment names
                  const sceneToEnvMap: { [key: string]: string } = {
                    'spread0_endpapers_map': 'Endpapers Map',
                    'spread1_morning_home': 'Home / Morning Kitchen',
                    'spread2_ferry_pier': 'Ferry Building & Pier',
                    'spread3_cable_car': 'Cable Car Street',
                    'spread6_painted_ladies': 'Painted Ladies Picnic',
                    'spread11_ice_cream': 'Ice Cream Shop',
                    'spread13_bedtime': 'Home Bedroom'
                  };
                  
                  const envName = sceneToEnvMap[sceneName];
                  if (!envName) return null;
                  
                  const env = step.data.seedsAndAssets.environments.find((e: any) => e.name === envName);
                  return env?.masterPlate || null;
                };

                const previewImage = scene.imageUrl || findEnvironmentPlate(scene.sceneId);

                return (
                <Card key={index} className="p-3">
                    {previewImage && (
                      <div className="relative">
                        <img 
                          src={previewImage} 
                          alt={scene.sceneId || scene.name || `Scene ${index + 1}`}
                          className="w-full h-40 object-contain bg-gray-50 rounded mb-2"
                          onError={(e) => {
                            const target = e.target as HTMLImageElement;
                            target.src = 'data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iMjAwIiBoZWlnaHQ9IjIwMCIgeG1sbnM9Imh0dHA6Ly93d3cudzMub3JnLzIwMDAvc3ZnIj48cmVjdCB3aWR0aD0iMjAwIiBoZWlnaHQ9IjIwMCIgZmlsbD0iI2Y3ZjdmNyIvPjx0ZXh0IHg9IjUwJSIgeT0iNTAlIiBmb250LWZhbWlseT0iQXJpYWwiIGZvbnQtc2l6ZT0iMTQiIGZpbGw9IiM5OTk5OTkiIHRleHQtYW5jaG9yPSJtaWRkbGUiIGR5PSIuM2VtIj5JbWFnZSBub3QgYXZhaWxhYmxlPC90ZXh0Pjwvc3ZnPg==';
                          }}
                        />
                        {!scene.imageUrl && previewImage && (
                          <div className="absolute top-2 right-2 bg-blue-100 text-blue-800 text-xs px-2 py-1 rounded">
                            Preview
                          </div>
                        )}
                      </div>
                    )}
                    <h5 className="font-medium text-sm">
                      Scene {scene.sceneNumber || index + 1}
                      {scene.environment && (
                        <span className="text-xs text-gray-500 ml-2">• {scene.environment}</span>
                      )}
                    </h5>
                    <p className="text-xs text-gray-600 mb-2">
                      {scene.sceneDescription || scene.description}
                    </p>
                    
                    {/* Characters in scene */}
                    {scene.characters && scene.characters.length > 0 && (
                      <div className="mb-2">
                        <div className="text-xs text-gray-500 mb-1">Characters:</div>
                        <div className="flex flex-wrap gap-1">
                          {scene.characters.map((character: string, charIndex: number) => (
                            <span key={charIndex} className="text-xs px-2 py-1 bg-purple-100 text-purple-700 rounded">
                              {character}
                            </span>
                          ))}
                        </div>
                      </div>
                    )}
                    
                    {!scene.imageUrl && (
                      <p className="text-xs text-orange-600 italic">Scene composition pending</p>
                    )}
                </Card>
                );
              })}
            </div>
            </div>
            )}
          </div>
        );

      case 6: // Final Review
        return (
          <div className="space-y-6">




            {/* Action Buttons */}
            <div className="bg-gradient-to-r from-blue-500 to-green-500 rounded-xl p-6 text-white text-center">
              <div className="flex items-center justify-center mb-4">
                <Star className="w-8 h-8 text-yellow-300" />
              </div>
              <h3 className="text-2xl font-bold mb-2">🌟 Your Book is Complete! 🌟</h3>
              <p className="text-purple-100 mb-6">
                {state.bookTitle} is ready!
              </p>
              
              <div className="flex flex-col sm:flex-row gap-3 justify-center max-w-md mx-auto">
                <Button
                  onClick={() => setShowPreview(true)}
                  className="flex-1 bg-white text-purple-600 hover:bg-gray-100 font-medium"
                  size="lg"
                >
                  <Eye className="w-5 h-5 mr-2" />
                  Preview Book
                </Button>
                {/* <Button
                  onClick={() => {
                    // TODO: Implement PDF download
                    alert('PDF download functionality coming soon!');
                  }}
                  className="flex-1 bg-purple-700 hover:bg-purple-800 font-medium"
                  size="lg"
                >
                  <Download className="w-5 h-5 mr-2" />
                  Download PDF
                </Button> */}
              </div>
              
            </div>
                        {/* Book Stats */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-center">
              <div>
                <div className="text-2xl font-bold text-blue-600">{bookPages.length}</div>
                <div className="text-xs text-gray-500">Pages</div>
              </div>
              <div>
                <div className="text-2xl font-bold text-green-600">
                  {state.steps.find(s => s.stepNumber === 2)?.data?.characters?.length || '5'}
                </div>
                <div className="text-xs text-gray-500">Characters</div>
              </div>
              <div>
                <div className="text-2xl font-bold text-purple-600">
                  {state.steps.find(s => s.stepNumber === 5)?.data?.scenes?.length || '8'}
                </div>
                <div className="text-xs text-gray-500">Scenes</div>
              </div>
              <div>
                <div className="text-2xl font-bold text-orange-600">
                  {state.steps.find(s => s.stepNumber === 4)?.data?.environments?.length || '15'}
                </div>
                <div className="text-xs text-gray-500">Images</div>
              </div>
            </div>
          </div>
        );

      default:
        return <div>Step content will appear here...</div>;
    }
  };

  // BookPreview Component
  const BookPreview = () => {
    const [isMobile, setIsMobile] = useState(false);
    const [currentMobilePage, setCurrentMobilePage] = useState(0);
    const [touchStart, setTouchStart] = useState<{ x: number; y: number } | null>(null);

    React.useEffect(() => {
      const checkMobile = () => {
        setIsMobile(window.innerWidth < 768);
      };
      checkMobile();
      window.addEventListener('resize', checkMobile);
      return () => window.removeEventListener('resize', checkMobile);
    }, []);

    // Don't close preview on mobile when window size changes
    const pages = buildPhysicalPages(state);

    if (isMobile) {
      // Mobile: Fullscreen swipeable book preview
      return (
        <div className="fixed inset-0 bg-white z-50 flex flex-col">
          {/* Minimal header with close button */}
          <div className="flex items-center justify-between p-4 bg-white/95 backdrop-blur-sm absolute top-0 left-0 right-0 z-20">
            <div className="flex items-center gap-4">
              <h2 className="text-lg font-semibold">Book Preview</h2>
              <span className="text-sm text-gray-500">
                {currentMobilePage + 1} / {pages.length}
              </span>
            </div>
            <button 
              onClick={() => setShowPreview(false)} 
              className="p-2 hover:bg-gray-100 rounded-full transition bg-white shadow-sm" 
              aria-label="Close preview"
            >
              <X size={24} />
            </button>
          </div>
          
          {/* Page dots indicator */}
          <div className="absolute bottom-6 left-0 right-0 z-20 flex justify-center">
            <div className="flex gap-2 bg-black/20 backdrop-blur-sm rounded-full px-4 py-2">
              {pages.map((_, index) => (
                <button
                  key={index}
                  onClick={() => setCurrentMobilePage(index)}
                  className={`w-2 h-2 rounded-full transition-all ${
                    index === currentMobilePage ? 'bg-white scale-125' : 'bg-white/50'
                  }`}
                />
              ))}
            </div>
          </div>
          
          {/* Fullscreen swipeable content */}
          <div 
            className="flex-1 w-full h-full relative overflow-hidden"
            onTouchStart={(e) => {
              const touch = e.touches[0];
              setTouchStart({ x: touch.clientX, y: touch.clientY });
            }}
            onTouchMove={(e) => {
              if (!touchStart) return;
              const touch = e.touches[0];
              const deltaX = touch.clientX - touchStart.x;
              const deltaY = touch.clientY - touchStart.y;
              
              // Only handle horizontal swipes (ignore vertical scrolling)
              if (Math.abs(deltaX) > Math.abs(deltaY) && Math.abs(deltaX) > 50) {
                e.preventDefault(); // Prevent scrolling when swiping horizontally
              }
            }}
            onTouchEnd={(e) => {
              if (!touchStart) return;
              
              const touch = e.changedTouches[0];
              const deltaX = touch.clientX - touchStart.x;
              const deltaY = touch.clientY - touchStart.y;
              
              // Only trigger page change for horizontal swipes
              if (Math.abs(deltaX) > Math.abs(deltaY) && Math.abs(deltaX) > 50) {
                if (deltaX > 0 && currentMobilePage > 0) {
                  // Swipe right - previous page
                  setCurrentMobilePage(currentMobilePage - 1);
                } else if (deltaX < 0 && currentMobilePage < pages.length - 1) {
                  // Swipe left - next page
                  setCurrentMobilePage(currentMobilePage + 1);
                }
              }
              
              setTouchStart(null);
            }}
          >
            {/* Current page content - fullscreen */}
            {pages.length > 0 && pages[currentMobilePage] && (
              <div className="w-full h-full relative">
                {(() => {
                  const page = pages[currentMobilePage] as any;
                  if (page.kind === 'cover') {
                    return (
                      <div className="w-full h-full bg-gradient-to-br from-purple-600 via-blue-600 to-indigo-700 text-white relative overflow-hidden">
                        <div className="absolute inset-0 bg-black/20" />
                        <div className="relative z-10 flex flex-col h-full p-8 justify-center items-center text-center">
                          <div className="mb-8">
                            {page.data.image && !page.data.image.includes('/api/placeholder') ? (
                              <img
                                src={page.data.image}
                                alt="Cover"
                                className="w-32 h-40 object-cover rounded-xl shadow-2xl mx-auto"
                                onError={(e) => {
                                  const target = e.target as HTMLImageElement;
                                  target.style.display = 'none';
                                }}
                              />
                            ) : (
                              <div className="w-32 h-40 bg-white/20 rounded-xl shadow-2xl mx-auto flex items-center justify-center backdrop-blur-sm">
                                <div className="text-center">
                                  <BookOpen size={32} className="mx-auto mb-2 text-white/80" />
                                  <div className="text-sm text-white/60">Story</div>
                                </div>
                              </div>
                            )}
                          </div>
                          
                          <h1 className="text-3xl font-bold mb-6 leading-tight max-w-sm">{page.data.title}</h1>
                          
                          {page.data.characters && page.data.characters.length > 0 && (
                            <div className="mb-6">
                              <p className="text-sm text-white/80 mb-3">Featuring</p>
                              <div className="flex flex-wrap justify-center gap-2">
                                {page.data.characters.map((character: any, index: number) => (
                                  <span key={index} className="text-sm bg-white/20 px-3 py-1 rounded-full">
                                    {character.name}
                                  </span>
                                ))}
                              </div>
                            </div>
                          )}
                          
                          <div className="flex gap-3 text-sm text-white/70 mb-8">
                            {page.data.genre && <span>{page.data.genre}</span>}
                            {page.data.targetAudience && <span>• {page.data.targetAudience}</span>}
                          </div>
                          
                          <div className="text-white/80">
                            <p className="text-sm">A Papr Story</p>
                          </div>
                        </div>
                      </div>
                      );
                    } else if (page.kind === 'chapter-title') {
                      return (
                        <div className="w-full h-full flex flex-col justify-center items-center text-center p-8 bg-gray-50">
                          <div className="text-5xl font-bold text-gray-800 mb-6">
                            Chapter {page.data.chapterNumber || 1}
                          </div>
                          <h2 className="text-2xl font-semibold text-gray-700 mb-8 max-w-md leading-tight">{page.data.title}</h2>
                          {page.data.summary && (
                            <p className="text-gray-600 text-lg px-6 italic leading-relaxed max-w-lg">{page.data.summary}</p>
                          )}
                        </div>
                      );
                    } else if (page.kind === 'chapter-content') {
                      return (
                        <div className="w-full h-full flex flex-col bg-white">
                          <div className="flex-1 p-6 pt-24 pb-20 overflow-y-auto">
                            <div className="prose prose-base max-w-none prose-p:mb-3 prose-p:leading-relaxed prose-headings:text-gray-800">
                              <div className="text-gray-800 leading-relaxed text-base">
                                <Markdown>{(() => {
                                  // Clean the text to remove illustration notes and character info
                                  let cleanText = page.data.text || '';
                                  
                                  // Remove illustration notes sections
                                  cleanText = cleanText.replace(/^Illustration Notes:.*$/gim, '');
                                  cleanText = cleanText.replace(/^\*Illustration Notes:.*\*$/gim, '');
                                  
                                  // Remove character sections
                                  cleanText = cleanText.replace(/^Characters?:.*$/gim, '');
                                  cleanText = cleanText.replace(/^\*Characters?:.*\*$/gim, '');
                                  
                                  // Remove horizontal rules that separate metadata
                                  cleanText = cleanText.replace(/^\s*---\s*$/gm, '');
                                  
                                  // Clean up multiple line breaks
                                  cleanText = cleanText.replace(/\n{3,}/g, '\n\n');
                                  
                                  return cleanText.trim();
                                })()}</Markdown>
                              </div>
                            </div>
                          </div>
                          {page.data.pageNumber && (
                            <div className="absolute bottom-4 left-0 right-0 text-center">
                              <span className="text-sm text-gray-400 bg-white/80 px-3 py-1 rounded-full">Page {page.data.pageNumber}</span>
                            </div>
                          )}
                        </div>
                      );
                    } else if (page.kind === 'back-cover') {
                      return (
                        <div className="w-full h-full bg-gradient-to-br from-indigo-700 via-blue-600 to-purple-600 text-white relative overflow-hidden">
                          <div className="absolute inset-0 bg-black/20" />
                          <div className="relative z-10 flex flex-col h-full p-8 justify-center">
                            <div className="text-center mb-6">
                              <h2 className="text-3xl font-bold mb-4">{page.data.title}</h2>
                              <div className="w-16 h-px bg-white/50 mx-auto"></div>
                            </div>
                        
                            <div className="flex-1 text-center max-w-md mx-auto">
                              <div className="mb-6">
                                <h3 className="text-xl font-semibold mb-4 text-white/90">About This Story</h3>
                                <p className="text-base leading-relaxed text-white/80">
                                  {page.data.summary}
                                </p>
                              </div>
                              
                              {page.data.characters && page.data.characters.length > 0 && (
                                <div className="mb-6">
                                  <h3 className="text-lg font-semibold mb-3 text-white/90">Main Characters</h3>
                                  <div className="space-y-2">
                                    {page.data.characters.slice(0, 4).map((character: any, index: number) => (
                                      <div key={index} className="text-sm">
                                        <span className="font-medium text-white">{character.name}</span>
                                        {character.description && (
                                          <div className="text-white/70 text-xs mt-1">{character.description}</div>
                                        )}
                                      </div>
                                    ))}
                                  </div>
                                </div>
                              )}
                              
                              <div className="flex justify-center gap-4 text-sm text-white/60 mb-6">
                                {page.data.genre && <span>{page.data.genre}</span>}
                                {page.data.totalChapters && <span>• {page.data.totalChapters} Chapters</span>}
                                {page.data.targetAudience && <span>• {page.data.targetAudience}</span>}
                              </div>
                              
                              <div className="text-center pt-4 border-t border-white/20">
                                <p className="text-sm text-white/80">Created with Papr</p>
                              </div>
                            </div>
                      </div>
                    </div>
                      );
                    } else {
                      return (
                        <div className="w-full h-full flex flex-col justify-center items-center p-8 bg-white">
                          <h2 className="text-2xl font-bold mb-6 text-gray-900 text-center">{page.data.title}</h2>
                          <div className="text-gray-700 leading-relaxed text-lg max-w-lg text-center">
                            {page.data.text && page.data.text.split('\n').map((line: string, i: number) => (
                              <p key={i} className="mb-4">{line}</p>
                            ))}
                          </div>
                        </div>
                      );
                    }
                  })()}
              </div>
            )}
          </div>
        </div>
      );
    }

    // Desktop: Flip book view
    return (
    <div className="fixed inset-0 bg-black/80 flex items-center justify-center z-50">
      <button 
        onClick={() => setShowPreview(false)} 
        className="absolute top-6 right-6 text-white hover:text-gray-200 transition" 
        aria-label="Close preview"
      >
        <X size={28} />
      </button>

      <div className="relative w-[1100px] max-w-[95vw]">
        <div className="absolute -top-12 left-0 right-0 text-white text-center font-medium">
            Book Preview — {bookPages.filter(p => p.kind !== 'cover' && p.kind !== 'back-cover').length} pages
        </div>

        <HTMLFlipBook
          width={520}
          height={660}
          size="fixed"
          minWidth={420}
          maxWidth={520}
          minHeight={560}
          maxHeight={660}
          showCover={true}
          usePortrait={false}
          mobileScrollSupport={false}
          className="shadow-2xl rounded-xl overflow-hidden"
          style={{}}
          startPage={0}
          drawShadow={true}
          flippingTime={1000}
          useMouseEvents={true}
          swipeDistance={30}
          clickEventForward={true}
          disableFlipByClick={false}
          startZIndex={0}
          autoSize={false}
          maxShadowOpacity={0.5}
          showPageCorners={true}
        >
          {bookPages.map((page: any, idx: number) => (
            <div key={idx} className="bg-white p-6">
              {page.kind === 'cover' ? (
                <div className="flex flex-col h-full bg-gradient-to-br from-purple-600 via-blue-600 to-indigo-700 text-white relative overflow-hidden">
                  <div className="absolute inset-0 bg-black/20" />
                  <div className="relative z-10 flex flex-col h-full">
                    <div className="flex-1 flex flex-col items-center justify-center text-center p-8">
                      <div className="mb-6">
                        {page.data.image && !page.data.image.includes('/api/placeholder') ? (
                  <img 
                    src={page.data.image} 
                            alt="Cover"
                            className="w-32 h-40 object-cover rounded-lg shadow-2xl mx-auto"
                            onError={(e) => {
                              // If character image fails to load, hide the image container
                              const target = e.target as HTMLImageElement;
                              target.style.display = 'none';
                            }}
                          />
                        ) : (
                          // Fallback design without image
                          <div className="w-32 h-40 bg-white/20 rounded-lg shadow-2xl mx-auto flex items-center justify-center backdrop-blur-sm">
                            <div className="text-center">
                              <BookOpen size={32} className="mx-auto mb-2 text-white/80" />
                              <div className="text-xs text-white/60">Story</div>
                            </div>
                          </div>
                        )}
                      </div>
                      <h1 className="text-3xl font-bold mb-4 leading-tight">{page.data.title}</h1>
                      
                      {/* Show main characters on cover */}
                      {page.data.characters && page.data.characters.length > 0 && (
                        <div className="mb-4">
                          <p className="text-sm text-white/80 mb-2">Featuring</p>
                          <div className="flex flex-wrap justify-center gap-2">
                            {page.data.characters.map((character: any, index: number) => (
                              <span key={index} className="text-xs bg-white/20 px-2 py-1 rounded-full">
                                {character.name}
                              </span>
                            ))}
                          </div>
                        </div>
                      )}
                      
                      {/* Genre and audience info */}
                      <div className="flex gap-4 text-xs text-white/70">
                        {page.data.genre && <span>{page.data.genre}</span>}
                        {page.data.targetAudience && <span>• {page.data.targetAudience}</span>}
                      </div>
                    </div>
                    <div className="text-center pb-6 text-white/80">
                      <p className="text-sm">A Papr Story</p>
                    </div>
                  </div>
                </div>
              ) : page.kind === 'chapter-title' ? (
                <div className="flex flex-col h-full">
                  <div className="flex-1 flex flex-col items-center justify-center text-center">
                    <div className="text-4xl font-bold text-gray-800 mb-4">
                      Chapter {page.data.chapterNumber}
                    </div>
                    <h1 className="text-2xl font-semibold text-gray-700 mb-6">{page.data.title}</h1>
                    {page.data.summary && (
                      <p className="text-gray-600 text-sm px-8 italic">{page.data.summary}</p>
                    )}
                  </div>
                  {page.data.pageNumber && (
                    <div className="mt-2 pt-2 text-xs text-gray-400 text-center border-t border-gray-100">
                      Page {page.data.pageNumber}
                    </div>
                  )}
                </div>
              ) : page.kind === 'chapter-content' ? (
                <div className="flex flex-col h-full">
                  <div className="flex-1 overflow-hidden">
                    {/* Use ProseMirror-style formatting with full height */}
                    <div className="relative w-full h-full prose dark:prose-invert prose-sm max-w-none prose-p:mb-4 prose-p:leading-relaxed">
                      <div className="h-full overflow-y-auto pr-2 text-gray-800 leading-relaxed text-base">
                        <div className="min-h-full">
                          <Markdown>{page.data.text}</Markdown>
                        </div>
                      </div>
                    </div>
                  </div>
                  {page.data.pageNumber && (
                    <div className="mt-2 pt-2 text-xs text-gray-400 text-center border-t border-gray-100">
                      Page {page.data.pageNumber}
                    </div>
                  )}
                </div>
              ) : page.kind === 'back-cover' ? (
                <div className="flex flex-col h-full bg-gradient-to-br from-indigo-700 via-blue-600 to-purple-600 text-white relative overflow-hidden">
                  <div className="absolute inset-0 bg-black/20" />
                  <div className="relative z-10 flex flex-col h-full p-8">
                    <div className="text-center mb-6">
                      <h2 className="text-2xl font-bold mb-2">{page.data.title}</h2>
                      <div className="w-16 h-px bg-white/50 mx-auto"></div>
                    </div>
                    
                    <div className="flex-1">
                      <div className="mb-6">
                        <h3 className="text-lg font-semibold mb-3 text-white/90">About This Story</h3>
                        <p className="text-sm leading-relaxed text-white/80">
                          {page.data.summary}
                        </p>
                      </div>
                      
                      {page.data.characters && page.data.characters.length > 0 && (
                        <div className="mb-6">
                          <h3 className="text-lg font-semibold mb-3 text-white/90">Characters</h3>
                          <div className="grid grid-cols-1 gap-2">
                            {page.data.characters.slice(0, 4).map((character: any, index: number) => (
                              <div key={index} className="text-sm">
                                <span className="font-medium text-white">{character.name}</span>
                                {character.description && (
                                  <span className="text-white/70 ml-2">— {character.description.slice(0, 50)}...</span>
                                )}
                              </div>
                            ))}
                          </div>
                        </div>
                      )}
                      
                      <div className="flex justify-between items-end text-xs text-white/60">
                        <div>
                          {page.data.genre && <span>{page.data.genre}</span>}
                          {page.data.totalChapters && <span> • {page.data.totalChapters} Chapters</span>}
                        </div>
                        <div>
                          {page.data.targetAudience && <span>{page.data.targetAudience}</span>}
                        </div>
                      </div>
                    </div>
                    
                    <div className="text-center pt-4 border-t border-white/20">
                      <p className="text-sm text-white/80">Created with Papr</p>
                    </div>
                  </div>
                </div>
              ) : page.kind === 'text' ? (
                <div className="h-full flex flex-col">
                  <h2 className="text-xl font-bold mb-4 text-gray-900">{page.data.title}</h2>
                  <div className="text-gray-700 leading-relaxed text-[1.05rem] flex-1">
                    {page.data.text.split('\n').map((line: string, i: number) => (
                      <p key={i} className="mb-2">{line}</p>
                    ))}
                  </div>
                  <div className="mt-auto pt-6 text-sm text-gray-400">
                    {page.data.page} • Story
                  </div>
                </div>
              ) : (
                <div className="h-full flex items-center justify-center bg-gray-100 rounded-lg">
                  <img 
                    src={page.data.image} 
                    alt={page.data.title} 
                    className="w-full h-full object-contain rounded-lg" 
                  />
                </div>
              )}
            </div>
          ))}
        </HTMLFlipBook>

        <div className="mt-4 text-center text-white/80 text-sm">
          Drag the page corners or use your trackpad to flip. ESC to close.
        </div>
      </div>
    </div>
  );
  };

  // Version History Modal
  const VersionHistoryModal = () => (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
      <div className="bg-white rounded-lg shadow-xl max-w-4xl w-full mx-4 max-h-[80vh] overflow-hidden">
        <div className="flex items-center justify-between p-4 border-b">
          <h2 className="text-lg font-semibold">Version History - Chapter {currentChapter}</h2>
          <Button
            variant="ghost"
            size="sm"
            onClick={() => setShowVersionHistory(false)}
          >
            <X size={16} />
          </Button>
        </div>
        
        <div className="p-4 overflow-y-auto max-h-[calc(80vh-120px)]">
          {chapterVersions.length === 0 ? (
            <div className="text-center py-8 text-gray-500">
              <History size={48} className="mx-auto mb-4 text-gray-300" />
              <p>No version history available yet.</p>
              <p className="text-sm mt-1">Versions will appear here as you make changes.</p>
            </div>
          ) : (
            <div className="space-y-4">
              {chapterVersions.map((version, index) => (
                <div key={version.id} className="border rounded-lg p-4">
                  <div className="flex items-center justify-between mb-2">
                    <div className="flex items-center gap-2">
                      <span className="text-sm font-medium">
                        Version {version.version}
                        {index === 0 && <span className="ml-2 bg-green-100 text-green-800 px-2 py-1 rounded-full text-xs">Current</span>}
                      </span>
                      <span className="text-xs text-gray-500">
                        {new Date(version.createdAt).toLocaleString()}
                      </span>
                    </div>
                    {index !== 0 && (
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => restoreVersion(version.id, version.content)}
                        className="text-xs"
                      >
                        <RefreshCw size={12} className="mr-1" />
                        Restore
                      </Button>
                    )}
                  </div>
                  
                  <div className="bg-gray-50 rounded p-3 text-sm">
                    <div className="max-h-32 overflow-y-auto">
                      {version.content ? (
                        <pre className="whitespace-pre-wrap text-gray-700">
                          {version.content.length > 200 
                            ? version.content.substring(0, 200) + '...' 
                            : version.content
                          }
                        </pre>
                      ) : (
                        <span className="text-gray-400 italic">No content</span>
                      )}
                    </div>
                    <div className="mt-2 text-xs text-gray-500">
                      {version.content?.length || 0} characters
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );

  return (
    <>
      {showPreview && <BookPreview />}
      {showVersionHistory && <VersionHistoryModal />}
      {/* Main content */}
    <div className="w-full max-w-4xl mx-auto p-3 sm:p-4 space-y-4 sm:space-y-6">
      {/* Header */}
      <div className="text-center px-2">
        <h1 className="text-xl sm:text-2xl font-bold text-gray-900 mb-2">{state.bookTitle}</h1>
        <p className="text-sm text-gray-600">{state.bookConcept}</p>
        <Badge variant="outline" className="mt-2">{state.targetAge}</Badge>
        
        {/* Preview Button for Mobile */}
        <div className="mt-4 sm:hidden">
          <Button 
            onClick={() => setShowPreview(true)}
            variant="outline"
            size="sm"
            className="text-blue-600 border-blue-600 hover:bg-blue-50 w-full"
          >
            <BookOpen size={16} className="mr-2" />
            Preview Book
          </Button>
        </div>
      </div>

      {/* Progress Bar */}
      <div className="space-y-2">
        <div className="flex justify-between items-center">
          <span className="text-sm font-medium">Overall Progress</span>
          <span className="text-sm text-gray-500">{Math.round(progressPercentage)}% Complete</span>
        </div>
        <Progress value={progressPercentage} className="h-2" />
      </div>

      {/* Steps */}
      <div className="space-y-4">
        {state.steps.map((step) => {
          const status = getStepStatus(step);
          const isExpanded = expandedStep === step.stepNumber;
          const canApprove = (status === 'completed' || (status === 'in_progress' && step.data?.content)) && !isReadonly && step.stepNumber !== 6;
          const canRegenerate = (status === 'completed' || status === 'needs_revision') && !isReadonly && step.stepNumber !== 6;

          return (
            <Card key={step.stepNumber} className={`transition-all ${status === 'approved' ? 'bg-green-50 border-green-200' : ''}`}>
              <CardHeader 
                className="cursor-pointer" 
                onClick={() => setExpandedStep(isExpanded ? 0 : step.stepNumber)}
              >
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2 sm:gap-3 flex-1 min-w-0">
                    <div className={`p-1.5 sm:p-2 rounded-full ${STEP_COLORS[status as keyof typeof STEP_COLORS]} flex-shrink-0`}>
                      {getStepIcon(step.stepNumber, status)}
                    </div>
                    <div className="min-w-0 flex-1">
                      <h3 className="font-medium text-sm sm:text-base truncate">Step {step.stepNumber}: {step.stepName}</h3>
                      <p className="text-xs sm:text-sm text-gray-500 capitalize">{status.replace('_', ' ')}</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-1 sm:gap-2 flex-shrink-0">
                    {status === 'approved' && <CheckCircle className="w-4 h-4 sm:w-5 sm:h-5 text-green-600" />}
                    {isExpanded ? <ChevronDown className="w-4 h-4 sm:w-5 sm:h-5" /> : <ChevronRight className="w-4 h-4 sm:w-5 sm:h-5" />}
                  </div>
                </div>
              </CardHeader>

              {isExpanded && (
                <CardContent className="pt-0">
                  {/* Step Content */}
                  <div className="mb-4">
                    {renderStepContent(step)}
                  </div>

                  {/* Action Buttons */}
                  {(canApprove || canRegenerate) && (
                    <div className="border-t pt-4 space-y-3">
                      <div className="flex gap-2">
                        {canApprove && (
                          <>
                            <Button 
                              onClick={() => handleApprove(step.stepNumber, true)}
                              className="flex-1"
                            >
                              <CheckCircle className="w-4 h-4 mr-2" />
                              Approve & Continue
                            </Button>
                            <Button 
                              variant="outline" 
                              onClick={() => handleApprove(step.stepNumber, false)}
                            >
                              <Edit3 className="w-4 h-4 mr-2" />
                              Request Changes
                            </Button>
                          </>
                        )}
                        {canRegenerate && (
                          <Button 
                            variant="outline" 
                            onClick={() => onRegenerate(step.stepNumber)}
                          >
                            <RefreshCw className="w-4 h-4 mr-2" />
                            Regenerate
                          </Button>
                        )}
                      </div>

                      {/* Feedback Input */}
                      {showFeedback === step.stepNumber && (
                        <div className="space-y-2">
                          <Textarea
                            placeholder="Please provide specific feedback on what you'd like changed..."
                            value={feedback}
                            onChange={(e) => setFeedback(e.target.value)}
                            className="min-h-[80px]"
                          />
                          <div className="flex gap-2">
                            <Button 
                              onClick={() => handleApprove(step.stepNumber, false)}
                              disabled={!feedback.trim()}
                            >
                              Submit Feedback
                            </Button>
                            <Button 
                              variant="outline" 
                              onClick={() => {
                                setShowFeedback(null);
                                setFeedback('');
                              }}
                            >
                              Cancel
                            </Button>
                          </div>
                        </div>
                      )}
                    </div>
                  )}
                </CardContent>
              )}
            </Card>
          );
        })}
      </div>
    </div>
    </>
  );
}
