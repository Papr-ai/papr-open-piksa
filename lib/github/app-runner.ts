import { AppDetector } from './app-detector';
import { toast } from 'sonner';

// Type declaration for Pyodide
declare global {
  interface Window {
    loadPyodide: (config: { indexURL: string }) => Promise<any>;
  }
  
  var loadPyodide: (config: { indexURL: string }) => Promise<any>;
}

export class AppRunner {
  private static runningApps = new Map<string, {
    iframe?: HTMLIFrameElement;
    terminal?: any;
    process?: any;
  }>();

  static async runApp(
    files: Map<string, string>,
    containerIdOrElement: string | HTMLElement,
    onOutput: (output: string, type: 'stdout' | 'stderr' | 'info') => void
  ) {
    onOutput(`🔍 Analyzing ${files.size} files...`, 'info');
    
    // Log all files for debugging
    for (const [fileName, content] of files.entries()) {
      onOutput(`📄 File: ${fileName} (${content.length} characters)`, 'info');
    }
    
    // Get container element - support both ID and direct element
    let container: HTMLElement | null = null;
    let containerId: string;
    
    if (typeof containerIdOrElement === 'string') {
      containerId = containerIdOrElement;
      container = document.getElementById(containerId);
      onOutput(`🔍 Looking for container by ID: ${containerId}`, 'info');
    } else {
      container = containerIdOrElement;
      containerId = container.id || `container-${Date.now()}`;
      onOutput(`🔍 Using provided container element: ${containerId}`, 'info');
    }
    
    // Verify container exists
    if (!container) {
      onOutput(`❌ Container not found: ${containerId}`, 'stderr');
      onOutput(`🔧 Available containers: ${Array.from(document.querySelectorAll('[id]')).map(el => el.id).join(', ')}`, 'info');
      onOutput(`🔧 Total DOM elements with IDs: ${document.querySelectorAll('[id]').length}`, 'info');
      
      // Try to find any container that might work
      const possibleContainers = Array.from(document.querySelectorAll('[id*="container"], [id*="app"]'));
      if (possibleContainers.length > 0) {
        onOutput(`🔧 Possible containers found: ${possibleContainers.map(el => el.id).join(', ')}`, 'info');
      }
      
      throw new Error(`Container not found: ${containerId}`);
    }
    
    onOutput(`✅ Container found: ${containerId}`, 'info');
    
    let appConfig: any;
    try {
      appConfig = AppDetector.detectAppType(files);
      onOutput(`🚀 Detected ${appConfig.type} app`, 'info');
      onOutput(`📁 Entry point: ${appConfig.entryPoint}`, 'info');
      onOutput(`🔧 Port: ${appConfig.port}`, 'info');
    } catch (error) {
      onOutput(`❌ Error detecting app type: ${error}`, 'stderr');
      throw error;
    }
    
    try {
      switch (appConfig.type) {
        case 'python-web':
          return await this.runPythonWebApp(files, appConfig, container, onOutput);
        case 'python-cli':
          return await this.runPythonCLI(files, appConfig, container, onOutput);
        case 'static-html':
          return this.runStaticHTML(files, appConfig, container, onOutput);
        case 'react':
          return this.runReactApp(files, appConfig, container, onOutput);
        default:
          onOutput(`❌ Unknown app type: ${appConfig.type}`, 'stderr');
          onOutput('📋 Supported types: python-web, python-cli, static-html, react', 'info');
          throw new Error(`Unknown app type: ${appConfig.type}`);
      }
    } catch (error) {
      onOutput(`❌ Error running app: ${error}`, 'stderr');
      onOutput(`🔧 Error details: ${error instanceof Error ? error.message : String(error)}`, 'stderr');
      onOutput(`📋 Stack trace: ${error instanceof Error ? error.stack : 'No stack trace'}`, 'stderr');
      throw error;
    }
  }

  private static async runPythonWebApp(
    files: Map<string, string>,
    config: any,
    container: HTMLElement,
    onOutput: (output: string, type: 'stdout' | 'stderr' | 'info') => void
  ) {
    onOutput('🐍 Loading Python environment...', 'info');
    
    let pyodideInstance: any;
    try {
      // Check if Pyodide is available
      if (typeof globalThis.loadPyodide === 'undefined') {
        onOutput('❌ Pyodide not available. Loading from CDN...', 'stderr');
        
        // Try to load Pyodide dynamically
        const script = document.createElement('script');
        script.src = 'https://cdn.jsdelivr.net/pyodide/v0.23.4/full/pyodide.js';
        document.head.appendChild(script);
        
        await new Promise((resolve, reject) => {
          script.onload = resolve;
          script.onerror = () => reject(new Error('Failed to load Pyodide from CDN'));
        });
      }
      
      pyodideInstance = await globalThis.loadPyodide({
        indexURL: 'https://cdn.jsdelivr.net/pyodide/v0.23.4/full/',
      });
      
      onOutput('✅ Python environment loaded successfully', 'info');
    } catch (error) {
      onOutput(`❌ Failed to load Python environment: ${error}`, 'stderr');
      onOutput('🔧 Falling back to simulated Python environment', 'info');
      
      // Create a fallback simulation
      this.createPythonFallback(container.id, files, config, onOutput);
      return;
    }

    // Install dependencies
    if (config.dependencies?.length > 0) {
      onOutput('📦 Installing dependencies...', 'info');
      try {
        const mappedDeps = AppDetector.getPackageMapping(config.dependencies);
        const availableDeps = mappedDeps.filter(dep => 
          ['flask', 'fastapi', 'streamlit', 'pandas', 'numpy', 'matplotlib', 'seaborn', 'plotly', 'scipy', 'requests'].includes(dep)
        );
        
        if (availableDeps.length > 0) {
          await pyodideInstance.loadPackage(availableDeps);
          onOutput(`✅ Installed: ${availableDeps.join(', ')}`, 'info');
        }
        
        const unavailableDeps = mappedDeps.filter(dep => !availableDeps.includes(dep));
        if (unavailableDeps.length > 0) {
          onOutput(`⚠️  Unavailable in Pyodide: ${unavailableDeps.join(', ')}`, 'stderr');
        }
      } catch (error) {
        onOutput(`⚠️  Error installing dependencies: ${error}`, 'stderr');
      }
    }

    // Setup file system
    try {
      this.setupVirtualFileSystem(pyodideInstance, files);
      onOutput('✅ Virtual file system setup complete', 'info');
    } catch (error) {
      onOutput(`❌ Error setting up virtual file system: ${error}`, 'stderr');
    }

    // Create a web server simulation
    const serverCode = `
import sys
import io
from contextlib import redirect_stdout, redirect_stderr

# Mock Flask/FastAPI for basic routing
class MockFlask:
    def __init__(self, name):
        self.name = name
        self.routes = {}
        
    def route(self, path, methods=['GET']):
        def decorator(func):
            self.routes[path] = func
            return func
        return decorator
        
    def run(self, host='0.0.0.0', port=5000, debug=False):
        print(f"🌐 Server running at http://{host}:{port}")
        print("📋 Available routes:")
        for route in self.routes.keys():
            print(f"  - {route}")
        
        # Simulate running the main route
        if '/' in self.routes:
            try:
                result = self.routes['/']()
                print(f"📄 Route '/' returned: {result}")
                print(result)
            except Exception as e:
                print(f"❌ Error in route '/': {e}")

# Mock FastAPI
class MockFastAPI:
    def __init__(self):
        self.routes = {}
        
    def get(self, path):
        def decorator(func):
            self.routes[path] = func
            return func
        return decorator
        
    def run(self, host='0.0.0.0', port=8000):
        print(f"🌐 FastAPI server running at http://{host}:{port}")
        print("📋 Available routes:")
        for route in self.routes.keys():
            print(f"  - GET {route}")

# Mock Streamlit
class MockStreamlit:
    @staticmethod
    def title(text):
        print(f"📊 TITLE: {text}")
        
    @staticmethod
    def write(text):
        print(f"📝 WRITE: {text}")
        
    @staticmethod
    def markdown(text):
        print(f"📄 MARKDOWN: {text}")

# Replace imports
if 'flask' in sys.modules:
    sys.modules['flask'].Flask = MockFlask
else:
    sys.modules['flask'] = type('flask', (), {'Flask': MockFlask})()

if 'fastapi' in sys.modules:
    sys.modules['fastapi'].FastAPI = MockFastAPI
else:
    sys.modules['fastapi'] = type('fastapi', (), {'FastAPI': MockFastAPI})()

if 'streamlit' in sys.modules:
    for attr in ['title', 'write', 'markdown']:
        setattr(sys.modules['streamlit'], attr, getattr(MockStreamlit, attr))
else:
    sys.modules['streamlit'] = MockStreamlit()
`;

    try {
      await pyodideInstance.runPythonAsync(serverCode);
      onOutput('✅ Mock server framework loaded', 'info');
    } catch (error) {
      onOutput(`❌ Error loading mock server: ${error}`, 'stderr');
    }
    
    // Run the app
    onOutput('🚀 Starting application...', 'info');
    const appContent = files.get(config.entryPoint) || '';
    
    if (!appContent.trim()) {
      onOutput(`❌ Entry point file is empty: ${config.entryPoint}`, 'stderr');
      return;
    }
    
    try {
      await pyodideInstance.runPythonAsync(appContent);
      onOutput('✅ Application executed successfully', 'info');
      
      // Create web preview
      this.createWebPreview(container.id, files, config);
      
    } catch (error) {
      onOutput(`❌ Error running app: ${error}`, 'stderr');
      onOutput(`🔧 Entry point content preview: ${appContent.substring(0, 200)}...`, 'info');
      
      // Still create a preview showing the error
      this.createErrorPreview(container, files, config, error, onOutput);
    }
  }

  private static createPythonFallback(
    containerId: string,
    files: Map<string, string>,
    config: any,
    onOutput: (output: string, type: 'stdout' | 'stderr' | 'info') => void
  ) {
    onOutput('🔄 Creating Python simulation preview...', 'info');
    
    const container = document.getElementById(containerId);
    if (!container) return;

    const preview = document.createElement('div');
    preview.style.border = '1px solid #ccc';
    preview.style.borderRadius = '8px';
    preview.style.padding = '20px';
    preview.style.backgroundColor = '#f9f9f9';
    preview.style.fontFamily = 'Arial, sans-serif';

    const mainFile = files.get(config.entryPoint) || '';
    
    preview.innerHTML = `
      <div style="display: flex; align-items: center; gap: 10px; margin-bottom: 15px;">
        <div style="width: 12px; height: 12px; background: #ff5f57; border-radius: 50%;"></div>
        <div style="width: 12px; height: 12px; background: #ffbd2e; border-radius: 50%;"></div>
        <div style="width: 12px; height: 12px; background: #28ca42; border-radius: 50%;"></div>
        <span style="margin-left: 10px; font-family: monospace; font-size: 12px;">localhost:${config.port}</span>
      </div>
      <div>
        <h2>🐍 Python App Preview (Simulated)</h2>
        <p>⚠️ Pyodide environment unavailable. Showing code preview instead.</p>
        <div style="margin-top: 20px;">
          <h3>📄 ${config.entryPoint}</h3>
          <pre style="background: #f5f5f5; padding: 15px; border-radius: 5px; overflow-x: auto; font-family: monospace;">${mainFile}</pre>
        </div>
        <div style="margin-top: 15px; padding: 15px; background: #e3f2fd; border-radius: 5px;">
          <p><strong>💡 To run this app properly:</strong></p>
          <ol>
            <li>Ensure you have a stable internet connection</li>
            <li>Try refreshing the page</li>
            <li>Check browser console for detailed errors</li>
            <li>Consider using a modern browser (Chrome/Firefox)</li>
          </ol>
        </div>
      </div>
    `;

    container.innerHTML = '';
    container.appendChild(preview);
    
    onOutput('✅ Python simulation preview created', 'info');
  }

  private static createErrorPreview(
    containerOrId: HTMLElement | string,
    files: Map<string, string>,
    config: any,
    error: any,
    onOutput: (output: string, type: 'stdout' | 'stderr' | 'info') => void
  ) {
    const container = typeof containerOrId === 'string' 
      ? document.getElementById(containerOrId) 
      : containerOrId;
    if (!container) return;

    const preview = document.createElement('div');
    preview.style.border = '1px solid #f44336';
    preview.style.borderRadius = '8px';
    preview.style.padding = '20px';
    preview.style.backgroundColor = '#ffebee';
    preview.style.fontFamily = 'Arial, sans-serif';

    const mainFile = files.get(config.entryPoint) || '';
    
    preview.innerHTML = `
      <div>
        <h2>❌ App Error</h2>
        <div style="margin: 15px 0; padding: 15px; background: #ffcdd2; border-radius: 5px;">
          <h3>Error Details:</h3>
          <pre style="color: #c62828; font-family: monospace;">${error.toString()}</pre>
        </div>
        <div style="margin-top: 20px;">
          <h3>📄 ${config.entryPoint}</h3>
          <pre style="background: #f5f5f5; padding: 15px; border-radius: 5px; overflow-x: auto; font-family: monospace; max-height: 300px;">${mainFile}</pre>
        </div>
      </div>
    `;

    container.innerHTML = '';
    container.appendChild(preview);
    
    onOutput('✅ Error preview created', 'info');
  }

  private static async runPythonCLI(
    files: Map<string, string>,
    config: any,
    container: HTMLElement,
    onOutput: (output: string, type: 'stdout' | 'stderr' | 'info') => void
  ) {
    onOutput('🐍 Loading Python environment...', 'info');
    
    const pyodideInstance = await globalThis.loadPyodide({
      indexURL: 'https://cdn.jsdelivr.net/pyodide/v0.23.4/full/',
    });

    // Setup output capture
    pyodideInstance.setStdout({
      batched: (output: string) => {
        onOutput(output, 'stdout');
      },
    });

    pyodideInstance.setStderr({
      batched: (output: string) => {
        onOutput(output, 'stderr');
      },
    });

    // Install dependencies
    if (config.dependencies?.length > 0) {
      onOutput('📦 Installing dependencies...', 'info');
      try {
        const mappedDeps = AppDetector.getPackageMapping(config.dependencies);
        const availableDeps = mappedDeps.filter(dep => 
          ['pandas', 'numpy', 'matplotlib', 'seaborn', 'plotly', 'scipy', 'requests'].includes(dep)
        );
        
        if (availableDeps.length > 0) {
          await pyodideInstance.loadPackage(availableDeps);
          onOutput(`✅ Installed: ${availableDeps.join(', ')}`, 'info');
        }
      } catch (error) {
        onOutput(`⚠️  Error installing dependencies: ${error}`, 'stderr');
      }
    }

    // Setup file system
    this.setupVirtualFileSystem(pyodideInstance, files);

    // Run the app
    onOutput('🚀 Running application...', 'info');
    const appContent = files.get(config.entryPoint) || '';
    
    try {
      await pyodideInstance.runPythonAsync(appContent);
      onOutput('✅ Application completed', 'info');
    } catch (error) {
      onOutput(`❌ Error: ${error}`, 'stderr');
    }
  }

  private static runStaticHTML(
    files: Map<string, string>,
    config: any,
    container: HTMLElement,
    onOutput: (output: string, type: 'stdout' | 'stderr' | 'info') => void
  ) {
    onOutput('🌐 Serving static HTML...', 'info');
    
    const containerId = container.id || `container-${Date.now()}`;

    onOutput(`📁 Available files: ${Array.from(files.keys()).join(', ')}`, 'info');

    // Create iframe for the app
    const iframe = document.createElement('iframe');
    iframe.style.width = '100%';
    iframe.style.height = '100%';
    iframe.style.border = 'none';
    iframe.style.borderRadius = '8px';

    // More flexible file detection
    const fileArray = Array.from(files.entries());
    let htmlContent = '';
    let cssContent = '';
    let jsContent = '';

    // Find HTML file - prioritize entry point, then look for common names
    const htmlFile = fileArray.find(([name]) => name === config.entryPoint) ||
                     fileArray.find(([name]) => name.endsWith('.html')) ||
                     fileArray.find(([name]) => name.includes('index'));
    
    if (htmlFile) {
      htmlContent = htmlFile[1];
      onOutput(`📄 Using HTML file: ${htmlFile[0]}`, 'info');
    } else {
      // If no HTML file, create a basic one with all content
      onOutput('📄 No HTML file found, creating basic structure', 'info');
      htmlContent = `
        <div style="padding: 20px; font-family: Arial, sans-serif;">
          <h1>Your Application</h1>
          <div id="app-content">
            ${fileArray.map(([name, content]) => `
              <div style="margin: 20px 0; padding: 15px; border: 1px solid #ddd; border-radius: 5px;">
                <h3>${name}</h3>
                <pre style="background: #f5f5f5; padding: 10px; border-radius: 3px; overflow-x: auto; white-space: pre-wrap;">${this.escapeHtml(content)}</pre>
              </div>
            `).join('')}
          </div>
        </div>
      `;
    }

    // Find CSS file
    const cssFile = fileArray.find(([name]) => name.endsWith('.css'));
    if (cssFile) {
      cssContent = cssFile[1];
      onOutput(`🎨 Using CSS file: ${cssFile[0]}`, 'info');
    }

    // Find JS file
    const jsFile = fileArray.find(([name]) => name.endsWith('.js'));
    if (jsFile) {
      jsContent = jsFile[1];
      onOutput(`⚙️ Using JS file: ${jsFile[0]}`, 'info');
    }

    // Create complete HTML document
    const fullHTML = `
<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Static Web App</title>
    <style>
        body { 
            margin: 0; 
            padding: 0; 
            font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', 'Roboto', sans-serif;
            background: #fff;
        }
        .error-display {
            color: red;
            padding: 20px;
            border: 1px solid red;
            margin: 20px;
            background: #ffebee;
            border-radius: 5px;
        }
        ${cssContent}
    </style>
</head>
<body>
    ${htmlContent}
    <script>
        window.addEventListener('error', function(e) {
            console.error('JavaScript error:', e.error);
            const errorDiv = document.createElement('div');
            errorDiv.className = 'error-display';
            errorDiv.innerHTML = '<h3>JavaScript Error</h3><pre>' + e.error + '</pre>';
            document.body.appendChild(errorDiv);
        });
        
        try {
            ${jsContent}
        } catch (error) {
            console.error('JavaScript error:', error);
            const errorDiv = document.createElement('div');
            errorDiv.className = 'error-display';
            errorDiv.innerHTML = '<h3>JavaScript Error</h3><pre>' + error.message + '</pre>';
            document.body.appendChild(errorDiv);
        }
    </script>
</body>
</html>`;

    onOutput(`📏 Generated HTML length: ${fullHTML.length} characters`, 'info');
    
    try {
      iframe.srcdoc = fullHTML;
      container.innerHTML = '';
      container.appendChild(iframe);

      this.runningApps.set(containerId, { iframe });
      onOutput('✅ Static site is running', 'info');
    } catch (error) {
      onOutput(`❌ Error creating static HTML app: ${error}`, 'stderr');
      this.createErrorPreview(container, files, config, error, onOutput);
    }
  }

  private static runReactApp(
    files: Map<string, string>,
    config: any,
    container: HTMLElement,
    onOutput: (output: string, type: 'stdout' | 'stderr' | 'info') => void
  ) {
    onOutput('⚛️ Loading React environment...', 'info');
    
    const containerId = container.id || `container-${Date.now()}`;

    onOutput(`📁 Available files: ${Array.from(files.keys()).join(', ')}`, 'info');

    // Create iframe for React app
    const iframe = document.createElement('iframe');
    iframe.style.width = '100%';
    iframe.style.height = '100%';
    iframe.style.border = 'none';
    iframe.style.borderRadius = '8px';

    // More flexible file detection
    const fileArray = Array.from(files.entries());
    let jsContent = '';
    let indexContent = '';

    // Find main React component file
    const mainFile = fileArray.find(([name]) => name === config.entryPoint) ||
                     fileArray.find(([name]) => name.includes('App.js') || name.includes('App.jsx')) ||
                     fileArray.find(([name]) => name.endsWith('.js') || name.endsWith('.jsx'));
    
    if (mainFile) {
      jsContent = mainFile[1];
      onOutput(`⚛️ Using React component: ${mainFile[0]}`, 'info');
    }

    // Find index file
    const indexFile = fileArray.find(([name]) => name.includes('index.js') || name.includes('index.jsx'));
    if (indexFile) {
      indexContent = indexFile[1];
      onOutput(`🏁 Using index file: ${indexFile[0]}`, 'info');
    }

    // If no specific React files, combine all JS content
    if (!jsContent && !indexContent) {
      const allJsFiles = fileArray.filter(([name]) => name.endsWith('.js') || name.endsWith('.jsx'));
      jsContent = allJsFiles.map(([name, content]) => `// ${name}\n${content}`).join('\n\n');
      onOutput(`📦 Combined ${allJsFiles.length} JavaScript files`, 'info');
    }

    const reactHTML = `
<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>React App</title>
    <script crossorigin src="https://unpkg.com/react@18/umd/react.development.js"></script>
    <script crossorigin src="https://unpkg.com/react-dom@18/umd/react-dom.development.js"></script>
    <script src="https://unpkg.com/@babel/standalone/babel.min.js"></script>
    <style>
        body { 
            margin: 0; 
            padding: 20px; 
            font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', 'Roboto', sans-serif;
            background: #fff;
        }
        #root { min-height: 100vh; }
        .error-container {
            color: red;
            padding: 20px;
            border: 1px solid red;
            background: #ffebee;
            border-radius: 5px;
            margin: 20px 0;
        }
        .loading-container {
            padding: 20px;
            text-align: center;
            color: #666;
        }
    </style>
</head>
<body>
    <div id="root">
        <div class="loading-container">
            <h2>Loading React App...</h2>
            <p>Please wait while the React environment initializes.</p>
        </div>
    </div>
    <script type="text/babel">
        const { useState, useEffect } = React;
        
        // Global error handler
        window.addEventListener('error', function(e) {
            console.error('Global error:', e.error);
            ReactDOM.render(
                <div className="error-container">
                    <h1>Runtime Error</h1>
                    <pre>{e.error.toString()}</pre>
                </div>,
                document.getElementById('root')
            );
        });
        
        // Try to execute the React component
        try {
            ${jsContent}
            ${indexContent}
            
            // Clear loading message
            document.getElementById('root').innerHTML = '';
            
            // Multiple render attempts
            if (typeof App !== 'undefined') {
                console.log('Rendering App component');
                ReactDOM.render(<App />, document.getElementById('root'));
            } else if (typeof Component !== 'undefined') {
                console.log('Rendering Component');
                ReactDOM.render(<Component />, document.getElementById('root'));
            } else {
                // Try to find any function that might be a component
                const possibleComponents = Object.keys(window).filter(key => 
                    typeof window[key] === 'function' && 
                    key.charAt(0) === key.charAt(0).toUpperCase() &&
                    key !== 'Object' && key !== 'Array' && key !== 'String' && key !== 'Error'
                );
                
                if (possibleComponents.length > 0) {
                    const ComponentToRender = window[possibleComponents[0]];
                    console.log('Rendering component:', possibleComponents[0]);
                    ReactDOM.render(<ComponentToRender />, document.getElementById('root'));
                } else {
                    console.log('No React component found, showing code');
                    ReactDOM.render(
                        <div>
                            <h1>React App Loaded</h1>
                            <p>No React component found to render. Available global objects:</p>
                            <ul>
                                {Object.keys(window).filter(key => 
                                    typeof window[key] === 'function' && 
                                    key.charAt(0) === key.charAt(0).toUpperCase()
                                ).map(key => <li key={key}>{key}</li>)}
                            </ul>
                            <details>
                                <summary>View Code</summary>
                                <pre style={{background: '#f5f5f5', padding: '10px', borderRadius: '5px', overflow: 'auto', fontSize: '12px'}}>
                                    {${JSON.stringify(jsContent + '\n\n' + indexContent)}}
                                </pre>
                            </details>
                        </div>,
                        document.getElementById('root')
                    );
                }
            }
        } catch (error) {
            console.error('React render error:', error);
            ReactDOM.render(
                <div className="error-container">
                    <h1>Error loading React app</h1>
                    <pre>{error.toString()}</pre>
                    <details>
                        <summary>View Code</summary>
                        <pre style={{background: '#f5f5f5', padding: '10px', borderRadius: '5px', overflow: 'auto', fontSize: '12px'}}>
                            {${JSON.stringify(jsContent + '\n\n' + indexContent)}}
                        </pre>
                    </details>
                </div>,
                document.getElementById('root')
            );
        }
    </script>
</body>
</html>`;

    onOutput(`📏 Generated React HTML length: ${reactHTML.length} characters`, 'info');
    
    try {
      iframe.srcdoc = reactHTML;
      container.innerHTML = '';
      container.appendChild(iframe);

      this.runningApps.set(containerId, { iframe });
      onOutput('✅ React app is running', 'info');
    } catch (error) {
      onOutput(`❌ Error creating React app: ${error}`, 'stderr');
      this.createErrorPreview(container, files, config, error, onOutput);
    }
  }

  private static createWebPreview(containerId: string, files: Map<string, string>, config: any) {
    const container = document.getElementById(containerId);
    if (!container) return;

    // Create a simple web preview
    const preview = document.createElement('div');
    preview.style.border = '1px solid #ccc';
    preview.style.borderRadius = '8px';
    preview.style.padding = '20px';
    preview.style.backgroundColor = '#f9f9f9';
    preview.style.marginTop = '20px';

    preview.innerHTML = `
      <div style="display: flex; align-items: center; gap: 10px; margin-bottom: 15px;">
        <div style="width: 12px; height: 12px; background: #ff5f57; border-radius: 50%;"></div>
        <div style="width: 12px; height: 12px; background: #ffbd2e; border-radius: 50%;"></div>
        <div style="width: 12px; height: 12px; background: #28ca42; border-radius: 50%;"></div>
        <span style="margin-left: 10px; font-family: monospace; font-size: 12px;">localhost:${config.port}</span>
      </div>
      <div style="font-family: Arial, sans-serif;">
        <h2>🚀 Your Python Web App is Running!</h2>
        <p>This is a simulated web server environment.</p>
        <p>In a real deployment, your app would be accessible at <code>http://localhost:${config.port}</code></p>
      </div>
    `;

    container.appendChild(preview);
  }

  private static setupVirtualFileSystem(pyodideInstance: any, files: Map<string, string>) {
    for (const [path, content] of files.entries()) {
      const dirs = path.split('/').slice(0, -1);
      let currentPath = '';
      
      for (const dir of dirs) {
        if (dir) {
          currentPath += `/${dir}`;
          try {
            pyodideInstance.FS.mkdir(currentPath);
          } catch (e) {
            // Directory might already exist
          }
        }
      }
      
      pyodideInstance.FS.writeFile(path, content);
    }
  }

  // Helper method to escape HTML
  private static escapeHtml(text: string): string {
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
  }

  static stopApp(containerId: string) {
    const app = this.runningApps.get(containerId);
    if (app) {
      if (app.iframe) {
        app.iframe.remove();
      }
      if (app.process) {
        app.process.terminate();
      }
      this.runningApps.delete(containerId);
    }
  }
}