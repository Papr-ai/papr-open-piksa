/**
 * Utility to migrate base64 and blob URLs in book content to proper Vercel Blob URLs
 */

/**
 * Upload a base64 image to Vercel Blob storage
 */
async function uploadBase64ImageToBlob(base64Data: string, filename: string = 'migrated-image.png'): Promise<string | null> {
  try {
    // Convert base64 to blob
    const response = await fetch(base64Data);
    const blob = await response.blob();
    
    // Create file from blob
    const file = new File([blob], filename, { type: blob.type });
    
    // Upload to Vercel Blob
    const formData = new FormData();
    formData.append('file', file);

    const uploadResponse = await fetch('/api/files/upload', {
      method: 'POST',
      body: formData,
    });

    if (uploadResponse.ok) {
      const data = await uploadResponse.json();
      return data.url;
    } else {
      console.error('Failed to upload base64 image:', await uploadResponse.text());
      return null;
    }
  } catch (error) {
    console.error('Error uploading base64 image:', error);
    return null;
  }
}

/**
 * Find and migrate all base64 and blob URLs in markdown content
 */
export async function migrateImagesInContent(content: string): Promise<string> {
  // Regex to find markdown images with base64 or blob URLs
  const imageRegex = /!\[([^\]]*)\]\((data:image\/[^;]+;base64,[^)]+|blob:[^)]+)\)/g;
  
  let migratedContent = content;
  const matches = Array.from(content.matchAll(imageRegex));
  
  console.log(`Found ${matches.length} images to migrate in content`);
  
  // Process each image sequentially to avoid overwhelming the upload endpoint
  for (const match of matches) {
    const [fullMatch, altText, imageUrl] = match;
    
    try {
      console.log(`Migrating image: ${imageUrl.substring(0, 50)}...`);
      
      // Generate filename from alt text or use default
      const filename = altText 
        ? `${altText.replace(/[^a-zA-Z0-9]/g, '-').toLowerCase()}.png`
        : 'migrated-image.png';
      
      const newUrl = await uploadBase64ImageToBlob(imageUrl, filename);
      
      if (newUrl) {
        // Replace the old URL with the new Vercel Blob URL
        migratedContent = migratedContent.replace(fullMatch, `![${altText}](${newUrl})`);
        console.log(`✅ Successfully migrated image: ${altText || 'untitled'}`);
      } else {
        console.log(`❌ Failed to migrate image: ${altText || 'untitled'}`);
      }
    } catch (error) {
      console.error(`Error migrating image ${altText}:`, error);
    }
    
    // Add a small delay to avoid rate limiting
    await new Promise(resolve => setTimeout(resolve, 100));
  }
  
  return migratedContent;
}

/**
 * Check if content contains images that need migration
 */
export function hasImagesToMigrate(content: string): boolean {
  const imageRegex = /!\[([^\]]*)\]\((data:image\/[^;]+;base64,[^)]+|blob:[^)]+)\)/g;
  return imageRegex.test(content);
}

/**
 * Get count of images that need migration
 */
export function countImagesToMigrate(content: string): number {
  const imageRegex = /!\[([^\]]*)\]\((data:image\/[^;]+;base64,[^)]+|blob:[^)]+)\)/g;
  return (content.match(imageRegex) || []).length;
}
