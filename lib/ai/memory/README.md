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

### Singleton Pattern

For better resource management, use the memory service singleton:

```typescript
import { createMemoryService } from './lib/ai/memory/service';

const memoryService = createMemoryService(apiKey);
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
    // Standard metadata fields
    sourceType: 'PaprChat', 
    user_id: paprUserId,
    external_user_id: session.user.id,
    createdAt: new Date().toISOString(),
    sourceUrl: `/chat/${session.user.id}`,
    
    // Enhanced organization fields
    'emoji tags': ['💡', '🔧', '⚙️'],
    topics: ['typescript', 'configuration', 'preferences'],
    hierarchical_structures: 'knowledge/development/typescript',
    
    // Custom fields go in customMetadata
    customMetadata: {
      category: 'knowledge',
      app_user_id: session.user.id
    }
  }
};

const options = { query: { user_id: userId } };
const addResponse: Papr.AddMemoryResponse = await paprClient.memory.add(memoryParams, options);

// The memory ID is returned in the response
const memoryId = addResponse.data.id;
```

Using the memory service singleton:

```typescript
const success = await memoryService.storeContent(
  paprUserId, 
  'Memory content to store',
  'text',
  {
    sourceType: 'PaprChat',
    'emoji tags': ['💡', '🔧', '⚙️'],
    topics: ['typescript', 'configuration', 'preferences'],
    hierarchical_structures: 'knowledge/development/typescript',
    customMetadata: {
      category: 'knowledge'
    }
  }
);
```

### Memory Organization Fields

The Papr Memory SDK supports several fields to help organize memories:

#### Emoji Tags

Emoji tags are visual identifiers that help quickly categorize memories:

```typescript
'emoji tags': ['👤', '⚙️', '🔧', '📝'] // For user preferences
'emoji tags': ['💡', '🔑', '☁️', '🔒'] // For AWS knowledge
```

Best practices:
- Use 2-4 visually distinct emojis
- Include category indicators (👤 for preferences, 🎯 for goals, etc.)
- Add domain-specific emojis (🐍 for Python, 🌐 for web, etc.)

#### Topics

Topics are keywords that improve searchability:

```typescript
topics: ['typescript', 'strict mode', 'compiler settings', 'development preferences']
topics: ['aws', 'lambda', 'environment variables', 'configuration']
```

Best practices:
- Include 3-5 specific topics
- Mix general and specific terms
- Use common search terms
- Keep topics concise (1-3 words each)

#### Hierarchical Structures

Hierarchical structures organize memories in a tree-like format:

```typescript
hierarchical_structures: 'preferences/development/typescript/compiler-options'
hierarchical_structures: 'knowledge/aws/lambda/environment-variables'
```

Best practices:
- Use path-like format with / separators
- Start with the category (preferences/, goals/, tasks/, knowledge/)
- Add 2-4 increasingly specific levels
- Consider different organization systems (technology, timeline, importance)

### Searching Memories

```typescript
const searchOptions = { query: { user_id: userId, max_memories: 10 } };
const searchResponse = await paprClient.memory.search({
  query: "Detailed search query"
}, searchOptions);

// Access search results
const memories = searchResponse.data?.memories || [];
```

Using the memory service:

```typescript
const memories = await memoryService.searchMemories(userId, "Detailed search query", { max_memories: 10 });
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

## Memory Categories

The PaprChat application uses four primary memory categories:

1. **Preferences**: User profile and preferences (communication style, UI preferences, coding style)
2. **Goals**: Long-term objectives and projects (learning plans, project timelines)
3. **Tasks**: To-dos with deadlines or actions to remember
4. **Knowledge**: Technical information, configuration details, patterns, and facts

These categories are stored in the `customMetadata.category` field.

## AI Tool Integration

The `addMemory` tool allows the AI to create memories with appropriate categorization:

```typescript
// Example of the addMemory tool implementation
export const addMemory = ({ session, dataStream }: AddMemoryProps): Tool => {
  return tool({
    description: 'Add important information to user memory for future reference',
    parameters: z.object({
      content: z.string().describe('The content of the memory to add'),
      category: z.enum(['preferences', 'goals', 'tasks', 'knowledge']),
      type: z.enum(['text', 'code_snippet', 'document']).default('text'),
      emoji_tags: z.array(z.string()).optional(),
      topics: z.array(z.string()).optional(),
      hierarchical_structure: z.string().optional(),
    }),
    // Implementation...
  });
};
```

## Important Notes

1. Always pass `user_id` as a query parameter, not in the request body
2. Always include `X-Client-Type` header (handled by the SDK wrapper)
3. Memory indexing might take some time (10+ seconds)
4. The minimum value for `max_memories` is 10
5. Use the singleton `createMemoryService` pattern for better resource management
6. Place custom fields in the `customMetadata` object
7. Standard metadata fields (`sourceType`, `user_id`, etc.) go at the top level
8. Organization fields (`emoji tags`, `topics`, `hierarchical_structures`) help improve memory discoverability

## Debugging

The SDK wrapper includes detailed logging to help diagnose issues. 