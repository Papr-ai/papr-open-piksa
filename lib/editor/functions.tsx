'use client';

import { defaultMarkdownSerializer, MarkdownSerializer } from 'prosemirror-markdown';
import { DOMParser, type Node } from 'prosemirror-model';
import { Decoration, DecorationSet, type EditorView } from 'prosemirror-view';
import { renderToString } from 'react-dom/server';

import { Markdown } from '@/components/common/markdown';

import { documentSchema } from './config';
import { createSuggestionWidget, type UISuggestion } from './suggestions';

export const buildDocumentFromContent = (content: string) => {
  const parser = DOMParser.fromSchema(documentSchema);
  
  // First, extract image attributes from HTML comments before rendering
  const imageWithCommentsRegex = /!\[([^\]]*)\]\(([^)]+)\)(\s*<!--\s*videoUrl:\s*([^>]+)\s*-->)?(\s*<!--\s*storyContext:\s*([^>]+)\s*-->)?/g;
  let match;
  const imageAttributes: Array<{src: string, videoUrl?: string, storyContext?: string}> = [];
  
  while ((match = imageWithCommentsRegex.exec(content)) !== null) {
    const [, alt, src, , videoUrl, , storyContextEncoded] = match;
    
    let storyContext;
    if (storyContextEncoded) {
      try {
        storyContext = Buffer.from(storyContextEncoded.trim(), 'base64').toString();
      } catch (e) {
        console.warn('Failed to decode story context:', e);
      }
    }
    
    imageAttributes.push({
      src: src.trim(),
      videoUrl: videoUrl?.trim(),
      storyContext
    });
  }
  
  // Remove HTML comments from content before rendering to avoid them being displayed as text
  const cleanContent = content.replace(/<!--\s*videoUrl:\s*[^>]+\s*-->/g, '').replace(/<!--\s*storyContext:\s*[^>]+\s*-->/g, '');
  
  // Render the cleaned markdown
  const stringFromMarkdown = renderToString(<Markdown>{cleanContent}</Markdown>);
  const tempContainer = document.createElement('div');
  tempContainer.innerHTML = stringFromMarkdown;
  
  // Apply the attributes to the parsed images
  const images = tempContainer.querySelectorAll('img');
  images.forEach((img, index) => {
    const attrs = imageAttributes.find(attr => attr.src === img.getAttribute('src'));
    if (attrs) {
      if (attrs.videoUrl) {
        img.setAttribute('data-video-url', attrs.videoUrl);
      }
      if (attrs.storyContext) {
        img.setAttribute('data-story-context', attrs.storyContext);
      }
    }
  });
  
  return parser.parse(tempContainer);
};

// Create a custom serializer that handles our enhanced image nodes
const customMarkdownSerializer = new MarkdownSerializer(
  {
    // Use all default node serializers
    ...defaultMarkdownSerializer.nodes,
    // Override the image serializer to handle videoUrl and storyContext
    image(state, node) {
      const { src, alt, title, videoUrl, storyContext } = node.attrs;
      let markdown = `![${alt || ''}](${src}`;
      
      if (title) {
        markdown += ` "${title}"`;
      }
      
      markdown += ')';
      
      // Add custom attributes as HTML comments for persistence
      if (videoUrl) {
        markdown += `<!-- videoUrl: ${videoUrl} -->`;
      }
      
      if (storyContext) {
        // Encode story context to avoid markdown conflicts
        const encodedContext = Buffer.from(storyContext).toString('base64');
        markdown += `<!-- storyContext: ${encodedContext} -->`;
      }
      
      state.write(markdown);
    },
  },
  // Use all default mark serializers
  defaultMarkdownSerializer.marks
);

export const buildContentFromDocument = (document: Node) => {
  return customMarkdownSerializer.serialize(document);
};

export const createDecorations = (
  suggestions: Array<UISuggestion>,
  view: EditorView,
) => {
  const decorations: Array<Decoration> = [];

  for (const suggestion of suggestions) {
    decorations.push(
      Decoration.inline(
        suggestion.selectionStart,
        suggestion.selectionEnd,
        {
          class: 'suggestion-highlight',
        },
        {
          suggestionId: suggestion.id,
          type: 'highlight',
        },
      ),
    );

    decorations.push(
      Decoration.widget(
        suggestion.selectionStart,
        (view) => {
          const { dom } = createSuggestionWidget(suggestion, view);
          return dom;
        },
        {
          suggestionId: suggestion.id,
          type: 'widget',
        },
      ),
    );
  }

  return DecorationSet.create(view.state.doc, decorations);
};
