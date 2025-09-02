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

const nodesWithImage = schema.spec.nodes.append({ image: imageNode });

export const documentSchema = new Schema({
  nodes: addListNodes(nodesWithImage, 'paragraph block*', 'block'),
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
