'use client';

import { useState, useRef } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Textarea } from '@/components/ui/textarea';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { 
  BookOpen, 
  PenTool, 
  Wand2, 
  Save, 
  Plus, 
  Image, 
  Users,
  MessageSquare,
  ArrowLeft,
  MoreHorizontal
} from 'lucide-react';
import { useRouter } from 'next/navigation';

interface Chapter {
  id: string;
  number: number;
  title: string;
  content: string;
  wordCount: number;
  status: 'draft' | 'review' | 'completed';
}

interface BookProject {
  id: string;
  title: string;
  genre: string;
  targetAge: string;
  chapters: Chapter[];
  currentChapter: number;
}

// Mock data - replace with real data from your API
const mockBook: BookProject = {
  id: '1',
  title: 'The Magical Forest Adventure',
  genre: 'Children\'s Fantasy',
  targetAge: '4-8 years',
  chapters: [
    {
      id: '1',
      number: 1,
      title: 'The Discovery',
      content: 'Once upon a time, in a small village at the edge of an enchanted forest, lived a curious little girl named Luna. She had bright green eyes that sparkled with wonder and curly auburn hair that bounced when she walked.\n\nEvery day, Luna would gaze out her bedroom window at the mysterious forest beyond the meadow. The trees seemed to whisper secrets, and sometimes she could swear she saw tiny lights dancing between the branches.\n\n"Mama," Luna asked one sunny morning, "what\'s in the forest?"\n\nHer mother smiled and ruffled her hair. "Stories, my dear. Wonderful, magical stories waiting to be discovered."',
      wordCount: 432,
      status: 'completed'
    },
    {
      id: '2',
      number: 2,
      title: 'Into the Woods',
      content: 'The next morning, Luna decided she couldn\'t wait any longer. She packed her small backpack with cookies, her favorite book, and a bottle of water.\n\nAs she stepped into the forest, the world seemed to change around her. The sunlight filtered through the leaves in golden streams, and the air hummed with magic.',
      wordCount: 187,
      status: 'draft'
    }
  ],
  currentChapter: 2
};

export function BookWritingInterface({ bookId }: { bookId: string }) {
  const router = useRouter();
  const [book] = useState<BookProject>(mockBook);
  const [currentChapter, setCurrentChapter] = useState(
    book.chapters.find(c => c.number === book.currentChapter) || book.chapters[0]
  );
  const [isWriting, setIsWriting] = useState(false);
  const [writingPrompt, setWritingPrompt] = useState('');
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  const handleAIAssist = async () => {
    if (!writingPrompt.trim()) return;
    
    setIsWriting(true);
    try {
      // Here you would integrate with your existing AI book writing tools
      // For now, we'll simulate the AI response
      await new Promise(resolve => setTimeout(resolve, 2000));
      
      const aiContent = `\n\n[AI Generated Content based on: "${writingPrompt}"]\n\nLuna's heart raced with excitement as she ventured deeper into the forest. The trees seemed to part before her, creating a natural pathway lined with glowing mushrooms that pulsed with soft, ethereal light.\n\nSuddenly, a tiny voice called out, "Who dares to enter our sacred grove?"\n\nLuna looked around but saw no one. Then, from behind a large oak tree, stepped the smallest person she had ever seen...`;
      
      setCurrentChapter(prev => ({
        ...prev,
        content: prev.content + aiContent,
        wordCount: prev.wordCount + aiContent.split(' ').length
      }));
      
      setWritingPrompt('');
    } catch (error) {
      console.error('AI writing error:', error);
    } finally {
      setIsWriting(false);
    }
  };

  const handleChapterChange = (chapter: Chapter) => {
    setCurrentChapter(chapter);
  };

  const addNewChapter = () => {
    const newChapter: Chapter = {
      id: String(book.chapters.length + 1),
      number: book.chapters.length + 1,
      title: `Chapter ${book.chapters.length + 1}`,
      content: '',
      wordCount: 0,
      status: 'draft'
    };
    
    book.chapters.push(newChapter);
    setCurrentChapter(newChapter);
  };

  const getStatusColor = (status: Chapter['status']) => {
    switch (status) {
      case 'draft': return 'bg-yellow-100 text-yellow-800 border-yellow-200';
      case 'review': return 'bg-blue-100 text-blue-800 border-blue-200';
      case 'completed': return 'bg-green-100 text-green-800 border-green-200';
      default: return 'bg-gray-100 text-gray-800 border-gray-200';
    }
  };

  return (
    <div className="flex h-full">
      {/* Sidebar - Chapter Navigation */}
      <div className="w-80 border-r bg-muted/30 flex flex-col">
        <div className="p-4 border-b">
          <div className="flex items-center gap-2 mb-2">
            <Button
              onClick={() => router.push('/books')}
              variant="ghost"
              size="sm"
            >
              <ArrowLeft className="w-4 h-4 mr-1" />
              Books
            </Button>
          </div>
          <h2 className="font-semibold text-lg truncate">{book.title}</h2>
          <p className="text-sm text-muted-foreground">{book.genre}</p>
        </div>

        <div className="flex-1 overflow-y-auto">
          <div className="p-4">
            <div className="flex justify-between items-center mb-3">
              <h3 className="font-medium">Chapters</h3>
              <Button onClick={addNewChapter} variant="ghost" size="sm">
                <Plus className="w-4 h-4" />
              </Button>
            </div>
            
            <div className="space-y-2">
              {book.chapters.map((chapter) => (
                <div
                  key={chapter.id}
                  onClick={() => handleChapterChange(chapter)}
                  className={`p-3 rounded-lg cursor-pointer transition-colors ${
                    currentChapter.id === chapter.id 
                      ? 'bg-primary/10 border border-primary/20' 
                      : 'hover:bg-muted/50'
                  }`}
                >
                  <div className="flex justify-between items-start mb-1">
                    <span className="font-medium text-sm">
                      Chapter {chapter.number}
                    </span>
                    <Badge 
                      variant="outline" 
                      className={`text-xs ${getStatusColor(chapter.status)}`}
                    >
                      {chapter.status}
                    </Badge>
                  </div>
                  <p className="text-sm text-muted-foreground truncate mb-2">
                    {chapter.title}
                  </p>
                  <p className="text-xs text-muted-foreground">
                    {chapter.wordCount} words
                  </p>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Quick Actions */}
        <div className="p-4 border-t space-y-2">
          <Button variant="outline" size="sm" className="w-full gap-2">
            <Users className="w-4 h-4" />
            Characters
          </Button>
          <Button variant="outline" size="sm" className="w-full gap-2">
            <Image className="w-4 h-4" />
            Illustrations
          </Button>
        </div>
      </div>

      {/* Main Writing Area */}
      <div className="flex-1 flex flex-col">
        {/* Chapter Header */}
        <div className="p-6 border-b bg-background">
          <div className="flex justify-between items-start mb-4">
            <div>
              <Input
                value={currentChapter.title}
                onChange={(e) => setCurrentChapter(prev => ({ ...prev, title: e.target.value }))}
                className="text-2xl font-bold border-none p-0 h-auto bg-transparent"
                placeholder="Chapter Title"
              />
              <p className="text-muted-foreground mt-1">
                Chapter {currentChapter.number} • {currentChapter.wordCount} words
              </p>
            </div>
            <div className="flex gap-2">
              <Button variant="outline" size="sm">
                <Save className="w-4 h-4 mr-2" />
                Save
              </Button>
              <Button variant="outline" size="sm">
                <MoreHorizontal className="w-4 h-4" />
              </Button>
            </div>
          </div>

          {/* AI Writing Assistant */}
          <Card className="bg-muted/30">
            <CardContent className="p-4">
              <div className="flex gap-3">
                <div className="flex-1">
                  <Input
                    placeholder="Tell the AI what happens next... (e.g., 'Luna meets a friendly fairy')"
                    value={writingPrompt}
                    onChange={(e) => setWritingPrompt(e.target.value)}
                    onKeyDown={(e) => e.key === 'Enter' && handleAIAssist()}
                  />
                </div>
                <Button 
                  onClick={handleAIAssist}
                  disabled={isWriting || !writingPrompt.trim()}
                  className="gap-2"
                >
                  {isWriting ? (
                    <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                  ) : (
                    <Wand2 className="w-4 h-4" />
                  )}
                  {isWriting ? 'Writing...' : 'AI Assist'}
                </Button>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Text Editor */}
        <div className="flex-1 p-6">
          <Textarea
            ref={textareaRef}
            value={currentChapter.content}
            onChange={(e) => {
              const newContent = e.target.value;
              const wordCount = newContent.trim() ? newContent.trim().split(/\s+/).length : 0;
              setCurrentChapter(prev => ({ 
                ...prev, 
                content: newContent,
                wordCount 
              }));
            }}
            placeholder="Start writing your story here..."
            className="w-full h-full min-h-[400px] resize-none border-none focus:ring-0 text-base leading-relaxed"
            style={{ fontSize: '16px', lineHeight: '1.6' }}
          />
        </div>

        {/* Status Bar */}
        <div className="p-4 border-t bg-muted/30 flex justify-between items-center text-sm text-muted-foreground">
          <div className="flex gap-4">
            <span>Words: {currentChapter.wordCount}</span>
            <span>Characters: {currentChapter.content.length}</span>
          </div>
          <div className="flex gap-2">
            <Badge variant="outline" className={getStatusColor(currentChapter.status)}>
              {currentChapter.status}
            </Badge>
          </div>
        </div>
      </div>
    </div>
  );
}
