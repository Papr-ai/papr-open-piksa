import { Artifact } from '@/components/create-artifact';
import { CodeEditor } from '@/components/code-editor';
import {
  CopyIcon,
  LogsIcon,
  MessageIcon,
  PlayIcon,
  RedoIcon,
  SaveIcon,
  UndoIcon,
} from '@/components/icons';
import { toast } from 'sonner';
import { generateUUID } from '@/lib/utils';
import { Console } from '@/components/console';
import type { ConsoleOutput, ConsoleOutputContent } from '@/components/console';
import React, { useEffect } from 'react';

const OUTPUT_HANDLERS = {
  matplotlib: `
    import io
    import base64
    from matplotlib import pyplot as plt

    # Clear any existing plots
    plt.clf()
    plt.close('all')

    # Switch to agg backend
    plt.switch_backend('agg')

    def setup_matplotlib_output():
        def custom_show():
            if plt.gcf().get_size_inches().prod() * plt.gcf().dpi ** 2 > 25_000_000:
                print("Warning: Plot size too large, reducing quality")
                plt.gcf().set_dpi(100)

            png_buf = io.BytesIO()
            plt.savefig(png_buf, format='png')
            png_buf.seek(0)
            png_base64 = base64.b64encode(png_buf.read()).decode('utf-8')
            print(f'data:image/png;base64,{png_base64}')
            png_buf.close()

            plt.clf()
            plt.close('all')

        plt.show = custom_show
  `,
  basic: `
    # Basic output capture setup
  `,
};

function detectRequiredHandlers(code: string): string[] {
  const handlers: string[] = ['basic'];

  if (code.includes('matplotlib') || code.includes('plt.')) {
    handlers.push('matplotlib');
  }

  return handlers;
}

interface Metadata {
  outputs: Array<ConsoleOutput>;
  previewMode: boolean;
}

// Improve language detection helper
function detectLanguage(
  code: string,
): 'python' | 'html' | 'jsx' | 'svg' | 'javascript' | 'unknown' {
  // Simple detection based on code content
  if (
    code.includes('import React') ||
    code.includes('export default') ||
    code.includes('React.') ||
    code.includes('<div') ||
    code.includes('</div>') ||
    code.includes('function Component')
  ) {
    return 'jsx';
  }
  if (
    code.includes('<!DOCTYPE html') ||
    code.includes('<html') ||
    code.includes('</html>')
  ) {
    return 'html';
  }
  if (code.includes('<svg') || code.includes('</svg>')) {
    return 'svg';
  }
  if (
    code.includes('document.getElementById') ||
    code.includes('function(') ||
    code.includes('() =>') ||
    code.includes('addEventListener') ||
    (code.includes('const ') && !code.includes('import '))
  ) {
    return 'javascript';
  }
  if (
    code.includes('import matplotlib') ||
    code.includes('def ') ||
    code.includes('print(') ||
    code.includes('if __name__')
  ) {
    return 'python';
  }
  return 'unknown';
}

export const codeArtifact = new Artifact<'code', Metadata>({
  kind: 'code',
  description:
    'Useful for code generation; Code execution is only available for python code.',
  initialize: async ({
    setMetadata,
    documentId,
    setArtifact,
  }: {
    setMetadata: (metadata: Metadata | ((prev: Metadata) => Metadata)) => void;
    documentId: string;
    setArtifact: (artifact: any) => void;
  }) => {
    console.log('[CODE ARTIFACT] Initializing with document ID:', documentId);

    // Initialize metadata with empty state
    const initialMetadata: Metadata = {
      outputs: [],
      previewMode: false,
    };
    setMetadata(initialMetadata);

    // CRITICAL: Always set visibility to true
    setArtifact((draft: any) => ({
      ...draft,
      isVisible: true,
      // Empty content string to avoid null/undefined issues
      content: draft.content || '',
    }));

    // Pre-set content if needed to ensure visibility
    if (documentId !== 'init') {
      try {
        const response = await fetch(`/api/document?id=${documentId}`);
        if (response.ok) {
          console.log('[CODE ARTIFACT] Successfully fetched initial document');

          try {
            const data = await response.json();
            if (Array.isArray(data) && data.length > 0) {
              const lastDocument = data[data.length - 1];
              if (lastDocument?.content) {
                console.log(
                  '[CODE ARTIFACT] Setting initial content from document:',
                  {
                    documentId: lastDocument.id,
                    contentLength: lastDocument.content?.length || 0,
                    preview: lastDocument.content?.substring(0, 50) || '',
                  },
                );

                // Immediately update content without any async delays
                setArtifact((draft: any) => ({
                  ...draft,
                  content: lastDocument.content,
                  isVisible: true,
                }));

                // Check if we should enable preview mode based on content
                const language = detectLanguage(lastDocument.content || '');
                if (['html', 'svg', 'javascript', 'jsx'].includes(language)) {
                  setMetadata((prev: Metadata) => ({
                    ...prev,
                    previewMode: true,
                  }));
                }
              }
            }
          } catch (parseError) {
            console.error(
              '[CODE ARTIFACT] Error parsing document:',
              parseError,
            );
          }
        } else {
          console.error(
            '[CODE ARTIFACT] Failed to fetch initial document:',
            await response.text(),
          );
        }
      } catch (error) {
        console.error(
          '[CODE ARTIFACT] Error fetching initial document:',
          error,
        );
      }
    }
  },
  onStreamPart: ({ streamPart, setArtifact, setMetadata }) => {
    console.log('[CODE ARTIFACT] Stream part received:', {
      type: streamPart.type,
      contentLength:
        typeof streamPart.content === 'string' ? streamPart.content.length : 0,
      timestamp: new Date().toISOString(),
    });

    // Process code deltas
    if (streamPart.type === 'code-delta') {
      try {
        // CRITICAL: Direct immediate update of artifact content
        const deltaContent =
          typeof streamPart.content === 'string' ? streamPart.content : '';

        if (deltaContent) {
          // Sync update to ensure immediate rendering
          setArtifact((draft) => {
            if (!draft) return draft;

            return {
              ...draft,
              content: deltaContent,
              isVisible: true,
              status: 'streaming' as const,
            };
          });

          // Detect language from content for potential preview mode
          const language = detectLanguage(deltaContent);
          if (['html', 'svg', 'javascript', 'jsx'].includes(language)) {
            setMetadata((prev) => ({
              ...prev,
              previewMode: true,
            }));
          }
        }
      } catch (error) {
        console.error('[CODE ARTIFACT] Error handling code delta:', error);
      }
    }
  },
  content: ({ metadata, setMetadata, ...props }) => {
    // Use streamed language if available, fallback to detection
    let detectedLanguage =
      props.language || detectLanguage(props.content || '');

    // Get preview mode from metadata
    const previewMode = metadata?.previewMode || false;

    // Show preview automatically for HTML/SVG/React/JavaScript
    useEffect(() => {
      const lang = props.language || detectLanguage(props.content || '');
      if (
        lang === 'html' ||
        lang === 'svg' ||
        lang === 'jsx' ||
        lang === 'javascript'
      ) {
        console.log('[CODE ARTIFACT] Auto-enabling preview mode for:', lang);
        setMetadata((prev: Metadata) => ({
          ...prev,
          previewMode: true,
        }));
      }
    }, [props.language, props.content, setMetadata]);

    // Ensure content is a string and handle empty values
    const safeContent = typeof props.content === 'string' ? props.content : '';

    // Clean up the content by removing the JSON wrapper if present
    let displayContent = safeContent;
    try {
      // First try to parse as JSON
      const parsed = JSON.parse(safeContent);
      if (parsed.code) {
        displayContent = parsed.code;
      } else if (parsed.html) {
        // If we have HTML content, extract it from the template literal if needed
        let htmlContent = parsed.html;
        // Check if the HTML is wrapped in template literals
        if (htmlContent.startsWith('`') && htmlContent.endsWith('`')) {
          htmlContent = htmlContent.slice(1, -1);
        }
        displayContent = htmlContent;
        detectedLanguage = 'html';
      }
    } catch (e) {
      // If parsing fails, check if the content itself is wrapped in template literals
      if (safeContent.startsWith('`') && safeContent.endsWith('`')) {
        displayContent = safeContent.slice(1, -1);
      } else {
        displayContent = safeContent;
      }
    }

    // --- Preview Renderers ---
    let previewElement: React.ReactNode = null;
    if (previewMode) {
      console.log('[CODE ARTIFACT] Rendering preview for:', {
        language: detectedLanguage,
        contentLength: displayContent?.length || 0,
        previewMode,
        contentPreview: `${displayContent.substring(0, 100)}...`, // Log first 100 chars for debugging
      });

      const previewContainerClass = props.isInline
        ? 'h-full w-full min-h-[200px] flex items-center justify-center overflow-hidden'
        : 'h-full w-full min-h-[600px] flex items-center justify-center';

      if (detectedLanguage === 'html') {
        previewElement = (
          <div className={`${previewContainerClass} border rounded-lg`}>
            <iframe
              srcDoc={displayContent}
              className="w-full h-full"
              title="HTML Preview"
              style={{ minHeight: props.isInline ? '200px' : '600px' }}
              sandbox="allow-scripts allow-same-origin"
            />
          </div>
        );
      } else if (['javascript', 'jsx'].includes(detectedLanguage)) {
        try {
          const iframeSrc = `
            <!DOCTYPE html>
            <html>
              <head>
                <script src="https://unpkg.com/react@17/umd/react.development.js"></script>
                <script src="https://unpkg.com/react-dom@17/umd/react-dom.development.js"></script>
                <script src="https://unpkg.com/babel-standalone@6/babel.min.js"></script>
                <style>
                  body { margin: 0; padding: 20px; }
                </style>
              </head>
              <body>
                <div id="root"></div>
                <script type="text/babel">
                  const content = ${JSON.stringify(displayContent)};
                  try {
                    if (typeof Component !== 'undefined') {
                      ReactDOM.render(<Component />, document.getElementById('root'));
                    } else if (typeof App !== 'undefined') {
                      ReactDOM.render(<App />, document.getElementById('root'));
                    } else {
                      document.getElementById('root').innerHTML = content;
                    }
                  } catch (err) {
                    document.getElementById('root').innerHTML = \`<pre style="color: red;">Error: \${err.message}</pre>\`;
                    console.error('Preview render error:', err);
                  }
                </script>
              </body>
            </html>
          `;
          previewElement = (
            <div className={`${previewContainerClass} border rounded-lg`}>
              <iframe
                srcDoc={iframeSrc}
                className="w-full h-full"
                title="JSX/JavaScript Preview"
                style={{ minHeight: props.isInline ? '200px' : '600px' }}
                sandbox="allow-scripts allow-same-origin"
              />
            </div>
          );
        } catch (error) {
          console.error('Error setting up preview:', error);
          previewElement = (
            <div
              className={`${previewContainerClass} border rounded-lg p-4 overflow-auto`}
            >
              <pre className="text-sm font-mono whitespace-pre-wrap">
                {displayContent}
                {`\n\nError: Failed to setup preview - ${error instanceof Error ? error.message : 'Unknown error'}`}
              </pre>
            </div>
          );
        }
      } else if (detectedLanguage === 'svg') {
        previewElement = (
          <div
            className={`${previewContainerClass} border rounded-lg bg-white p-4`}
          >
            <div
              dangerouslySetInnerHTML={{ __html: displayContent }}
              className="w-full h-full flex items-center justify-center"
              style={{
                minHeight: props.isInline ? '200px' : '400px',
                maxHeight: props.isInline ? '300px' : '800px',
              }}
            />
          </div>
        );
      }
    }

    return (
      <>
        <div className="px-1 relative h-full">
          {props.status === 'streaming' && (
            <div className="absolute top-2 right-2 z-10 text-xs px-2 py-1 bg-blue-500 text-white rounded-md animate-pulse">
              Generating...
            </div>
          )}

          {!previewMode && <CodeEditor {...props} content={displayContent} />}
          {previewMode && previewElement}
        </div>

        {metadata?.outputs && (
          <Console
            consoleOutputs={metadata.outputs}
            setConsoleOutputs={() => {
              setMetadata((prev: Metadata) => ({
                ...prev,
                outputs: [],
              }));
            }}
          />
        )}
      </>
    );
  },
  actions: [
    {
      icon: <PlayIcon size={18} />,
      label: 'Run',
      description: 'Execute or preview code',
      onClick: async (context) => {
        const language = detectLanguage(context.content || '') as string;

        // For previewable languages, toggle preview mode
        if (['html', 'svg', 'javascript', 'jsx'].includes(language)) {
          const currentPreviewMode = context.metadata?.previewMode || false;
          const newPreviewMode = !currentPreviewMode;

          console.log('[CODE ARTIFACT] Toggling preview mode:', {
            from: currentPreviewMode,
            to: newPreviewMode,
            language,
          });

          // Force update metadata with preview mode
          context.setMetadata((prev: Metadata) => {
            const updated = {
              ...prev,
              previewMode: newPreviewMode,
              outputs: prev.outputs || [], // Ensure outputs array exists
            };
            console.log('[CODE ARTIFACT] Updated metadata:', updated);
            return updated;
          });
          return;
        }

        // For Python, execute the code as before
        const runId = generateUUID();
        const outputContent: Array<ConsoleOutputContent> = [];

        context.setMetadata((prev) => ({
          ...prev,
          outputs: [
            ...prev.outputs,
            {
              id: runId,
              contents: [],
              status: 'in_progress',
            },
          ],
        }));

        try {
          // @ts-expect-error - loadPyodide is not defined
          const currentPyodideInstance = await globalThis.loadPyodide({
            indexURL: 'https://cdn.jsdelivr.net/pyodide/v0.23.4/full/',
          });

          currentPyodideInstance.setStdout({
            batched: (output: string) => {
              outputContent.push({
                type: output.startsWith('data:image/png;base64')
                  ? 'image'
                  : 'text',
                value: output,
              });
            },
          });

          await currentPyodideInstance.loadPackagesFromImports(
            context.content || '',
            {
              messageCallback: (message: string) => {
                context.setMetadata((metadata) => ({
                  ...metadata,
                  outputs: [
                    ...metadata.outputs.filter((output) => output.id !== runId),
                    {
                      id: runId,
                      contents: [{ type: 'text', value: message }],
                      status: 'loading_packages',
                    },
                  ],
                }));
              },
            },
          );

          const requiredHandlers = detectRequiredHandlers(
            context.content || '',
          );
          for (const handler of requiredHandlers) {
            if (OUTPUT_HANDLERS[handler as keyof typeof OUTPUT_HANDLERS]) {
              await currentPyodideInstance.runPythonAsync(
                OUTPUT_HANDLERS[handler as keyof typeof OUTPUT_HANDLERS],
              );

              if (handler === 'matplotlib') {
                await currentPyodideInstance.runPythonAsync(
                  'setup_matplotlib_output()',
                );
              }
            }
          }

          await currentPyodideInstance.runPythonAsync(context.content || '');

          context.setMetadata((metadata) => ({
            ...metadata,
            outputs: [
              ...metadata.outputs.filter((output) => output.id !== runId),
              {
                id: runId,
                contents: outputContent,
                status: 'completed',
              },
            ],
          }));
        } catch (error: any) {
          context.setMetadata((metadata) => ({
            ...metadata,
            outputs: [
              ...metadata.outputs.filter((output) => output.id !== runId),
              {
                id: runId,
                contents: [{ type: 'text', value: error.message }],
                status: 'failed',
              },
            ],
          }));
        }
      },
      isDisabled: (context) => {
        const language = detectLanguage(context.content || '');

        // Update button text based on language
        if (
          language === 'html' ||
          language === 'svg' ||
          language === 'javascript' ||
          language === 'jsx'
        ) {
          // We'd want to change the label to 'Preview' here, but we can't directly modify the button
          // Instead, we'll handle the UI change in the artifact-actions.tsx component
          return false;
        }

        return false;
      },
    },
    {
      icon: <SaveIcon size={18} />,
      description: 'Save to memory',
      onClick: async ({ content }) => {
        try {
          const response = await fetch('/api/memory/save', {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
            },
            body: JSON.stringify({
              content,
              type: 'document',
              metadata: {
                kind: 'code',
                language: detectLanguage(content),
              },
            }),
          });

          if (!response.ok) {
            throw new Error('Failed to save to memory');
          }

          // Use DOM to find and update the save button's icon
          const saveButtons = document.querySelectorAll(
            '[data-tooltip-content="Save to memory"]',
          );
          saveButtons.forEach((btn) => {
            // Find the SaveIcon within this button
            const svgElement = btn.querySelector('svg');
            if (svgElement) {
              // Update a data attribute that can be used in CSS to show filled state
              svgElement.setAttribute('data-saved', 'true');
              // Try to find the path element to directly update fill
              const pathElement = svgElement.querySelector('path');
              if (pathElement) {
                const gradientId =
                  svgElement.querySelector('linearGradient')?.id;
                if (gradientId) {
                  pathElement.setAttribute('fill', `url(#${gradientId})`);
                }
              }
            }

            // Update tooltip content
            const tooltipContent = btn
              .closest('[role="tooltip"]')
              ?.querySelector('[data-tooltip-content="Save to memory"]');
            if (tooltipContent) {
              tooltipContent.setAttribute(
                'data-tooltip-content',
                'Already saved to memory',
              );
            }

            // Find parent TooltipProvider and update content
            const tooltipTrigger = btn.closest('[role="button"]');
            if (tooltipTrigger) {
              const tooltipPopup = tooltipTrigger.nextElementSibling;
              if (
                tooltipPopup &&
                tooltipPopup.textContent === 'Save to memory'
              ) {
                tooltipPopup.textContent = 'Already saved to memory';
              }
            }
          });

          toast.success('Saved to memory!');
        } catch (error) {
          console.error('Error saving to memory:', error);
          toast.error('Failed to save to memory');
        }
      },
    },
    {
      icon: <UndoIcon size={18} />,
      description: 'View Previous version',
      onClick: ({ handleVersionChange }) => {
        handleVersionChange('prev');
      },
      isDisabled: ({ currentVersionIndex }) => {
        if (currentVersionIndex === 0) {
          return true;
        }

        return false;
      },
    },
    {
      icon: <RedoIcon size={18} />,
      description: 'View Next version',
      onClick: ({ handleVersionChange }) => {
        handleVersionChange('next');
      },
      isDisabled: ({ isCurrentVersion }) => {
        if (isCurrentVersion) {
          return true;
        }

        return false;
      },
    },
    {
      icon: <CopyIcon size={18} />,
      description: 'Copy code to clipboard',
      onClick: ({ content }) => {
        navigator.clipboard.writeText(content);
        toast.success('Copied to clipboard!');
      },
    },
  ],
  toolbar: [
    {
      icon: <MessageIcon />,
      description: 'Add comments',
      onClick: ({ appendMessage }) => {
        appendMessage({
          role: 'user',
          content: 'Add comments to the code snippet for understanding',
        });
      },
    },
    {
      icon: <LogsIcon />,
      description: 'Add logs',
      onClick: ({ appendMessage }) => {
        appendMessage({
          role: 'user',
          content: 'Add logs to the code snippet for debugging',
        });
      },
    },
  ],
});
