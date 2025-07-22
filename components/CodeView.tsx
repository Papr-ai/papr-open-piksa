import type { App } from '@/types/app';
import { useState, useEffect } from 'react';

interface CodeViewProps {
  loading: boolean;
  app: App | null;
}

export function CodeView({ loading, app }: CodeViewProps) {
  if (loading) {
    return <div className="p-4">Loading code view...</div>;
  }

  if (!app) {
    return <div className="p-4">No app selected</div>;
  }

  return (
    <div className="p-4">
      <h2 className="text-lg font-semibold mb-4">Code View for {app.name}</h2>
      <pre className="bg-gray-100 dark:bg-gray-800 p-4 rounded overflow-auto">
        {/* Add code editor or syntax highlighting component here */}
        {JSON.stringify(app, null, 2)}
      </pre>
    </div>
  );
}

// Add a streaming indicator component for file generation
export const CodeStreamingIndicator = ({ filename }: { filename: string }) => {
  const [dots, setDots] = useState('');
  
  useEffect(() => {
    const interval = setInterval(() => {
      setDots(prev => prev.length >= 3 ? '' : prev + '.');
    }, 300);
    
    return () => clearInterval(interval);
  }, []);

  return (
    <div className="fixed bottom-4 right-4 px-4 py-2 bg-blue-500 text-white rounded shadow-lg z-50 flex items-center gap-2 opacity-90">
      <div className="animate-pulse w-2 h-2 bg-white rounded-full"></div>
      <span>Generating {filename}{dots}</span>
    </div>
  );
};
