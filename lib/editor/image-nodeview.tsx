import React from 'react';
import { createRoot, Root } from 'react-dom/client';
import { NodeView, EditorView } from 'prosemirror-view';
import { Node as ProseMirrorNode } from 'prosemirror-model';
import { ImageVideoOverlay } from '@/components/book/image-video-overlay';
import { BookContextProvider } from '@/components/book/book-context';

export class ImageNodeView implements NodeView {
  dom: HTMLElement;
  contentDOM?: HTMLElement;
  node: ProseMirrorNode;
  view: EditorView;
  getPos: () => number | undefined;
  root: Root;
  isDestroyed: boolean = false;

  constructor(
    node: ProseMirrorNode,
    view: EditorView,
    getPos: () => number | undefined,
    decorations?: any,
    innerDecorations?: any
  ) {
    this.node = node;
    this.view = view;
    this.getPos = getPos;

    // Create the DOM structure
    this.dom = document.createElement('div');
    this.dom.className = 'image-node-view';
    this.dom.style.position = 'relative';
    this.dom.style.display = 'inline-block';
    this.dom.style.maxWidth = '100%';

    // Check if this is a full-page image context
    const isFullPage = this.isInFullPageContext();

    if (isFullPage) {
      this.dom.className = 'image-node-view image-node-view-fullpage';
      this.dom.style.width = '100%';
      this.dom.style.height = '100%';
      this.dom.style.display = 'block';
    }

    // Create React root and render the component
    this.root = createRoot(this.dom);
    this.renderComponent();
  }

  private isInFullPageContext(): boolean {
    // Check if the parent has full-page styling classes
    let parent = this.dom.parentElement;
    while (parent) {
      if (parent.classList.contains('prose') &&
          parent.classList.contains('flex') && 
          parent.classList.contains('items-center') && 
          parent.classList.contains('justify-center')) {
        return true;
      }
      parent = parent.parentElement;
    }
    
    // Also check the ProseMirror editor's parent
    let editorParent = this.view.dom.parentElement;
    while (editorParent) {
      if (editorParent.classList.contains('prose') &&
          editorParent.classList.contains('flex') && 
          editorParent.classList.contains('items-center') && 
          editorParent.classList.contains('justify-center')) {
        return true;
      }
      editorParent = editorParent.parentElement;
    }
    
    return false;
  }

  private renderComponent() {
    if (this.isDestroyed) return;
    
    const { src, alt, width, height, videoUrl, storyContext: savedStoryContext } = this.node.attrs;
    const isFullPage = this.isInFullPageContext();

    // Try to get current story context from the parent BookContextProvider
    // Look for the parent editor container that has the story context
    let currentStoryContext = savedStoryContext;
    
    // Walk up the DOM tree to find the editor container with data-story-context
    let parentElement = this.view.dom.parentElement;
    while (parentElement && !currentStoryContext) {
      const contextData = parentElement.getAttribute('data-story-context');
      if (contextData) {
        currentStoryContext = contextData;
        break;
      }
      parentElement = parentElement.parentElement;
    }

    console.log('[ImageNodeView] Story context available:', currentStoryContext ? 'YES' : 'NO');

    try {
      this.root.render(
        <BookContextProvider isFullPageImage={isFullPage} storyContext={currentStoryContext}>
          <ImageVideoOverlay
            imageSrc={src}
            imageAlt={alt || ''}
            isFullPage={isFullPage}
            initialVideoUrl={videoUrl}
            storyContext={currentStoryContext} // Pass as direct prop
            onVideoGenerated={(newVideoUrl) => {
              // Update the node attributes to include the video URL and current story context
              if (!this.isDestroyed) {
                this.updateNodeAttrs({ 
                  videoUrl: newVideoUrl,
                  storyContext: currentStoryContext // Save the story context that was used for generation
                });
              }
            }}
          />
        </BookContextProvider>
      );
    } catch (error) {
      console.warn('Error rendering ImageNodeView component:', error);
    }
  }

  private updateNodeAttrs(newAttrs: Record<string, any>) {
    const pos = this.getPos();
    if (pos === undefined) return;

    const tr = this.view.state.tr.setNodeMarkup(
      pos,
      null,
      { ...this.node.attrs, ...newAttrs }
    );
    
    // Ensure the transaction triggers a save by marking it as a document change
    tr.setMeta('no-debounce', true); // Save immediately for important updates like video URL
    
    console.log('[ImageNodeView] Updating node attributes:', newAttrs);
    this.view.dispatch(tr);
  }

  update(node: ProseMirrorNode) {
    if (this.isDestroyed) return false;
    if (node.type !== this.node.type) return false;
    
    this.node = node;
    this.renderComponent();
    return true;
  }

  destroy() {
    if (this.isDestroyed) return;
    this.isDestroyed = true;
    
    if (this.root) {
      // Use requestAnimationFrame to defer unmount to avoid race conditions
      requestAnimationFrame(() => {
        if (this.root) {
          try {
            this.root.unmount();
          } catch (error) {
            // Ignore unmount errors during cleanup
            console.warn('Error during React root unmount:', error);
          }
        }
      });
    }
  }

  stopEvent(event: Event): boolean {
    // Allow mouse events to pass through to our React component
    return true;
  }

  ignoreMutation(): boolean {
    // Ignore mutations within our React component
    return true;
  }
}

// Factory function to create the NodeView
export function createImageNodeView(
  node: ProseMirrorNode,
  view: EditorView,
  getPos: () => number | undefined,
  decorations?: any,
  innerDecorations?: any
) {
  return new ImageNodeView(node, view, getPos, decorations, innerDecorations);
}
