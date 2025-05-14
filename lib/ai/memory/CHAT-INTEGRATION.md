# Papr Memory Chat Integration

This integration adds memory capabilities to the v0chat experience. When enabled, the system will:

1. Automatically save user messages to Papr Memory
2. Retrieve relevant memories when a user sends a new message
3. Include those memories in the system prompt to enhance the AI's response

## Configuration

To enable this feature, you need to add your Papr Memory API key to your environment variables:

```
# In .env.local or relevant environment file
PAPR_MEMORY_API_KEY=your_papr_memory_api_key
```

## How It Works

### Storing Memories

When a user sends a message, it's automatically stored in Papr Memory with metadata including:
- User ID
- Chat ID
- Message ID
- Timestamp

This allows for effective retrieval and filtering of memories later.

### Retrieving Memories

When a user sends a message, the system:
1. Extracts the content from the message
2. Searches Papr Memory for relevant previous messages from this user
3. Formats these memories into a special section of the system prompt
4. Sends this enhanced prompt to the AI model

### Memory-Enhanced Prompting

The system adds a section to the prompt that looks like:

```
The user has the following relevant memories you should consider when responding:

Memory 1: [Content of relevant memory]

Memory 2: [Content of another relevant memory]

Consider these memories when responding to the user's current request.
```

This gives the AI model context about previous conversations and user information without requiring it to be included in the conversation history.

## Benefits

- **Personalization**: The AI can remember information about users across sessions
- **Context**: The AI can refer to previous discussions even if they happened in a different chat
- **Efficiency**: Memory provides useful context without increasing token usage from conversation history

## Technical Implementation

- `lib/ai/memory/service.ts`: Core memory service for storing and retrieving memories
- `lib/ai/memory/middleware.ts`: Middleware to integrate memory into the chat flow
- `app/(chat)/api/chat/route.ts`: Integration with the chat API endpoint

## Customization

You can modify how memories are used by editing:
- The search query construction in `enhancePromptWithMemories()`
- The memory formatting in `formatMemoriesForPrompt()`
- The metadata saved with memories in `storeMessage()` 