'use client';

import { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Image, Plus, BookOpen, Palette } from 'lucide-react';
import Link from 'next/link';

interface BookProp {
  id: string;
  bookId: string;
  bookTitle: string;
  type: string;
  name: string;
  description?: string | null;
  metadata: any;
  imageUrl?: string | null;
  createdAt: Date;
}

export function IllustrationsPage() {
  const [illustrations, setIllustrations] = useState<BookProp[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isCreateDialogOpen, setIsCreateDialogOpen] = useState(false);
  const [isGenerating, setIsGenerating] = useState(false);
  const [newIllustration, setNewIllustration] = useState({
    title: '',
    description: '',
    style: 'children-book',
    bookId: crypto.randomUUID(),
    bookTitle: 'Standalone Illustration'
  });

  useEffect(() => {
    fetchIllustrations();
  }, []);

  const fetchIllustrations = async () => {
    try {
      // Fetch both environments and illustrations
      const [environmentsRes, illustrationsRes] = await Promise.all([
        fetch('/api/book-props?type=environment'),
        fetch('/api/book-props?type=illustration')
      ]);
      
      const environments = environmentsRes.ok ? (await environmentsRes.json()).props : [];
      const illustrationsData = illustrationsRes.ok ? (await illustrationsRes.json()).props : [];
      
      setIllustrations([...environments, ...illustrationsData]);
    } catch (error) {
      console.error('Error fetching illustrations:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const handleGenerateIllustration = async () => {
    if (!newIllustration.title.trim() || !newIllustration.description.trim()) {
      return;
    }

    setIsGenerating(true);
    try {
      // Generate the image using the chat API with image generation
      const chatResponse = await fetch('/api/chat-simple', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          messages: [{
            role: 'user',
            content: `Generate an illustration with this description: "${newIllustration.description}". Style: ${newIllustration.style}. Create a detailed, high-quality image.`
          }],
          model: 'claude-3-5-sonnet-20241022'
        }),
      });

      let imageUrl = null;
      if (chatResponse.ok) {
        const reader = chatResponse.body?.getReader();
        if (reader) {
          // Read the streaming response to find any generated image
          // This is a simplified version - you might need to adjust based on your streaming format
          const { value } = await reader.read();
          const text = new TextDecoder().decode(value);
          // Look for image URLs in the response
          const imageUrlMatch = text.match(/https:\/\/[^\s]+\.(jpg|jpeg|png|webp)/i);
          if (imageUrlMatch) {
            imageUrl = imageUrlMatch[0];
          }
        }
      }

      // Save the illustration to database
      const response = await fetch('/api/book-props', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          bookId: newIllustration.bookId,
          bookTitle: newIllustration.bookTitle,
          type: 'illustration',
          name: newIllustration.title,
          description: newIllustration.description,
          imageUrl: imageUrl,
          metadata: {
            style: newIllustration.style,
            createdFrom: 'illustrations-page',
            isStandalone: true,
            prompt: newIllustration.description
          }
        }),
      });

      if (response.ok) {
        const data = await response.json();
        setIllustrations(prev => [...prev, data.prop]);
        
        // Reset form
        setNewIllustration({
          title: '',
          description: '',
          style: 'children-book',
          bookId: crypto.randomUUID(),
          bookTitle: 'Standalone Illustration'
        });
        setIsCreateDialogOpen(false);
      } else {
        console.error('Error saving illustration:', await response.text());
      }
    } catch (error) {
      console.error('Error generating illustration:', error);
    } finally {
      setIsGenerating(false);
    }
  };

  return (
    <div className="container mx-auto p-6 max-w-6xl">
      {/* Header */}
      <div className="flex justify-between items-center mb-8">
        <div>
          <h1 className="text-3xl font-bold text-foreground">Illustrations</h1>
          <p className="text-muted-foreground mt-2">
            Create and manage AI-generated artwork for your books
          </p>
        </div>
        <Dialog open={isCreateDialogOpen} onOpenChange={setIsCreateDialogOpen}>
          <DialogTrigger asChild>
            <Button size="lg" className="gap-2">
              <Plus className="w-4 h-4" />
              Create Illustration
            </Button>
          </DialogTrigger>
          <DialogContent className="sm:max-w-[500px]">
            <DialogHeader>
              <DialogTitle>Generate Illustration</DialogTitle>
              <DialogDescription>
                Create AI-generated artwork for your stories.
              </DialogDescription>
            </DialogHeader>
            <div className="grid gap-4 py-4">
              <div className="grid gap-2">
                <Label htmlFor="title-header">Title</Label>
                <Input
                  id="title-header"
                  value={newIllustration.title}
                  onChange={(e) => setNewIllustration(prev => ({ ...prev, title: e.target.value }))}
                  placeholder="Enter illustration title..."
                />
              </div>
              
              <div className="grid gap-2">
                <Label htmlFor="description-header">Description</Label>
                <Textarea
                  id="description-header"
                  value={newIllustration.description}
                  onChange={(e) => setNewIllustration(prev => ({ ...prev, description: e.target.value }))}
                  placeholder="Describe what you want to illustrate..."
                  rows={3}
                />
              </div>

              <div className="grid gap-2">
                <Label htmlFor="style-header">Art Style</Label>
                <Select value={newIllustration.style} onValueChange={(value) => setNewIllustration(prev => ({ ...prev, style: value }))}>
                  <SelectTrigger>
                    <SelectValue placeholder="Select art style" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="children-book">Children&apos;s Book</SelectItem>
                    <SelectItem value="realistic">Realistic</SelectItem>
                    <SelectItem value="cartoon">Cartoon</SelectItem>
                    <SelectItem value="watercolor">Watercolor</SelectItem>
                    <SelectItem value="digital-art">Digital Art</SelectItem>
                    <SelectItem value="sketch">Sketch</SelectItem>
                    <SelectItem value="vintage">Vintage</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
            <DialogFooter>
              <Button
                type="button"
                variant="outline"
                onClick={() => setIsCreateDialogOpen(false)}
              >
                Cancel
              </Button>
              <Button
                type="button"
                onClick={handleGenerateIllustration}
                disabled={!newIllustration.title.trim() || !newIllustration.description.trim() || isGenerating}
              >
                {isGenerating ? 'Generating...' : 'Generate Illustration'}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>

      {/* Illustrations Grid */}
      {isLoading ? (
        <Card>
          <CardContent className="flex items-center justify-center py-16">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
            <span className="ml-3">Loading illustrations...</span>
          </CardContent>
        </Card>
      ) : illustrations.length === 0 ? (
        <Card>
          <CardContent className="flex flex-col items-center justify-center py-16">
            <Image className="w-16 h-16 text-muted-foreground mb-4" />
            <h3 className="text-xl font-semibold mb-2">No illustrations yet</h3>
            <p className="text-muted-foreground text-center mb-6 max-w-md">
              Create beautiful AI-generated illustrations for your books. Perfect for children&apos;s books, 
              graphic novels, and any story that needs visual enhancement.
            </p>
            <div className="flex gap-3">
              <Link href="/books/new">
                <Button className="gap-2">
                  <BookOpen className="w-4 h-4" />
                  Create Picture Book
                </Button>
              </Link>
              <Dialog open={isCreateDialogOpen} onOpenChange={setIsCreateDialogOpen}>
                <DialogTrigger asChild>
                  <Button variant="outline" className="gap-2">
                    <Palette className="w-4 h-4" />
                    Generate Artwork
                  </Button>
                </DialogTrigger>
                <DialogContent className="sm:max-w-[500px]">
                  <DialogHeader>
                    <DialogTitle>Generate Illustration</DialogTitle>
                    <DialogDescription>
                      Create AI-generated artwork for your stories.
                    </DialogDescription>
                  </DialogHeader>
                  <div className="grid gap-4 py-4">
                    <div className="grid gap-2">
                      <Label htmlFor="title">Title</Label>
                      <Input
                        id="title"
                        value={newIllustration.title}
                        onChange={(e) => setNewIllustration(prev => ({ ...prev, title: e.target.value }))}
                        placeholder="Enter illustration title..."
                      />
                    </div>
                    
                    <div className="grid gap-2">
                      <Label htmlFor="description">Description</Label>
                      <Textarea
                        id="description"
                        value={newIllustration.description}
                        onChange={(e) => setNewIllustration(prev => ({ ...prev, description: e.target.value }))}
                        placeholder="Describe what you want to illustrate..."
                        rows={3}
                      />
                    </div>

                    <div className="grid gap-2">
                      <Label htmlFor="style">Art Style</Label>
                      <Select value={newIllustration.style} onValueChange={(value) => setNewIllustration(prev => ({ ...prev, style: value }))}>
                        <SelectTrigger>
                          <SelectValue placeholder="Select art style" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="children-book">Children&apos;s Book</SelectItem>
                          <SelectItem value="realistic">Realistic</SelectItem>
                          <SelectItem value="cartoon">Cartoon</SelectItem>
                          <SelectItem value="watercolor">Watercolor</SelectItem>
                          <SelectItem value="digital-art">Digital Art</SelectItem>
                          <SelectItem value="sketch">Sketch</SelectItem>
                          <SelectItem value="vintage">Vintage</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                  </div>
                  <DialogFooter>
                    <Button
                      type="button"
                      variant="outline"
                      onClick={() => setIsCreateDialogOpen(false)}
                    >
                      Cancel
                    </Button>
                    <Button
                      type="button"
                      onClick={handleGenerateIllustration}
                      disabled={!newIllustration.title.trim() || !newIllustration.description.trim() || isGenerating}
                    >
                      {isGenerating ? 'Generating...' : 'Generate Illustration'}
                    </Button>
                  </DialogFooter>
                </DialogContent>
              </Dialog>
            </div>
          </CardContent>
        </Card>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
          {illustrations.map((illustration) => (
            <Card key={illustration.id} className="hover:shadow-md transition-shadow">
              <CardContent className="p-0">
                {illustration.imageUrl ? (
                  <div className="aspect-square w-full overflow-hidden rounded-t-lg bg-muted">
                    <img 
                      src={illustration.imageUrl} 
                      alt={illustration.name}
                      className="w-full h-full object-cover hover:scale-105 transition-transform"
                    />
                  </div>
                ) : (
                  <div className="aspect-square w-full bg-muted rounded-t-lg flex items-center justify-center">
                    <Image className="w-12 h-12 text-muted-foreground" />
                  </div>
                )}
                <div className="p-4">
                  <div className="flex justify-between items-start mb-2">
                    <h3 className="font-medium text-sm line-clamp-2">{illustration.name}</h3>
                    <Badge variant="outline" className="text-xs ml-2">
                      {illustration.type}
                    </Badge>
                  </div>
                  <p className="text-xs text-muted-foreground mb-2 line-clamp-2">
                    {illustration.bookTitle}
                  </p>
                  {illustration.description && (
                    <p className="text-xs text-muted-foreground mb-3 line-clamp-2">
                      {illustration.description}
                    </p>
                  )}
                  <div className="flex justify-between items-center">
                    <div className="text-xs text-muted-foreground">
                      {new Date(illustration.createdAt).toLocaleDateString()}
                    </div>
                    <Link href={`/books/${illustration.bookId}`}>
                      <Button variant="outline" size="sm" className="text-xs h-7">
                        View Book
                      </Button>
                    </Link>
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {/* Feature Cards */}
      <div className="mt-8 grid grid-cols-1 md:grid-cols-3 gap-6">
        <Card>
          <CardHeader>
            <CardTitle className="text-lg flex items-center gap-2">
              <Image className="w-5 h-5" />
              Scene Illustrations
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-sm text-muted-foreground">
              Generate complete scene illustrations that bring your story moments to life with 
              characters, environments, and perfect composition.
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-lg flex items-center gap-2">
              <Palette className="w-5 h-5" />
              Character Portraits
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-sm text-muted-foreground">
              Create consistent character portraits and expressions that maintain visual 
              continuity throughout your entire book series.
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-lg flex items-center gap-2">
              <BookOpen className="w-5 h-5" />
              Book Covers
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-sm text-muted-foreground">
              Design compelling book covers that capture the essence of your story and 
              attract readers with professional-quality artwork.
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Tips Section */}
      <Card className="mt-8">
        <CardHeader>
          <CardTitle>Illustration Tips</CardTitle>
          <CardDescription>
            Get the most out of AI-generated artwork
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div>
              <h4 className="font-medium mb-2">Maintain Consistency</h4>
              <p className="text-sm text-muted-foreground">
                Use character profiles and style guides to ensure your illustrations maintain 
                visual consistency throughout your book.
              </p>
            </div>
            <div>
              <h4 className="font-medium mb-2">Scene Composition</h4>
              <p className="text-sm text-muted-foreground">
                Our AI automatically composes scenes using your character portraits and 
                environment backgrounds for perfect storytelling flow.
              </p>
            </div>
            <div>
              <h4 className="font-medium mb-2">Style Matching</h4>
              <p className="text-sm text-muted-foreground">
                Define your book&apos;s artistic style early and let AI maintain that style 
                across all illustrations for a cohesive look.
              </p>
            </div>
            <div>
              <h4 className="font-medium mb-2">Memory Integration</h4>
              <p className="text-sm text-muted-foreground">
                Our memory system remembers your characters, settings, and style preferences 
                to create seamless visual storytelling.
              </p>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
