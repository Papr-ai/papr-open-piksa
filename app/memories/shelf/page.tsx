'use client';

import { useEffect, useState, useCallback, useRef } from 'react';
import { useRouter } from 'next/navigation';
import { ChatBreadcrumb } from '@/components/chat/chat-breadcrumb';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { RefreshIcon, UploadIcon, TrashIcon } from '@/components/common/icons';
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from '@/components/ui/accordion';

interface Document {
  id: string;
  title: string;
  content: string;
  createdAt: string;
  status: 'processing' | 'completed' | 'failed';
}

export default function ShelfPage() {
  const router = useRouter();
  const [documents, setDocuments] = useState<Document[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isUploading, setIsUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [userId, setUserId] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Fetch user data to get the user ID
  const fetchUserData = async () => {
    try {
      const userResponse = await fetch('/api/user');
      if (!userResponse.ok) throw new Error('Failed to get user session');
      const userData = await userResponse.json();
      setUserId(userData.id);
      return userData.id;
    } catch (err) {
      console.error('Error fetching user data:', err);
      setError('Failed to load user data');
      return null;
    }
  };

  // Fetch documents from the API
  const fetchDocuments = useCallback(async () => {
    try {
      setIsLoading(true);
      const response = await fetch('/api/documents');
      
      if (!response.ok) {
        throw new Error('Failed to fetch documents');
      }
      
      const data = await response.json();
      
      // Transform the data into our Document format
      const formattedDocs = data.map((doc: any) => ({
        id: doc.id,
        title: doc.title || 'Untitled Document',
        content: doc.content || '',
        createdAt: doc.createdAt,
        status: doc.status || 'completed'
      }));
      
      setDocuments(formattedDocs);
    } catch (err) {
      console.error('Error loading documents:', err);
      setError('Failed to load documents');
    } finally {
      setIsLoading(false);
    }
  }, []);

  // Handle file upload and add to memory
  const handleFileUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(event.target.files || []);
    if (files.length === 0) return;

    setIsUploading(true);
    setError(null);
    
    try {
      const documents = [];
      
      // Process each file
      for (const file of files) {
        // Read file content
        const content = await file.text();
        
        // Create document for batch processing
        documents.push({
          title: file.name,
          content: content,
          type: 'document',
          metadata: {
            sourceType: 'Shelf',
            topics: ['document', 'shelf'],
            hierarchical_structures: 'shelf/documents',
            customMetadata: {
              fileType: file.type,
              fileSize: file.size,
              uploadedAt: new Date().toISOString()
            }
          }
        });
      }
      
      // Send all documents to batch endpoint
      const response = await fetch('/api/documents/batch', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ documents }),
      });
      
      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Failed to upload documents to memory');
      }
      
      const result = await response.json();
      console.log('Batch processing result:', result);
      
      if (result.errorCount > 0) {
        setError(`${result.errorCount} document(s) failed to upload`);
      }
      
      // Refresh document list
      fetchDocuments();
      
      // Reset file input
      if (fileInputRef.current) {
        fileInputRef.current.value = '';
      }
    } catch (err) {
      console.error('Error uploading documents:', err);
      setError(err instanceof Error ? err.message : 'Failed to upload documents');
    } finally {
      setIsUploading(false);
    }
  };

  // Delete a document
  const handleDeleteDocument = async (documentId: string) => {
    try {
      const response = await fetch(`/api/documents/${documentId}`, {
        method: 'DELETE',
      });
      
      if (!response.ok) {
        throw new Error('Failed to delete document');
      }
      
      // Update the UI by removing the deleted document
      setDocuments(documents.filter(doc => doc.id !== documentId));
    } catch (err) {
      console.error('Error deleting document:', err);
      setError('Failed to delete document');
    }
  };

  useEffect(() => {
    async function loadData() {
      try {
        setError(null);
        const uid = await fetchUserData();
        if (uid) {
          await fetchDocuments();
        }
      } catch (error) {
        console.error('Error loading data:', error);
        setError('Something went wrong. Please try again later.');
      }
    }

    loadData();
  }, [fetchDocuments]);

  return (
    <div className="flex flex-col h-full w-full">
      <ChatBreadcrumb title="Document Shelf" />

      <div className="flex-1 overflow-auto p-2 pt-5 w-full">
        <div className="w-[70%] mx-auto">
          <Card className="mb-6">
            <CardHeader>
              <CardTitle>Upload Documents</CardTitle>
              <CardDescription>
                Upload documents to your shelf. These will be stored in memory for future reference.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="flex items-center justify-center w-full">
                <label
                  htmlFor="dropzone-file"
                  className="flex flex-col items-center justify-center w-full h-32 border-2 border-dashed rounded-lg cursor-pointer bg-muted/50 hover:bg-muted"
                >
                  <div className="flex flex-col items-center justify-center pt-5 pb-6">
                    <div className="mb-2">
                      <UploadIcon size={24} />
                    </div>
                    <p className="mb-2 text-sm">
                      <span className="font-semibold">Click to upload</span> or drag and drop
                    </p>
                    <p className="text-xs text-muted-foreground">
                      Text files, PDFs, Markdown (.txt, .pdf, .md)
                    </p>
                  </div>
                  <input
                    id="dropzone-file"
                    type="file"
                    className="hidden"
                    multiple
                    accept=".txt,.md,.pdf,.json"
                    ref={fileInputRef}
                    onChange={handleFileUpload}
                    disabled={isUploading}
                  />
                </label>
              </div>
            </CardContent>
            <CardFooter className="flex justify-between">
              {isUploading && <p>Uploading...</p>}
              {error && <p className="text-red-500 text-sm">{error}</p>}
            </CardFooter>
          </Card>

          {isLoading && documents.length === 0 && (
            <div className="flex justify-center items-center py-12">
              <p>Loading documents...</p>
            </div>
          )}

          {!isLoading && documents.length === 0 && (
            <Card>
              <CardHeader>
                <CardTitle>No Documents Yet</CardTitle>
                <CardDescription>
                  Upload documents to add them to your shelf.
                </CardDescription>
              </CardHeader>
            </Card>
          )}

          {documents.length > 0 && (
            <div className="mb-4">
              <div className="flex justify-between items-center mb-4">
                <h2 className="text-xl font-bold">Your Documents</h2>
                <Button
                  variant="outline"
                  size="sm"
                  className="flex items-center gap-2"
                  onClick={fetchDocuments}
                  disabled={isLoading}
                >
                  <RefreshIcon size={14} />
                  <span>Refresh</span>
                </Button>
              </div>

              <Accordion type="multiple" className="space-y-4">
                {documents.map((doc) => (
                  <AccordionItem
                    key={doc.id}
                    value={doc.id}
                    className="border rounded-lg p-1"
                  >
                    <div className="flex justify-between items-center px-4">
                      <AccordionTrigger className="flex-1">
                        <div className="flex flex-col items-start text-left">
                          <h3 className="text-lg font-semibold">{doc.title}</h3>
                          <p className="text-sm text-muted-foreground">
                            Added: {new Date(doc.createdAt).toLocaleDateString()}
                          </p>
                        </div>
                      </AccordionTrigger>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={(e) => {
                          e.stopPropagation();
                          handleDeleteDocument(doc.id);
                        }}
                      >
                        <TrashIcon size={16} />
                      </Button>
                    </div>
                    <AccordionContent className="px-4 pt-2">
                      <div className="max-h-40 overflow-y-auto p-2 bg-muted rounded text-sm">
                        {doc.content ? (
                          <pre className="whitespace-pre-wrap">{doc.content.substring(0, 500)}{doc.content.length > 500 ? '...' : ''}</pre>
                        ) : (
                          <p className="text-muted-foreground">No preview available</p>
                        )}
                      </div>
                    </AccordionContent>
                  </AccordionItem>
                ))}
              </Accordion>
            </div>
          )}
        </div>
      </div>
    </div>
  );
} 