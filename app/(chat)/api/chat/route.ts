import {
  createTextStreamResponse,
  smoothStream,
  streamText,
} from 'ai';
import { auth } from '@/app/(auth)/auth';
import {
  deleteChatById,
  getChatById,
  saveChat,
  saveMessages,
} from '@/lib/db/queries';
import {
  generateUUID,
  getMostRecentUserMessage,
  getTrailingMessageId,
} from '@/lib/utils';
import { generateTitleFromUserMessage } from '../../actions';
import { createDocument } from '@/lib/ai/tools/create-document';
import { updateDocument } from '@/lib/ai/tools/update-document';
import { requestSuggestions } from '@/lib/ai/tools/request-suggestions';
import { getWeather } from '@/lib/ai/tools/get-weather';
import { searchMemories } from '@/lib/ai/tools/search-memories';
import { addMemory } from '@/lib/ai/tools/add-memory';
import { createTaskTrackerTools } from '@/lib/ai/tools/task-tracker';
import { 
  createListRepositoriesTool,
  createCreateProjectTool,
  createGetRepositoryFilesTool,
  createGetFileContentTool,
  createSearchFilesTool,
  createOpenFileExplorerTool,
  createCreateRepositoryTool,
  createUpdateStagedFileTool,
  createGetStagingStateTool,
  createClearStagedFilesTool
} from '@/lib/ai/tools/github-integration';
import { isProductionEnvironment } from '@/lib/constants';
import { myProvider } from '@/lib/ai/providers';
import {
  createMemoryEnabledSystemPrompt,
  storeMessageInMemory,
} from '@/lib/ai/memory/middleware';
import { systemPrompt } from '@/lib/ai/prompts';
import type { ExtendedUIMessage } from '@/lib/types';
import type { DataStreamWriter } from '@/lib/types';
import { modelSupportsReasoning } from '@/lib/ai/models';
import { createToolFeedbackMiddleware } from '@/lib/ai/tools/middleware/feedback';
import { ToolRegistry } from '@/lib/ai/tools/middleware/registry';
import { checkModelAccess } from '@/lib/subscription/utils';
import { 
  checkBasicInteractionLimit, 
  checkPremiumInteractionLimit,
  trackBasicInteraction, 
  trackPremiumInteraction 
} from '@/lib/subscription/usage-middleware';
import { modelIsPremium } from '@/lib/ai/models';
import { checkOnboardingStatus } from '@/lib/auth/onboarding-middleware';
import { handleRateLimitWithRetry, estimateConversationTokens } from '@/lib/ai/rate-limit-handler';

export const maxDuration = 60;

// Get Papr Memory API key from environment
const PAPR_MEMORY_API_KEY = process.env.PAPR_MEMORY_API_KEY || '';

// Update sanitization function to return messages in the correct format
function sanitizeMessageForAI(message: ExtendedUIMessage) {
  // Filter out incomplete tool invocations (only include those with results)
  const completedToolInvocations = message.toolInvocations?.filter((invocation: any) => {
    // Only include tool invocations that have completed successfully
    return invocation.state === 'result';
  });

  // Find text content or use placeholder for empty messages
  const textPart = message.parts?.find(part => part.type === 'text');
  const textContent = textPart?.text || '';
  
  // Use placeholder if text is empty but we have attachments or tool calls
  const hasAttachments = message.attachments && message.attachments.length > 0;
  const hasToolCalls = message.tool_calls && message.tool_calls.length > 0;
  const content = textContent.trim() || 
                  (hasAttachments ? "[Attachment provided]" : 
                  (hasToolCalls ? "[Tool call provided]" : "Empty message"));

  // Create a new message with only the properties expected by the AI SDK
  return {
    id: message.id,
    role: message.role,
    content: content,
    // Only include these if they exist and are needed
    tool_calls: message.tool_calls,
    // Only include completed tool invocations to avoid AI SDK errors
    toolInvocations: completedToolInvocations && completedToolInvocations.length > 0 ? completedToolInvocations : undefined,
  };
}

// Function to extract memories from tool calls if present
function extractMemoriesFromToolCalls(message: any): any[] | null {
  if (!message) return null;
  
  // Check for toolInvocations first (newer format)
  if (message.toolInvocations?.length) {
    for (const invocation of message.toolInvocations) {
      if (
        (invocation.toolName === 'searchMemories' ||
         invocation.toolName === 'mcp_Papr_MCP_Server_get_memory') &&
        invocation.result?.memories?.length
      ) {
        console.log(`[Memory] Found memories in tool invocation for message ${message.id}`);
        return invocation.result.memories;
      }
    }
  }
  
  // Check for tool_calls (older format)
  if (message.tool_calls?.length) {
    for (const call of message.tool_calls) {
      if (
        call?.function?.name && 
        (call.function.name.includes('searchMemories') || 
         call.function.name.includes('get_memory')) &&
        call.function?.output
      ) {
        try {
          const output = typeof call.function.output === 'string' 
            ? JSON.parse(call.function.output) 
            : call.function.output;
          
          if (output?.memories?.length) {
            console.log(`[Memory] Found memories in tool_calls for message ${message.id}`);
            return output.memories;
          }
        } catch (e) {
          console.error(`[Memory] Error parsing tool call output:`, e);
        }
      }
    }
  }
  
  return null;
}

interface ToolStartEvent {
  toolName: string;
  args: Record<string, any>;
}

interface ToolEndEvent {
  toolName: string;
  result: Record<string, any>;
}

// Helper function to generate user-friendly message when a tool call starts
function getToolCallStartMessage(toolName: string, args: Record<string, any>): string {
  switch (toolName) {
    case 'searchMemories':
      return `🔍 Searching your memories for: "${args.query}"`;
    case 'addMemory':
      return `💾 Saving ${args.category} memory`;
    case 'getWeather':
      return `🌤️ Getting weather information for ${args.location}`;
    case 'createDocument':
      return `📝 Creating document: "${args.title}"`;
    case 'updateDocument':
      return `✏️ Updating document: "${args.title}"`;
    case 'requestSuggestions':
      return `💡 Generating suggestions for this conversation`;
    case 'listRepositories':
      return `📂 Loading your GitHub repositories`;
    case 'createProject':
      return `🚀 Creating project: "${args.project?.name || 'New Project'}" in ${args.repository?.owner}/${args.repository?.name}`;
    case 'getRepositoryFiles':
      return `📁 Loading files from ${args.repository?.owner}/${args.repository?.name}`;
    case 'getFileContent':
      return `📄 Reading file: ${args.filePath}`;
    case 'searchFiles':
      return `🔎 Searching for files matching: "${args.searchQuery}"`;
    case 'openFileExplorer':
      return `🗂️ Opening file explorer for ${args.repository?.owner}/${args.repository?.name}`;
    case 'createRepository':
      return `🏗️ Setting up new repository: "${args.repositoryName}"`;
    case 'requestRepositoryApproval':
      return `✅ Requesting approval for repository: "${args.repositoryName}"`;
    case 'updateStagedFile':
      return `📝 Updating staged file: ${args.filePath}`;
    case 'getStagingState':
      return `🔍 Checking staging state for ${args.repository?.owner}/${args.repository?.name}`;
    case 'clearStagedFiles':
      return `🗑️ Clearing staged files for ${args.repository?.owner}/${args.repository?.name}`;
    case 'createTaskPlan':
      return `📋 Creating task plan with ${args.tasks?.length || 0} steps`;
    case 'updateTask':
      return `📝 Updating task status`;
    case 'completeTask':
      return `✅ Completing task`;
    case 'getTaskStatus':
      return `📊 Checking task progress`;
    case 'addTask':
      return `📋 Adding tasks to plan`;
    default:
      return `🔧 Running ${toolName}`;
  }
}

// Helper function to generate user-friendly message when a tool call completes
function getToolCallResultMessage(toolName: string, result: Record<string, any>): string {
  switch (toolName) {
    case 'searchMemories':
      const memoryCount = result.memories?.length || 0;
      return memoryCount > 0 
        ? `✅ Found ${memoryCount} relevant ${memoryCount === 1 ? 'memory' : 'memories'}`
        : `📭 No relevant memories found`;
    case 'addMemory':
      return result.success 
        ? `✅ Added ${result.message ? result.message.replace('Added ', '').replace(' memory successfully', '') : ''} memory` 
        : `❌ Failed to add memory: ${result.error}`;
    case 'getWeather':
      return `✅ Weather information retrieved`;
    case 'createDocument':
      return `✅ Document created successfully`;
    case 'updateDocument':
      return `✅ Document updated successfully`;
    case 'requestSuggestions':
      return `✅ Suggestions generated`;
    case 'listRepositories':
      const repoCount = result.repositories?.length || 0;
      return `✅ Found ${repoCount} repositories`;
    case 'createProject':
      if (result.success) {
        const fileCount = result.stagedFiles?.length || 0;
        return `✅ Project "${result.project?.name || 'New Project'}" created with ${fileCount} files staged for review`;
      } else {
        return `❌ Failed to create project: ${result.error}`;
      }
    case 'getRepositoryFiles':
      const fileCount = result.files?.length || 0;
      return `✅ Loaded ${fileCount} files`;
    case 'getFileContent':
      return `✅ File content loaded`;
    case 'searchFiles':
      const searchResults = result.searchResults?.length || 0;
      return `✅ Found ${searchResults} matching files`;
    case 'openFileExplorer':
      return `✅ File explorer opened`;
    case 'createRepository':
      if (result.requiresApproval) {
        return `⏳ Awaiting approval for repository: "${result.repositoryName}"`;
      } else if (result.success) {
        return `✅ Repository "${result.repository?.name}" created successfully`;
      } else {
        return `❌ Failed to create repository: ${result.error}`;
      }
    case 'requestRepositoryApproval':
      return `✅ Repository approval requested`;
    case 'updateStagedFile':
      return `✅ Staged file updated`;
    case 'getStagingState':
      const stagedCount = result.stagedFilesCount || 0;
      return `✅ Found ${stagedCount} staged files`;
    case 'clearStagedFiles':
      const clearedCount = result.clearedCount || 0;
      return `✅ Cleared ${clearedCount} staged files`;
    case 'createTaskPlan':
    case 'updateTask':
    case 'completeTask':
    case 'getTaskStatus':
    case 'addTask':
      if (result.error) {
        return `❌ Task tracker error: ${result.error}`;
      } else if (result.success) {
        if (result.nextTask) {
          return `✅ ${result.message} - Next: ${result.nextTask.title}`;
        } else if (result.allCompleted) {
          return `🎉 All tasks completed! ${result.message}`;
        } else {
          return `✅ ${result.message}`;
        }
      } else {
        return `✅ Task tracker completed`;
      }
    default:
      return `✅ ${toolName} completed successfully`;
  }
}

// Helper function to prepare file path for streaming code
function streamFileCode(dataStream: DataStreamWriter, filePath: string, content: string, language: string, isFirst = false, isFinal = false, isNewChat = false) {
  // Helper to get filename from path
  const getFilename = (path: string) => path.split('/').pop();

  console.log(`[CHAT API] Streaming code for file: ${filePath}`);
  
  // Send file path for UI indicator
  if (isFirst) {
    dataStream.write?.({
      type: 'project-structure',
      content: [{
        path: filePath,
        name: getFilename(filePath) || 'file',
        isDirectory: false,
        content: '',
        language
      }]
    });
  }
  
  // Send the code content with file path
  dataStream.write?.({
    type: 'code-delta',
    content: content,
    filePath: filePath,
    isIncremental: !isFinal,
    isFinal: isFinal,
    newChat: isNewChat // Pass the flag to indicate a new chat/project
  });

  // Mark streaming complete for this file if it's final
  if (isFinal) {
    console.log(`[CHAT API] Completed streaming for file: ${filePath}`);
  }
}

// Helper function to create and stream a new code project
async function createAndStreamCodeProject(dataStream: DataStreamWriter, title: string, isNewChat = true) {
  console.log(`[CHAT API] Creating new code project: ${title}`);
  
  // Define basic project structure for a web-based game
  const projectFiles = [
    {
      path: 'index.html',
      content: `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${title}</title>
  <link rel="stylesheet" href="style.css">
</head>
<body>
  <div class="game-container">
    <canvas id="gameCanvas"></canvas>
    <div class="game-ui">
      <div class="score">Score: <span id="scoreValue">0</span></div>
      <button id="startButton">Start Game</button>
    </div>
  </div>
  <script src="script.js"></script>
</body>
</html>`,
      language: 'html'
    },
    {
      path: 'style.css',
      content: `body {
  margin: 0;
  padding: 0;
  display: flex;
  justify-content: center;
  align-items: center;
  height: 100vh;
  background-color: #f0f0f0;
  font-family: Arial, sans-serif;
}

.game-container {
  position: relative;
  width: 600px;
  height: 400px;
  border: 2px solid #333;
  overflow: hidden;
}

canvas {
  background-color: #111;
}

.game-ui {
  position: absolute;
  top: 10px;
  right: 10px;
  color: white;
  font-size: 18px;
}

.score {
  margin-bottom: 10px;
}

button {
  background-color: #4CAF50;
  border: none;
  color: white;
  padding: 8px 16px;
  text-align: center;
  text-decoration: none;
  display: inline-block;
  font-size: 16px;
  margin: 4px 2px;
  cursor: pointer;
  border-radius: 4px;
}`,
      language: 'css'
    },
    {
      path: 'script.js',
      content: `// Game variables
const canvas = document.getElementById('gameCanvas');
const ctx = canvas.getContext('2d');
const startButton = document.getElementById('startButton');
const scoreElement = document.getElementById('scoreValue');

// Set canvas dimensions
canvas.width = 600;
canvas.height = 400;

// Game state
let gameRunning = false;
let score = 0;
let snake = [];
let food = {};
let direction = 'right';

// Game settings
const gridSize = 20;
const initialSnakeLength = 3;
const gameSpeed = 100; // milliseconds

// Initialize game
function initGame() {
  // Reset game state
  gameRunning = true;
  score = 0;
  scoreElement.textContent = score;
  direction = 'right';
  
  // Create initial snake
  snake = [];
  for (let i = 0; i < initialSnakeLength; i++) {
    snake.push({
      x: Math.floor(canvas.width / (2 * gridSize)) * gridSize - i * gridSize,
      y: Math.floor(canvas.height / (2 * gridSize)) * gridSize
    });
  }
  
  // Place initial food
  placeFood();
  
  // Start game loop
  gameLoop();
}

// Place food at random position
function placeFood() {
  food = {
    x: Math.floor(Math.random() * (canvas.width / gridSize)) * gridSize,
    y: Math.floor(Math.random() * (canvas.height / gridSize)) * gridSize
  };
  
  // Make sure food doesn't spawn on snake
  for (let segment of snake) {
    if (segment.x === food.x && segment.y === food.y) {
      placeFood(); // Try again
      break;
    }
  }
}

// Game loop
function gameLoop() {
  if (!gameRunning) return;
  
  setTimeout(() => {
    moveSnake();
    checkCollision();
    drawGame();
    gameLoop();
  }, gameSpeed);
}

// Move snake
function moveSnake() {
  // Create new head based on direction
  const head = {x: snake[0].x, y: snake[0].y};
  
  switch(direction) {
    case 'up': head.y -= gridSize; break;
    case 'down': head.y += gridSize; break;
    case 'left': head.x -= gridSize; break;
    case 'right': head.x += gridSize; break;
  }
  
  // Add new head to beginning of snake array
  snake.unshift(head);
  
  // Check if food is eaten
  if (head.x === food.x && head.y === food.y) {
    score += 10;
    scoreElement.textContent = score;
    placeFood();
  } else {
    // Remove tail if food wasn't eaten
    snake.pop();
  }
}

// Check for collisions
function checkCollision() {
  const head = snake[0];
  
  // Check wall collision
  if (
    head.x < 0 ||
    head.y < 0 ||
    head.x >= canvas.width ||
    head.y >= canvas.height
  ) {
    gameOver();
    return;
  }
  
  // Check self collision (starting from index 1 to avoid checking head against itself)
  for (let i = 1; i < snake.length; i++) {
    if (head.x === snake[i].x && head.y === snake[i].y) {
      gameOver();
      return;
    }
  }
}

// Draw everything
function drawGame() {
  // Clear canvas
  ctx.fillStyle = '#111';
  ctx.fillRect(0, 0, canvas.width, canvas.height);
  
  // Draw snake
  ctx.fillStyle = '#4CAF50';
  for (let segment of snake) {
    ctx.fillRect(segment.x, segment.y, gridSize - 2, gridSize - 2);
  }
  
  // Draw food
  ctx.fillStyle = '#FF5252';
  ctx.fillRect(food.x, food.y, gridSize - 2, gridSize - 2);
}

// Game over
function gameOver() {
  gameRunning = false;
  alert('Game Over! Your score: ' + score);
  startButton.style.display = 'inline-block';
}

// Event listeners
startButton.addEventListener('click', () => {
  startButton.style.display = 'none';
  initGame();
});

// Keyboard controls
document.addEventListener('keydown', (event) => {
  if (!gameRunning) return;
  
  switch(event.key) {
    case 'ArrowUp':
      if (direction !== 'down') direction = 'up';
      break;
    case 'ArrowDown':
      if (direction !== 'up') direction = 'down';
      break;
    case 'ArrowLeft':
      if (direction !== 'right') direction = 'left';
      break;
    case 'ArrowRight':
      if (direction !== 'left') direction = 'right';
      break;
  }
});`,
      language: 'javascript'
    },
    {
      path: 'README.md',
      content: `# ${title}

A modern snake game built with HTML5 Canvas and JavaScript.

## How to Play

1. Open index.html in a web browser
2. Click the "Start Game" button
3. Use the arrow keys to control the snake
4. Eat the food to grow and score points
5. Avoid hitting the walls or yourself

## Features

- Responsive canvas-based gameplay
- Score tracking
- Clean, modern UI
- Customizable speed and grid size

## Customization

You can customize the game by modifying the variables in script.js:
- gameSpeed: Changes how fast the snake moves
- gridSize: Changes the size of the snake and food
- initialSnakeLength: Changes the starting length of the snake`,
      language: 'markdown'
    }
  ];

  // First, send the project structure to set up the file tree
  dataStream.write?.({
    type: 'project-structure',
    content: projectFiles.map(file => ({
      path: file.path,
      name: file.path.split('/').pop() || file.path,
      isDirectory: false,
      content: '',  // Initial content is empty, will be streamed
      language: file.language
    })),
    newChat: isNewChat
  });

  // Wait a moment to ensure structure is processed
  await new Promise(resolve => setTimeout(resolve, 100));

  // Then stream each file's content
  for (let i = 0; i < projectFiles.length; i++) {
    const file = projectFiles[i];
    const isFirst = i === 0;
    const isFinal = i === projectFiles.length - 1;
    
    // Stream this file's code
    streamFileCode(
      dataStream, 
      file.path,
      file.content, 
      file.language,
      isFirst,
      true,  // Each file is complete when sent
      isNewChat
    );
    
    // Small delay between files to avoid overwhelming the client
    await new Promise(resolve => setTimeout(resolve, 50));
  }

  return "Project files created successfully";
}

// Tool configuration for error handling
const toolConfig = {
  searchMemories: {
    errorHandling: {
      nonFatal: true,
      errorMessage: 'Memory search failed, continuing without it',
    }
  },
  addMemory: {
    errorHandling: {
      nonFatal: true,
      errorMessage: 'Adding memory failed, continuing without it',
    }
  },
  getWeather: {
    errorHandling: {
      nonFatal: true,
      errorMessage: 'Weather lookup failed, continuing without it',
    }
  },
  requestSuggestions: {
    errorHandling: {
      nonFatal: true,
      errorMessage: 'Failed to generate suggestions, continuing without them',
    }
  }
};

export async function POST(request: Request) {
  try {
    const {
      id,
      messages,
      selectedChatModel,
    }: {
      id: string;
      messages: Array<ExtendedUIMessage>;
      selectedChatModel?: string;
    } = await request.json();

    // Use selectedChatModel from request body or fallback to default
    const modelToUse = selectedChatModel || 'gpt-5-mini';
    
    console.log('[CHAT API] Selected model from request:', selectedChatModel);
    console.log('[CHAT API] Model to use:', modelToUse);

    // Get abort signal from request
    const signal = request.signal;

    // Check onboarding status first - this includes auth check
    const onboardingResult = await checkOnboardingStatus();
    if (!onboardingResult.isCompleted) {
      return onboardingResult.response!;
    }

    const session = await auth();
    if (!session || !session.user || !session.user.id) {
      return new Response('Unauthorized', { status: 401 });
    }

    // Check if user has access to the selected model
    const modelAccess = await checkModelAccess(session.user.id, modelToUse);
    if (!modelAccess.allowed) {
      return new Response(JSON.stringify({ 
        error: modelAccess.reason || 'Model access denied',
        code: 'MODEL_ACCESS_DENIED'
      }), { 
        status: 403,
        headers: { 'Content-Type': 'application/json' }
      });
    }

    // Check usage limits based on model type
    const isPremium = modelIsPremium(modelToUse);
    const usageCheck = isPremium 
      ? await checkPremiumInteractionLimit(session.user.id)
      : await checkBasicInteractionLimit(session.user.id);
      
    if (!usageCheck.allowed) {
      return new Response(JSON.stringify({ 
        error: usageCheck.reason,
        code: 'USAGE_LIMIT_EXCEEDED',
        usage: usageCheck.usage,
        shouldShowUpgrade: usageCheck.shouldShowUpgrade
      }), { 
        status: 429, // Too Many Requests
        headers: { 'Content-Type': 'application/json' }
      });
    }

    const userMessage = getMostRecentUserMessage(messages);

    if (!userMessage) {
      return new Response('No user message found', { status: 400 });
    }

    const chat = await getChatById({ id });

    if (!chat) {
      const title = await generateTitleFromUserMessage({
        message: userMessage,
      });

      await saveChat({ id, userId: session.user.id, title });
    } else {
      if (chat.userId !== session.user.id) {
        return new Response('Unauthorized', { status: 401 });
      }
    }

    // Get custom headers from the request
    const memoryHeaderValue = request.headers.get('X-Memory-Enabled');
    const isMemoryEnabled = memoryHeaderValue === 'true';
    console.log('[CHAT API] Memory enabled:', isMemoryEnabled);
    
    const contextHeader = request.headers.get('X-Context');
    const selectedContexts = contextHeader ? JSON.parse(contextHeader) : [];
    console.log('[CHAT API] Selected contexts:', selectedContexts);
    
          // Keep track of interaction mode (only chat mode supported)
      const interactionMode = 'chat';
      console.log('[CHAT API] Interaction mode:', interactionMode);

    // Extract code artifact info if present
    const hasCodeArtifact = request.headers.get('X-Code-Artifact') === 'true';
    const isNewChat = request.headers.get('X-New-Chat') === 'true';
    let codeFileStructure: any[] = [];
    let currentCodeFile = '';
    let repoOwner = '';
    let repoName = '';
    
    if (hasCodeArtifact) {
      try {
        // Check for GitHub repository info
        repoOwner = request.headers.get('X-Code-Repo-Owner') || '';
        repoName = request.headers.get('X-Code-Repo-Name') || '';
        
        // Check for regular file structure
        const codeFilesHeader = request.headers.get('X-Code-Files');
        if (codeFilesHeader) {
          codeFileStructure = JSON.parse(codeFilesHeader);
        }
        
        currentCodeFile = request.headers.get('X-Current-File') || '';
        
        console.log('[CHAT API] Received code artifact info:', {
          fileCount: codeFileStructure.length,
          currentFile: currentCodeFile,
          githubRepo: repoOwner && repoName ? `${repoOwner}/${repoName}` : 'none',
          isNewChat
        });
      } catch (error) {
        console.error('[CHAT API] Error parsing code artifact headers:', error);
      }
    }

    // STEP 1: First, save the message to our database
    console.log('[Memory] Saving user message to database...');
    await saveMessages({
      messages: [
        {
          chatId: id,
          id: userMessage.id,
          role: 'user',
          parts: userMessage.parts.map((part) => {
            if (part.type === 'text') {
              return part;
            }
            // Convert any non-text parts to text parts
            return { type: 'text', text: String(part) };
          }),
          tool_calls: null,
          attachments: (userMessage as ExtendedUIMessage).attachments ?? [],
          memories: null,
          modelId: null, // User messages don't have a model
          createdAt: new Date(),
        },
      ],
    });
    console.log('[Memory] User message saved to database');

    // Check if the selected model supports reasoning
    const supportsReasoning = modelSupportsReasoning(modelToUse);
    console.log(`[Chat API] Model ${modelToUse} supports reasoning: ${supportsReasoning}`);

    // Prepare system prompt with context if needed
    const prepareSystemPrompt = (basePrompt: string) => {
      let enhancedPrompt = basePrompt;
      
      // Add context information if available
      if (selectedContexts.length > 0) {
        // Add context information to the system prompt
        const contextSection = `
CONTEXT INFORMATION:
The user has provided the following context for this conversation:
${selectedContexts.map((ctx: any, index: number) => {
  // Include the document content if available
  const contentPreview = ctx.text 
    ? `\n\nContent: ${ctx.text.substring(0, 1000)}${ctx.text.length > 1000 ? '...' : ''}`
    : '(No text content)';
  
  return `\n\n[DOCUMENT ${index + 1}]: ${ctx.title} (${ctx.type})${contentPreview}`;
}).join('\n')}

Please consider this context when responding to the user's message.
`;
        enhancedPrompt += contextSection;
      }
      
      // Add GitHub repository context if available
      if (hasCodeArtifact && repoOwner && repoName) {
        const githubSection = `
GITHUB REPOSITORY CONTEXT:
The user is asking about a GitHub repository: ${repoOwner}/${repoName}

IMPORTANT INSTRUCTIONS:
1. Use your available GitHub file reading tools to examine this repository
2. When the user asks about specific code or functionality, read the relevant files first
3. Provide helpful analysis and explanations about the code
`;
        enhancedPrompt += githubSection;
      }
      
      return enhancedPrompt;
    };

    // STEP 2: Process AI response with memory search as a tool
    
    // Create a readable stream for the response
    const { readable, writable } = new TransformStream();
    const writer = writable.getWriter();
    
    // Process the AI response asynchronously
    (async () => {
      try {
        // Create a mock dataStream object for compatibility
        const dataStream = {
          write: (data: any) => {
            // Convert data to text and write to the stream
            const textData = JSON.stringify(data) + '\n';
            writer.write(new TextEncoder().encode(textData));
          }
        };
        // Add signal to stream options
        const streamOptions = {
          signal,
          onCancel: () => {
            console.log('[CHAT API] Request cancelled by client');
            dataStream.write?.({
              type: 'status',
              content: 'cancelled',
            });
          }
        };

        // Create a data stream transformer to intercept certain messages
        const transformedDataStream = {
          ...dataStream,
          write: (data: any) => {
            // Check for code project request
            if (data.type === 'code-project-request') {
              console.log('[CHAT API] Intercepted code project request:', data.content);
              return; // Don't pass this message to the client
            }
            
            // Pass through all other messages
            return dataStream.write?.(data);
          }
        };

        // Check if memory search is enabled in the request
        const memoryHeaderValue = request.headers.get('X-Memory-Enabled');
        console.log(
          '[Memory DEBUG] X-Memory-Enabled header value:',
          memoryHeaderValue,
        );
        // Check specifically for 'true' string value
        const isMemoryEnabled = memoryHeaderValue === 'true';
        console.log('[Memory DEBUG] Memory enabled:', isMemoryEnabled);

        // Get base system prompt
        const baseSystemPrompt = systemPrompt({ selectedChatModel: modelToUse });

        // Add memory context to system prompt if enabled
        let enhancedSystemPrompt = isMemoryEnabled
          ? `${baseSystemPrompt}\n\n
IMPORTANT MEMORY TOOL INSTRUCTIONS:
You have access to a memory search tool that can find relevant past conversations and information. Use it when you need to recall past context or information from previous conversations.

When using the searchMemories tool:
1. ONLY use this tool when the user asks about past conversations or when you need context from previous interactions
2. NEVER include the raw tool response or any JSON in your message text
3. NEVER format memory results as code blocks or lists in your response
4. After using the tool, ONLY reference the information in a natural conversational way
5. The memory results will be automatically displayed to the user in a separate UI component
6. If the initial search doesn't find what you're looking for, try searching again with different keywords or phrasings
7. You can make up to 5 memory searches per response to find the most relevant information

IMPORTANT: If you use the searchMemories tool, do NOT manually format the results in your response. The tool output is handled separately by the UI.

Examples of INCORRECT usage (DO NOT DO THIS):
- Including JSON output: \`\`\`{ "memories": [...] }\`\`\`
- Listing memories: "Here are your memories: 1. 2025-01-01: Memory content"
- Date-based formatting: "2025-01-01: Memory content"

STAGING WORKFLOW:
When working with GitHub repositories, you have access to a staging area that prevents conflicts:
- Files are first staged for review before being committed
- When getting file content, you automatically check the staging area FIRST, then GitHub
- IMPORTANT: Always check existing staged files before creating new projects using getStagingState
- When creating projects, you have two options:
  1. Update existing staged files (default behavior) - files with same paths will be updated
  2. Clear all staged files first (set clearStagedFiles: true) - creates completely fresh project
- Use updateStagedFile to modify existing staged files
- The user can review all changes in the staging area before committing them
- When the user runs the app, it uses the LATEST staged files, not the files in the editor

STAGING BEST PRACTICES:
1. Before creating a new project, use getStagingState to check what files are already staged
2. If the user wants to replace an existing project entirely, you can:
   - Use clearStagedFiles: true parameter in createProject, OR
   - Use the clearStagedFiles tool first, then create the project normally
3. If the user wants to update/modify an existing project, use the default behavior
4. Always inform the user about staged files and what will happen when they run the app
5. Use updateStagedFile to modify individual staged files without affecting others

AVAILABLE STAGING TOOLS:
- getStagingState: Check what files are currently staged in a repository
- clearStagedFiles: Clear all staged files for a repository to start fresh
- updateStagedFile: Update content of an existing staged file
- createProject with clearStagedFiles: true: Create project and clear old staged files first
`
          : baseSystemPrompt;
        
        // Add context information to system prompt if present
        enhancedSystemPrompt = prepareSystemPrompt(enhancedSystemPrompt);

        console.log('[Memory] System prompt generation complete');

        try {
          // Initialize tool registry
          const toolRegistry = new ToolRegistry();

          // Create feedback middleware with abort signal and tool config
          const createToolWrapper = (toolName: string) => {
            const middleware = createToolFeedbackMiddleware({
              toolName,
              dataStream,
              registry: toolRegistry,
              signal,
              toolConfig,
            });
            return middleware.wrapTool;
          };

          // Wrap tools with feedback
          const tools = {
            getWeather: createToolWrapper('getWeather')(getWeather),
            createDocument: createToolWrapper('createDocument')(createDocument({ session, dataStream })),
            updateDocument: createToolWrapper('updateDocument')(updateDocument({ session, dataStream })),
            requestSuggestions: createToolWrapper('requestSuggestions')(requestSuggestions({ session, dataStream })),
            listRepositories: createToolWrapper('listRepositories')(createListRepositoriesTool({ session, dataStream })),
            createProject: createToolWrapper('createProject')(createCreateProjectTool({ session, dataStream })),
            getRepositoryFiles: createToolWrapper('getRepositoryFiles')(createGetRepositoryFilesTool({ session, dataStream })),
            getFileContent: createToolWrapper('getFileContent')(createGetFileContentTool({ session, dataStream })),
            searchFiles: createToolWrapper('searchFiles')(createSearchFilesTool({ session, dataStream })),
            openFileExplorer: createToolWrapper('openFileExplorer')(createOpenFileExplorerTool({ session, dataStream })),
            createRepository: createToolWrapper('createRepository')(createCreateRepositoryTool({ session, dataStream })),
            updateStagedFile: createToolWrapper('updateStagedFile')(createUpdateStagedFileTool({ session, dataStream })),
            getStagingState: createToolWrapper('getStagingState')(createGetStagingStateTool({ session, dataStream })),
            clearStagedFiles: createToolWrapper('clearStagedFiles')(createClearStagedFilesTool({ session, dataStream })),
            
            // Task tracker tools
            createTaskPlan: createToolWrapper('createTaskPlan')(createTaskTrackerTools(dataStream).createTaskPlan),
            updateTask: createToolWrapper('updateTask')(createTaskTrackerTools(dataStream).updateTask),
            completeTask: createToolWrapper('completeTask')(createTaskTrackerTools(dataStream).completeTask),
            getTaskStatus: createToolWrapper('getTaskStatus')(createTaskTrackerTools(dataStream).getTaskStatus),
            addTask: createToolWrapper('addTask')(createTaskTrackerTools(dataStream).addTask),
            
            ...(isMemoryEnabled
              ? { 
                  searchMemories: createToolWrapper('searchMemories')(searchMemories({ session })),
                  addMemory: createToolWrapper('addMemory')(addMemory({ session }))
                }
              : {}),
          };

          // Track any code project request to handle it separately
          let pendingCodeProjectRequest: any = null;
          
          // Create a data stream transformer to intercept certain messages
          const transformedDataStream = {
            ...dataStream,
            write: (data: any) => {
              // Check for code project request
              if (data.type === 'code-project-request') {
                console.log('[CHAT API] Intercepted code project request:', data.content);
                pendingCodeProjectRequest = data.content;
                return; // Don't pass this message to the client
              }
              
              // Pass through all other messages
              return dataStream.write?.(data);
            }
          };

          // Create new result with wrapped tools and abort signal
          const resultWithFeedback = await streamText({
            model: myProvider.languageModel(modelToUse), // Always use modelToUse
            system: enhancedSystemPrompt,
            messages: messages.slice(-15).map(sanitizeMessageForAI), // Limit to last 15 messages
            tools: tools,  // Use original tools
            providerOptions: {
              anthropic: {
                // Only enable thinking if the model supports reasoning
                ...(supportsReasoning ? { thinking: { type: 'enabled', budgetTokens: 2000 } } : {})
              },
              openai: {
                // Enable high-effort reasoning for o4-mini
                ...(modelToUse === 'o4-mini' ? { 
                  reasoning: { 
                    effort: 'high',
                    budgetTokens: 5000 // Higher token budget for more thorough reasoning
                  }
                } : {})
              }
            },
            temperature: 1,
            experimental_activeTools: [
              'getWeather',
              'createDocument',
              'updateDocument',
              'requestSuggestions',
              'listRepositories',
              'createProject',
              'getRepositoryFiles',
              'getFileContent',
              'searchFiles',
              'openFileExplorer',
              'createRepository',
              'updateStagedFile',
              'getStagingState',
              'clearStagedFiles',
              'createTaskPlan',
              'updateTask', 
              'completeTask',
              'getTaskStatus',
              'addTask',
              ...(isMemoryEnabled ? (['searchMemories', 'addMemory'] as const) : []),
            ],
            // experimental_generateMessageId: generateUUID, // Removed in AI SDK 5.0
            onFinish: async ({ response }) => {
              console.log('[CHAT API] Response messages:', JSON.stringify(response.messages, null, 2));
              if (session.user?.id) {
                try {
                  // Track the interaction usage based on model type
                  const isPremiumModel = modelIsPremium(modelToUse);
                  if (isPremiumModel) {
                    await trackPremiumInteraction(session.user.id);
                    console.log('[CHAT API] Tracked premium interaction for user:', session.user.id);
                  } else {
                    await trackBasicInteraction(session.user.id);
                    console.log('[CHAT API] Tracked basic interaction for user:', session.user.id);
                  }
                  const assistantMessages = response.messages.filter(
                    (message) => message.role === 'assistant'
                  );
                  const assistantId = assistantMessages.length > 0 ? 
                    (assistantMessages[assistantMessages.length - 1] as any).id || generateUUID() :
                    generateUUID();

                  if (!assistantId) {
                    console.error(
                      '[CHAT API] No assistant message found in response',
                    );
                    dataStream.write?.({
                      type: 'status',
                      content: 'idle',
                    });
                    dataStream.write?.({
                      type: 'finish',
                      content: '',
                    });
                    return;
                  }

                  // Get the assistant message from the response messages
                  const assistantMessage = assistantMessages.length > 0 ? 
                    {
                      id: assistantId,
                      role: 'assistant' as const,
                      parts: (assistantMessages[assistantMessages.length - 1] as any).content || [],
                      tool_calls: (assistantMessages[assistantMessages.length - 1] as any).tool_calls || null,
                      toolInvocations: (assistantMessages[assistantMessages.length - 1] as any).toolInvocations || [],
                      attachments: []
                    } as ExtendedUIMessage :
                    null;

                  // Extract memories from tool calls if present
                  const memories = assistantMessage ? extractMemoriesFromToolCalls(assistantMessage) : null;
                  
                  if (memories && memories.length > 0) {
                    console.log(`[Memory] Found ${memories.length} memories in assistant message, storing directly in message record`);
                  }

                  // Signal completion before persistence operations
                  dataStream.write?.({
                    type: 'status',
                    content: 'idle',
                  });
                  dataStream.write?.({
                    type: 'finish',
                    content: '',
                  });

                  // Fire-and-forget persistence operations
                  Promise.all([
                    // Save the AI response to database with memories included
                    assistantMessage ? saveMessages({
                      messages: [
                        {
                          id: assistantId,
                          chatId: id,
                          role: assistantMessage.role,
                          parts: assistantMessage.parts || [],
                          tool_calls: assistantMessage.tool_calls || null,
                          attachments:
                            assistantMessage.attachments ?? [],
                          memories: memories,
                          modelId: modelToUse,
                          createdAt: new Date(),
                        },
                      ],
                    }).catch(error => {
                      console.error('[CHAT API] Error saving assistant message:', error);
                    }) : Promise.resolve(),

                    // Store the user message in memory if enabled
                    isMemoryEnabled && PAPR_MEMORY_API_KEY ?
                      storeMessageInMemory({
                        userId: session.user.id,
                        chatId: id,
                        message: userMessage,
                        apiKey: PAPR_MEMORY_API_KEY,
                      }).catch(error => {
                        console.error('[Memory] Error storing message in memory:', error);
                      })
                    : Promise.resolve()
                  ]).catch(error => {
                    console.error('[CHAT API] Error in background persistence:', error);
                  });

                } catch (error) {
                  console.error('[CHAT API] Error in onFinish:', error);
                  // Signal error but allow the stream to complete
                  dataStream.write?.({
                    type: 'status',
                    content: 'idle',
                  });
                  dataStream.write?.({
                    type: 'finish',
                    content: '',
                  });
                }
              } else {
                // Handle case where session.user.id is not available
                console.error('[CHAT API] No user ID available in session');
                dataStream.write?.({
                  type: 'status',
                  content: 'idle',
                });
                dataStream.write?.({
                  type: 'finish',
                  content: '',
                });
              }
            },
            experimental_telemetry: {
              isEnabled: isProductionEnvironment,
              functionId: 'stream-text',
            },
          });

          // Process the stream result directly
          for await (const part of resultWithFeedback.textStream) {
            // Write text parts to the data stream
                      if (transformedDataStream && transformedDataStream.write) {
            transformedDataStream.write({
                type: 'text',
                content: part
              });
            }
          }

          // Ensure we send the final status updates
          dataStream.write?.({
            type: 'status',
            content: 'idle',
          });
          
          // Handle the pending code project request if it exists
          if (pendingCodeProjectRequest) {
            console.log('[CHAT API] Handling pending code project request:', pendingCodeProjectRequest);
            const title = pendingCodeProjectRequest.title || 'New Project';
            const isNewChat = request.headers.get('X-New-Chat') === 'true';
            try {
              await createAndStreamCodeProject(dataStream, title, isNewChat);
              console.log('[CHAT API] Code project streamed successfully');
            } catch (projectError) {
              console.error('[CHAT API] Error creating code project:', projectError);
            }
          }
          
          dataStream.write?.({
            type: 'finish',
            content: '',
          });

        } catch (streamError) {
          console.error('[CHAT API] Error consuming stream:', streamError);

          // Check if error is due to abort
          if (signal?.aborted) {
            console.log('[CHAT API] Stream aborted by client');
            return;
          }

          // Log more detailed information
          if (messages.length > 0) {
            const lastMessage = messages[messages.length - 1];
            console.log('[CHAT API] Last message role:', lastMessage.role);

            // Check for tool_calls
            if (lastMessage.tool_calls) {
              console.log(
                '[CHAT API] Tool calls found:',
                lastMessage.tool_calls.length,
              );
              lastMessage.tool_calls.forEach((tc, idx) => {
                console.log(`[CHAT API] Tool call #${idx + 1}:`, {
                  name: tc.function?.name,
                  hasOutput: !!tc.function?.output,
                });
              });
            }
          }

          dataStream.write?.({
            type: 'status',
            content: 'idle',
          });
          dataStream.write?.({
            type: 'finish',
            content: '',
          });
        } finally {
          // Close the writer
          writer.close();
        }
      } catch (error) {
        console.error('[CHAT API] STREAMING ERROR:', error);
        
        // Check if error is due to abort
        if (signal?.aborted) {
          console.log('[CHAT API] Stream aborted by client');
        }

        if (error instanceof Error) {
          console.error('[CHAT API] Stream error message:', error.message);
          console.error('[CHAT API] Stream error stack:', error.stack);
        }
        
        // Close the writer on error
        writer.close();
      }
    })();

    // Return the text stream response (fallback for now)
    return createTextStreamResponse({
      textStream: readable
    });
  } catch (error) {
    console.error('[CHAT API] ERROR:', error);

    // Get abort signal from request
    const signal = request.signal;

    // Check if error is due to abort
    if (signal?.aborted) {
      return new Response('Request cancelled', { status: 499 }); // Using 499 status code for client closed request
    }

    // Log additional details about the error
    if (error instanceof Error) {
      console.error('[CHAT API] Error message:', error.message);
      console.error('[CHAT API] Error stack:', error.stack);
    }

    return new Response(
      JSON.stringify({
        error: 'An error occurred while processing your request.',
        details: error instanceof Error ? error.message : 'Unknown error',
      }),
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

export async function DELETE(request: Request) {
  const { searchParams } = new URL(request.url);
  const id = searchParams.get('id');

  if (!id) {
    return new Response('Not Found', { status: 404 });
  }

  const session = await auth();

  if (!session || !session.user) {
    return new Response('Unauthorized', { status: 401 });
  }

  try {
    const chat = await getChatById({ id });

    if (chat.userId !== session.user.id) {
      return new Response('Unauthorized', { status: 401 });
    }

    await deleteChatById({ id });

    return new Response('Chat deleted', { status: 200 });
  } catch (error) {
    return new Response('An error occurred while processing your request!', {
      status: 500,
    });
  }
}
