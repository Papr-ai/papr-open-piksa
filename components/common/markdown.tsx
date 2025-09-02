import Link from 'next/link';
import React, { memo, useRef, useEffect } from 'react';
import ReactMarkdown, { type Components } from 'react-markdown';
import remarkGfm from 'remark-gfm';
import { CodeBlock } from '../editor/code-block';

const components: Partial<Components> = {
  // @ts-expect-error
  code: CodeBlock,
  pre: ({ children }) => <>{children}</>,
  ol: ({ node, children, ...props }) => {
    return (
      <ol className="list-decimal list-outside ml-4" {...props}>
        {children}
      </ol>
    );
  },
  li: ({ node, children, ...props }) => {
    return (
      <li className="py-1" {...props}>
        {children}
      </li>
    );
  },
  ul: ({ node, children, ...props }) => {
    return (
      <ul className="list-decimal list-outside ml-4" {...props}>
        {children}
      </ul>
    );
  },
  strong: ({ node, children, ...props }) => {
    return (
      <span className="font-semibold" {...props}>
        {children}
      </span>
    );
  },
  a: ({ node, children, ...props }) => {
    return (
      // @ts-expect-error
      <Link
        className="text-blue-500 hover:underline"
        target="_blank"
        rel="noreferrer"
        {...props}
      >
        {children}
      </Link>
    );
  },
  h1: ({ node, children, ...props }) => {
    return (
      <h1 className="text-3xl font-semibold mt-6 mb-2" {...props}>
        {children}
      </h1>
    );
  },
  h2: ({ node, children, ...props }) => {
    return (
      <h2 className="text-2xl font-semibold mt-6 mb-2" {...props}>
        {children}
      </h2>
    );
  },
  h3: ({ node, children, ...props }) => {
    return (
      <h3 className="text-xl font-semibold mt-6 mb-2" {...props}>
        {children}
      </h3>
    );
  },
  h4: ({ node, children, ...props }) => {
    return (
      <h4 className="text-lg font-semibold mt-6 mb-2" {...props}>
        {children}
      </h4>
    );
  },
  h5: ({ node, children, ...props }) => {
    return (
      <h5 className="text-base font-semibold mt-6 mb-2" {...props}>
        {children}
      </h5>
    );
  },
  h6: ({ node, children, ...props }) => {
    return (
      <h6 className="text-sm font-semibold mt-6 mb-2" {...props}>
        {children}
      </h6>
    );
  },
  img: ({ node, src, alt, ...props }) => {
    // Handle empty, null, or invalid src attributes to prevent browser errors
    if (!src || src.trim() === '') {
      return (
        <div className="bg-gray-100 border border-gray-300 rounded p-4 text-center text-gray-500">
          <span>Image not available</span>
          {alt && <div className="text-sm mt-1">{alt}</div>}
        </div>
      );
    }
    
    return (
      // eslint-disable-next-line @next/next/no-img-element
      <img
        src={src}
        alt={alt || ''}
        className="max-w-full h-auto rounded book-image"
        {...props}
        onLoad={(e) => {
          // Check if this image is in a full-page context after it loads
          const target = e.target as HTMLImageElement;
          const parent = target.closest('.prose');
          const isFullPage = parent?.classList.contains('flex') && 
                            parent?.classList.contains('items-center') && 
                            parent?.classList.contains('justify-center');
          
          if (isFullPage) {
            // Apply true full-page styling - cover entire page
            target.style.maxWidth = '100%';
            target.style.maxHeight = '100%';
            target.style.width = '100%';
            target.style.height = '100%';
            target.style.objectFit = 'cover';
            target.style.borderRadius = '0';
            target.style.margin = '0';
            target.style.padding = '0';
            target.style.display = 'block';
            target.classList.add('book-fullpage-image');
          }
        }}
        onError={(e) => {
          // Handle broken image URLs
          const target = e.target as HTMLImageElement;
          target.style.display = 'none';
          const placeholder = document.createElement('div');
          placeholder.className = 'bg-gray-100 border border-gray-300 rounded p-4 text-center text-gray-500';
          placeholder.innerHTML = `
            <span>Image failed to load</span>
            ${alt ? `<div class="text-sm mt-1">${alt}</div>` : ''}
          `;
          target.parentNode?.insertBefore(placeholder, target);
        }}
      />
    );
  },
};

const remarkPlugins = [remarkGfm];

const NonMemoizedMarkdown = ({ children }: { children: string }) => {
  return (
    <ReactMarkdown remarkPlugins={remarkPlugins} components={components}>
      {children}
    </ReactMarkdown>
  );
};

export const Markdown = memo(
  NonMemoizedMarkdown,
  (prevProps, nextProps) => prevProps.children === nextProps.children,
);
