import { Plugin } from 'prosemirror-state';
import type { EditorView } from 'prosemirror-view';
import { documentSchema } from './config';

/**
 * Upload an image file to Vercel Blob storage
 */
async function uploadImageToBlob(file: File): Promise<string | null> {
  try {
    const formData = new FormData();
    formData.append('file', file);

    const response = await fetch('/api/files/upload', {
      method: 'POST',
      body: formData,
    });

    if (response.ok) {
      const data = await response.json();
      return data.url;
    } else {
      console.error('Failed to upload image:', await response.text());
      return null;
    }
  } catch (error) {
    console.error('Error uploading image:', error);
    return null;
  }
}

/**
 * Convert a blob URL or base64 data URL to a File object
 */
async function urlToFile(url: string, filename: string = 'pasted-image.png'): Promise<File | null> {
  try {
    const response = await fetch(url);
    const blob = await response.blob();
    return new File([blob], filename, { type: blob.type });
  } catch (error) {
    console.error('Error converting URL to file:', error);
    return null;
  }
}

/**
 * Handle image paste events and upload to Vercel Blob
 */
function handleImagePaste(view: EditorView, event: ClipboardEvent): boolean {
  const items = event.clipboardData?.items;
  if (!items) return false;

  for (let i = 0; i < items.length; i++) {
    const item = items[i];
    
    if (item.type.indexOf('image') === 0) {
      event.preventDefault();
      
      const file = item.getAsFile();
      if (!file) continue;

      // Show loading placeholder
      const { state, dispatch } = view;
      const { selection } = state;
      const loadingNode = documentSchema.text('🔄 Uploading image...');
      const tr = state.tr.replaceSelectionWith(loadingNode);
      dispatch(tr);

      // Upload image and replace placeholder
      uploadImageToBlob(file).then((url) => {
        if (url) {
          const imageNode = documentSchema.nodes.image.create({
            src: url,
            alt: file.name,
          });
          
          // Replace the loading text with the image
          const currentState = view.state;
          const pos = currentState.selection.from - loadingNode.nodeSize;
          const replaceTr = currentState.tr
            .delete(pos, pos + loadingNode.nodeSize)
            .insert(pos, imageNode);
          
          view.dispatch(replaceTr);
        } else {
          // Replace loading text with error message
          const currentState = view.state;
          const pos = currentState.selection.from - loadingNode.nodeSize;
          const errorNode = documentSchema.text('❌ Failed to upload image');
          const replaceTr = currentState.tr
            .delete(pos, pos + loadingNode.nodeSize)
            .insert(pos, errorNode);
          
          view.dispatch(replaceTr);
        }
      });

      return true;
    }
  }

  return false;
}

/**
 * Handle image drops and upload to Vercel Blob
 */
function handleImageDrop(view: EditorView, event: DragEvent): boolean {
  const files = event.dataTransfer?.files;
  if (!files || files.length === 0) return false;

  for (let i = 0; i < files.length; i++) {
    const file = files[i];
    
    if (file.type.indexOf('image') === 0) {
      event.preventDefault();
      
      // Get drop position
      const pos = view.posAtCoords({ left: event.clientX, top: event.clientY });
      if (!pos) continue;

      // Show loading placeholder
      const { state, dispatch } = view;
      const loadingNode = documentSchema.text('🔄 Uploading image...');
      const tr = state.tr.insert(pos.pos, loadingNode);
      dispatch(tr);

      // Upload image and replace placeholder
      uploadImageToBlob(file).then((url) => {
        if (url) {
          const imageNode = documentSchema.nodes.image.create({
            src: url,
            alt: file.name,
          });
          
          // Replace the loading text with the image
          const currentState = view.state;
          const replaceTr = currentState.tr
            .delete(pos.pos, pos.pos + loadingNode.nodeSize)
            .insert(pos.pos, imageNode);
          
          view.dispatch(replaceTr);
        } else {
          // Replace loading text with error message
          const currentState = view.state;
          const errorNode = documentSchema.text('❌ Failed to upload image');
          const replaceTr = currentState.tr
            .delete(pos.pos, pos.pos + loadingNode.nodeSize)
            .insert(pos.pos, errorNode);
          
          view.dispatch(replaceTr);
        }
      });

      return true;
    }
  }

  return false;
}

/**
 * Plugin to handle image paste and drop events
 */
export const imageHandlerPlugin = new Plugin({
  props: {
    handlePaste(view, event) {
      return handleImagePaste(view, event);
    },
    handleDrop(view, event) {
      return handleImageDrop(view, event);
    },
  },
});
