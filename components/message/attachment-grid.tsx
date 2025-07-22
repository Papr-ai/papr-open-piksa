'use client';

import { PreviewAttachment } from '../preview-attachment';
import type { Attachment } from 'ai';

interface AttachmentGridProps {
  attachments: Attachment[];
}

export function AttachmentGrid({ attachments }: AttachmentGridProps) {
  if (!attachments?.length) return null;

  return (
    <div className="flex flex-wrap gap-2">
      {attachments.map((attachment) => (
        <PreviewAttachment key={attachment.url} attachment={attachment} />
      ))}
    </div>
  );
} 