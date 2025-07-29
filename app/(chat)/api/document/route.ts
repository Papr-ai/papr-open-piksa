import { auth } from '@/app/(auth)/auth';
import type { ArtifactKind } from '@/components/artifact/artifact';
import {
  deleteDocumentsByIdAfterTimestamp,
  getDocumentsById,
  saveDocument,
} from '@/lib/db/queries';

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const id = searchParams.get('id');
  const timeout = searchParams.get('timeout');

  // If no timeout or small timeout value, use 3 seconds
  const timeoutMs = timeout ? Number.parseInt(timeout, 10) : 3000;

  if (!id) {
    console.log('[DOCUMENT API] Missing document ID in GET request');
    return new Response('Missing id', { status: 400 });
  }

  console.log(`[DOCUMENT API] GET request for document ${id}`);

  try {
    // Add timeout for database operations
    const timeoutPromise = new Promise<null>((_, reject) =>
      setTimeout(
        () => reject(new Error(`Database timeout after ${timeoutMs}ms`)),
        timeoutMs,
      ),
    );

    // This will fetch the document with a timeout
    const documentPromise = (async () => {
      try {
        const session = await auth();
        if (!session || !session.user) {
          throw new Error('Unauthorized - no valid session');
        }

        const documents = await getDocumentsById({ id });
        return { documents, session };
      } catch (err) {
        console.error(`[DOCUMENT API] Database error: ${err}`);
        throw err;
      }
    })();

    // Race the document fetch against the timeout
    const result = await Promise.race([documentPromise, timeoutPromise]).catch(
      (error) => {
        console.log(
          `[DOCUMENT API] Falling back to empty documents: ${error.message}`,
        );
        return { documents: [], session: null }; // Return empty array on timeout or error
      },
    );

    const { documents, session } = result || { documents: [], session: null };
    console.log(
      `[DOCUMENT API] Found ${Array.isArray(documents) ? documents.length : 0} documents for ID ${id}`,
    );

    // Return empty array with a 200 status
    if (!documents || !Array.isArray(documents) || documents.length === 0) {
      console.log(
        `[DOCUMENT API] No documents found for ID ${id}, returning empty array`,
      );
      return Response.json([], {
        status: 200,
        headers: {
          'Cache-Control': 'no-cache, no-store, must-revalidate',
        },
      });
    }

    // Add cache headers for better performance but disable for now to help with debugging
    return Response.json(documents, {
      status: 200,
      headers: {
        'Cache-Control': 'no-cache, no-store, must-revalidate',
        ETag: `"document-${id}-${Date.now()}"`,
      },
    });
  } catch (error) {
    console.error(`[DOCUMENT API] Error retrieving document ${id}:`, error);
    // Return empty array on error to prevent 404
    return Response.json([], { status: 200 });
  }
}

export async function POST(request: Request) {
  const { searchParams } = new URL(request.url);
  const id = searchParams.get('id');

  if (!id) {
    return new Response('Missing id', { status: 400 });
  }

  const session = await auth();

  if (!session) {
    return new Response('Unauthorized', { status: 401 });
  }

  const {
    content,
    title,
    kind,
    forceNewVersion = false,
  }: {
    content: string;
    title: string;
    kind: ArtifactKind;
    forceNewVersion?: boolean;
  } = await request.json();

  console.log(`[DOCUMENT API] POST request for document ${id}`, {
    contentLength: content?.length || 0,
    title,
    kind,
    forceNewVersion,
  });

  if (!session.user?.id) {
    return new Response('Unauthorized - no user ID', { status: 401 });
  }

  try {
    // Get the current latest document to check if content is actually changed
    const existingDocuments = await getDocumentsById({ id });
    console.log(
      `[DOCUMENT API] Found ${existingDocuments.length} existing versions`,
    );

    const latestDocument =
      existingDocuments.length > 0
        ? existingDocuments[existingDocuments.length - 1]
        : null;

    // Compare content strictly, or create new version if forced
    const contentChanged =
      !latestDocument || latestDocument.content !== content || forceNewVersion;

    if (contentChanged) {
      console.log(`[DOCUMENT API] Creating new version for document ${id}`, {
        reason: !latestDocument
          ? 'no previous document'
          : forceNewVersion
            ? 'force new version'
            : 'content changed',
        previousLength: latestDocument?.content?.length || 0,
        newLength: content?.length || 0,
      });

      try {
        const document = await saveDocument({
          id,
          content,
          title,
          kind,
          userId: session.user.id,
        });

        if (!document) {
          console.error(`[DOCUMENT API] Failed to save document ${id}`);
          return Response.json(
            { error: 'Failed to save document. Please try again.' },
            {
              status: 500,
              headers: {
                'Content-Type': 'application/json',
                'Cache-Control': 'no-cache, no-store, must-revalidate',
              },
            },
          );
        }

        // Verify the save was successful and fetch updated documents
        const updatedDocuments = await getDocumentsById({ id });

        if (!updatedDocuments || updatedDocuments.length === 0) {
          console.error(
            `[DOCUMENT API] Failed to retrieve saved document ${id}`,
          );
          return Response.json(
            {
              error:
                'Document was saved but could not be retrieved. Please refresh.',
            },
            {
              status: 500,
              headers: {
                'Content-Type': 'application/json',
                'Cache-Control': 'no-cache, no-store, must-revalidate',
              },
            },
          );
        }

        console.log(
          `[DOCUMENT API] Document saved, now ${updatedDocuments.length} versions`,
        );

        return Response.json(updatedDocuments, {
          status: 200,
          headers: {
            'Content-Type': 'application/json',
            'Cache-Control': 'no-cache, no-store, must-revalidate',
          },
        });
      } catch (saveError) {
        console.error(`[DOCUMENT API] Error saving document:`, saveError);
        // Return a proper error response
        return Response.json(
          {
            error: 'Failed to save document',
            details:
              saveError instanceof Error ? saveError.message : 'Unknown error',
          },
          {
            status: 500,
            headers: {
              'Content-Type': 'application/json',
              'Cache-Control': 'no-cache, no-store, must-revalidate',
            },
          },
        );
      }
    } else {
      console.log(
        `[DOCUMENT API] Content unchanged, skipping update for ${id}`,
      );
      return Response.json(existingDocuments, {
        status: 200,
        headers: {
          'Content-Type': 'application/json',
          'Cache-Control': 'no-cache, no-store, must-revalidate',
        },
      });
    }
  } catch (error) {
    console.error(`[DOCUMENT API] Error updating document ${id}:`, error);
    return Response.json(
      {
        error: 'Failed to process document update',
        details: error instanceof Error ? error.message : 'Unknown error',
      },
      {
        status: 500,
        headers: {
          'Content-Type': 'application/json',
          'Cache-Control': 'no-cache, no-store, must-revalidate',
        },
      },
    );
  }
}

export async function PATCH(request: Request) {
  const { searchParams } = new URL(request.url);
  const id = searchParams.get('id');

  const { timestamp }: { timestamp: string } = await request.json();

  if (!id) {
    return new Response('Missing id', { status: 400 });
  }

  const session = await auth();

  if (!session || !session.user) {
    return new Response('Unauthorized', { status: 401 });
  }

  const documents = await getDocumentsById({ id });

  const [document] = documents;

  if (document.userId !== session.user.id) {
    return new Response('Unauthorized', { status: 401 });
  }

  await deleteDocumentsByIdAfterTimestamp({
    id,
    timestamp: new Date(timestamp),
  });

  return new Response('Deleted', { status: 200 });
}
