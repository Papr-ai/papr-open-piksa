# Papr Memory SDK Integration

This module provides a convenient wrapper for the [@papr/memory](https://memory.papr.ai/) SDK, allowing easy integration of memory capabilities into v0chat.

## Overview

Papr Memory is an end-to-end RAG (Retrieval-Augmented Generation) solution combining vector embeddings and knowledge graphs in one simple API call. This integration makes it easy to:

- Store memories from chat conversations
- Retrieve relevant memories for context
- Update and manage stored memories
- Connect memories using knowledge graphs

## Installation

The @papr/memory package should already be installed as a dependency of v0chat. If not, you can install it using:

```bash
npm install @papr/memory --legacy-peer-deps
```

## Usage

### Approach 1: Direct API Access (Recommended)

The authenticated fetch function provides a simple way to make direct API calls with proper authentication:

```typescript
import { createAuthenticatedFetch } from '@/lib/ai/memory';

// Create an authenticated fetch function with your API key
const authenticatedFetch = createAuthenticatedFetch(process.env.PAPR_MEMORY_API_KEY);

// Use it just like regular fetch but with automatic authentication
const response = await authenticatedFetch('https://your-papr-endpoint.com/v1/memory', {
  method: 'POST',
  body: JSON.stringify({
    content: 'This is a memory to save',
    type: 'text',
    metadata: {
      source: 'v0-app',
      tags: ['important', 'information']
    }
  })
});

const data = await response.json();
```

### Approach 2: Using the SDK (For SDK features)

If you need specific SDK features, you can use the SDK wrapper:

```typescript
import { initPaprMemory } from '@/lib/ai/memory';

// Initialize with API key
const paprClient = initPaprMemory(process.env.PAPR_MEMORY_API_KEY);
```

### Adding Memories

```typescript
import { initPaprMemory, type MemoryAddParams } from '@/lib/ai/memory';

const paprClient = initPaprMemory(process.env.PAPR_MEMORY_API_KEY);

const memoryParams: MemoryAddParams = {
  content: 'This is important information to remember',
  type: 'text',
  metadata: {
    source: 'v0-app',
    userId: 'user-123',
    tags: ['important', 'information']
  }
};

const response = await paprClient.memory.add(memoryParams);
```

### Searching Memories

```typescript
import { initPaprMemory, type MemorySearchParams } from '@/lib/ai/memory';

const paprClient = initPaprMemory(process.env.PAPR_MEMORY_API_KEY);

const searchParams: MemorySearchParams = {
  query: 'Find information about important topics from yesterday',
  max_memories: 5
};

const response = await paprClient.memory.search(searchParams);
```

### Updating Memories

```typescript
import { initPaprMemory } from '@/lib/ai/memory';

const paprClient = initPaprMemory(process.env.PAPR_MEMORY_API_KEY);

const response = await paprClient.memory.update('memory-id', {
  content: 'Updated information',
  metadata: {
    tags: ['updated', 'information']
  }
});
```

### Deleting Memories

```typescript
import { initPaprMemory } from '@/lib/ai/memory';

const paprClient = initPaprMemory(process.env.PAPR_MEMORY_API_KEY);

const response = await paprClient.memory.delete('memory-id');
```

## Environment Variables

The SDK requires the following environment variable:

- `PAPR_MEMORY_API_KEY`: Your Papr Memory API key

## Advanced Configuration

For advanced configuration options, you can pass additional parameters to the `initPaprMemory` function:

```typescript
import { initPaprMemory, type ClientOptions } from '@/lib/ai/memory';

const options: Omit<ClientOptions, 'apiKey'> = {
  baseURL: 'https://custom-endpoint.example.com',
  timeout: 30000, // 30 seconds
  // Additional options...
};

const paprClient = initPaprMemory(process.env.PAPR_MEMORY_API_KEY, options);
```

## Examples

See the `example.ts` file for complete usage examples.

## Documentation

For more detailed information, see the [Papr Memory API documentation](https://platform.papr.ai/). 