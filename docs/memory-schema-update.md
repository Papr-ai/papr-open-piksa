# Memory Schema Update

This document explains the changes to how memories are stored in the application and the migration process.

## Overview

Previously, memories retrieved from the search tool were stored in a separate `MessageMemory` table, requiring additional API calls to fetch them. This approach had several drawbacks:

1. Inefficient - required separate API calls to fetch memories
2. Added complexity to the UI components 
3. Created race conditions where memories might not be available immediately
4. Led to duplicate memory fetching attempts and infinite loops

The new approach stores memories directly in the message record as a `memories` field, similar to how artifacts are stored. This is more efficient and eliminates the need for separate API calls.

## Schema Changes

1. Added a `memories` field to the `message` table in the database schema:
   ```typescript
   export const message = pgTable('Message_v2', {
     // existing fields...
     memories: jsonb('memories').default(null),
     // other fields...
   });
   ```

2. Updated the `ExtendedUIMessage` type to include the memories field:
   ```typescript
   export interface ExtendedUIMessage extends UIMessage {
     // existing fields...
     memories?: Array<any>;
   }
   ```

## Implementation Details

### Backend Changes

1. The chat API route now extracts memories from tool calls and includes them directly in the message record
2. This happens automatically when a memory search tool is used

### Frontend Changes

1. The `ChatMemoryResults` component now reads memories directly from the message object
2. It falls back to localStorage for cached memories from previous sessions
3. For backward compatibility, it can still extract memories from tool calls if needed

## Migration Process

To migrate to the new schema and move existing memories:

1. First, add the memories column to the database:
   ```bash
   npm run db:add-memories-column
   # or
   yarn db:add-memories-column
   # or
   pnpm db:add-memories-column
   ```

2. After the column is added, migrate existing memories from the MessageMemory table:
   ```bash
   npm run memory:migrate
   # or
   yarn memory:migrate
   # or
   pnpm memory:migrate
   ```

3. The migration scripts will:
   - Add the `memories` column to the `Message_v2` table
   - Fetch all existing memory records
   - Update the corresponding message records with the memories data
   - Report success/failure counts

4. After verifying the migration, you can optionally delete the old `MessageMemory` table or keep it for backward compatibility.

## Benefits

- **Simpler UI Logic**: Components can directly access memories without separate API calls
- **Improved Performance**: Memories load immediately with messages
- **Fewer API Calls**: Eliminates separate endpoints for memory retrieval
- **No Race Conditions**: Memories are always available when the message loads
- **Better Caching**: Memories are cached with messages in Next.js data fetching

## Rollback Plan

If needed, the application can fall back to the previous approach by:

1. Continuing to use the `MessageMemory` table
2. Updating the `ChatMemoryResults` component to use the API endpoints again

However, the new approach is strictly better and should not require a rollback. 