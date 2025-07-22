'use client';

interface CodeBlockProps {
  node: any;
  inline: boolean;
  className: string;
  children: any;
}

export function CodeBlock({
  node,
  inline,
  className,
  children,
  ...props
}: CodeBlockProps) {
  if (!inline) {
    return (
      <span className="not-prose inline-flex flex-col">
        <pre
          {...props}
          className={`inline-block whitespace-pre-wrap w-fit text-sm overflow-x-auto dark:bg-zinc-900 p-1 px-2 bg-muted-foreground rounded-xl dark:text-zinc-50 text-zinc-50`}
        >
          <code className="inline-block whitespace-pre-wrap break-words">{children}</code>
        </pre>
      </span>
    );
  } else {
    return (
      <code
        className={`${className} text-sm bg-zinc-100 dark:bg-zinc-800 py-0.5 px-1 rounded-md`}
        {...props}
      >
        {children}
      </code>
    );
  }
}
