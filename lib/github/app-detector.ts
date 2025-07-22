interface AppConfig {
  type: 'python-web' | 'python-cli' | 'node-web' | 'static-html' | 'react' | 'unknown';
  entryPoint: string;
  dependencies?: string[];
  buildCommand?: string;
  runCommand?: string;
  port?: number;
  outputType: 'web' | 'terminal' | 'both';
}

export class AppDetector {
  static detectAppType(files: Map<string, string>): AppConfig {
    const filePaths = Array.from(files.keys());
    
    // Python Flask/FastAPI/Streamlit app
    if (files.has('app.py') || files.has('main.py')) {
      const appPyContent = files.get('app.py') || '';
      const mainPyContent = files.get('main.py') || '';
      const content = appPyContent + mainPyContent;
      
      if (content.includes('Flask') || content.includes('FastAPI') || content.includes('streamlit')) {
        return {
          type: 'python-web',
          entryPoint: files.has('app.py') ? 'app.py' : 'main.py',
          outputType: 'web',
          port: 5000,
          dependencies: this.extractPythonDependencies(files),
        };
      }
    }
    
    // Node.js/React app
    if (files.has('package.json')) {
      try {
        const packageJson = JSON.parse(files.get('package.json') || '{}');
        if (packageJson.dependencies?.react) {
          return {
            type: 'react',
            entryPoint: 'src/index.js',
            outputType: 'web',
            port: 3000,
            buildCommand: 'npm install && npm run build',
            runCommand: 'npm start',
          };
        }
      } catch (e) {
        // Invalid package.json, continue with other detection
      }
    }
    
    // Static HTML
    if (files.has('index.html')) {
      return {
        type: 'static-html',
        entryPoint: 'index.html',
        outputType: 'web',
        port: 8080,
      };
    }
    
    // Python CLI
    if (filePaths.some(path => path.endsWith('.py'))) {
      return {
        type: 'python-cli',
        entryPoint: 'main.py',
        outputType: 'terminal',
        dependencies: this.extractPythonDependencies(files),
      };
    }
    
    return {
      type: 'unknown',
      entryPoint: 'main.py',
      outputType: 'terminal',
    };
  }
  
  private static extractPythonDependencies(files: Map<string, string>): string[] {
    const requirements = files.get('requirements.txt');
    if (requirements) {
      return requirements.split('\n')
        .filter(line => line.trim() && !line.startsWith('#'))
        .map(line => line.split('==')[0].split('>=')[0].split('<=')[0].trim());
    }
    
    // Extract from imports
    const dependencies: Set<string> = new Set();
    for (const content of files.values()) {
      const importMatches = content.match(/^import\s+(\w+)|^from\s+(\w+)/gm);
      importMatches?.forEach(imp => {
        const match = imp.match(/(?:import|from)\s+(\w+)/);
        if (match) {
          const pkg = match[1];
          // Skip built-in Python modules
          if (!['os', 'sys', 'json', 'time', 'datetime', 'math', 'random', 'collections', 'itertools', 'functools', 're', 'urllib', 'io', 'base64'].includes(pkg)) {
            dependencies.add(pkg);
          }
        }
      });
    }
    
    return Array.from(dependencies);
  }

  static getPackageMapping(dependencies: string[]): string[] {
    const mapping: Record<string, string> = {
      'flask': 'flask',
      'fastapi': 'fastapi',
      'streamlit': 'streamlit',
      'pandas': 'pandas',
      'numpy': 'numpy',
      'matplotlib': 'matplotlib',
      'seaborn': 'seaborn',
      'plotly': 'plotly',
      'scipy': 'scipy',
      'sklearn': 'scikit-learn',
      'requests': 'requests',
      'beautifulsoup4': 'beautifulsoup4',
      'bs4': 'beautifulsoup4',
      'selenium': 'selenium',
      'sqlalchemy': 'sqlalchemy',
      'django': 'django',
      'pytest': 'pytest',
      'pillow': 'pillow',
      'opencv': 'opencv-python',
      'cv2': 'opencv-python',
      'tensorflow': 'tensorflow',
      'torch': 'torch',
      'transformers': 'transformers',
      'openai': 'openai',
    };

    return dependencies.map(dep => mapping[dep] || dep);
  }

  static createDockerfile(appConfig: AppConfig): string {
    switch (appConfig.type) {
      case 'python-web':
      case 'python-cli':
        return `FROM python:3.9-slim

WORKDIR /app

COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

COPY . .

EXPOSE ${appConfig.port || 8000}

CMD ["python", "${appConfig.entryPoint}"]`;

      case 'react':
        return `FROM node:16-alpine

WORKDIR /app

COPY package*.json ./
RUN npm install

COPY . .

RUN npm run build

EXPOSE ${appConfig.port || 3000}

CMD ["npm", "start"]`;

      case 'static-html':
        return `FROM nginx:alpine

COPY . /usr/share/nginx/html

EXPOSE 80

CMD ["nginx", "-g", "daemon off;"]`;

      default:
        return '';
    }
  }
} 