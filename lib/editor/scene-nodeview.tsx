import React from 'react';
import { createRoot, Root } from 'react-dom/client';
import { NodeView, EditorView } from 'prosemirror-view';
import { Node as ProseMirrorNode } from 'prosemirror-model';
import { createImageNodeView } from './image-nodeview';
import { BookContextProvider } from '@/components/book/book-context';
import { documentSchema } from './config';

export class SceneNodeView implements NodeView {
  dom: HTMLElement;
  contentDOM: HTMLElement;
  imageContainer: HTMLElement;
  node: ProseMirrorNode;
  view: EditorView;
  getPos: () => number | undefined;
  root?: Root;
  imageNodeView?: NodeView;
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

    // Create scene container
    this.dom = document.createElement('div');
    this.dom.className = 'scene-node-view';
    this.dom.setAttribute('data-scene-id', node.attrs.sceneId);
    this.dom.setAttribute('data-scene-number', node.attrs.sceneNumber?.toString() || '1');

    // Create scene header
    const header = document.createElement('div');
    header.className = 'scene-header';
    
    const headerContent = document.createElement('div');
    headerContent.className = 'scene-header-content';
    
    // Scene title
    const title = document.createElement('h3');
    title.className = 'scene-title';
    title.textContent = `Scene ${node.attrs.sceneNumber || 1}`;
    if (node.attrs.synopsis) {
      title.textContent += `: ${node.attrs.synopsis}`;
    }
    
    // Scene metadata
    const metadata = document.createElement('div');
    metadata.className = 'scene-metadata';
    if (node.attrs.environment) {
      const envSpan = document.createElement('span');
      envSpan.className = 'scene-environment';
      envSpan.textContent = `📍 ${node.attrs.environment}`;
      metadata.appendChild(envSpan);
    }
    if (node.attrs.characters && node.attrs.characters.length > 0) {
      const charSpan = document.createElement('span');
      charSpan.className = 'scene-characters';
      charSpan.textContent = `👥 ${node.attrs.characters.join(', ')}`;
      metadata.appendChild(charSpan);
    }

    headerContent.appendChild(title);
    headerContent.appendChild(metadata);
    header.appendChild(headerContent);

    // Create text content area (editable)
    this.contentDOM = document.createElement('div');
    this.contentDOM.className = 'scene-content';

    // Create image container (managed by us)
    this.imageContainer = document.createElement('div');
    this.imageContainer.className = 'scene-image-container';

    // Assemble the structure
    this.dom.appendChild(header);
    this.dom.appendChild(this.contentDOM);
    this.dom.appendChild(this.imageContainer);

    // Render image if present
    this.renderImage();
  }

  private renderImage() {
    if (this.isDestroyed) return;
    
    const { imageUrl, storyContext, synopsis, sceneId } = this.node.attrs;
    
    // Clear existing image
    if (this.imageNodeView) {
      if (this.imageNodeView.destroy) {
        this.imageNodeView.destroy();
      }
      this.imageNodeView = undefined;
    }
    this.imageContainer.innerHTML = '';
    
    if (imageUrl) {
      try {
        // Create image node for the scene
        const imageNode = documentSchema.nodes.image.create({
          src: imageUrl,
          alt: synopsis || `Scene ${this.node.attrs.sceneNumber}`,
          storyContext: storyContext,
          'data-scene-id': sceneId
        });
        
        // Create image nodeview
        this.imageNodeView = createImageNodeView(
          imageNode,
          this.view,
          () => undefined // Image position is managed by scene, not directly editable
        );
        
        this.imageContainer.appendChild(this.imageNodeView.dom);
        
        console.log(`[SceneNodeView] Rendered image for scene ${sceneId}`);
      } catch (error) {
        console.error('[SceneNodeView] Error rendering image:', error);
      }
    }
  }

  update(node: ProseMirrorNode): boolean {
    if (node.type !== this.node.type) {
      return false;
    }

    const oldImageUrl = this.node.attrs.imageUrl;
    const newImageUrl = node.attrs.imageUrl;
    
    this.node = node;
    
    // Update scene attributes
    this.dom.setAttribute('data-scene-id', node.attrs.sceneId);
    this.dom.setAttribute('data-scene-number', node.attrs.sceneNumber?.toString() || '1');
    
    // Re-render image if URL changed
    if (oldImageUrl !== newImageUrl) {
      this.renderImage();
    }
    
    // Update header content
    const title = this.dom.querySelector('.scene-title');
    if (title) {
      title.textContent = `Scene ${node.attrs.sceneNumber || 1}`;
      if (node.attrs.synopsis) {
        title.textContent += `: ${node.attrs.synopsis}`;
      }
    }
    
    // Update metadata
    const metadata = this.dom.querySelector('.scene-metadata');
    if (metadata) {
      metadata.innerHTML = '';
      if (node.attrs.environment) {
        const envSpan = document.createElement('span');
        envSpan.className = 'scene-environment';
        envSpan.textContent = `📍 ${node.attrs.environment}`;
        metadata.appendChild(envSpan);
      }
      if (node.attrs.characters && node.attrs.characters.length > 0) {
        const charSpan = document.createElement('span');
        charSpan.className = 'scene-characters';
        charSpan.textContent = `👥 ${node.attrs.characters.join(', ')}`;
        metadata.appendChild(charSpan);
      }
    }

    return true;
  }

  destroy() {
    this.isDestroyed = true;
    
    if (this.imageNodeView && this.imageNodeView.destroy) {
      this.imageNodeView.destroy();
    }
    
    if (this.root) {
      this.root.unmount();
    }
  }

  selectNode() {
    this.dom.classList.add('ProseMirror-selectednode');
  }

  deselectNode() {
    this.dom.classList.remove('ProseMirror-selectednode');
  }

  ignoreMutation(mutation: any): boolean {
    // Allow mutations to the content area, but ignore mutations to our managed image container
    if (mutation.type === 'selection') {
      return false;
    }
    return mutation.target === this.imageContainer || 
           this.imageContainer.contains(mutation.target as Node) ||
           mutation.target === this.dom.querySelector('.scene-header') ||
           (this.dom.querySelector('.scene-header')?.contains(mutation.target as Node) ?? false);
  }
}

// Factory function to create the Scene NodeView
export function createSceneNodeView(
  node: ProseMirrorNode,
  view: EditorView,
  getPos: () => number | undefined,
  decorations?: any,
  innerDecorations?: any
) {
  return new SceneNodeView(node, view, getPos, decorations, innerDecorations);
}
