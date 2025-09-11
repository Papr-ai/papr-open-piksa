import { textblockTypeInputRule } from 'prosemirror-inputrules';
import { Schema, type NodeSpec, type DOMOutputSpec } from 'prosemirror-model';
import { schema } from 'prosemirror-schema-basic';
import { addListNodes } from 'prosemirror-schema-list';
import type { Transaction } from 'prosemirror-state';
import type { EditorView } from 'prosemirror-view';
import type { MutableRefObject } from 'react';

import { buildContentFromDocument } from './functions';

// Add image node to the schema with video support
const imageNode: NodeSpec = {
  attrs: {
    src: {},
    alt: { default: null },
    title: { default: null },
    width: { default: null },
    height: { default: null },
    videoUrl: { default: null }, // For generated videos
    storyContext: { default: null }, // For video generation context
  },
  group: 'inline',
  inline: true,
  draggable: true,
  parseDOM: [
    {
      tag: 'img[src]',
      getAttrs(dom: HTMLElement) {
        return {
          src: dom.getAttribute('src'),
          alt: dom.getAttribute('alt'),
          title: dom.getAttribute('title'),
          width: dom.getAttribute('width'),
          height: dom.getAttribute('height'),
          videoUrl: dom.getAttribute('data-video-url'),
          storyContext: dom.getAttribute('data-story-context'),
        };
      },
    },
  ],
  toDOM(node: any): DOMOutputSpec {
    const attrs: any = {
      src: node.attrs.src,
      alt: node.attrs.alt,
      title: node.attrs.title,
    };
    
    if (node.attrs.width) attrs.width = node.attrs.width;
    if (node.attrs.height) attrs.height = node.attrs.height;
    if (node.attrs.videoUrl) attrs['data-video-url'] = node.attrs.videoUrl;
    if (node.attrs.storyContext) attrs['data-story-context'] = node.attrs.storyContext;
    
    return ['img', attrs];
  },
};

// Add scene node to the schema
const sceneNode: NodeSpec = {
  attrs: {
    sceneId: {},
    sceneNumber: { default: 1 },
    synopsis: { default: null },
    imageUrl: { default: null },
    storyContext: { default: null },
    environment: { default: null },
    characters: { default: [] }
  },
  content: 'block*', // Can contain paragraphs, etc.
  group: 'block',
  draggable: true,
  parseDOM: [{
    tag: 'div[data-scene-id]',
    getAttrs(dom: HTMLElement) {
      const charactersStr = dom.getAttribute('data-characters');
      let characters = [];
      try {
        characters = charactersStr ? JSON.parse(charactersStr) : [];
      } catch (e) {
        console.warn('Failed to parse scene characters:', e);
        characters = [];
      }
      
      return {
        sceneId: dom.getAttribute('data-scene-id'),
        sceneNumber: parseInt(dom.getAttribute('data-scene-number') || '1'),
        synopsis: dom.getAttribute('data-synopsis'),
        imageUrl: dom.getAttribute('data-image-url'),
        storyContext: dom.getAttribute('data-story-context'),
        environment: dom.getAttribute('data-environment'),
        characters
      };
    }
  }],
  toDOM(node: any): DOMOutputSpec {
    const attrs: any = {
      'data-scene-id': node.attrs.sceneId,
      'data-scene-number': node.attrs.sceneNumber?.toString() || '1',
      'class': 'scene-block'
    };
    
    if (node.attrs.synopsis) attrs['data-synopsis'] = node.attrs.synopsis;
    if (node.attrs.imageUrl) attrs['data-image-url'] = node.attrs.imageUrl;
    if (node.attrs.storyContext) attrs['data-story-context'] = node.attrs.storyContext;
    if (node.attrs.environment) attrs['data-environment'] = node.attrs.environment;
    if (node.attrs.characters && node.attrs.characters.length > 0) {
      attrs['data-characters'] = JSON.stringify(node.attrs.characters);
    }
    
    return ['div', attrs, 0]; // 0 means content goes here
  }
};

const nodesWithImageAndScene = schema.spec.nodes.append({ 
  image: imageNode,
  scene: sceneNode
});

export const documentSchema = new Schema({
  nodes: addListNodes(nodesWithImageAndScene, 'paragraph block*', 'block'),
  marks: schema.spec.marks,
});

export function headingRule(level: number) {
  return textblockTypeInputRule(
    new RegExp(`^(#{1,${level}})\\s$`),
    documentSchema.nodes.heading,
    () => ({ level }),
  );
}

export const handleTransaction = ({
  transaction,
  editorRef,
  onSaveContent,
}: {
  transaction: Transaction;
  editorRef: MutableRefObject<EditorView | null>;
  onSaveContent: (updatedContent: string, debounce: boolean) => void;
}) => {
  if (!editorRef || !editorRef.current) return;

  const newState = editorRef.current.state.apply(transaction);
  editorRef.current.updateState(newState);

  if (transaction.docChanged && !transaction.getMeta('no-save')) {
    const updatedContent = buildContentFromDocument(newState.doc);

    if (transaction.getMeta('no-debounce')) {
      onSaveContent(updatedContent, false);
    } else {
      onSaveContent(updatedContent, true);
    }
  }
};
