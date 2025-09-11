'use client';

import { useState, useEffect, useRef } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Users, Plus, BookOpen, Upload, X } from 'lucide-react';
import Link from 'next/link';
import Image from 'next/image';

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

export function CharactersPage() {
  const [characters, setCharacters] = useState<BookProp[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isCreateDialogOpen, setIsCreateDialogOpen] = useState(false);
  const [isEditDialogOpen, setIsEditDialogOpen] = useState(false);
  const [isCreating, setIsCreating] = useState(false);
  const [isEditing, setIsEditing] = useState(false);
  const [editingCharacter, setEditingCharacter] = useState<BookProp | null>(null);
  const [newCharacter, setNewCharacter] = useState({
    name: '',
    role: '',
    description: '', // This will be used as "personality"
    physicalDescription: '',
    backstory: '',
    bookId: crypto.randomUUID(), // Generate UUID for standalone character
    bookTitle: 'Standalone Character'
  });
  const [selectedImage, setSelectedImage] = useState<File | null>(null);
  const [imagePreview, setImagePreview] = useState<string | null>(null);
  const [isUploadingImage, setIsUploadingImage] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    fetchCharacters();
  }, []);

  const fetchCharacters = async () => {
    try {
      const response = await fetch('/api/book-props?type=character');
      if (response.ok) {
        const data = await response.json();
        setCharacters(data.props);
      }
    } catch (error) {
      console.error('Error fetching characters:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const handleImageSelect = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (file) {
      setSelectedImage(file);
      // Create preview URL
      const reader = new FileReader();
      reader.onload = (e) => {
        setImagePreview(e.target?.result as string);
      };
      reader.readAsDataURL(file);
    }
  };

  const handleRemoveImage = () => {
    setSelectedImage(null);
    setImagePreview(null);
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  const uploadImage = async (file: File): Promise<string | null> => {
    setIsUploadingImage(true);
    try {
      const formData = new FormData();
      formData.append('file', file);

      const response = await fetch('/api/upload/image', {
        method: 'POST',
        body: formData,
      });

      if (response.ok) {
        const data = await response.json();
        return data.url;
      } else {
        console.error('Error uploading image:', await response.text());
        return null;
      }
    } catch (error) {
      console.error('Error uploading image:', error);
      return null;
    } finally {
      setIsUploadingImage(false);
    }
  };

  const handleCreateCharacter = async () => {
    if (!newCharacter.name.trim()) {
      return;
    }

    setIsCreating(true);
    try {
      // Upload image first if selected
      let imageUrl: string | null = null;
      if (selectedImage) {
        imageUrl = await uploadImage(selectedImage);
      }

      const response = await fetch('/api/book-props', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          bookId: newCharacter.bookId,
          bookTitle: newCharacter.bookTitle,
          type: 'character',
          name: newCharacter.name,
          description: newCharacter.description, // This becomes "personality" in memory
          imageUrl: imageUrl,
          metadata: {
            role: newCharacter.role,
            physicalDescription: newCharacter.physicalDescription,
            backstory: newCharacter.backstory,
            createdFrom: 'characters-page',
            isStandalone: true
          }
        }),
      });

      if (response.ok) {
        const data = await response.json();
        setCharacters(prev => [...prev, data.prop]);
        
        // Reset form
        setNewCharacter({
          name: '',
          role: '',
          description: '',
          physicalDescription: '',
          backstory: '',
          bookId: crypto.randomUUID(), // Generate new UUID for next character
          bookTitle: 'Standalone Character'
        });
        handleRemoveImage();
        setIsCreateDialogOpen(false);
      } else {
        console.error('Error creating character:', await response.text());
      }
    } catch (error) {
      console.error('Error creating character:', error);
    } finally {
      setIsCreating(false);
    }
  };

  const handleEditCharacter = (character: BookProp) => {
    setEditingCharacter(character);
    setIsEditDialogOpen(true);
    // Set image preview if character has an image
    if (character.imageUrl) {
      setImagePreview(character.imageUrl);
    }
  };

  const handleUpdateCharacter = async () => {
    if (!editingCharacter) return;
    
    setIsEditing(true);
    try {
      let imageUrl = editingCharacter.imageUrl;
      
      // Upload new image if selected
      if (selectedImage) {
        imageUrl = await uploadImage(selectedImage);
        if (!imageUrl) {
          console.error('Failed to upload image');
          return;
        }
      }

      const response = await fetch(`/api/book-props/${editingCharacter.id}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          name: editingCharacter.name,
          description: editingCharacter.description,
          metadata: editingCharacter.metadata,
          imageUrl
        }),
      });

      if (response.ok) {
        const data = await response.json();
        setCharacters(prev => prev.map(char => 
          char.id === editingCharacter.id ? data.prop : char
        ));
        
        // Reset form
        setEditingCharacter(null);
        handleRemoveImage();
        setIsEditDialogOpen(false);
      } else {
        console.error('Error updating character:', await response.text());
      }
    } catch (error) {
      console.error('Error updating character:', error);
    } finally {
      setIsEditing(false);
    }
  };

  return (
    <div className="container mx-auto p-6 max-w-6xl">
      {/* Header */}
      <div className="flex justify-between items-center mb-8">
        <div>
          <h1 className="text-3xl font-bold text-foreground">Characters</h1>
          <p className="text-muted-foreground mt-2">
            Manage your story characters across all your books
          </p>
        </div>
        <Dialog open={isCreateDialogOpen} onOpenChange={setIsCreateDialogOpen}>
          <DialogTrigger asChild>
            <Button size="lg" className="gap-2">
              <Plus className="w-4 h-4" />
              Create Character
            </Button>
          </DialogTrigger>
          <DialogContent className="sm:max-w-[425px]">
            <DialogHeader>
              <DialogTitle>Create New Character</DialogTitle>
              <DialogDescription>
                Add a new character that you can use across your stories.
              </DialogDescription>
            </DialogHeader>
            <div className="grid gap-4 py-4">
              <div className="grid gap-2">
                <Label htmlFor="name">Character Name</Label>
                <Input
                  id="name"
                  value={newCharacter.name}
                  onChange={(e) => setNewCharacter(prev => ({ ...prev, name: e.target.value }))}
                  placeholder="Enter character name..."
                />
              </div>
              
              <div className="grid gap-2">
                <Label htmlFor="role">Role</Label>
                <Input
                  id="role"
                  value={newCharacter.role}
                  onChange={(e) => setNewCharacter(prev => ({ ...prev, role: e.target.value }))}
                  placeholder="e.g., Protagonist, Antagonist, Supporting Character..."
                />
              </div>
              
              <div className="grid gap-2">
                <Label htmlFor="description">Personality</Label>
                <Textarea
                  id="description"
                  value={newCharacter.description}
                  onChange={(e) => setNewCharacter(prev => ({ ...prev, description: e.target.value }))}
                  placeholder="Describe their personality, traits, motivations..."
                  rows={2}
                />
              </div>

              <div className="grid gap-2">
                <Label htmlFor="physicalDescription">Physical Description</Label>
                <Textarea
                  id="physicalDescription"
                  value={newCharacter.physicalDescription}
                  onChange={(e) => setNewCharacter(prev => ({ ...prev, physicalDescription: e.target.value }))}
                  placeholder="Describe their appearance..."
                  rows={2}
                />
              </div>

              <div className="grid gap-2">
                <Label htmlFor="backstory">Backstory (Optional)</Label>
                <Textarea
                  id="backstory"
                  value={newCharacter.backstory}
                  onChange={(e) => setNewCharacter(prev => ({ ...prev, backstory: e.target.value }))}
                  placeholder="Character's background, history..."
                  rows={2}
                />
              </div>

              <div className="grid gap-2">
                <Label>Character Image</Label>
                <div className="flex items-center gap-4">
                  {imagePreview ? (
                    <div className="relative">
                      <Image
                        src={imagePreview}
                        alt="Character preview"
                        width={80}
                        height={80}
                        className="rounded-lg object-cover"
                      />
                      <Button
                        type="button"
                        variant="destructive"
                        size="sm"
                        className="absolute -top-2 -right-2 h-6 w-6 rounded-full p-0"
                        onClick={handleRemoveImage}
                      >
                        <X className="h-3 w-3" />
                      </Button>
                    </div>
                  ) : (
                    <div className="w-20 h-20 border-2 border-dashed border-gray-300 rounded-lg flex items-center justify-center">
                      <Upload className="h-6 w-6 text-gray-400" />
                    </div>
                  )}
                  
                  <div className="flex-1">
                    <input
                      ref={fileInputRef}
                      type="file"
                      accept="image/*"
                      onChange={handleImageSelect}
                      className="hidden"
                    />
                    <Button
                      type="button"
                      variant="outline"
                      onClick={() => fileInputRef.current?.click()}
                      disabled={isUploadingImage}
                    >
                      {isUploadingImage ? 'Uploading...' : 'Choose Image'}
                    </Button>
                    <p className="text-xs text-muted-foreground mt-1">
                      Upload a character image (optional)
                    </p>
                  </div>
                </div>
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
                onClick={handleCreateCharacter}
                disabled={!newCharacter.name.trim() || isCreating}
              >
                {isCreating ? 'Creating...' : 'Create Character'}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        {/* Edit Character Dialog */}
        <Dialog open={isEditDialogOpen} onOpenChange={setIsEditDialogOpen}>
          <DialogContent className="sm:max-w-[425px]">
            <DialogHeader>
              <DialogTitle>Edit Character</DialogTitle>
              <DialogDescription>
                Update character details and image.
              </DialogDescription>
            </DialogHeader>
            {editingCharacter && (
              <div className="grid gap-4 py-4">
                <div className="grid gap-2">
                  <Label htmlFor="edit-name">Character Name</Label>
                  <Input
                    id="edit-name"
                    value={editingCharacter.name}
                    onChange={(e) => setEditingCharacter(prev => prev ? { ...prev, name: e.target.value } : null)}
                    placeholder="Character name"
                  />
                </div>

                <div className="grid gap-2">
                  <Label htmlFor="edit-role">Role</Label>
                  <Input
                    id="edit-role"
                    value={editingCharacter.metadata?.role || ''}
                    onChange={(e) => setEditingCharacter(prev => prev ? { 
                      ...prev, 
                      metadata: { ...prev.metadata, role: e.target.value }
                    } : null)}
                    placeholder="Protagonist, antagonist, sidekick..."
                  />
                </div>

                <div className="grid gap-2">
                  <Label htmlFor="edit-description">Description/Personality</Label>
                  <Textarea
                    id="edit-description"
                    value={editingCharacter.description || ''}
                    onChange={(e) => setEditingCharacter(prev => prev ? { ...prev, description: e.target.value } : null)}
                    placeholder="Character's personality, traits..."
                    rows={2}
                  />
                </div>

                <div className="grid gap-2">
                  <Label htmlFor="edit-physical">Physical Description</Label>
                  <Textarea
                    id="edit-physical"
                    value={editingCharacter.metadata?.physicalDescription || ''}
                    onChange={(e) => setEditingCharacter(prev => prev ? { 
                      ...prev, 
                      metadata: { ...prev.metadata, physicalDescription: e.target.value }
                    } : null)}
                    placeholder="Height, hair color, clothing style..."
                    rows={2}
                  />
                </div>

                <div className="grid gap-2">
                  <Label htmlFor="edit-backstory">Backstory (Optional)</Label>
                  <Textarea
                    id="edit-backstory"
                    value={editingCharacter.metadata?.backstory || ''}
                    onChange={(e) => setEditingCharacter(prev => prev ? { 
                      ...prev, 
                      metadata: { ...prev.metadata, backstory: e.target.value }
                    } : null)}
                    placeholder="Character's background, history..."
                    rows={2}
                  />
                </div>

                <div className="grid gap-2">
                  <Label>Character Image</Label>
                  <div className="flex items-center gap-4">
                    {imagePreview ? (
                      <div className="relative">
                        <Image
                          src={imagePreview}
                          alt="Character preview"
                          width={80}
                          height={80}
                          className="rounded-lg object-cover"
                        />
                        <Button
                          type="button"
                          variant="destructive"
                          size="sm"
                          className="absolute -top-2 -right-2 h-6 w-6 rounded-full p-0"
                          onClick={handleRemoveImage}
                        >
                          <X className="h-3 w-3" />
                        </Button>
                      </div>
                    ) : (
                      <div className="w-20 h-20 border-2 border-dashed border-gray-300 rounded-lg flex items-center justify-center">
                        <Upload className="h-6 w-6 text-gray-400" />
                      </div>
                    )}
                    
                    <div className="flex-1">
                      <input
                        ref={fileInputRef}
                        type="file"
                        accept="image/*"
                        onChange={handleImageSelect}
                        className="hidden"
                      />
                      <Button
                        type="button"
                        variant="outline"
                        onClick={() => fileInputRef.current?.click()}
                        className="w-full"
                      >
                        {imagePreview ? 'Change Image' : 'Upload Image'}
                      </Button>
                    </div>
                  </div>
                </div>
              </div>
            )}
            <DialogFooter>
              <Button
                type="button"
                variant="outline"
                onClick={() => {
                  setIsEditDialogOpen(false);
                  setEditingCharacter(null);
                  handleRemoveImage();
                }}
              >
                Cancel
              </Button>
              <Button
                type="button"
                onClick={handleUpdateCharacter}
                disabled={isEditing}
              >
                {isEditing ? 'Updating...' : 'Update Character'}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>

      {/* Characters Grid */}
      {isLoading ? (
        <Card>
          <CardContent className="flex items-center justify-center py-16">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
            <span className="ml-3">Loading characters...</span>
          </CardContent>
        </Card>
      ) : characters.length === 0 ? (
        <Card>
          <CardContent className="flex flex-col items-center justify-center py-16">
            <Users className="w-16 h-16 text-muted-foreground mb-4" />
            <h3 className="text-xl font-semibold mb-2">No characters yet</h3>
            <p className="text-muted-foreground text-center mb-6 max-w-md">
              Start by creating a book or add standalone characters that you can use across multiple stories.
            </p>
            <div className="flex gap-3">
              <Link href="/books/new">
                <Button className="gap-2">
                  <BookOpen className="w-4 h-4" />
                  Create Your First Book
                </Button>
              </Link>
              <Button 
                variant="outline" 
                className="gap-2"
                onClick={() => setIsCreateDialogOpen(true)}
              >
                <Plus className="w-4 h-4" />
                Add Character
              </Button>
            </div>
          </CardContent>
        </Card>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
          {characters.map((character) => (
            <Card key={character.id} className="hover:shadow-md transition-shadow">
              <CardContent className="p-0">
                {character.imageUrl ? (
                  <div className="aspect-square w-full overflow-hidden rounded-t-lg bg-muted">
                    <img 
                      src={character.imageUrl} 
                      alt={character.name}
                      className="w-full h-full object-cover hover:scale-105 transition-transform"
                    />
                  </div>
                ) : (
                  <div className="aspect-square w-full bg-muted rounded-t-lg flex items-center justify-center">
                    <Users className="w-12 h-12 text-muted-foreground" />
                  </div>
                )}
                <div className="p-4">
                  <div className="flex justify-between items-start mb-2">
                    <div>
                      <h3 className="font-semibold text-lg mb-1">{character.name}</h3>
                      <Badge variant="outline" className="text-xs mb-2">
                        {character.bookTitle}
                      </Badge>
                    </div>
                  </div>
                  <p className="text-sm text-muted-foreground line-clamp-2 mb-3">
                    {character.description || 'No description available'}
                  </p>
                  
                  {character.metadata && (
                    <div className="space-y-1 mb-3">
                      {character.metadata.role && (
                        <div className="text-xs">
                          <span className="font-medium text-gray-600">Role:</span> <span className="text-gray-800">{character.metadata.role}</span>
                        </div>
                      )}
                      {character.metadata.personality && (
                        <div className="text-xs">
                          <span className="font-medium text-gray-600">Personality:</span> <span className="text-gray-800">{character.metadata.personality}</span>
                        </div>
                      )}
                    </div>
                  )}
                  
                  <div className="flex justify-between items-center mt-auto pt-2 border-t">
                    <div className="text-xs text-muted-foreground">
                      {new Date(character.createdAt).toLocaleDateString()}
                    </div>
                    <div className="flex gap-2">
                      <Button 
                        variant="outline" 
                        size="sm"
                        onClick={() => handleEditCharacter(character)}
                        className="text-xs"
                      >
                        Edit
                      </Button>
                      {character.metadata?.isStandalone ? (
                        <Badge variant="secondary" className="text-xs">
                          Standalone
                        </Badge>
                      ) : (
                        <Link href={`/books/${character.bookId}`}>
                          <Button variant="outline" size="sm" className="text-xs">
                            View Book
                          </Button>
                        </Link>
                      )}
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {/* Info Section */}
      <div className="mt-8 grid grid-cols-1 md:grid-cols-2 gap-6">
        <Card>
          <CardHeader>
            <CardTitle className="text-lg">Character Development</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-sm text-muted-foreground">
              Create detailed character profiles with personality traits, backstories, and physical descriptions. 
              Our AI will help maintain character consistency throughout your stories.
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-lg">Visual Consistency</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-sm text-muted-foreground">
              Generate character portraits and maintain visual consistency across illustrations. 
              Perfect for picture books and graphic novels.
            </p>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
