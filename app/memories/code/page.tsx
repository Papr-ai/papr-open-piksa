import React from 'react';
import { auth } from '@/app/(auth)/auth';
import { redirect } from 'next/navigation';
// Remove ProjectFilesViewer import
import { Button } from '@/components/ui/button';
import Link from 'next/link';
import { PlusIcon, FileIcon, ExternalLinkIcon } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';

// Types for project files
interface CodeArtifact {
  kind: string;
  title?: string;
  documentId: string;
}

interface Message {
  chatId?: string;
  timestamp?: string;
  artifacts?: CodeArtifact[];
}

interface ProjectFile {
  path: string;
  documentId: string;
  name: string;
  timestamp: string;
}

interface ProjectGroup {
  projectName: string;
  files: ProjectFile[];
  chatId?: string;
  timestamp: string;
}

// Simple component to display projects
function BasicProjectList({ projects }: { projects: ProjectGroup[] }) {
  if (!projects || projects.length === 0) {
    return (
      <Card className="w-full mt-4">
        <CardContent className="pt-4">
          <p className="text-sm text-gray-500">No project files found.</p>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-4">
      {projects.map((project) => (
        <Card key={project.projectName} className="w-full">
          <CardHeader className="py-3 px-4">
            <CardTitle className="text-base">{project.projectName}</CardTitle>
            <div className="text-xs text-gray-500">
              {project.files.length} {project.files.length === 1 ? 'file' : 'files'}
            </div>
          </CardHeader>
          <CardContent className="py-2 px-4">
            <div className="border rounded-md">
              {project.files.slice(0, 5).map((file) => (
                <div 
                  key={file.documentId}
                  className="flex items-center px-4 py-2 hover:bg-gray-50 border-b last:border-b-0"
                >
                  <FileIcon className="h-4 w-4 text-gray-500 mr-2" />
                  <span className="text-sm flex-grow">{file.path}</span>
                  {project.chatId && (
                    <Link 
                      href={`/chat/${project.chatId}?documentId=${file.documentId}&directOpen=true`}
                      className="text-xs text-blue-500 hover:text-blue-700 flex items-center"
                    >
                      <ExternalLinkIcon className="h-3 w-3 mr-1" />
                      Open
                    </Link>
                  )}
                </div>
              ))}
              {project.files.length > 5 && (
                <div className="px-4 py-2 text-sm text-gray-500">
                  +{project.files.length - 5} more files
                </div>
              )}
            </div>
          </CardContent>
        </Card>
      ))}
    </div>
  );
}

// Helper function to detect project files from related code artifacts
function groupRelatedCodeArtifacts(messages: Message[]): ProjectGroup[] {
  // This groups artifacts by their project name based on the title pattern: "{Project Name} - {File Path}"
  const projectFiles: Record<string, ProjectGroup> = {};
  
  messages.forEach(message => {
    if (!message.artifacts) return;
    
    message.artifacts.forEach(artifact => {
      // We no longer use 'code' artifacts, but check in case there are historical ones
      // or ones that have 'text' artifacts with code content
      
      // Check for project pattern in title
      const titleMatch = artifact.title?.match(/^(.*?)\s*-\s*(.*)$/);
      if (!titleMatch) {
        // For code artifacts without project pattern, create a single-file project
        const projectName = artifact.title || 'Untitled Code';
        if (!projectFiles[projectName]) {
          projectFiles[projectName] = {
            projectName,
            files: [],
            chatId: message.chatId,
            timestamp: message.timestamp || new Date().toISOString()
          };
        }
        
        projectFiles[projectName].files.push({
          path: artifact.title || 'file',
          documentId: artifact.documentId,
          name: artifact.title || 'file',
          timestamp: message.timestamp || new Date().toISOString()
        });
        
        return;
      }
      
      const [_, projectName, filePath] = titleMatch;
      
      if (!projectFiles[projectName]) {
        projectFiles[projectName] = {
          projectName,
          files: [],
          chatId: message.chatId,
          timestamp: message.timestamp || new Date().toISOString()
        };
      }
      
      projectFiles[projectName].files.push({
        path: filePath.trim(),
        documentId: artifact.documentId,
        name: filePath.trim().split('/').pop() || 'file',
        timestamp: message.timestamp || new Date().toISOString()
      });
    });
  });
  
  return Object.values(projectFiles);
}

async function getMessages(userId?: string) {
  // Fetch all messages with artifacts from the database
  const res = await fetch(`${process.env.NEXT_PUBLIC_BASE_URL}/api/chats`, {
    cache: "no-store",
  });
  
  if (!res.ok) {
    throw new Error(`Failed to fetch chats: ${res.status}`);
  }
  
  const data = await res.json();
  return data.chats || [];
}

export default async function CodeProjects() {
  const session = await auth();
  if (!session?.user) {
    redirect('/login');
  }
  
  const messages = await getMessages(session.user.id);
  const projects = groupRelatedCodeArtifacts(messages);
  
  return (
    <div className="container mx-auto py-8 px-4">
      <div className="flex justify-between items-center mb-6">
        <h1 className="text-2xl font-bold">Code Projects</h1>
        <Link href="/memories/code/create">
          <Button>
            <PlusIcon className="w-4 h-4 mr-2" />
            Create New Project
          </Button>
        </Link>
      </div>
      
      <div className="mb-8">
        <p className="text-gray-600">
          View and access all your code projects. Each project contains multiple files that were created in conversations.
        </p>
      </div>
      
      <BasicProjectList projects={projects} />
    </div>
  );
} 