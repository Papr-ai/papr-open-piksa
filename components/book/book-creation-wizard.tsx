'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { ArrowLeft, ArrowRight, BookOpen, Users, Image, Wand2 } from 'lucide-react';
import { toast } from '@/components/common/toast';

interface BookData {
  genre: string;
  startingPoint: 'blank' | 'idea' | 'characters' | 'outline';
  quickPrompt: string;
  isPictureBook: boolean;
}

const genres = [
  'Children\'s Fantasy',
  'Children\'s Adventure',
  'Educational',
  'Comic Book',
  'Young Adult Fantasy',
  'Young Adult Romance',
  'Mystery/Thriller',
  'Science Fiction',
  'Historical Fiction',
  'Biography/Memoir',
  'Self-Help',
  'Poetry',
  'Other'
];

// Removed age groups - AI can determine appropriate complexity from genre and content

const startingPoints = [
  { 
    id: 'blank', 
    name: 'Start from scratch', 
    description: 'I have a basic idea and want the AI to help develop everything',
    icon: BookOpen
  },
  { 
    id: 'idea', 
    name: 'I have a story idea', 
    description: 'I know what I want to write about and need help structuring it',
    icon: Wand2
  },
  { 
    id: 'characters', 
    name: 'I have characters', 
    description: 'I\'ve already developed some characters and want to build a story around them',
    icon: Users
  },
  { 
    id: 'outline', 
    name: 'I have an outline', 
    description: 'I have a plot outline and need help writing the actual content',
    icon: ArrowRight
  }
];

export function BookCreationWizard() {
  const router = useRouter();
  const [currentStep, setCurrentStep] = useState(1);
  const [isLoading, setIsLoading] = useState(false);
  const [bookData, setBookData] = useState<BookData>({
    genre: '',
    startingPoint: 'blank',
    quickPrompt: '',
    isPictureBook: false
  });

  const totalSteps = 1;

  const handleNext = () => {
    if (currentStep < totalSteps) {
      setCurrentStep(currentStep + 1);
    }
  };

  const handlePrevious = () => {
    if (currentStep > 1) {
      setCurrentStep(currentStep - 1);
    }
  };

  // Simplified form - no complex character/theme management needed

  const handleCreateBook = async () => {
    setIsLoading(true);
    try {
      // Create a comprehensive prompt for the AI to process
      let initialPrompt = `I want to create a ${bookData.genre.toLowerCase()} book`;
      if (bookData.isPictureBook) {
        initialPrompt += ' (picture book with illustrations)';
      }
      initialPrompt += '. ';
      
      if (bookData.quickPrompt) {
        initialPrompt += bookData.quickPrompt + ' ';
      }
      
      // Add specific guidance based on starting point
      switch (bookData.startingPoint) {
        case 'blank':
          initialPrompt += 'I\'m starting from scratch and need help with everything - title, story planning, characters, and plot development.';
          break;
        case 'idea':
          initialPrompt += 'I have a story idea and need help structuring it, developing characters, and creating a compelling plot.';
          break;
        case 'characters':
          initialPrompt += 'I\'ve already developed some characters and want to build an engaging story around them.';
          break;
        case 'outline':
          initialPrompt += 'I have a plot outline and need help writing the actual content and bringing the story to life.';
          break;
      }
      
      initialPrompt += ' Please help me plan and write this book. Focus on creating actual story content for the book itself, and use separate documents for any writing tools like outlines, character profiles, or style guides. Start by suggesting a compelling title and creating the book structure.';
      
      toast({ type: 'success', description: 'Starting your book creation process...' });
      
      // Generate a new chat UUID and navigate with the initial prompt
      const chatId = crypto.randomUUID();
      
      // Store the initial prompt and book type in sessionStorage so the chat can pick it up
      sessionStorage.setItem(`initial-prompt-${chatId}`, initialPrompt);
      sessionStorage.setItem(`is-picture-book-${chatId}`, bookData.isPictureBook.toString());
      
      // Navigate to the new chat page - this will create a new chat via the API
      router.push(`/chat/${chatId}`);
    } catch (error) {
      console.error('Error starting book creation:', error);
      toast({ type: 'error', description: 'Failed to start book creation. Please try again.' });
    } finally {
      setIsLoading(false);
    }
  };

  const canProceed = () => {
    return bookData.genre && bookData.startingPoint;
  };

  const renderStep = () => {
    return (
      <div className="space-y-8">
        {/* Genre Selection and Picture Book Checkbox - Enhanced Design */}
        <div className="space-y-4">
          <div className="flex flex-col md:flex-row md:items-end gap-6">
            {/* Genre Selection */}
            <div className="flex-1">
              <Label htmlFor="genre" className="text-base font-medium">What type of book do you want to write? *</Label>
              <Select value={bookData.genre} onValueChange={(value) => setBookData(prev => ({ ...prev, genre: value }))}>
                <SelectTrigger className="mt-3 h-12">
                  <SelectValue placeholder="Select a genre" />
                </SelectTrigger>
                <SelectContent>
                  {genres.map((genre) => (
                    <SelectItem key={genre} value={genre}>{genre}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* Picture Book Checkbox - Enhanced */}
            <div className="flex items-center space-x-3 md:pb-1">
              <div className="flex items-center space-x-3 p-3 rounded-lg border border-gray-200 hover:border-gray-300 transition-colors">
                <input
                  type="checkbox"
                  id="pictureBook"
                  checked={bookData.isPictureBook}
                  onChange={(e) => setBookData(prev => ({ ...prev, isPictureBook: e.target.checked }))}
                  className="w-5 h-5 text-primary border-gray-300 rounded focus:ring-primary focus:ring-2"
                />
                <Label htmlFor="pictureBook" className="flex items-center gap-2 cursor-pointer whitespace-nowrap font-medium">
                  <Image className="w-5 h-5 text-primary" />
                  Picture book
                </Label>
              </div>
            </div>
          </div>
        </div>

        {/* Starting Point Selection - Compact */}
        <div>
          <Label className="text-base font-medium">How would you like to start? *</Label>
          <p className="text-sm text-muted-foreground mb-4">
            Choose your starting point - the AI will help develop everything else through conversation.
          </p>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            {startingPoints.map((point) => {
              const IconComponent = point.icon;
              return (
                <div
                  key={point.id}
                  className={`cursor-pointer transition-all rounded-lg border-2 p-4 ${
                    bookData.startingPoint === point.id 
                      ? 'border-primary bg-primary/5' 
                      : 'border-gray-200 hover:border-gray-300 hover:bg-gray-50'
                  }`}
                  onClick={() => setBookData(prev => ({ ...prev, startingPoint: point.id as any }))}
                >
                  <div className="flex items-center gap-3">
                    <IconComponent className="w-5 h-5 text-primary flex-shrink-0" />
                    <div className="min-w-0">
                      <h3 className="font-medium text-sm mb-1">{point.name}</h3>
                      <p className="text-xs text-muted-foreground leading-tight">{point.description}</p>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* Quick Prompt */}
        <div>
          <Label htmlFor="quickPrompt">Tell us about your book idea (Optional)</Label>
          <Textarea
            id="quickPrompt"
            value={bookData.quickPrompt}
            onChange={(e) => setBookData(prev => ({ ...prev, quickPrompt: e.target.value }))}
            placeholder="Tell me briefly about your idea, characters, or what you want to write about..."
            className="mt-2 min-h-[100px]"
          />
          <p className="text-sm text-muted-foreground mt-2">
            This helps the AI understand your vision from the start. You can always develop this further in the chat.
          </p>
        </div>
      </div>
    );
  };

  return (
    <div className="container mx-auto max-w-4xl p-6 min-h-full">
      {/* Header */}
      <div className="flex items-center gap-4 mb-8">
        <Button
          onClick={() => router.push('/books')}
          variant="ghost"
          size="sm"
        >
          <ArrowLeft className="w-4 h-4 mr-2" />
          Back to Books
        </Button>

      </div>

      {/* Removed progress bar for single step */}

      {/* Main Content */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Wand2 className="w-6 h-6" />
            Let&apos;s Create Your Book
          </CardTitle>
          <CardDescription>
            Just a few quick details and we&apos;ll get you started with AI-powered writing
          </CardDescription>
        </CardHeader>
        <CardContent>
          {renderStep()}
        </CardContent>
      </Card>

      {/* Single Create Button */}
      <div className="flex justify-center mt-8">
        <Button
          onClick={handleCreateBook}
          disabled={!canProceed() || isLoading}
          size="lg"
          className="gap-2 px-8"
        >
          {isLoading ? (
            <>
              <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
              Creating your book...
            </>
          ) : (
            <>
              <Wand2 className="w-4 h-4" />
              Create Book & Start Writing
            </>
          )}
        </Button>
      </div>
    </div>
  );
}
