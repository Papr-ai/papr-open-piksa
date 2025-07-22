'use client';

import React, { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { Textarea } from '@/components/ui/textarea';
import { toast } from 'sonner';
import { useRouter } from 'next/navigation';

export default function CreateProject() {
  const [projectDescription, setProjectDescription] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const router = useRouter();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!projectDescription.trim()) {
      toast.error('Please provide a project description');
      return;
    }
    
    setIsLoading(true);
    
    try {
      const response = await fetch('/api/generate-project', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ projectDescription }),
      });
      
      if (!response.ok) {
        throw new Error('Failed to generate project');
      }
      
      toast.success('Project generation started in a new chat');
      router.push('/chat'); // Navigate to chat page where the project will appear
    } catch (error) {
      console.error('Error generating project:', error);
      toast.error('Failed to generate project. Please try again.');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="container mx-auto py-8 px-4 max-w-2xl">
      <h1 className="text-2xl font-bold mb-6">Create New Code Project</h1>
      
      <Card>
        <CardHeader>
          <CardTitle>Project Description</CardTitle>
          <CardDescription>
            Describe the project you want to create in detail. Include technologies,
            features, and any specific requirements.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit}>
            <Textarea
              placeholder="Example: Create a React todo app with TypeScript and Tailwind CSS. It should have features for adding, completing, and deleting tasks, as well as filtering by status."
              value={projectDescription}
              onChange={(e) => setProjectDescription(e.target.value)}
              className="min-h-[200px] mb-4"
            />
            <div className="flex justify-end">
              <Button 
                type="submit" 
                disabled={isLoading || !projectDescription.trim()}
              >
                {isLoading ? 'Generating...' : 'Generate Project'}
              </Button>
            </div>
          </form>
        </CardContent>
        <CardFooter className="flex flex-col items-start">
          <p className="text-sm text-gray-500">
            The AI will create multiple files for your project, each as a separate code artifact
            in a new conversation.
          </p>
        </CardFooter>
      </Card>
      
      <div className="mt-8">
        <h2 className="text-xl font-semibold mb-4">Examples</h2>
        <div className="grid gap-4">
          <Card className="cursor-pointer hover:bg-gray-50" onClick={() => 
            setProjectDescription('Create a full-stack web application using Next.js, Tailwind CSS, and Prisma for a blog platform. The blog should have user authentication, posts with comments, and categories. Include API routes for CRUD operations.')
          }>
            <CardContent className="p-4">
              <p className="font-medium">Next.js Blog Platform</p>
              <p className="text-sm text-gray-600 mt-1">Full-stack with authentication, comments, and categories</p>
            </CardContent>
          </Card>
          
          <Card className="cursor-pointer hover:bg-gray-50" onClick={() => 
            setProjectDescription('Create a React Native mobile app for a fitness tracker. Include screens for workout logging, progress tracking, and user profiles. Use Redux for state management and styled-components for UI.')
          }>
            <CardContent className="p-4">
              <p className="font-medium">React Native Fitness Tracker</p>
              <p className="text-sm text-gray-600 mt-1">Mobile app with multiple screens and Redux</p>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
} 