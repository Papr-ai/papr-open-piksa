'use client';

import { EditorView } from '@codemirror/view';
import { EditorState } from '@codemirror/state';
import { Transaction } from '@codemirror/state';
import { python } from '@codemirror/lang-python';
import { oneDark } from '@codemirror/theme-one-dark';
import { basicSetup } from 'codemirror';
import React, { memo, useEffect, useRef } from 'react';
import type { Suggestion } from '@/lib/db/schema';

type EditorProps = {
  content: string;
  onSaveContent: (updatedContent: string, debounce: boolean) => void;
  status: 'streaming' | 'idle';
  isCurrentVersion: boolean;
  currentVersionIndex: number;
  suggestions: Array<Suggestion>;
};

function PureCodeEditor({ content, onSaveContent, status }: EditorProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const editorRef = useRef<EditorView | null>(null);

  useEffect(() => {
    if (containerRef.current && !editorRef.current) {
      console.log('[CODE EDITOR] Initializing editor with content:', {
        contentLength: content?.length || 0,
        preview: content?.substring?.(0, 50) || 'empty',
      });

      // Ensure we have valid content to start with
      const initialContent = typeof content === 'string' ? content : '';

      // Add a placeholder to make the editor visible
      const startState = EditorState.create({
        doc: initialContent || '# Generated content',
        extensions: [basicSetup, python(), oneDark],
      });

      editorRef.current = new EditorView({
        state: startState,
        parent: containerRef.current,
      });

      // Force a layout update after mounting
      setTimeout(() => {
        if (editorRef.current) {
          editorRef.current.requestMeasure();
        }
      }, 50);
    }

    return () => {
      if (editorRef.current) {
        console.log('[CODE EDITOR] Destroying editor');
        editorRef.current.destroy();
        editorRef.current = null;
      }
    };
    // NOTE: we only want to run this effect once
    // eslint-disable-next-line
  }, []);

  useEffect(() => {
    if (editorRef.current) {
      const updateListener = EditorView.updateListener.of((update) => {
        if (update.docChanged) {
          const transaction = update.transactions.find(
            (tr) => !tr.annotation(Transaction.remote),
          );

          if (transaction) {
            const newContent = update.state.doc.toString();
            onSaveContent(newContent, true);
          }
        }
      });

      const currentSelection = editorRef.current.state.selection;

      const newState = EditorState.create({
        doc: editorRef.current.state.doc,
        extensions: [basicSetup, python(), oneDark, updateListener],
        selection: currentSelection,
      });

      editorRef.current.setState(newState);
    }
  }, [onSaveContent]);

  useEffect(() => {
    if (editorRef.current) {
      try {
        // Log for debugging
        console.log('[CODE EDITOR] Content update triggered:', {
          hasEditor: !!editorRef.current,
          contentLength: content?.length || 0,
          status,
          preview: content?.substring?.(0, 50) || 'empty',
        });

        // Create a sanitized version of the content to avoid issues
        const sanitizedContent = typeof content === 'string' ? content : '';
        if (!sanitizedContent && status !== 'streaming') {
          console.log('[CODE EDITOR] Empty content, skipping update');
          return;
        }

        const currentContent = editorRef.current.state.doc.toString();

        // Make sure we apply empty content updates when streaming (to clear placeholder)
        const shouldUpdateForStreaming = status === 'streaming';

        // Only update if the content is different or if we're streaming
        if (shouldUpdateForStreaming || currentContent !== sanitizedContent) {
          console.log('[CODE EDITOR] Updating editor with new content', {
            currentLength: currentContent.length,
            newLength: sanitizedContent.length,
            isStreaming: status === 'streaming',
            contentChanged: currentContent !== sanitizedContent,
          });

          // Create a transaction to update the content
          const transaction = editorRef.current.state.update({
            changes: {
              from: 0,
              to: currentContent.length,
              insert: sanitizedContent,
            },
            annotations: [Transaction.remote.of(true)],
          });

          // Apply the transaction
          editorRef.current.dispatch(transaction);

          // Force layout update to ensure content is visible
          setTimeout(() => {
            if (editorRef.current) {
              console.log('[CODE EDITOR] Forcing layout update');
              editorRef.current.requestMeasure();
            }
          }, 50);
        } else {
          console.log('[CODE EDITOR] Content unchanged, skipping update');
        }
      } catch (error) {
        console.error('[CODE EDITOR] Error updating editor:', error);
      }
    } else {
      console.log('[CODE EDITOR] No editor ref available for content update');
    }
  }, [content, status]);

  return (
    <div
      className="relative not-prose w-full pb-[calc(80dvh)] text-sm"
      ref={containerRef}
    />
  );
}

function areEqual(prevProps: EditorProps, nextProps: EditorProps) {
  if (prevProps.suggestions !== nextProps.suggestions) return false;
  if (prevProps.currentVersionIndex !== nextProps.currentVersionIndex)
    return false;
  if (prevProps.isCurrentVersion !== nextProps.isCurrentVersion) return false;
  if (prevProps.status === 'streaming' && nextProps.status === 'streaming')
    return false;
  if (prevProps.content !== nextProps.content) return false;

  return true;
}

export const CodeEditor = memo(PureCodeEditor, areEqual);
