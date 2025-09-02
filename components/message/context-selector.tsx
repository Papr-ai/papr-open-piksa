'use client';

import React, { useState, useRef } from 'react';
import { PageContext } from '@/types/app';
import { 
  DocumentIcon, 
  YouTubeIcon, 
  PDFIcon, 
  PageIcon,
  PaperclipIcon,
  LoaderIcon 
} from '@/components/common/icons';
import { ImageIcon } from 'lucide-react';
import { fetcher } from '@/lib/utils';
import useSWR from 'swr';

interface ContextSelectorProps {
  selectedPages: PageContext[];
  onPagesChange: (pages: PageContext[]) => void;
  onClose: () => void;
  isMobile?: boolean;
  isDocumentUploading?: boolean;
  isPDFUploading?: boolean;
}

interface Document {
  id: string;
  title: string;
  kind: string;
  createdAt: string;
}

export function ContextSelector({
  selectedPages,
  onPagesChange,
  onClose,
  isMobile = false,
  isDocumentUploading = false,
  isPDFUploading = false,
}: ContextSelectorProps) {
  

  const documentInputRef = useRef<HTMLInputElement>(null);
  const imageInputRef = useRef<HTMLInputElement>(null);
  const [isUploading, setIsUploading] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);

  // Fetch user documents
  const { data: documents, isLoading } = useSWR<Document[]>(
    '/api/documents',
    fetcher
  );



  // Fetch document content when selected
  const fetchDocumentContent = async (doc: Document) => {
    try {
      const response = await fetch(`/api/documents/${doc.id}`);
      if (response.ok) {
        const documentData = await response.json();
        return {
          id: doc.id,
          title: doc.title,
          type: doc.kind as 'document' | 'pdf' | 'youtube' | 'page',
          text: documentData.content || '',
        };
      } else {
        console.error('Error fetching document content:', await response.text());
        return {
          id: doc.id,
          title: doc.title,
          type: doc.kind as 'document' | 'pdf' | 'youtube' | 'page',
          text: '',
        };
      }
    } catch (error) {
      console.error('Error fetching document content:', error);
      return {
        id: doc.id,
        title: doc.title,
        type: doc.kind as 'document' | 'pdf' | 'youtube' | 'page',
        text: '',
      };
    }
  };

  const handleTogglePage = async (page: Document) => {
    const isSelected = selectedPages.some(p => p.id === page.id);
    if (isSelected) {
      onPagesChange(selectedPages.filter(p => p.id !== page.id));
    } else {
      const contextWithContent = await fetchDocumentContent(page);
      onPagesChange([...selectedPages, contextWithContent]);
    }
  };

  // Convert documents to PageContext format
  const availablePages = documents?.map(doc => ({
    id: doc.id,
    title: doc.title,
    type: doc.kind as 'document' | 'pdf' | 'youtube' | 'page' | 'image',
    kind: doc.kind,
    createdAt: doc.createdAt
  })) || [];

  // Handle document upload (PDF, DOC, TXT)
  const handleDocumentUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(event.target.files || []);
    if (files.length === 0) return;

    setIsUploading(true);
    
    try {
      const formData = new FormData();
      formData.append('file', files[0]);

      const response = await fetch('/api/files/upload', {
        method: 'POST',
        body: formData,
      });

      if (response.ok) {
        const data = await response.json();
        const isPDF = files[0].type.includes('pdf');
        
        // Add the uploaded document as a context
        const newContext: PageContext = {
          id: data.id || crypto.randomUUID(),
          title: files[0].name,
          type: isPDF ? 'pdf' : 'document',
          file: {
            name: files[0].name,
            url: data.url,
            __type: 'File'
          },
          text: await files[0].text().catch(() => ''),
        };
        onPagesChange([...selectedPages, newContext]);
      }
    } catch (error) {
      console.error('Error uploading document:', error);
    } finally {
      setIsUploading(false);
      if (documentInputRef.current) {
        documentInputRef.current.value = '';
      }
    }
  };

  // Handle image upload (JPEG, PNG, WebP, GIF)
  const handleImageUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(event.target.files || []);
    if (files.length === 0) return;

    console.log('[CONTEXT SELECTOR] Starting image upload:', files[0].name);
    setIsUploading(true);
    
    try {
      const formData = new FormData();
      formData.append('file', files[0]);

      const response = await fetch('/api/files/upload', {
        method: 'POST',
        body: formData,
      });

      if (response.ok) {
        const data = await response.json();
        console.log('[CONTEXT SELECTOR] Image upload successful:', data);
        
        // Add the uploaded image as a context
        const newContext: PageContext = {
          id: data.id || crypto.randomUUID(),
          title: files[0].name,
          type: 'image',
          file: {
            name: files[0].name,
            url: data.url,
            __type: 'File'
          },
          text: '', // Images don't have text content
        };
        
        console.log('[CONTEXT SELECTOR] Adding new context:', newContext);
        console.log('[CONTEXT SELECTOR] Current selectedPages:', selectedPages.length);
        
        const updatedContexts = [...selectedPages, newContext];
        console.log('[CONTEXT SELECTOR] Updated contexts:', updatedContexts.length);
        
        onPagesChange(updatedContexts);
      } else {
        console.error('[CONTEXT SELECTOR] Image upload failed:', response.status, response.statusText);
      }
    } catch (error) {
      console.error('[CONTEXT SELECTOR] Error uploading image:', error);
    } finally {
      setIsUploading(false);
      if (imageInputRef.current) {
        imageInputRef.current.value = '';
      }
    }
  };

  return (
    <>
      {/* Document upload input */}
      <input
        type="file"
        ref={documentInputRef}
        onChange={handleDocumentUpload}
        className="hidden"
        accept=".pdf,.doc,.docx,.txt"
        id="document-upload"
      />
      
      {/* Image upload input */}
      <input
        type="file"
        ref={imageInputRef}
        onChange={handleImageUpload}
        className="hidden"
        accept="image/jpeg,image/jpg,image/png,image/webp,image/gif"
        id="image-upload"
      />
      
      <div 
        ref={menuRef}
        className="max-h-80 overflow-auto"
      >
        <div className="p-0">
          {/* Document Upload Option */}
          <label 
            htmlFor="document-upload"
            className="flex items-center gap-2 px-4 py-2 text-sm hover:bg-accent cursor-pointer border-b border-border"
          >
            {isUploading ? (
              <>
                <LoaderIcon className="animate-spin" size={16} />
                <span>Uploading...</span>
              </>
            ) : (
              <>
                <DocumentIcon size={16} className="text-muted-foreground" />
                <span>Upload Document/PDF</span>
              </>
            )}
          </label>

          {/* Image Upload Option */}
          <label 
            htmlFor="image-upload"
            className="flex items-center gap-2 px-4 py-2 text-sm hover:bg-accent cursor-pointer border-b border-border"
          >
            {isUploading ? (
              <>
                <LoaderIcon className="animate-spin" size={16} />
                <span>Uploading...</span>
              </>
            ) : (
              <>
                <ImageIcon size={16} className="text-muted-foreground" />
                <span>Upload Image</span>
              </>
            )}
          </label>

          {selectedPages.length > 0 && (
            <>
              <div className="px-4 py-2 text-xs text-muted-foreground">
                Added
              </div>
              {selectedPages.map((page) => (
                <div 
                  key={page.id}
                  onClick={() => {
                    const isSelected = selectedPages.some(p => p.id === page.id);
                    if (isSelected) {
                      onPagesChange(selectedPages.filter(p => p.id !== page.id));
                    }
                  }}
                  className="flex items-center gap-2 px-4 py-2 text-sm hover:bg-accent cursor-pointer"
                >
                  {page.type === 'youtube' && <YouTubeIcon size={16} className="text-muted-foreground" />}
                  {page.type === 'pdf' && <PDFIcon size={16} className="text-muted-foreground" />}
                  {page.type === 'document' && <DocumentIcon size={16} className="text-muted-foreground" />}
                  {page.type === 'image' && <ImageIcon size={16} className="text-muted-foreground" />}
                  {(!page.type || page.type === 'page') && <PageIcon size={16} className="text-muted-foreground" />}
                  <span className="truncate">{page.title}</span>
                </div>
              ))}
              <div className="h-px bg-border my-2" />
            </>
          )}

          <div className="px-4 py-2 text-xs text-muted-foreground">
            Available
          </div>
          
          {isLoading ? (
            <div className="flex items-center justify-center p-4">
              <LoaderIcon className="animate-spin" size={16} />
            </div>
          ) : availablePages.length === 0 ? (
            <div className="px-4 py-2 text-sm text-muted-foreground">
              No documents found
            </div>
          ) : (
            availablePages
              .filter(page => !selectedPages.some(p => p.id === page.id))
              .map((page) => (
                <div 
                  key={page.id}
                  onClick={() => handleTogglePage(page)}
                  className="flex items-center gap-2 px-4 py-2 text-sm hover:bg-accent cursor-pointer"
                >
                  {page.type === 'youtube' && <YouTubeIcon size={16} className="text-muted-foreground" />}
                  {page.type === 'pdf' && <PDFIcon size={16} className="text-muted-foreground" />}
                  {page.type === 'document' && <DocumentIcon size={16} className="text-muted-foreground" />}
                  {page.type === 'image' && <ImageIcon size={16} className="text-muted-foreground" />}
                  {(!page.type || page.type === 'page') && <PageIcon size={16} className="text-muted-foreground" />}
                  <span className="truncate">{page.title}</span>
                </div>
              ))
          )}
        </div>
      </div>
    </>
  );
} 