'use client';

import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { 
  FileIcon, 
  PlusIcon, 
  GitIcon,
  CodeIcon,
  TerminalIcon,
  ImageIcon,
  LineChartIcon,
} from '@/components/common/icons';

export interface ProjectContext {
  type: 'new' | 'existing';
  projectType: 'python-cli' | 'python-web' | 'react' | 'static-html' | 'data-science' | 'javascript';
  name: string;
  description: string;
  repository?: {
    owner: string;
    name: string;
    branch: string;
  };
}

interface ProjectContextSelectorProps {
  onContextSelect: (context: ProjectContext) => void;
  onSkip: () => void;
}

const PROJECT_TYPES = [
  {
    id: 'python-cli',
    name: 'Python CLI Tool',
    description: 'Command-line applications with argument parsing',
    icon: <CodeIcon size={20} />,
  },
  {
    id: 'python-web',
    name: 'Python Web App',
    description: 'Flask, FastAPI, or Django web applications',
    icon: <TerminalIcon size={20} />,
  },
  {
    id: 'react',
    name: 'React App',
    description: 'Modern React applications with JSX',
    icon: <FileIcon size={20} />,
  },
  {
    id: 'static-html',
    name: 'Static Website',
    description: 'HTML, CSS, and JavaScript websites',
    icon: <ImageIcon size={20} />,
  },
  {
    id: 'data-science',
    name: 'Data Science',
    description: 'Jupyter notebooks and data analysis projects',
    icon: <LineChartIcon size={20} />,
  },
  {
    id: 'javascript',
    name: 'Node.js App',
    description: 'Server-side JavaScript applications',
    icon: <TerminalIcon size={20} />,
  },
];

export function ProjectContextSelector({ onContextSelect, onSkip }: ProjectContextSelectorProps) {
  const [contextType, setContextType] = useState<'new' | 'existing'>('new');
  const [projectType, setProjectType] = useState<string>('');
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [repository, setRepository] = useState({
    owner: '',
    name: '',
    branch: 'main',
  });

  const handleSubmit = () => {
    if (!projectType || !name) {
      return;
    }

    const context: ProjectContext = {
      type: contextType,
      projectType: projectType as ProjectContext['projectType'],
      name,
      description,
      ...(contextType === 'existing' && repository.owner && repository.name
        ? { repository }
        : {}),
    };

    onContextSelect(context);
  };

  return (
    <Card className="w-full max-w-2xl mx-auto">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <GitIcon />
          Project Context
        </CardTitle>
        <CardDescription>
          Configure your project context to generate code that fits your needs
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        {/* Context Type Selection */}
        <div className="space-y-3">
          <Label className="text-sm font-medium">Project Context</Label>
          <div className="grid grid-cols-2 gap-3">
            <Button
              variant={contextType === 'new' ? 'default' : 'outline'}
              className="h-auto p-4 flex flex-col items-center gap-2"
              onClick={() => setContextType('new')}
            >
              <PlusIcon size={24} />
              <div className="text-center">
                <div className="font-medium">New Project</div>
                <div className="text-xs text-gray-500">Create from scratch</div>
              </div>
            </Button>
            <Button
              variant={contextType === 'existing' ? 'default' : 'outline'}
              className="h-auto p-4 flex flex-col items-center gap-2"
              onClick={() => setContextType('existing')}
            >
              <GitIcon />
              <div className="text-center">
                <div className="font-medium">Existing Project</div>
                <div className="text-xs text-gray-500">Extend existing code</div>
              </div>
            </Button>
          </div>
        </div>

        {/* Project Type Selection */}
        <div className="space-y-3">
          <Label className="text-sm font-medium">Project Type</Label>
          <div className="grid grid-cols-2 gap-3">
            {PROJECT_TYPES.map((type) => (
              <Button
                key={type.id}
                variant={projectType === type.id ? 'default' : 'outline'}
                className="h-auto p-4 flex items-start gap-3 text-left"
                onClick={() => setProjectType(type.id)}
              >
                {type.icon}
                <div className="flex-1 min-w-0">
                  <div className="font-medium text-sm">{type.name}</div>
                  <div className="text-xs text-gray-500 line-clamp-2">
                    {type.description}
                  </div>
                </div>
              </Button>
            ))}
          </div>
        </div>

        {/* Project Details */}
        <div className="space-y-4">
          <div>
            <Label htmlFor="name" className="text-sm font-medium">
              Project Name
            </Label>
            <Input
              id="name"
              placeholder="my-awesome-project"
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="mt-1"
            />
          </div>

          <div>
            <Label htmlFor="description" className="text-sm font-medium">
              Description (Optional)
            </Label>
            <Textarea
              id="description"
              placeholder="A brief description of what this project does..."
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              className="mt-1"
              rows={3}
            />
          </div>
        </div>

        {/* Repository Details (for existing projects) */}
        {contextType === 'existing' && (
          <div className="space-y-4 p-4 bg-gray-50 rounded-lg">
            <h4 className="font-medium text-sm">Repository Details</h4>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label htmlFor="owner" className="text-sm font-medium">
                  Owner
                </Label>
                <Input
                  id="owner"
                  placeholder="username"
                  value={repository.owner}
                  onChange={(e) => setRepository(prev => ({ ...prev, owner: e.target.value }))}
                  className="mt-1"
                />
              </div>
              <div>
                <Label htmlFor="repo-name" className="text-sm font-medium">
                  Repository Name
                </Label>
                <Input
                  id="repo-name"
                  placeholder="my-repo"
                  value={repository.name}
                  onChange={(e) => setRepository(prev => ({ ...prev, name: e.target.value }))}
                  className="mt-1"
                />
              </div>
            </div>
            <div>
              <Label htmlFor="branch" className="text-sm font-medium">
                Branch
              </Label>
              <Input
                id="branch"
                placeholder="main"
                value={repository.branch}
                onChange={(e) => setRepository(prev => ({ ...prev, branch: e.target.value }))}
                className="mt-1"
              />
            </div>
          </div>
        )}

        {/* Actions */}
        <div className="flex justify-between pt-4">
          <Button variant="outline" onClick={onSkip}>
            Skip Context Setup
          </Button>
          <Button 
            onClick={handleSubmit}
            disabled={!projectType || !name}
          >
            Set Project Context
          </Button>
        </div>
      </CardContent>
    </Card>
  );
} 