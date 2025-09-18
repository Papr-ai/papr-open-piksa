import { createDocumentHandler } from '@/lib/artifacts/server';
import type { BookArtifactState } from '@/lib/ai/tools/book-creation-constants';

export const bookCreationDocumentHandler = createDocumentHandler<'book-creation'>({
  kind: 'book-creation',
  onCreateDocument: async ({ title, dataStream }) => {
    console.log('[BookCreationDocumentHandler] 📄 onCreateDocument called with title:', title);
    
    // Initialize with empty book creation state
    const initialState: BookArtifactState = {
      bookId: '',
      bookTitle: title || 'New Book',
      bookConcept: '',
      targetAge: '3-8 years',
      currentStep: 1,
      steps: [],
      createdAt: new Date(),
      updatedAt: new Date()
    };

    // Send initial content
    const initialContent = JSON.stringify(initialState);
    
    console.log('[BookCreationDocumentHandler] 📡 Sending book-creation-state event:', initialState);
    dataStream.write?.({
      type: 'book-creation-state',
      content: initialState,
    });

    console.log('[BookCreationDocumentHandler] 📄 Returning initial content, length:', initialContent.length);
    return initialContent;
  },
  onUpdateDocument: async ({ document, description, dataStream }) => {
    // For updates, we'll let the createBookArtifact tool handle the logic
    // This is just a placeholder to satisfy the document handler interface
    return document.content || '';
  },
});
