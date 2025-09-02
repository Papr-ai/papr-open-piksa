'use client';

import { exampleSetup } from 'prosemirror-example-setup';
import { inputRules } from 'prosemirror-inputrules';
import { EditorState } from 'prosemirror-state';
import { EditorView } from 'prosemirror-view';
import React, { memo, useEffect, useRef } from 'react';

import type { Suggestion } from '@/lib/db/schema';
import {
  documentSchema,
  handleTransaction,
  headingRule,
} from '@/lib/editor/config';
import {
  buildContentFromDocument,
  buildDocumentFromContent,
  createDecorations,
} from '@/lib/editor/functions';
import {
  projectWithPositions,
  suggestionsPlugin,
  suggestionsPluginKey,
} from '@/lib/editor/suggestions';
import { imageHandlerPlugin } from '@/lib/editor/image-handler';
import { createImageNodeView } from '@/lib/editor/image-nodeview';

type EditorProps = {
  content: string;
  onSaveContent: (updatedContent: string, debounce: boolean) => void;
  status: 'streaming' | 'idle';
  isCurrentVersion: boolean;
  currentVersionIndex: number;
  suggestions: Array<Suggestion>;
  storyContext?: string; // Add story context prop
};

function PureEditor({
  content,
  onSaveContent,
  suggestions,
  status,
  storyContext,
}: EditorProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const editorRef = useRef<EditorView | null>(null);

  useEffect(() => {
    if (containerRef.current && !editorRef.current) {
      const state = EditorState.create({
        doc: buildDocumentFromContent(content),
        plugins: [
          ...exampleSetup({ schema: documentSchema, menuBar: false }),
          inputRules({
            rules: [
              headingRule(1),
              headingRule(2),
              headingRule(3),
              headingRule(4),
              headingRule(5),
              headingRule(6),
            ],
          }),
          suggestionsPlugin,
          imageHandlerPlugin,
        ],
      });

      editorRef.current = new EditorView(containerRef.current, {
        state,
        nodeViews: {
          image: createImageNodeView as any,
        },
      });
    }

    return () => {
      if (editorRef.current) {
        editorRef.current.destroy();
        editorRef.current = null;
      }
    };
    // NOTE: we only want to run this effect once
    // eslint-disable-next-line
  }, []);

  useEffect(() => {
    if (editorRef.current) {
      editorRef.current.setProps({
        dispatchTransaction: (transaction) => {
          handleTransaction({
            transaction,
            editorRef,
            onSaveContent,
          });
        },
      });
    }
  }, [onSaveContent]);

  useEffect(() => {
    if (editorRef.current && content) {
      const currentContent = buildContentFromDocument(
        editorRef.current.state.doc,
      );

      if (status === 'streaming') {
        const newDocument = buildDocumentFromContent(content);

        const transaction = editorRef.current.state.tr.replaceWith(
          0,
          editorRef.current.state.doc.content.size,
          newDocument.content,
        );

        transaction.setMeta('no-save', true);
        editorRef.current.dispatch(transaction);
        return;
      }

      if (currentContent !== content) {
        const newDocument = buildDocumentFromContent(content);

        const transaction = editorRef.current.state.tr.replaceWith(
          0,
          editorRef.current.state.doc.content.size,
          newDocument.content,
        );

        transaction.setMeta('no-save', true);
        editorRef.current.dispatch(transaction);
      }
    }
  }, [content, status]);

  useEffect(() => {
    if (editorRef.current?.state.doc && content) {
      try {
        // Ensure we have valid suggestions data
        const validSuggestions = Array.isArray(suggestions) ? suggestions : [];

        // Project suggestions onto the document and filter out invalid ones
        const projectedSuggestions = projectWithPositions(
          editorRef.current.state.doc,
          validSuggestions,
        ).filter(
          (suggestion) =>
            !!suggestion?.selectionStart &&
            !!suggestion?.selectionEnd &&
            suggestion.selectionStart < suggestion.selectionEnd,
        );

        // Create decorations for valid suggestions
        const decorations = createDecorations(
          projectedSuggestions,
          editorRef.current,
        );

        // Apply decorations to the editor
        const transaction = editorRef.current.state.tr;
        transaction.setMeta(suggestionsPluginKey, { decorations });
        editorRef.current.dispatch(transaction);
      } catch (error) {
        console.error('Error applying suggestions to editor:', error);
      }
    }
  }, [suggestions, content]);

  return (
    <div 
      className="relative w-full h-full prose dark:prose-invert" 
      ref={containerRef} 
      data-story-context={storyContext} // Add story context as data attribute
    />
  );
}

function areEqual(prevProps: EditorProps, nextProps: EditorProps) {
  return (
    prevProps.suggestions === nextProps.suggestions &&
    prevProps.currentVersionIndex === nextProps.currentVersionIndex &&
    prevProps.isCurrentVersion === nextProps.isCurrentVersion &&
    !(prevProps.status === 'streaming' && nextProps.status === 'streaming') &&
    prevProps.content === nextProps.content &&
    prevProps.onSaveContent === nextProps.onSaveContent &&
    prevProps.storyContext === nextProps.storyContext
  );
}

export const Editor = memo(PureEditor, areEqual);
