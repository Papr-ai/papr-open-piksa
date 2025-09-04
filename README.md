# Piksa.ai

<a href="https://piksa.ai">
  <img alt="An AI-powered creative platform for content creation built on Next.js 14." src="app/(chat)/opengraph-image.png">
  <h1 align="center">Piksa.ai</h1>
</a>

<p align="center">
    Piksa.ai is an AI-powered creative platform for content creation. Built on Next.js 14, it helps creators make amazing books, stories, characters, illustrations, and more with AI assistance.
</p>

<p align="center">
  <a href="https://platform.papr.ai/papr-chat-template"><strong>Documentation</strong></a> ·
  <a href="#features"><strong>Features</strong></a> ·
  <a href="#model-providers"><strong>Model Providers</strong></a> ·
  <a href="#deploy-your-own"><strong>Deploy Your Own</strong></a> ·
  <a href="#running-locally"><strong>Running locally</strong></a>
</p>
<br/>

## Features

- **Advanced Memory System**
  - Long-term memory for personalized chat experiences powered by [Papr](https://platform.papr.ai)
  - Automatic storage and retrieval of relevant conversations
  - RAG (Retrieval-Augmented Generation) capabilities
  - Semantic search across conversation history
  - Organized memory with emoji tags, topics, and hierarchical structures
  - Memory categorization (preferences, goals, tasks, knowledge)
  - Persistent memory storage in the cloud

- **Rich Artifact System**
  - Create and edit code with syntax highlighting
  - Generate and visualize data using spreadsheets
  - Create and edit text documents
  - Generate and display images
  - Save artifacts to collections

- **GitHub Integration**
  - OAuth authentication for repository access
  - Repository browser with IDE-like file explorer
  - Live code editor with syntax highlighting
  - Run Python, HTML, and React applications
  - Save changes back to GitHub with commit messages

- **Container Runner**
  - Execute code in isolated, secure environments
  - Support for various application types (Node.js, Python, React, etc.)
  - Vercel Sandbox integration with OIDC authentication
  - Run applications with real networking and system dependencies
  - Turbopack-powered hot module replacement (HMR)

- **Modern Tech Stack**
  - Built with [Next.js 14](https://nextjs.org) App Router
  - [AI SDK](https://sdk.vercel.ai/docs) for unified LLM interactions
  - Beautiful UI with [shadcn/ui](https://ui.shadcn.com) and [Tailwind CSS](https://tailwindcss.com)
  - Component primitives from [Radix UI](https://radix-ui.com)
  - TypeScript for type safety

- **Production Ready**
  - [Neon Serverless Postgres](https://neon.tech) for chat history and memory
  - [Vercel Blob](https://vercel.com/storage/blob) for file storage
  - [Auth.js](https://authjs.dev) for authentication
  - Easy deployment to Vercel
  - Comprehensive test suite with Jest and Playwright

## About Papr Chat

Papr Chat is maintained by [Papr](https://platform.papr.ai) and builds upon [Vercel's V0 chatbot](https://github.com/vercel/ai-chatbot). We've enhanced the original template with our memory SDK to create chatbots that can maintain context across conversations and provide truly personalized experiences.

The key enhancement is the integration of Papr's Memory SDK, which allows your chatbot to:
- Remember past conversations and user preferences
- Retrieve relevant context automatically
- Build a knowledge base from chat interactions
- Provide more consistent and personalized responses
- Organize memories with tags, topics, and hierarchical structures

## Model Providers

Papr Chat ships with [xAI](https://x.ai) `grok-2-1212` as the default chat model, but supports multiple providers through the [AI SDK](https://sdk.vercel.ai/docs). You can easily switch to:
- [OpenAI](https://openai.com) (GPT-4, GPT-3.5)
- [Anthropic](https://anthropic.com) (Claude 3)
- [Google](https://ai.google.dev) (Gemini)
- [Cohere](https://cohere.com/)
- [Groq](https://groq.com)
- [And many more](https://sdk.vercel.ai/providers/ai-sdk-providers)

## Memory Architecture

Papr Chat implements a sophisticated memory system that:

1. **Automatically stores** important information from conversations
2. **Retrieves relevant memories** when needed for context
3. **Organizes memories** using:
   - Categories (preferences, goals, tasks, knowledge)
   - Emoji tags for visual identification
   - Topics for improved searchability
   - Hierarchical structures for organization

The memory system is powered by the Papr Memory SDK, which provides:
- Semantic vector search capabilities
- Long-term persistent storage
- User-specific memory isolation
- Advanced memory organization tools

## Deploy Your Own

You can deploy Papr Chat to Vercel with one click. Here's what you'll need:

1. A [Papr](https://app.papr.ai) account for the memory features
2. A database (can set up Neon automatically via Vercel)
3. An AI provider API key (xAI, OpenAI, Anthropic, etc.)

Click the button below to clone and deploy:

[![Deploy with Vercel](https://vercel.com/button)](https://vercel.com/new/clone?repository-url=https%3A%2F%2Fgithub.com%2Fpapr%2Fchat&env=PAPR_MEMORY_API_KEY,AUTH_SECRET,OPENAI_API_KEY&envDescription=API%20keys%20needed%20to%20run%20Papr%20Chat&envLink=https%3A%2F%2Fdocs.papr.ai%2Fchat%2Fdeployment&project-name=papr-chat&repository-name=papr-chat&demo-title=Papr%20Chat&demo-description=Open-Source%20AI%20Chatbot%20with%20Memory%20by%20Papr&demo-url=https%3A%2F%2Fchat.papr.ai&integration-ids=oac_VqOgBHqhEoFTPzGkPd7L0iH6)

### What Happens When You Deploy

1. Your GitHub repository will be cloned
2. Vercel will create a new project and deploy it
3. A Neon PostgreSQL database will be automatically provisioned
4. Vercel Blob Storage will be set up for file uploads
5. You'll be prompted to add the required environment variables:
   - `PAPR_MEMORY_API_KEY`: Get this from [Papr Dashboard](https://app.papr.ai/) → Settings → API Key
   - `AUTH_SECRET`: A random string for authentication (we'll generate one for you)
   - `OPENAI_API_KEY`: Your OpenAI API key (or another provider's key)

### After Deployment

1. Your app will be live at `your-project.vercel.app`
2. Set up authentication in the Vercel dashboard
3. Configure your AI provider settings in `config/ai.ts`
4. Optionally customize the chat interface in `components/`

For detailed setup instructions and customization options, visit our [deployment guide](https://platform.papr.ai/chat/papr-chat-template).

## Running locally

### Prerequisites

1. Get your Papr API key:
   - Sign up at [app.papr.ai](https://app.papr.ai)
   - Go to Settings → API Keys
   - Create a new API key

2. Set up your environment variables in `.env.local`:

```bash
# Authentication (required)
AUTH_SECRET=your_auth_secret_key

# Database (required)
POSTGRES_URL=your_neon_postgres_url

# File Storage (required)
BLOB_READ_WRITE_TOKEN=your_vercel_blob_token

# Papr Memory (required)
PAPR_MEMORY_API_KEY=your_papr_memory_api_key

# AI Provider (one is required)
XAI_API_KEY=your_xai_api_key
# OR
OPENAI_API_KEY=your_openai_api_key
# OR another provider

# GitHub Integration (optional)
GITHUB_CLIENT_ID=your_github_client_id
GITHUB_CLIENT_SECRET=your_github_client_secret
```

### Installation

1. Clone the repository:
```bash
git clone https://github.com/Papr-ai/PaprChat 
cd PaprChat
```

2. Install dependencies:
```bash
pnpm install
```

3. Set up the database:
```bash
pnpm db:migrate
```

4. Run the development server:
```bash
pnpm dev
```

Visit [localhost:3000](http://localhost:3000) to see your chatbot in action.

## Advanced Features

### GitHub Integration

To set up GitHub integration for code editing and execution:

1. Create a GitHub OAuth app at GitHub Settings → Developer settings → OAuth Apps
2. Set the callback URL to `http://localhost:3000/api/auth/callback/github` (for local) or your deployed URL
3. Add the client ID and secret to your environment variables
4. Restart the application

### Container Runner

The Vercel Sandbox integration provides secure container environments for running code:

- When deployed to Vercel, it's automatically configured via OIDC
- For local development, use `vercel link` and `vercel env pull` to get the necessary tokens
- Supports running Node.js, Python, React, and static HTML applications

### Custom Memory Organization

You can customize how memories are stored and retrieved:

1. Use emoji tags for visual categorization: `'emoji tags': ['💡', '🔧', '⚙️']`
2. Add topics for better searchability: `topics: ['typescript', 'configuration', 'preferences']`
3. Create hierarchical structures: `hierarchical_structures: 'knowledge/development/typescript'`
4. Categorize memories as preferences, goals, tasks, or knowledge

## Contributing

We welcome contributions! Please see our [Contributing Guide](CONTRIBUTING.md) for details.

## License

Papr Chat is open-source software licensed under the MIT license.

## Support

- Documentation: [platform.papr.ai/papr-chat-template](https://platform.papr.ai/papr-chat-template)
- Discord: [Join our community](https://discord.gg/tGzshWDg)
- Issues: [GitHub Issues](https://github.com/papr/chat/issues)
