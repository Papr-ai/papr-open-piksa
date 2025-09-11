import { put } from '@vercel/blob';

/**
 * Utility function to add delay between retries
 */
async function delay(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms));
}

/**
 * Verify that a URL is accessible
 */
async function verifyUrlAccessible(url: string): Promise<boolean> {
  try {
    const response = await fetch(url, { method: 'HEAD' });
    return response.ok;
  } catch {
    return false;
  }
}

/**
 * Saves a base64 image to Vercel Blob storage with retry logic
 * @param base64Data - The base64 image data (with or without data URL prefix)
 * @param userId - The user ID for organizing files
 * @param type - The type of image (e.g., 'generated', 'edited', 'book')
 * @param retries - Number of retry attempts (default: 3)
 * @returns Promise<string> - The public URL of the saved image
 */
export async function saveImageToBlob(
  base64Data: string,
  userId: string,
  type: 'generated' | 'edited' | 'book' = 'generated',
  retries: number = 3
): Promise<string> {
  let lastError: Error;

  for (let attempt = 1; attempt <= retries; attempt++) {
    try {
      console.log(`[BLOB STORAGE] Upload attempt ${attempt}/${retries} for ${type} image`);
      
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

      console.log(`[BLOB STORAGE] Upload successful: ${blob.url.substring(0, 50)}...`);

      // Verify the URL is accessible (with a short timeout)
      const isAccessible = await Promise.race([
        verifyUrlAccessible(blob.url),
        delay(2000).then(() => false) // 2 second timeout
      ]);

      if (isAccessible || attempt === retries) {
        // Return the URL even if not immediately accessible on final attempt
        if (!isAccessible && attempt === retries) {
          console.warn(`[BLOB STORAGE] URL not immediately accessible but returning anyway: ${blob.url.substring(0, 50)}...`);
        }
        return blob.url;
      }

      console.warn(`[BLOB STORAGE] URL not immediately accessible, retrying in ${attempt}s...`);
      await delay(1000 * attempt); // Progressive delay: 1s, 2s, 3s

    } catch (error) {
      lastError = error instanceof Error ? error : new Error('Unknown error');
      console.error(`[BLOB STORAGE] Upload attempt ${attempt}/${retries} failed:`, lastError.message);
      
      if (attempt === retries) {
        console.error('[BLOB STORAGE] All retry attempts failed');
        throw new Error(`Failed to save image to storage after ${retries} attempts: ${lastError.message}`);
      }
      
      // Wait before retrying
      await delay(1000 * attempt);
    }
  }

  throw new Error('Unexpected error in blob storage retry logic');
}

/**
 * Saves a base64 image specifically for book artifacts with retry logic
 * @param base64Data - The base64 image data
 * @param userId - The user ID
 * @param bookId - The book/document ID
 * @param chapterNumber - The chapter number (optional)
 * @param retries - Number of retry attempts (default: 3)
 * @returns Promise<string> - The public URL of the saved image
 */
export async function saveBookImageToBlob(
  base64Data: string,
  userId: string,
  bookId: string,
  chapterNumber?: number,
  retries: number = 3
): Promise<string> {
  let lastError: Error;

  for (let attempt = 1; attempt <= retries; attempt++) {
    try {
      console.log(`[BOOK BLOB STORAGE] Upload attempt ${attempt}/${retries} for book ${bookId}`);
      
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

      console.log(`[BOOK BLOB STORAGE] Upload successful: ${blob.url.substring(0, 50)}...`);

      // Verify the URL is accessible (with a short timeout)
      const isAccessible = await Promise.race([
        verifyUrlAccessible(blob.url),
        delay(2000).then(() => false) // 2 second timeout
      ]);

      if (isAccessible || attempt === retries) {
        // Return the URL even if not immediately accessible on final attempt
        if (!isAccessible && attempt === retries) {
          console.warn(`[BOOK BLOB STORAGE] URL not immediately accessible but returning anyway: ${blob.url.substring(0, 50)}...`);
        }
        return blob.url;
      }

      console.warn(`[BOOK BLOB STORAGE] URL not immediately accessible, retrying in ${attempt}s...`);
      await delay(1000 * attempt); // Progressive delay: 1s, 2s, 3s

    } catch (error) {
      lastError = error instanceof Error ? error : new Error('Unknown error');
      console.error(`[BOOK BLOB STORAGE] Upload attempt ${attempt}/${retries} failed:`, lastError.message);
      
      if (attempt === retries) {
        console.error('[BOOK BLOB STORAGE] All retry attempts failed');
        throw new Error(`Failed to save book image to storage after ${retries} attempts: ${lastError.message}`);
      }
      
      // Wait before retrying
      await delay(1000 * attempt);
    }
  }

  throw new Error('Unexpected error in book blob storage retry logic');
}
