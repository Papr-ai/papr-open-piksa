import type { App } from '@/types/app';

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
