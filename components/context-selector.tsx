'use client';

import React, { useState, useEffect, useRef } from 'react';
import { PageContext } from '@/types/app';
import { 
  DocumentIcon, 
  YouTubeIcon, 
  PDFIcon, 
  PageIcon,
  PaperclipIcon,
  LoaderIcon 
} from './icons';
import { fetcher } from '@/lib/utils';
import useSWR from 'swr';

interface ContextSelectorProps {
  isOpen: boolean;
  onClose: () => void;
  anchorEl: HTMLElement | null;
  selectedPages: PageContext[];
  onPagesChange: (pages: PageContext[]) => void;
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
  isOpen,
  onClose,
  anchorEl,
  selectedPages,
  onPagesChange,
  isMobile = false,
  isDocumentUploading = false,
  isPDFUploading = false,
}: ContextSelectorProps) {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [isUploading, setIsUploading] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);

  // Fetch user documents
  const { data: documents, isLoading } = useSWR<Document[]>(
    isOpen ? '/api/documents' : null,
    fetcher
  );

  // Handle click outside to close menu
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (menuRef.current && !menuRef.current.contains(event.target as Node) && 
          anchorEl && !anchorEl.contains(event.target as Node)) {
        onClose();
      }
    }

    if (isOpen) {
      document.addEventListener('mousedown', handleClickOutside);
    }
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [isOpen, onClose, anchorEl]);

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
    type: doc.kind as 'document' | 'pdf' | 'youtube' | 'page',
    kind: doc.kind,
    createdAt: doc.createdAt
  })) || [];

  // Handle file upload
  const handleFileUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
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
        // Add the uploaded file as a context
        const newContext: PageContext = {
          id: data.id || crypto.randomUUID(),
          title: files[0].name,
          type: files[0].type.includes('pdf') ? 'pdf' : 'document',
          file: {
            name: files[0].name,
            url: data.url,
            __type: 'File'
          },
          text: await files[0].text(), // Include the file content
        };
        onPagesChange([...selectedPages, newContext]);
      }
    } catch (error) {
      console.error('Error uploading file:', error);
    } finally {
      setIsUploading(false);
      if (fileInputRef.current) {
        fileInputRef.current.value = '';
      }
    }
  };

  if (!isOpen) return null;

  // Calculate position based on anchorEl
  const getMenuPosition = () => {
    if (!anchorEl) return { top: 0, left: 0 };
    
    const rect = anchorEl.getBoundingClientRect();
    return {
      bottom: `${window.innerHeight - rect.top + window.scrollY}px`,
      left: `${rect.left + window.scrollX}px`,
    };
  };

  const menuPosition = getMenuPosition();

  return (
    <>
      <input
        type="file"
        ref={fileInputRef}
        onChange={handleFileUpload}
        className="hidden"
        accept=".pdf,.doc,.docx,.txt"
        id="file-upload"
      />
      
      <div 
        ref={menuRef}
        className="absolute z-50 bg-background border border-border rounded-md shadow-md overflow-auto"
        style={{
          position: 'fixed',
          bottom: menuPosition.bottom,
          left: menuPosition.left,
          maxHeight: isMobile ? '90vh' : '350px',
          width: isMobile ? '90vw' : '300px',
          marginBottom: '4px',
        }}
      >
        <div className="p-0">
          <label 
            htmlFor="file-upload"
            className="flex items-center gap-2 px-4 py-2 text-sm hover:bg-accent cursor-pointer border-b border-border"
          >
            {isUploading || isDocumentUploading ? (
              <>
                <LoaderIcon className="animate-spin" size={16} />
                <span>Uploading...</span>
              </>
            ) : (
              <>
                <PaperclipIcon size={16} className="text-muted-foreground" />
                <span>Upload Document/PDF</span>
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