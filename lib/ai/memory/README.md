# Papr Memory SDK Integration

This module provides integration with the Papr Memory SDK for managing memory operations in PaprChat.

## Overview

The Papr Memory SDK (`@papr/memory`) is used to:
- Create and manage users
- Store and retrieve memory items
- Search through memories
- Update and delete memory items

## Usage

### Initialization

```typescript
import { initPaprMemory } from './lib/ai/memory/index';

const paprClient = initPaprMemory(apiKey, {
  baseURL: 'https://memory.papr.ai',
  clientType: 'PaprChat' // Required header for API calls
});
```

### Creating Users

```typescript
const userResponse = await paprClient.user.create({
  external_id: 'unique-user-id',
  email: 'user@example.com',
  metadata: {
    // Custom metadata
  }
});

// The user_id is needed for memory operations
const userId = userResponse.user_id;
```

### Adding Memory

The SDK requires `user_id` to be passed as a query parameter, not in the body:

```typescript
const memoryParams = {
  content: 'Memory content to store',
  type: 'text', // Valid types: 'text', 'code_snippet', 'document'
  metadata: {
    // Additional metadata
  }
};

const options = { query: { user_id: userId } };
const addResponse = await paprClient.memory.add(memoryParams, options);

// The memory ID is returned in the response
const memoryId = addResponse.data[0].memoryId;
```

### Searching Memories

```typescript
const searchOptions = { query: { user_id: userId, max_memories: 10 } };
const searchResponse = await paprClient.memory.search({
  query: "Detailed search query"
}, searchOptions);

// Access search results
const memories = searchResponse.data?.memories || [];
```

### Updating Memory

```typescript
const updateResponse = await paprClient.memory.update(memoryId, {
  content: 'Updated content',
  metadata: {
    updated: true
  }
});
```

### Deleting Memory

```typescript
const deleteResponse = await paprClient.memory.delete(memoryId);
```

## Important Notes

1. Always pass `user_id` as a query parameter, not in the request body
2. Always include `X-Client-Type` header (handled by the SDK wrapper)
3. Memory indexing might take some time (10+ seconds)
4. The minimum value for `max_memories` is 10

## Debugging

The SDK wrapper includes detailed logging to help diagnose issues. 