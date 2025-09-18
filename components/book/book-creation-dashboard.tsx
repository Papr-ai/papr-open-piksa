'use client';

import { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { BookOpen, PenTool, Users, Image, Plus, Clock, CheckCircle } from 'lucide-react';
import Link from 'next/link';

interface Book {
  bookId: string;
  bookTitle: string;
  chapterCount: number;
  totalWordCount: number;
  lastUpdated: Date;
  userId: string;
}

interface BookWithProgress extends Book {
  progress: number;
  lastUpdatedFormatted: string;
  status: string; // derived status
  currentStep?: number;
  totalSteps?: number;
  completedSteps?: number;
  hasWorkflow?: boolean;
  currentStepName?: string;
  workflowSteps?: Array<{
    stepNumber: number;
    stepName: string;
    status: string;
    hasData: boolean;
  }>;
}

const getStatusColor = (status: string) => {
  switch (status) {
    case 'planning': return 'bg-yellow-100 text-yellow-800 border-yellow-200';
    case 'writing': return 'bg-blue-100 text-blue-800 border-blue-200';
    case 'illustrating': return 'bg-purple-100 text-purple-800 border-purple-200';
    case 'finalizing': return 'bg-orange-100 text-orange-800 border-orange-200';
    case 'completed': return 'bg-green-100 text-green-800 border-green-200';
    default: return 'bg-gray-100 text-gray-800 border-gray-200';
  }
};

const getStatusIcon = (status: string) => {
  switch (status) {
    case 'planning': return <Clock className="w-3 h-3" />;
    case 'writing': return <PenTool className="w-3 h-3" />;
    case 'illustrating': return <Image className="w-3 h-3" />;
    case 'finalizing': return <BookOpen className="w-3 h-3" />;
    case 'completed': return <CheckCircle className="w-3 h-3" />;
    default: return <Clock className="w-3 h-3" />;
  }
};

export function BookCreationDashboard() {
  const [books, setBooks] = useState<BookWithProgress[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    fetchBooks();
  }, []);

  const fetchBooks = async () => {
    try {
      const response = await fetch('/api/books');
      if (response.ok) {
        const data = await response.json();
        
        // Fetch workflow progress for each book
        const booksWithProgress: BookWithProgress[] = await Promise.all(
          data.books.map(async (book: Book) => {
            try {
              // Try workflow progress first
              const workflowResponse = await fetch(`/api/books/${book.bookId}/workflow-progress`);
              const workflowData = workflowResponse.ok ? await workflowResponse.json() : null;
              
              if (workflowData && workflowData.hasWorkflow) {
                // Use workflow-based progress
                return {
                  ...book,
                  progress: workflowData.progressPercentage || 0,
                  lastUpdatedFormatted: formatLastUpdated(book.lastUpdated),
                  status: deriveWorkflowStatus(workflowData),
                  currentStep: workflowData.currentStep,
                  totalSteps: workflowData.totalSteps,
                  completedSteps: workflowData.completedSteps,
                  hasWorkflow: true,
                  currentStepName: workflowData.currentStepName,
                  workflowSteps: workflowData.steps,
                };
              } else {
                // Fallback to task-based progress
                const progressResponse = await fetch(`/api/books/${book.bookId}/progress`);
                const progressData = progressResponse.ok ? await progressResponse.json() : null;
                
                return {
                  ...book,
                  progress: progressData?.progressPercentage || 0,
                  lastUpdatedFormatted: formatLastUpdated(book.lastUpdated),
                  status: deriveStatus(book, progressData),
                  currentStep: progressData?.currentStep,
                  totalSteps: progressData?.totalSteps,
                  completedSteps: progressData?.completedSteps,
                  hasWorkflow: false,
                };
              }
            } catch (error) {
              console.error(`Error fetching progress for book ${book.bookId}:`, error);
              return {
                ...book,
                progress: 0,
                lastUpdatedFormatted: formatLastUpdated(book.lastUpdated),
                status: 'planning',
                hasWorkflow: false,
              };
            }
          })
        );
        
        setBooks(booksWithProgress);
      }
    } catch (error) {
      console.error('Error fetching books:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const calculateProgress = (book: Book): number => {
    // More realistic progress calculation
    // Assume a book needs around 50,000-80,000 words to be "complete"
    const targetWordsForBook = 60000; // Average novel length
    const targetChaptersForBook = 20; // Average number of chapters
    
    // Calculate progress based on both word count and chapter count
    const wordProgress = Math.min(100, (book.totalWordCount / targetWordsForBook) * 100);
    const chapterProgress = Math.min(100, (book.chapterCount / targetChaptersForBook) * 100);
    
    // Take the average of both metrics, but cap at reasonable levels
    const averageProgress = (wordProgress + chapterProgress) / 2;
    
    // Round to nearest 5% for cleaner display
    return Math.round(averageProgress / 5) * 5;
  };

  const formatLastUpdated = (date: Date): string => {
    const now = new Date();
    const diffMs = now.getTime() - new Date(date).getTime();
    const diffHours = Math.floor(diffMs / (1000 * 60 * 60));
    const diffDays = Math.floor(diffHours / 24);

    if (diffHours < 1) return 'Just now';
    if (diffHours < 24) return `${diffHours} hour${diffHours > 1 ? 's' : ''} ago`;
    if (diffDays < 7) return `${diffDays} day${diffDays > 1 ? 's' : ''} ago`;
    return new Date(date).toLocaleDateString();
  };

  const deriveWorkflowStatus = (workflowData: any): string => {
    const { currentStep, progressPercentage } = workflowData;
    
    if (progressPercentage === 100) return 'completed';
    if (currentStep === 1) return 'planning';
    if (currentStep === 2) return 'writing';
    if (currentStep === 3) return 'writing';
    if (currentStep === 4) return 'illustrating';
    if (currentStep === 5) return 'illustrating';
    if (currentStep === 6) return 'finalizing';
    
    return 'planning';
  };

  const deriveStatus = (book: Book, progressData?: any): string => {
    if (!progressData) {
      // Fallback to word-based status if no progress data
      if (book.totalWordCount === 0) return 'planning';
      if (book.totalWordCount < 5000) return 'writing';
      return 'writing';
    }

    const { currentStep, progressPercentage } = progressData;
    
    if (progressPercentage === 100) return 'completed';
    if (currentStep === 1) return 'planning';
    if (currentStep === 2) return 'writing';
    if (currentStep >= 3 && currentStep <= 6) return 'illustrating';
    if (currentStep === 7) return 'finalizing';
    
    return 'planning';
  };

  return (
    <div className="container mx-auto p-6 max-w-6xl">
      {/* Header */}
      <div className="flex justify-between items-center mb-8">
        <div>
          <h1 className="text-3xl font-bold text-foreground">My Books</h1>
          <p className="text-muted-foreground mt-2">
            Create amazing stories with AI-powered writing assistance
          </p>
        </div>
        <Link href="/books/new">
          <Button size="lg" className="gap-2">
            <Plus className="w-4 h-4" />
            Start New Book
          </Button>
        </Link>
      </div>

      {/* Quick Actions */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-8">
        <Link href="/books/new">
          <Card className="hover:shadow-md transition-shadow cursor-pointer">
            <CardContent className="flex items-center gap-3 p-4">
              <div className="p-2 bg-primary/10 rounded-lg">
                <PenTool className="w-5 h-5 text-primary" />
              </div>
              <div>
                <p className="font-medium">Start Writing</p>
                <p className="text-sm text-muted-foreground">Begin a new book</p>
              </div>
            </CardContent>
          </Card>
        </Link>

        <Link href="/characters">
          <Card className="hover:shadow-md transition-shadow cursor-pointer">
            <CardContent className="flex items-center gap-3 p-4">
              <div className="p-2 bg-blue-100 rounded-lg">
                <Users className="w-5 h-5 text-blue-600" />
              </div>
              <div>
                <p className="font-medium">Characters</p>
                <p className="text-sm text-muted-foreground">Manage characters</p>
              </div>
            </CardContent>
          </Card>
        </Link>

        <Link href="/illustrations">
          <Card className="hover:shadow-md transition-shadow cursor-pointer">
            <CardContent className="flex items-center gap-3 p-4">
              <div className="p-2 bg-purple-100 rounded-lg">
                <Image className="w-5 h-5 text-purple-600" />
              </div>
              <div>
                <p className="font-medium">Illustrations</p>
                <p className="text-sm text-muted-foreground">Create artwork</p>
              </div>
            </CardContent>
          </Card>
        </Link>

      </div>

      {/* Recent Books */}
      <div className="mb-8">
        <h2 className="text-xl font-semibold mb-4">Recent Books</h2>
        {isLoading ? (
          <Card>
            <CardContent className="flex items-center justify-center py-12">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
              <span className="ml-3">Loading your books...</span>
            </CardContent>
          </Card>
        ) : books.length === 0 ? (
          <Card>
            <CardContent className="flex flex-col items-center justify-center py-12">
              <BookOpen className="w-12 h-12 text-muted-foreground mb-4" />
              <h3 className="text-lg font-medium mb-2">No books yet</h3>
              <p className="text-muted-foreground text-center mb-4">
                Start your first book and let AI help you create something amazing!
              </p>
              <Link href="/books/new">
                <Button className="gap-2">
                  <Plus className="w-4 h-4" />
                  Create Your First Book
                </Button>
              </Link>
            </CardContent>
          </Card>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {books.map((book) => (
              <Link key={book.bookId} href={book.hasWorkflow ? `/chat/book/${book.bookId}` : `/books/${book.bookId}`}>
                <Card className="hover:shadow-md transition-shadow cursor-pointer">
                  <CardHeader>
                    <div className="flex justify-between items-start">
                      <div>
                        <CardTitle className="text-lg line-clamp-2">{book.bookTitle}</CardTitle>
                        <CardDescription>
                          {book.hasWorkflow ? 'Book Creation Workflow' : 'Book Project'}
                          {book.currentStepName && (
                            <span className="block text-xs text-muted-foreground mt-1">
                              Current: {book.currentStepName}
                            </span>
                          )}
                        </CardDescription>
                      </div>
                      <Badge 
                        variant="outline" 
                        className={`gap-1 ${getStatusColor(book.status)}`}
                      >
                        {getStatusIcon(book.status)}
                        {book.status}
                      </Badge>
                    </div>
                  </CardHeader>
                  <CardContent>
                    <div className="space-y-3">
                      {/* Progress Bar */}
                      <div>
                        <div className="flex justify-between text-sm mb-1">
                          <span>Progress</span>
                          <span>{book.progress}%</span>
                        </div>
                        <div className="w-full bg-gray-200 rounded-full h-2">
                          <div 
                            className="bg-primary h-2 rounded-full transition-all"
                            style={{ width: `${book.progress}%` }}
                          />
                        </div>
                        {book.hasWorkflow && book.totalSteps && (
                          <div className="text-xs text-muted-foreground mt-1">
                            {book.completedSteps} of {book.totalSteps} steps completed
                          </div>
                        )}
                      </div>
                      
                      {/* Stats */}
                      <div className="flex justify-between text-sm text-muted-foreground">
                        <span>{book.chapterCount} chapters</span>
                        <span>{book.totalWordCount.toLocaleString()} words</span>
                      </div>
                      
                      {/* Workflow Steps Preview */}
                      {book.hasWorkflow && book.workflowSteps && (
                        <div className="text-xs">
                          <div className="flex flex-wrap gap-1 mt-2">
                            {book.workflowSteps.slice(0, 6).map((step) => (
                              <div
                                key={step.stepNumber}
                                className={`w-2 h-2 rounded-full ${
                                  step.status === 'completed' || step.status === 'approved'
                                    ? 'bg-green-500'
                                    : step.status === 'in_progress'
                                    ? 'bg-blue-500'
                                    : 'bg-gray-300'
                                }`}
                                title={`${step.stepName}: ${step.status}`}
                              />
                            ))}
                          </div>
                        </div>
                      )}
                      
                      <div className="text-xs text-muted-foreground">
                        Updated {book.lastUpdatedFormatted}
                      </div>
                    </div>
                  </CardContent>
                </Card>
              </Link>
            ))}
          </div>
        )}
      </div>

      {/* Writing Tips */}
      <Card>
        <CardHeader>
          <CardTitle>Writing Tips</CardTitle>
          <CardDescription>
            Get the most out of your book creation experience
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div>
              <h4 className="font-medium mb-2">Start with Planning</h4>
              <p className="text-sm text-muted-foreground">
                Use our story planning tools to outline your plot, develop characters, and establish your book&apos;s themes before you start writing.
              </p>
            </div>
            <div>
              <h4 className="font-medium mb-2">Build Consistent Characters</h4>
              <p className="text-sm text-muted-foreground">
                Create detailed character profiles to maintain consistency throughout your story and generate character illustrations.
              </p>
            </div>
            <div>
              <h4 className="font-medium mb-2">Use Memory for Continuity</h4>
              <p className="text-sm text-muted-foreground">
                Our AI remembers your story elements, characters, and plot points to maintain consistency across chapters.
              </p>
            </div>
            <div>
              <h4 className="font-medium mb-2">Enhance with Illustrations</h4>
              <p className="text-sm text-muted-foreground">
                Add beautiful AI-generated illustrations to bring your story to life, especially for children&apos;s books.
              </p>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
