import { streamText, convertToModelMessages, stepCountIs } from 'ai';
import { auth } from '@/app/(auth)/auth';
import { myProvider } from '@/lib/ai/providers';
import { modelIsPremium, modelSupportsReasoning, modelSupportsWebSearch, getWebSearchModel } from '@/lib/ai/models';
import { trackBasicInteraction, trackPremiumInteraction } from '@/lib/subscription/usage-middleware';
import { fastCheckChatPermissions, trackInteractionAsync } from '@/lib/subscription/fast-usage-middleware';
import { getMostRecentUserMessage } from '@/lib/utils';
import { generateUUID } from '@/lib/utils';
import { saveMessages, getChatById, saveChat } from '@/lib/db/queries';
import { generateTitleFromUserMessage } from '../../actions';
import { getOrCreateChatContext } from '@/lib/ai/memory/chat-context';
import type { ExtendedUIMessage } from '@/lib/types';
import { searchMemories } from '@/lib/ai/tools/search-memories';
import { addMemory } from '@/lib/ai/tools/add-memory';
import { updateMemory } from '@/lib/ai/tools/update-memory';
import { deleteMemory } from '@/lib/ai/tools/delete-memory';
import { shouldAnalyzeConversation, processConversationCompletion } from '@/lib/ai/conversation-insights';
import { handleNewChatCreation } from '@/lib/ai/chat-history-context';
import { systemPrompt } from '@/lib/ai/prompts';
import { createDocument } from '@/lib/ai/tools/create-document';
import { updateDocument } from '@/lib/ai/tools/update-document';
import { createBook } from '@/lib/ai/tools/create-book';
import { searchBooks } from '@/lib/ai/tools/search-books';
import { searchBookProps } from '@/lib/ai/tools/search-book-props';
import { createBookImagePlan } from '@/lib/ai/tools/create-book-image-plan';
import { createSingleBookImage } from '@/lib/ai/tools/create-single-book-image';
import { requestSuggestions } from '@/lib/ai/tools/request-suggestions';
import { createTaskTrackerTools } from '@/lib/ai/tools/task-tracker';
import { createImage } from '@/lib/ai/tools/create-image';
import { createWritingTools } from '@/lib/ai/tools/create-writing-tools';

// Helper function to extract domain name from URL
function extractDomainName(url: string): string {
  try {
    const domain = new URL(url).hostname;
    return domain.replace('www.', '');
  } catch {
    return 'Web Source';
  }
}

// Helper function to convert tool names to user-friendly descriptions
function getFriendlyToolName(toolName: string): string {
  const friendlyNames: Record<string, string> = {
    // Memory tools
    'searchMemories': 'Searching memories',
    'addMemory': 'Saving to memory',
    'updateMemory': 'Updating memory',
    'deleteMemory': 'Removing from memory',
    
    // Document tools
    'createDocument': 'Creating document',
    'updateDocument': 'Updating document',
    
    // Book tools
    'createBook': 'Creating book',
    'searchBooks': 'Searching books',
    'searchBookProps': 'Finding book assets',
    'createBookImagePlan': 'Planning book images',
    'createSingleBookImage': 'Generating book image',
    'createStructuredBookImages': 'Creating book illustrations',
    
    // Task tools
    'createTaskPlan': 'Creating task plan',
    'updateTask': 'Updating task',
    'completeTask': 'Completing task',
    'getTaskStatus': 'Checking task status',
    'addTask': 'Adding task',
    
    // Image tools
    'createImage': 'Generating image',
    
    // Web search
    'google_search': 'Searching the web',
    
    
    
    // Enhanced book tools
    'createBookPlan': 'Planning book structure',
    'draftChapter': 'Drafting chapter',
    'segmentChapterIntoScenes': 'Breaking chapter into scenes',
    'createCharacterPortraits': 'Creating character portraits',
    'createEnvironments': 'Creating environments',
    'createSceneManifest': 'Creating scene manifest',
    'renderScene': 'Rendering scene',
    'completeBook': 'Completing book'
  };
  
  return friendlyNames[toolName] || `Running ${toolName}`;
}

import { handleRateLimitWithRetry } from '@/lib/ai/rate-limit-handler';
import { google } from '@ai-sdk/google';
import { openai } from '@ai-sdk/openai';

// Simple chat API that works with useChat hook
export async function POST(request: Request) {
  // 🕐 START TIMING TRACKING
  const requestStartTime = Date.now();
  const timings: Record<string, number> = {};
  
  const logTiming = (step: string, startTime: number) => {
    const duration = Date.now() - startTime;
    timings[step] = duration;
    console.log(`[TIMING] ${step}: ${duration}ms`);
    return duration;
  };

  try {
    // Parse request body
    const parseStart = Date.now();
    const {
      id,
      messages,
      selectedChatModel,
    }: {
      id: string;
      messages: Array<ExtendedUIMessage>;
      selectedChatModel?: string;
    } = await request.json();
    logTiming('Parse Request Body', parseStart);

    // Check web search enabled status from headers
    const webSearchHeaderValue = request.headers.get('X-Web-Search-Enabled');
    const isWebSearchEnabled = webSearchHeaderValue === 'true';
    console.log('[SIMPLE CHAT API] Web search enabled:', isWebSearchEnabled);

    // Check for book context from headers
    const bookId = request.headers.get('X-Book-Id');
    console.log('[SIMPLE CHAT API] Book ID from headers:', bookId);

    // Use selectedChatModel from request body or fallback to default
    // If web search is enabled, ensure we use a web-capable model
    let modelToUse = selectedChatModel || 'gpt-5-mini';
    if (isWebSearchEnabled) {
      modelToUse = getWebSearchModel(selectedChatModel);
      console.log('[SIMPLE CHAT API] Web search enabled, using model:', modelToUse);
    }
    
    console.log('[SIMPLE CHAT API] Using model:', modelToUse);

    // Get session first
    const sessionStart = Date.now();
    const session = await auth();
    if (!session || !session.user || !session.user.id) {
      return new Response('Unauthorized', { status: 401 });
    }
    logTiming('Auth Session', sessionStart);

    // Fast combined permission check (replaces 4+ separate DB queries with 1)
    const permissionsStart = Date.now();
    const permissionCheck = await fastCheckChatPermissions(session.user.id, modelToUse);
    logTiming('Permission Check', permissionsStart);
    
    if (!permissionCheck.allowed) {
      // Handle different error types
      if (permissionCheck.code === 'ONBOARDING_REQUIRED') {
        return new Response(JSON.stringify({
          error: 'Please complete onboarding first',
          code: 'ONBOARDING_REQUIRED',
          redirectTo: '/onboarding'
        }), {
          status: 403,
          headers: { 'Content-Type': 'application/json' }
        });
      }
      
      if (permissionCheck.code === 'MODEL_ACCESS_DENIED') {
        return new Response(JSON.stringify({ 
          error: permissionCheck.reason || 'Model access denied',
          code: 'MODEL_ACCESS_DENIED',
          shouldShowUpgrade: permissionCheck.shouldShowUpgrade
        }), { 
          status: 403,
          headers: { 'Content-Type': 'application/json' }
        });
      }
      
      if (permissionCheck.code === 'USAGE_LIMIT_EXCEEDED') {
        return new Response(JSON.stringify({ 
          error: permissionCheck.reason,
          code: 'USAGE_LIMIT_EXCEEDED',
          usage: permissionCheck.usage,
          shouldShowUpgrade: permissionCheck.shouldShowUpgrade
        }), { 
          status: 429,
          headers: { 'Content-Type': 'application/json' }
        });
      }
      
      if (permissionCheck.code === 'PLAN_DETECTION_ERROR') {
        return new Response(JSON.stringify({ 
          error: permissionCheck.reason,
          code: 'PLAN_DETECTION_ERROR',
          shouldRefresh: true
        }), { 
          status: 500,
          headers: { 'Content-Type': 'application/json' }
        });
      }
      
      // Generic error
      return new Response(JSON.stringify({
        error: permissionCheck.reason || 'Permission denied',
        code: permissionCheck.code || 'PERMISSION_DENIED'
      }), {
        status: 403,
        headers: { 'Content-Type': 'application/json' }
      });
    }

    // Check memory enabled status from headers
    const memoryHeaderValue = request.headers.get('X-Memory-Enabled');
    const isMemoryEnabled = memoryHeaderValue === 'true';
    //console.log('[SIMPLE CHAT API] Memory header value:', memoryHeaderValue);
    //console.log('[SIMPLE CHAT API] Memory enabled:', isMemoryEnabled);
    //console.log('[SIMPLE CHAT API] All headers:', Object.fromEntries(request.headers.entries()));

    // Check if it's a picture book from headers (set by frontend based on user choice or DB)
    const pictureBookHeaderValue = request.headers.get('X-Is-Picture-Book');
    const isPictureBook = pictureBookHeaderValue === 'true';
    console.log('[SIMPLE CHAT API] Picture book mode:', isPictureBook);

    const userMessage = getMostRecentUserMessage(messages);
    if (!userMessage) {
      return new Response('No user message found', { status: 400 });
    }

    // Get or create chat with user context (handles both new and existing chats)
    const chatContextStart = Date.now();
    const { chatExists, userContext, contextString } = await getOrCreateChatContext(
      id,
      session.user.id,
      messages
    );
    logTiming('Chat Context Creation', chatContextStart);

    if (chatExists) {
      // Verify ownership for existing chat
      const ownershipStart = Date.now();
      const chat = await getChatById({ id });
      if (chat && chat.userId !== session.user.id) {
        return new Response('Unauthorized', { status: 401 });
      }
      logTiming('Ownership Verification', ownershipStart);
    } else {
      //console.log('[SIMPLE CHAT API] Created new chat with user context');
    }

    // Save user message
    //console.log('[SIMPLE CHAT API] Processing message for user:', session.user.id);
    //console.log('[SIMPLE CHAT API] Message count:', messages.length);

    //console.log('[SIMPLE CHAT API] Saving user message to database...');
    const saveMessageStart = Date.now();
    await saveMessages({
      messages: [
        {
          id: userMessage.id,
          chatId: id,
          role: 'user',
          parts: userMessage.parts,
          tool_calls: null,
          attachments: [],
          memories: null,
          sources: null,
          modelId: null,
          memoryDecision: null, // Will be updated later with actual decision
          createdAt: new Date(),
        }
      ]
    });
    logTiming('Save User Message', saveMessageStart);
    //console.log('[SIMPLE CHAT API] User message saved to database');

    // Convert UI messages to model messages format with hardening against malformed parts
    let modelMessages;
    try {
      modelMessages = convertToModelMessages(messages, {
        ignoreIncompleteToolCalls: true,
      });
    } catch (conversionError) {
      console.error('[SIMPLE CHAT API] convertToModelMessages failed, sanitizing messages:', conversionError);
      // Fallback: drop any non-text/file parts and retry
      const sanitizedMessages = messages.map((m: any) => ({
        ...m,
        // Keep only valid, simple parts to avoid unsupported states
        parts: Array.isArray(m.parts)
          ? m.parts.filter((p: any) => p && typeof p === 'object' && (p.type === 'text' || p.type === 'file'))
          : m.parts,
      }));

      modelMessages = convertToModelMessages(sanitizedMessages, {
        ignoreIncompleteToolCalls: true,
      });
    }

    const supportsReasoning = modelSupportsReasoning(modelToUse);
    // Only OpenAI models support the reasoning API format
    const supportsOpenAIReasoning = supportsReasoning && (modelToUse.startsWith('gpt-') || modelToUse.startsWith('o4-'));
    console.log('[SIMPLE CHAT API] Model supports reasoning:', supportsReasoning, 'OpenAI reasoning:', supportsOpenAIReasoning, 'for model:', modelToUse);

    // For the simple chat route, we'll collect data stream writes and include them in tool responses
    // This is a simpler approach than real-time streaming but will show progress after tool completion
    const dataStreamWrites: any[] = [];
    const dataStream = {
      write: (data: any) => {
        //console.log('[SIMPLE CHAT] Tool progress:', data);
        dataStreamWrites.push(data);
      }
    };
    
    // Set up tools
    const toolsSetupStart = Date.now();
    const tools: any = {};
    
    // Always available tools
    // TEMPORARILY DISABLED to force unified workflow
    // tools.createDocument = createDocument({ session, dataStream });
    tools.updateDocument = updateDocument({ session, dataStream });
    // TEMPORARILY DISABLED to force unified workflow
    // tools.createBook = createBook({ session, dataStream });
    tools.searchBooks = searchBooks({ session });
    tools.searchBookProps = searchBookProps({ session, dataStream });
    tools.createBookImagePlan = createBookImagePlan({ session, dataStream });
    tools.createSingleBookImage = createSingleBookImage({ session, dataStream });
    tools.requestSuggestions = requestSuggestions({ session, dataStream });
    tools.createImage = createImage({ session });
    tools.createWritingTools = createWritingTools({ session, dataStream });
    
    // Structured book image creation tool
    const { createStructuredBookImages } = await import('@/lib/ai/tools/structured-book-image-creation');
    tools.createStructuredBookImages = createStructuredBookImages({ session, dataStream });
    
    // Enhanced book creation workflow tools - TEMPORARILY DISABLED to force unified workflow
    // const { createEnhancedBookTools } = await import('@/lib/ai/tools/enhanced-book-tools');
    // const enhancedBookTools = createEnhancedBookTools(session, dataStream);
    // tools.createBookPlan = enhancedBookTools.createBookPlan;
    // tools.draftChapter = enhancedBookTools.draftChapter;
    // tools.segmentChapterIntoScenes = enhancedBookTools.segmentChapterIntoScenes;
    // tools.createCharacterPortraits = enhancedBookTools.createCharacterPortraits;
    // tools.createEnvironments = enhancedBookTools.createEnvironments;
    // tools.createSceneManifest = enhancedBookTools.createSceneManifest;
    // tools.renderScene = enhancedBookTools.renderScene;
    // tools.completeBook = enhancedBookTools.completeBook;
    
    // Unified book creation artifact tool
    const { createBookArtifact } = await import('@/lib/ai/tools/unified-book-creation');
    tools.createBookArtifact = createBookArtifact({ session, dataStream });
    
    // Book workflow status tool
    const { getBookWorkflowStatus } = await import('@/lib/ai/tools/book-workflow-status');
    tools.getBookWorkflowStatus = getBookWorkflowStatus({ session });
    
    
    // Task tracker tools - DISABLED in favor of unified book creation workflow
    // const taskTrackerTools = createTaskTrackerTools(dataStream, session, id);
    // tools.createTaskPlan = taskTrackerTools.createTaskPlan;
    // tools.updateTask = taskTrackerTools.updateTask;
    // tools.completeTask = taskTrackerTools.completeTask;
    // tools.getTaskStatus = taskTrackerTools.getTaskStatus;
    // tools.addTask = taskTrackerTools.addTask;
    
    // Memory tools (if enabled)
    if (isMemoryEnabled) {
      tools.searchMemories = searchMemories({ 
        session: { user: session.user! } as any
      });
      tools.addMemory = addMemory({ 
        session: { user: session.user! } as any
      });
      tools.updateMemory = updateMemory({ 
        session: { user: session.user! } as any
      });
      tools.deleteMemory = deleteMemory({ 
        session: { user: session.user! } as any
      });
    }

    // Web search tools (only for Google models when web search is enabled)
    if (isWebSearchEnabled && modelSupportsWebSearch(modelToUse)) {
      //console.log('[SIMPLE CHAT API] Adding Google Search tool');
      tools.google_search = google.tools.googleSearch({});
    } else {
      //console.log('[SIMPLE CHAT API] Web search not enabled or model does not support it');
      //console.log('[SIMPLE CHAT API] isWebSearchEnabled:', isWebSearchEnabled);
      //console.log('[SIMPLE CHAT API] modelSupportsWebSearch:', modelSupportsWebSearch(modelToUse));
    }

    //console.log('[SIMPLE CHAT API] Final tools available:', Object.keys(tools));
    //console.log('[SIMPLE CHAT API] Tools details:', JSON.stringify(Object.keys(tools).reduce((acc, key) => ({ ...acc, [key]: typeof tools[key] }), {}), null, 2));
    
    logTiming('Tools Setup', toolsSetupStart);

    // Get system prompt (memory-enabled or regular)
    const apiKey = process.env.PAPR_MEMORY_API_KEY;
    let enhancedSystemPrompt: string;
    
    // Use system prompt with memory instructions if memory is enabled
    let baseSystemPrompt = systemPrompt({ 
      selectedChatModel: modelToUse,
      isPictureBook   
    });
    
    // Get chat history context for newly created chats only
    let chatHistoryContext = '';
    if (!chatExists && isMemoryEnabled && apiKey && session?.user?.id) {
      //console.log('[SIMPLE CHAT API] 🆕 New chat being created, loading chat history context');
      chatHistoryContext = await handleNewChatCreation(session.user.id, apiKey);
    }
    
    // Enhance system prompt with user memories if memory is enabled
    // Only do this for NEW chats to avoid searching memory on every message
    if (isMemoryEnabled && apiKey && session?.user?.id && !chatExists) {
      const { enhancePromptWithMemories } = await import('@/lib/ai/memory/middleware');
      
      try {
        const memoryEnhanceStart = Date.now();
        baseSystemPrompt = await enhancePromptWithMemories({
          userId: session.user.id,
          prompt: baseSystemPrompt,
          apiKey,
          maxMemories: 15,
          searchQuery: 'user preferences and context'
        });
        logTiming('Memory Enhancement (New Chat Only)', memoryEnhanceStart);
        console.log('[SIMPLE CHAT API] Enhanced system prompt with user memories for new chat');
      } catch (error) {
        console.error('[SIMPLE CHAT API] Failed to enhance prompt with memories:', error);
      }
    }
    
    // Always include user context if available (regardless of memory toggle)
    let contextualSystemPrompt = baseSystemPrompt;
    
    // Add book context if bookId is provided
    if (bookId && bookId.trim() !== '') {
      try {
        const bookContextStart = Date.now();
        const { getWorkflowFromDatabase } = await import('@/lib/ai/tools/unified-book-creation');
        const workflowState = await getWorkflowFromDatabase(bookId, session);
        
        if (workflowState) {
          const completedSteps = workflowState.steps?.filter((step: any) => 
            step.status === 'completed' || step.status === 'approved'
          ) || [];
          
          const currentStepInfo = workflowState.steps?.find((step: any) => 
            step.stepNumber === workflowState.currentStep
          );
          
          const bookContext = `

📖 CURRENT BOOK PROJECT CONTEXT:
- Book Title: ${workflowState.bookTitle}
- Target Age: ${workflowState.targetAge}
- Book Concept: ${workflowState.bookConcept}
- Current Step: ${workflowState.currentStep}/6 (${currentStepInfo?.stepName || 'Unknown'})
- Completed Steps: ${completedSteps.length}/6
- Book ID: ${workflowState.bookId}

You are currently helping the user with their book project. You have access to the createBookArtifact tool to update any step of the book creation workflow. When the user asks questions about their book or requests changes, use this context to provide relevant assistance.

Step Status:
${workflowState.steps?.map((step: any) => 
  `${step.stepNumber}. ${step.stepName}: ${step.status}${step.data ? ' ✓' : ''}`
).join('\n') || 'No steps found'}
`;

          contextualSystemPrompt += bookContext;
          logTiming('Book Context Enhancement', bookContextStart);
          console.log('[SIMPLE CHAT API] Enhanced system prompt with book context');
        }
      } catch (error) {
        console.error('[SIMPLE CHAT API] Failed to enhance prompt with book context:', error);
      }
    }
    
    if (contextString) {
      //console.log('[SIMPLE TEXT CHAT] Adding user context to system prompt:');
      //console.log('='.repeat(80));
      //console.log('User Context Length:', contextString.length);
      //console.log('User Context Preview:', contextString.substring(0, 200) + '...');
      //console.log('='.repeat(80));
      //console.log('='.repeat(80));
      
      contextualSystemPrompt += `\n\n${contextString}`;
    }
    
    if (chatHistoryContext) {
      //console.log('[SIMPLE TEXT CHAT] Adding chat history context');
      contextualSystemPrompt += `\n\n${chatHistoryContext}`;
    }
    
    // Add memory tool instructions if memory is enabled
    enhancedSystemPrompt = isMemoryEnabled 
      ? `${contextualSystemPrompt}\n\n
MEMORY TOOL INSTRUCTIONS:
You have access to memory tools to help maintain context and remember important information about the user.

**searchMemories tool:** Use when you need to recall past conversations or user information.

**addMemory tool - USE THIS NATURALLY:**
- Save important information about the user as you discover it during conversation
- Save user preferences, goals, projects, and interests  
- Save key facts about their work, tools they use, or problems they're solving
- Think of it as taking notes during a conversation - save what would be useful to remember later

**When to use addMemory:**
- When the user shares their goals or projects
- When you learn about their preferences or working style
- When they mention their profession, interests, or expertise
- When they share important context about their work

Use these tools naturally as part of helping the user - you don't need to announce when you're using them.`
      : contextualSystemPrompt;
    
    // Check system prompt size and truncate if necessary to prevent token limit errors
    // Simple character-based estimation: ~4 chars per token
    const systemPromptTokens = Math.ceil(enhancedSystemPrompt.length / 4);
    
    if (systemPromptTokens > 50000) { // If system prompt is over 50k tokens
      
      // Use a much shorter system prompt for large contexts
      enhancedSystemPrompt = `You are Pen, an AI work assistant that helps users find information from their Papr memories and create content. You are tasked with responding to user queries by accessing their saved Papr memories when enabled (currently: ${isMemoryEnabled}). Today is ${new Date().toISOString().split('T')[0]}.

## 📖 Book Writing Support
When you detect book writing requests, always use the createBook tool for substantial book content. This tool manages the entire book structure and individual chapters.

**Memory Management:**
- Always check memory first when users ask about something not in context
- Use add_memory tool to save important information from conversations
- Use search_memories tool to recall past conversations
- Cite memories using source URLs when retrieved

**Response Quality:**
Be helpful and concise. Use markdown formatting with headers, bullet points, and code blocks. Provide actionable feedback and maintain consistency across conversations.${isMemoryEnabled ? `

**MEMORY TOOL INSTRUCTIONS:**
- searchMemories: Use when you need to recall past conversations or user information
- addMemory: Save important user information, preferences, goals, and context naturally during conversation` : ''}`;
      

    }
    
    //console.log(`[SIMPLE CHAT API] Using ${isMemoryEnabled ? 'memory-enabled' : 'standard'} system prompt`);

    // Function to sanitize tool names to match OpenAI pattern ^[a-zA-Z0-9_-]+$
    const sanitizeToolName = (name: string): string => {
      return name.replace(/[^a-zA-Z0-9_-]/g, '_');
    };

    // Pre-process messages to handle orphaned tool calls and remove large binary data
    const preprocessedMessages = messages.map((msg, msgIndex) => {
      if (msg.parts) {
        msg.parts = msg.parts.map((part: any) => {
          // Sanitize tool names for all tool-related parts
          if (part.type === 'tool-call' && part.toolName) {
            const sanitizedName = sanitizeToolName(part.toolName);
            if (sanitizedName !== part.toolName) {
              //console.log(`[SIMPLE CHAT API] Sanitizing tool name: "${part.toolName}" -> "${sanitizedName}"`);
            }
            part = { ...part, toolName: sanitizedName };
          }
          
          if (part.type === 'tool-result' && part.toolName) {
            const sanitizedName = sanitizeToolName(part.toolName);
            if (sanitizedName !== part.toolName) {
              //console.log(`[SIMPLE CHAT API] Sanitizing tool result name: "${part.toolName}" -> "${sanitizedName}"`);
            }
            part = { ...part, toolName: sanitizedName };
          }
          
          // If this is a tool result with large data, sanitize it
          if (part.type === 'tool-result' && part.output) {
            const outputStr = JSON.stringify(part.output);
            if (outputStr.length > 100000) { // Over 100k chars
              //console.log(`[SIMPLE CHAT API] Pre-processing: Sanitizing large tool result: ${part.toolName}, size: ${outputStr.length}`);
              
              // For image generation, keep only metadata
              if (part.toolName === 'generateImage') {
                return {
                  ...part,
                  output: {
                    type: 'json',
                    value: {
                      id: part.output?.value?.id,
                      imageUrl: part.output?.value?.imageUrl,
                      prompt: part.output?.value?.prompt,
                      style: part.output?.value?.style,
                      context: part.output?.value?.context,
                      // Remove any base64 or large data
                    }
                  }
                };
              }
              
              // For other large tools, truncate
              return {
                ...part,
                output: {
                  type: 'text',
                  value: `[Large tool result truncated - original size: ${outputStr.length} chars]`
                }
              };
            }
          }
          return part;
        });
      }
      return msg;
    });

    //console.log(`[SIMPLE CHAT API] Pre-processed ${messages.length} messages, removed large binary data`);

    // Fix orphaned tool calls by adding dummy tool results
    const fixedMessages: any[] = [];
    for (let i = 0; i < preprocessedMessages.length; i++) {
      const currentMsg = preprocessedMessages[i];
      fixedMessages.push(currentMsg);
      
      // Check if this message has tool calls
      const toolCalls = currentMsg.parts?.filter((p: any) => p.type === 'tool-call' && p.toolCallId) || [];
      
      if (toolCalls.length > 0) {
        // Check if the next message has corresponding tool results
        const nextMsg = preprocessedMessages[i + 1];
        const toolResults = nextMsg?.parts?.filter((p: any) => p.type === 'tool-result' && p.toolCallId) || [];
        
        // Find tool calls without corresponding results
        const orphanedCalls = toolCalls.filter((call: any) => 
          !toolResults.some((result: any) => result.toolCallId === call.toolCallId)
        );
        
        if (orphanedCalls.length > 0) {
          //console.log(`[SIMPLE CHAT API] Found ${orphanedCalls.length} orphaned tool calls, adding dummy results`);
          
          // Create dummy tool results for orphaned calls
          const dummyResults = orphanedCalls.map((call: any) => ({
            type: 'dynamic-tool' as const,
            toolName: call.toolName || 'unknown',
            toolCallId: call.toolCallId,
            state: 'output-available' as const,
            input: {},
            output: { error: 'Tool call result not found in conversation history' }
          }));
          
          // Add a message with dummy results if next message doesn't exist or is from user
          if (!nextMsg || nextMsg.role === 'user') {
            fixedMessages.push({
              id: `dummy-${Date.now()}-${Math.random()}`,
              role: 'assistant' as const,
              parts: dummyResults
            });
          } else {
            // Add dummy results to existing assistant message
            nextMsg.parts = [...(nextMsg.parts || []), ...dummyResults];
          }
        }
      }
    }

    //console.log(`[SIMPLE CHAT API] Fixed messages: ${fixedMessages.length} (was ${preprocessedMessages.length})`);

    // Use rate limit handler with automatic retry
    const result = await handleRateLimitWithRetry(
      fixedMessages,
      modelToUse,
      async (messagesToUse) => {
        //console.log(`[SIMPLE CHAT API] Attempting API call with ${messagesToUse.length} messages`);
        
        // Convert messages to model format for the actual API call
        let adjustedModelMessages;
        try {
          adjustedModelMessages = convertToModelMessages(messagesToUse, {
            ignoreIncompleteToolCalls: true,
          });
          

          
        } catch (conversionError) {
          //console.error('[SIMPLE CHAT API] convertToModelMessages failed for truncated messages, sanitizing:', conversionError);
          const sanitizedMessages = messagesToUse.map((m: any) => ({
            ...m,
            parts: Array.isArray(m.parts)
              ? m.parts.filter((p: any) => p && typeof p === 'object' && (p.type === 'text' || p.type === 'file'))
              : m.parts,
          }));
          adjustedModelMessages = convertToModelMessages(sanitizedMessages, {
            ignoreIncompleteToolCalls: true,
          });
          

        }

        // CRITICAL: Apply sanitization AFTER conversion to remove large binary data
        adjustedModelMessages = adjustedModelMessages.map((msg: any) => {
          if (msg.content && Array.isArray(msg.content)) {
            msg.content = msg.content.map((part: any) => {
              if (part && typeof part === 'object' && part.text) {
                const textLength = part.text.length;
                if (textLength > 100000) { // Over 100k chars
                  //console.log(`[SIMPLE CHAT API] POST-CONVERSION: Sanitizing large content in message, size: ${textLength}`);
                  return {
                    ...part,
                    text: `[Large content truncated - original size: ${textLength} chars]`
                  };
                }
              }
              return part;
            });
          } else if (msg.content && typeof msg.content === 'string' && msg.content.length > 100000) {
            //console.log(`[SIMPLE CHAT API] POST-CONVERSION: Sanitizing large string content, size: ${msg.content.length}`);
            msg.content = `[Large content truncated - original size: ${msg.content.length} chars]`;
          }
          return msg;
        });



        // Use direct providers for testing streaming issues
        const modelProvider = (isWebSearchEnabled && modelSupportsWebSearch(modelToUse)) 
          ? google(modelToUse)
          : modelToUse.startsWith('gpt-') || modelToUse.startsWith('o4-')
            ? openai(modelToUse) // Use OpenAI provider directly for GPT models
            : myProvider.languageModel(modelToUse);

        // Build final system prompt with additional instructions
        const additionalInstructions = "\n\nIMPORTANT: When using tools, ALWAYS provide a helpful text response explaining what you're doing or what the tools accomplish. DO NOT include raw tool response data or JSON in your text - the UI will handle displaying tool results automatically. Focus on natural language explanations of your actions." +
          (isWebSearchEnabled ? "\n\nYou have access to real-time web search via Google Search. ALWAYS USE THE GOOGLE SEARCH TOOL when users ask about:\n- Current events or recent news\n- Latest developments in any field\n- Real-time information\n- Recent updates or changes\n- \"What's new\" or \"latest\" questions\n\nIMPORTANT CITATION REQUIREMENTS:\n1. When you use web search, you MUST include inline citations in your response\n2. Use this format: [Source Name] for each key fact or claim\n3. Place citations immediately after the relevant information\n4. Use the actual website name (like \"TechCrunch\", \"Reuters\", \"BBC News\") as the citation\n5. Do not rely on your training data for recent information - always search first when dealing with current topics\n\nExample: \"OpenAI announced a new model today [TechCrunch]. The model shows 40% improvement in coding tasks [GitHub Blog].\"\n\nFor the user's question, you MUST use the google_search tool first to get current information, then provide your response with proper inline citations using the format above." : "");
        
        const finalSystemPrompt = enhancedSystemPrompt + additionalInstructions;
        

        
        // Log detailed message content to understand what's being sent
        //console.log(`[SIMPLE CHAT API] DETAILED MESSAGE ANALYSIS:`);
        //console.log(`  - Total messages: ${adjustedModelMessages.length}`);
        
        adjustedModelMessages.forEach((msg, index) => {
          const msgContent = JSON.stringify(msg);
          const msgLength = msgContent.length;
          const estimatedTokens = Math.ceil(msgLength / 4);
          
          //console.log(`  - Message ${index} (${msg.role}): ${msgLength} chars, ~${estimatedTokens} tokens`);
          /*if (msgLength > 10000) {
            console.log(`    - LARGE MESSAGE DETECTED: ${msgContent.substring(0, 200)}...`);
          }*/
        });
        
        // Log system prompt details
        //console.log(`[SIMPLE CHAT API] SYSTEM PROMPT ANALYSIS:`);
        //console.log(`  - System prompt length: ${finalSystemPrompt.length} chars`);
        //console.log(`  - System prompt preview: ${finalSystemPrompt.substring(0, 200)}...`);
        

        console.log(`[SIMPLE CHAT API] 🧠 REASONING CONFIG:`, {
          modelId: modelProvider.modelId || 'unknown',
          supportsReasoning,
          supportsOpenAIReasoning,
          reasoningConfig: supportsOpenAIReasoning ? { effort: 'low', budgetTokens: 100 } : 'none',
          sendReasoning: supportsReasoning
        });

                const streamTextStart = Date.now();
                console.log(`[TIMING] 🚀 Starting AI streamText call...`);
                const streamResult = await streamText({
          model: modelProvider,
          stopWhen: [stepCountIs(5)], // Allow up to 5 steps for multi-step reasoning
          system: finalSystemPrompt,
          messages: adjustedModelMessages,
          tools: tools,
          experimental_activeTools: [
            'createBookArtifact',
            'updateDocument',
            'searchBooks',
            'searchBookProps',
            'createBookImagePlan',
            'createSingleBookImage',
            'requestSuggestions',
            ...(isMemoryEnabled ? ['searchMemories', 'addMemory', 'updateMemory', 'deleteMemory'] : []),
            ...(isWebSearchEnabled && modelSupportsWebSearch(modelToUse) ? ['google_search'] : []),
          ],
          providerOptions: {
            openai: supportsReasoning
              ? { reasoning: { effort: 'medium', budgetTokens: 2000 } }
              : {},
          },
          temperature: 1,
          onStepFinish: (stepResult) => {
            // 📊 PROGRESS TRACKING: Log detailed step information
            const stepStartTime = Date.now();
            
            // Log tool calls with user-friendly names
            if (stepResult.toolCalls && stepResult.toolCalls.length > 0) {
              stepResult.toolCalls.forEach((toolCall: any) => {
                const friendlyName = getFriendlyToolName(toolCall.toolName);
                console.log(`[PROGRESS] 🔧 ${friendlyName}...`);
                
                // Debug tool call arguments for JSON parsing issues
                try {
                  JSON.stringify(toolCall.args);
                  console.log(`[PROGRESS] ✅ ${toolCall.toolName} args are valid JSON`);
                } catch (error) {
                  console.error(`[PROGRESS] ❌ ${toolCall.toolName} has invalid JSON args:`, error);
                  console.error(`[PROGRESS] Raw args:`, toolCall.args);
                }
                //console.log('[SIMPLE CHAT API] Tool calls attempted:', JSON.stringify(stepResult.toolCalls, null, 2));
              });
            }
            
            // Log tool results with completion status
            if (stepResult.toolResults && stepResult.toolResults.length > 0) {
              stepResult.toolResults.forEach((result: any) => {
                const friendlyName = getFriendlyToolName(result.toolName);
                const success = !result.result?.error;
                const status = success ? '✅' : '❌';
                console.log(`[PROGRESS] ${status} ${friendlyName} ${success ? 'completed' : 'failed'}`);
                //console.log('[SIMPLE CHAT API] Tool results:', JSON.stringify(stepResult.toolResults, null, 2));
              });
            }
            
            // Log collected data stream writes (these will be included in the message parts)
            if (dataStreamWrites.length > 0) {
              console.log(`[PROGRESS] 📝 Processed ${dataStreamWrites.length} progress updates`);
              //console.log('[SIMPLE CHAT API] Collected data stream writes:', dataStreamWrites.length);
            }
            if (isWebSearchEnabled) {
              // Check for Google grounding metadata
              const googleMetadata = (stepResult.providerMetadata as any)?.google;
              if (googleMetadata?.groundingMetadata) {
                //console.log('[SIMPLE CHAT API] Found grounding metadata with', googleMetadata.groundingMetadata.groundingSupports?.length, 'sources');
                
                // Capture the grounding metadata for later use
                if (googleMetadata.groundingMetadata.groundingSupports?.length) {
                  // Create a map of unique sources from grounding chunks
                  const sourceMap = new Map();
                  
                  googleMetadata.groundingMetadata.groundingSupports.forEach((support: any) => {
                    if (support.groundingChunkIndices?.length) {
                      support.groundingChunkIndices.forEach((chunkIndex: number) => {
                        const chunk = googleMetadata.groundingMetadata.groundingChunks?.[chunkIndex];
                        if (chunk?.web) {
                          const url = chunk.web.uri || '#';
                          const title = chunk.web.title || extractDomainName(url);
                          
                          if (!sourceMap.has(url)) {
                            sourceMap.set(url, {
                              title: title,
                              url: url,
                              snippet: support.segment?.text || 'Information from web search'
                            });
                          }
                        }
                      });
                    }
                  });
                  
                  capturedSources = Array.from(sourceMap.values());
                  //console.log('[SIMPLE CHAT API] Captured', capturedSources.length, 'unique sources from grounding metadata');
                }
              }
            }
          },
          onFinish: async ({ response }) => {
            if (isWebSearchEnabled) {
              //console.log('[SIMPLE CHAT API] Web search completed');
            }
          },
        });

        logTiming('AI streamText Call', streamTextStart);
        return streamResult;
      }
    );

    console.log('[SIMPLE CHAT API] Returning UI message stream response');
    
    // 🕐 FINAL TIMING SUMMARY (before return)
    const totalDuration = Date.now() - requestStartTime;
    console.log(`\n[TIMING SUMMARY] 📊 Total Request Duration: ${totalDuration}ms`);
    console.log('[TIMING BREAKDOWN]:');
    Object.entries(timings).forEach(([step, duration]) => {
      const percentage = ((duration / totalDuration) * 100).toFixed(1);
      console.log(`  • ${step}: ${duration}ms (${percentage}%)`);
    });
    console.log('');
    
    // Store sources to attach to message metadata
    let capturedSources: any[] = [];
    
    return result.toUIMessageStreamResponse<ExtendedUIMessage>({
      originalMessages: messages, // keeps strong typing of metadata on the client
      sendReasoning: true, // Enable reasoning and tool call streaming
      sendSources: isWebSearchEnabled, // Send sources if web search is enabled
      messageMetadata: ({ part }: { part: any }) => {
        // Attach metadata at start/finish (visible on client as message.metadata)
        if (part.type === 'start') {
          return { model: modelToUse, createdAt: Date.now() };
        }
        if (part.type === 'finish') {
          return {
            totalTokens: part.totalUsage?.totalTokens,
            inputTokens: part.totalUsage?.inputTokens,
            outputTokens: part.totalUsage?.outputTokens,
            // Include sources if available
            ...(capturedSources.length > 0 && { sources: capturedSources }),
          };
        }
      },
      onFinish: ({ messages: finalMessages }: { messages: any }) => {
        // Process in background to avoid blocking streaming
        setImmediate(async () => {
        try {
          // Sanitize messages to remove large binary data before saving
          const sanitizedMessages = finalMessages.map((msg: any) => {
            if (msg.parts) {
              msg.parts = msg.parts.map((part: any) => {
                // If this is a tool result with large data, sanitize it
                if (part.type === 'tool-result' && part.output) {
                  const outputStr = JSON.stringify(part.output);
                  if (outputStr.length > 100000) { // Over 100k chars
                    console.log(`[SIMPLE CHAT API] Sanitizing large tool result: ${part.toolName}, size: ${outputStr.length}`);
                    
                    // For image generation, keep only metadata
                    if (part.toolName === 'generateImage') {
                      return {
                        ...part,
                        output: {
                          type: 'json',
                          value: {
                            id: part.output?.value?.id,
                            imageUrl: part.output?.value?.imageUrl,
                            prompt: part.output?.value?.prompt,
                            style: part.output?.value?.style,
                            context: part.output?.value?.context,
                            // Remove any base64 or large data
                          }
                        }
                      };
                    }
                    
                    // For other large tools, truncate
                    return {
                      ...part,
                      output: {
                        type: 'text',
                        value: `[Large tool result truncated - original size: ${outputStr.length} chars]`
                      }
                    };
                  }
                }
                return part;
              });
            }
            return msg;
          });
          
          // Use sanitized messages for processing
          finalMessages = sanitizedMessages;
          
          // Track usage (non-blocking background operation)
          const userId = session.user?.id;
          if (userId) {
            const isPremiumModel = modelIsPremium(modelToUse);
            // Use fast async tracking - doesn't block response
            trackInteractionAsync(userId, isPremiumModel ? 'premium' : 'basic');
            console.log(`[SIMPLE CHAT API] Tracking ${isPremiumModel ? 'premium' : 'basic'} interaction in background`);
          }

          // Note: Memory is now handled by the AI itself via addMemory tool calls
          console.log('[SIMPLE CHAT API] 💭 Memory handling delegated to AI via tools');

          // Check if we should analyze this conversation for insights
          const allMessages = [...messages, ...finalMessages.slice(messages.length)];
          const PAPR_MEMORY_API_KEY = process.env.PAPR_MEMORY_API_KEY;
          
          /*console.log('[SIMPLE CHAT API] 🔍 Checking conversation analysis conditions:', {
            messageCount: allMessages.length,
            isMemoryEnabled,
            hasApiKey: !!PAPR_MEMORY_API_KEY,
            shouldAnalyze: shouldAnalyzeConversation(allMessages),
            chatId: id
          });*/
          
          if (isMemoryEnabled && PAPR_MEMORY_API_KEY && shouldAnalyzeConversation(allMessages)) {
            /*console.log('[SIMPLE CHAT API] 🔍 Conversation ready for analysis:', {
              messageCount: allMessages.length,
              chatId: id
            });*/

            // Process conversation insights in the background
            const currentChat = await getChatById({ id });
            processConversationCompletion({
              chatId: id,
              chatTitle: currentChat?.title,
              messages: allMessages,
              userId: userId!,
            }, PAPR_MEMORY_API_KEY).catch(error => {
              console.error('[SIMPLE CHAT API] 🔍 Error processing conversation insights:', error);
            });
          } else {
            //console.log('[SIMPLE CHAT API] 🔍 Skipping conversation analysis - conditions not met');
          }

          // Save all new messages (assistant messages with tool results)
          const newMessages = finalMessages.slice(messages.length); // Get only new messages
          //console.log('[SIMPLE CHAT API] New messages to save:', newMessages.length);
          //console.log('[SIMPLE CHAT API] New messages details:', JSON.stringify(newMessages, null, 2));
          
          for (const message of newMessages) {
            console.log('[SIMPLE CHAT API] Processing message:', {
              role: message.role,
              id: message.id,
              partsCount: message.parts?.length || 0,
              partsTypes: message.parts?.map((p: any) => p.type) || []
            });
            
            if (message.role === 'assistant') {
              //console.log('[SIMPLE CHAT API] Saving assistant message with parts:', message.parts.length);
              //console.log('[SIMPLE CHAT API] Parts details:', JSON.stringify(message.parts, null, 2));
              //console.log('[SIMPLE CHAT API] Model to save:', modelToUse);
              
              // Extract tool calls from parts for the tool_calls field
              const toolCalls = message.parts
                .filter((part: any) => part.type && part.type.startsWith('tool-'))
                .map((part: any) => ({
                  id: part.toolCallId,
                  type: 'function',
                  function: {
                    name: part.type.replace('tool-', ''),
                    arguments: JSON.stringify(part.input || {}),
                  },
                  // Don't include the result/output - that stays in parts for UI rendering
                }));
              
              //console.log('[SIMPLE CHAT API] Extracted tool calls:', JSON.stringify(toolCalls, null, 2));

              // Extract sources from message metadata if available
              const sources = (message as any).metadata?.sources || capturedSources;

              const messageToSave = {
                id: message.id || generateUUID(), // Generate ID if empty
                chatId: id,
                role: 'assistant',
                parts: message.parts,
                tool_calls: toolCalls.length > 0 ? toolCalls : null,
                attachments: [],
                memories: null,
                modelId: modelToUse,
                memoryDecision: null, // Assistant messages don't have memory decisions
                createdAt: new Date(),
                // Add sources if available
                ...(sources && sources.length > 0 && { sources }),
              };
              
              //console.log('[SIMPLE CHAT API] Message object to save:', JSON.stringify(messageToSave, null, 2));
              
              await saveMessages({
                messages: [messageToSave]
              });
              
              //console.log('[SIMPLE CHAT API] Assistant message saved successfully');
            }
          }
        } catch (error) {
          console.error('[SIMPLE CHAT API] Error in onFinish:', error);
        }
        });
      },
    });

  } catch (error) {
    console.error('[SIMPLE CHAT API] ERROR:', error);
    return new Response(JSON.stringify({
      error: 'An error occurred while processing your request.',
      details: error instanceof Error ? error.message : 'Unknown error',
    }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' }
    });
  }
}
