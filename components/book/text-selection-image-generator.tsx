'use client';

import { useState, useEffect, useRef } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { 
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import { SparklesIcon, ImageIcon, XIcon } from '@/components/common/icons';
import { toast } from 'sonner';

interface TextSelectionImageGeneratorProps {
  selectedText: string;
  bookTitle?: string;
  chapterTitle?: string;
  onClose: () => void;
  onGenerateImage: (params: {
    prompt: string;
    context: string;
    style: string;
    title?: string;
    subtitle?: string;
  }) => void;
  isGenerating?: boolean;
}

const imageStyles = [
  { value: 'illustration', label: 'Book Illustration', description: 'Clean, suitable for reading' },
  { value: 'artistic', label: 'Artistic', description: 'Creative and expressive' },
  { value: 'realistic', label: 'Realistic', description: 'Photorealistic style' },
  { value: 'watercolor', label: 'Watercolor', description: 'Soft watercolor painting' },
  { value: 'sketch', label: 'Sketch', description: 'Hand-drawn pencil sketch' },
  { value: 'digital-art', label: 'Digital Art', description: 'Modern digital illustration' },
];

export function TextSelectionImageGenerator({
  selectedText,
  bookTitle,
  chapterTitle,
  onClose,
  onGenerateImage,
  isGenerating = false,
}: TextSelectionImageGeneratorProps) {
  const [prompt, setPrompt] = useState('');
  const [style, setStyle] = useState('illustration');
  const [isExpanded, setIsExpanded] = useState(false);
  const cardRef = useRef<HTMLDivElement>(null);

  // Auto-generate a prompt based on the selected text
  useEffect(() => {
    if (selectedText && !prompt) {
      // Extract key visual elements from the text
      const words = selectedText.toLowerCase();
      let suggestedPrompt = '';
      
      // Simple keyword extraction for visual elements
      if (words.includes('forest') || words.includes('trees') || words.includes('woods')) {
        suggestedPrompt = 'A mystical forest scene with ancient trees and dappled sunlight';
      } else if (words.includes('castle') || words.includes('palace') || words.includes('tower')) {
        suggestedPrompt = 'A majestic castle or palace with impressive architecture';
      } else if (words.includes('character') || words.includes('person') || words.includes('hero')) {
        suggestedPrompt = 'A portrait of the main character described in the text';
      } else if (words.includes('battle') || words.includes('fight') || words.includes('war')) {
        suggestedPrompt = 'An epic battle scene with dramatic action and tension';
      } else if (words.includes('magic') || words.includes('spell') || words.includes('wizard')) {
        suggestedPrompt = 'A magical scene with mystical elements and enchanting atmosphere';
      } else {
        // Fallback: use the first few words as inspiration
        const firstWords = selectedText.split(' ').slice(0, 8).join(' ');
        suggestedPrompt = `A scene depicting: ${firstWords}`;
      }
      
      setPrompt(suggestedPrompt);
    }
  }, [selectedText, prompt]);

  const handleGenerate = () => {
    if (!prompt.trim()) {
      toast.error('Please enter a description for the image');
      return;
    }

          onGenerateImage({
        prompt: prompt.trim(),
        context: selectedText,
        style,
        title: bookTitle,
        subtitle: chapterTitle,
      });
  };

  const truncatedText = selectedText.length > 100 
    ? `${selectedText.substring(0, 100)}...` 
    : selectedText;

  return (
    <Card 
      ref={cardRef}
      className="fixed z-50 bg-white dark:bg-zinc-900 border border-gray-200 dark:border-zinc-700 shadow-lg max-w-md"
      style={{
        // Position the card near the selection, but ensure it's visible
        top: '50%',
        left: '50%',
        transform: 'translate(-50%, -50%)',
      }}
    >
      <CardContent className="p-4 space-y-4">
        {/* Header */}
        <div className="flex items-start justify-between">
          <div className="flex items-center gap-2">
            <ImageIcon size={16} className="text-purple-600" />
            <h3 className="font-medium text-sm">Generate Illustration</h3>
          </div>
          <Button
            size="sm"
            variant="ghost"
            onClick={onClose}
            className="h-6 w-6 p-0 text-gray-400 hover:text-gray-600"
          >
            <XIcon size={14} />
          </Button>
        </div>

        {/* Selected text preview */}
        <div className="space-y-2">
          <div className="text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wide">
            Selected Text
          </div>
          <div className="text-sm bg-gray-50 dark:bg-zinc-800 rounded-md p-2 border">
            <div className="text-gray-700 dark:text-gray-300">
              &quot;{truncatedText}&quot;
            </div>
            {selectedText.length > 100 && (
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setIsExpanded(!isExpanded)}
                className="mt-1 h-6 text-xs text-blue-600 hover:text-blue-700 p-0"
              >
                {isExpanded ? 'Show less' : `Show ${selectedText.length - 100} more characters`}
              </Button>
            )}
          </div>
          
          {isExpanded && selectedText.length > 100 && (
            <div className="text-sm bg-gray-50 dark:bg-zinc-800 rounded-md p-2 border">
              <div className="text-gray-700 dark:text-gray-300">
                &quot;{selectedText.substring(100)}&quot;
              </div>
            </div>
          )}
        </div>

        {/* Book context */}
        {(bookTitle || chapterTitle) && (
          <div className="flex flex-wrap gap-1">
            {bookTitle && (
              <Badge variant="secondary" className="text-xs">
                📖 {bookTitle}
              </Badge>
            )}
            {chapterTitle && (
              <Badge variant="secondary" className="text-xs">
                📄 {chapterTitle}
              </Badge>
            )}
          </div>
        )}

        {/* Image prompt input */}
        <div className="space-y-2">
          <div className="text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wide">
            Image Description
          </div>
          <Textarea
            value={prompt}
            onChange={(e) => setPrompt(e.target.value)}
            placeholder="Describe the image you want to generate..."
            className="text-sm resize-none"
            rows={3}
          />
        </div>

        {/* Style selection */}
        <div className="space-y-2">
          <div className="text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wide">
            Art Style
          </div>
          <Select value={style} onValueChange={setStyle}>
            <SelectTrigger className="text-sm">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {imageStyles.map((styleOption) => (
                <SelectItem key={styleOption.value} value={styleOption.value}>
                  <div className="flex flex-col">
                    <span>{styleOption.label}</span>
                    <span className="text-xs text-gray-500">{styleOption.description}</span>
                  </div>
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        {/* Generate button */}
        <Button
          onClick={handleGenerate}
          disabled={isGenerating || !prompt.trim()}
          className="w-full"
          size="sm"
        >
          {isGenerating ? (
            <>
              <div className="animate-spin w-3 h-3 border border-gray-300 border-t-white rounded-full mr-2" />
              Generating...
            </>
          ) : (
            <>
              <SparklesIcon size={14} className="mr-2" />
              Generate Illustration
            </>
          )}
        </Button>
      </CardContent>
    </Card>
  );
}
