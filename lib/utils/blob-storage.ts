import { put } from '@vercel/blob';

/**
 * Saves a base64 image to Vercel Blob storage
 * @param base64Data - The base64 image data (with or without data URL prefix)
 * @param userId - The user ID for organizing files
 * @param type - The type of image (e.g., 'generated', 'edited', 'book')
 * @returns Promise<string> - The public URL of the saved image
 */
export async function saveImageToBlob(
  base64Data: string,
  userId: string,
  type: 'generated' | 'edited' | 'book' = 'generated'
): Promise<string> {
  try {
    // Extract base64 data and determine file extension
    let base64Content: string;
    let mimeType: string;
    let fileExtension: string;

    if (base64Data.startsWith('data:')) {
      // Extract mime type and base64 content from data URL
      const [header, content] = base64Data.split(',');
      const mimeMatch = header.match(/data:([^;]+)/);
      mimeType = mimeMatch ? mimeMatch[1] : 'image/png';
      base64Content = content;
    } else {
      // Assume PNG if no data URL prefix
      mimeType = 'image/png';
      base64Content = base64Data;
    }

    // Determine file extension from mime type
    switch (mimeType) {
      case 'image/jpeg':
      case 'image/jpg':
        fileExtension = 'jpg';
        break;
      case 'image/png':
        fileExtension = 'png';
        break;
      case 'image/webp':
        fileExtension = 'webp';
        break;
      case 'image/gif':
        fileExtension = 'gif';
        break;
      default:
        fileExtension = 'png';
    }

    // Convert base64 to buffer
    const buffer = Buffer.from(base64Content, 'base64');
    
    // Create unique filename
    const timestamp = Date.now();
    const randomId = Math.random().toString(36).substring(2, 15);
    const filename = `images/${type}/${userId}-${timestamp}-${randomId}.${fileExtension}`;

    // Upload to Vercel Blob
    const blob = await put(filename, buffer, {
      access: 'public',
      contentType: mimeType,
    });

    return blob.url;
  } catch (error) {
    console.error('Failed to save image to blob storage:', error);
    throw new Error('Failed to save image to storage');
  }
}

/**
 * Saves a base64 image specifically for book artifacts
 * @param base64Data - The base64 image data
 * @param userId - The user ID
 * @param bookId - The book/document ID
 * @param chapterNumber - The chapter number (optional)
 * @returns Promise<string> - The public URL of the saved image
 */
export async function saveBookImageToBlob(
  base64Data: string,
  userId: string,
  bookId: string,
  chapterNumber?: number
): Promise<string> {
  try {
    // Extract base64 data and determine file extension
    let base64Content: string;
    let mimeType: string;
    let fileExtension: string;

    if (base64Data.startsWith('data:')) {
      const [header, content] = base64Data.split(',');
      const mimeMatch = header.match(/data:([^;]+)/);
      mimeType = mimeMatch ? mimeMatch[1] : 'image/png';
      base64Content = content;
    } else {
      mimeType = 'image/png';
      base64Content = base64Data;
    }

    switch (mimeType) {
      case 'image/jpeg':
      case 'image/jpg':
        fileExtension = 'jpg';
        break;
      case 'image/png':
        fileExtension = 'png';
        break;
      case 'image/webp':
        fileExtension = 'webp';
        break;
      case 'image/gif':
        fileExtension = 'gif';
        break;
      default:
        fileExtension = 'png';
    }

    // Convert base64 to buffer
    const buffer = Buffer.from(base64Content, 'base64');
    
    // Create unique filename with book context
    const timestamp = Date.now();
    const randomId = Math.random().toString(36).substring(2, 15);
    const chapterSuffix = chapterNumber ? `-ch${chapterNumber}` : '';
    const filename = `images/books/${userId}/${bookId}${chapterSuffix}-${timestamp}-${randomId}.${fileExtension}`;

    // Upload to Vercel Blob
    const blob = await put(filename, buffer, {
      access: 'public',
      contentType: mimeType,
    });

    return blob.url;
  } catch (error) {
    console.error('Failed to save book image to blob storage:', error);
    throw new Error('Failed to save book image to storage');
  }
}
