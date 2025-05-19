'use server';

import { getSuggestionsByDocumentId } from '@/lib/db/queries';

export async function getSuggestions({ documentId }: { documentId: string }) {
  try {
    const suggestions = await getSuggestionsByDocumentId({ documentId });
    return suggestions ?? [];
  } catch (error) {
    console.error('Error fetching suggestions:', error);
    return [];
  }
}

export async function applySuggestion({
  documentId,
  suggestionId,
}: {
  documentId: string;
  suggestionId: string;
}) {
  try {
    // This would typically update the suggestion status in your database
    // Marking it as resolved/applied
    // For now we'll just return success
    return { success: true, suggestionId };
  } catch (error) {
    console.error('Error applying suggestion:', error);
    return { success: false, error: 'Failed to apply suggestion' };
  }
}
