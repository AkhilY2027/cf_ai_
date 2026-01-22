# Cloudflare AI Chat Application

An AI-powered chat application built on Cloudflare's platform, demonstrating modern serverless architecture with Workers AI, Durable Objects, and Pages.

## 🌟 Features

- **AI Integration**: Powered by Llama 3.3 (70B) on Cloudflare Workers AI
- **Persistent Memory**: Conversation history managed with Durable Objects
- **Real-time Chat**: Beautiful, responsive web interface
- **Session Management**: Each user gets their own conversation session
- **Stateful Conversations**: AI remembers previous messages in the conversation
- **Clear Chat**: Ability to reset conversation history

## 🏗️ Architecture

This application implements all required Cloudflare components:

1. **LLM**: Llama 3.3 (70B FP8 Fast) via Workers AI
2. **Workflow/Coordination**: Cloudflare Workers for API endpoints and request handling
3. **User Input**: Web-based chat interface served via Cloudflare Pages/Workers
4. **Memory/State**: Durable Objects for persistent conversation storage

### Component Details

- **Cloudflare Workers**: Handles HTTP requests, API endpoints, and serves the frontend
- **Workers AI**: Processes chat messages using Llama 3.3 model
- **Durable Objects**: Manages conversation state with persistent storage
- **TypeScript**: Type-safe development

## 📋 Prerequisites

Before you begin, ensure you have:

- [Node.js](https://nodejs.org/) (v18 or later)
- [npm](https://www.npmjs.com/) or [yarn](https://yarnpkg.com/)
- A [Cloudflare account](https://dash.cloudflare.com/sign-up)
- [Wrangler CLI](https://developers.cloudflare.com/workers/wrangler/install-and-update/) (installed via npm)

## 🚀 Setup Instructions

### 1. Install Dependencies

```bash
npm install
```

This will install:
- `wrangler`: Cloudflare's CLI for Workers
- `@cloudflare/workers-types`: TypeScript definitions
- `typescript`: TypeScript compiler

### 2. Authenticate with Cloudflare

```bash
npx wrangler login
```

This will open your browser to authenticate with your Cloudflare account.

### 3. Run Locally

Start the development server:

```bash
npm run dev
```

Or using wrangler directly:

```bash
npx wrangler dev
```

The application will be available at `http://localhost:8787`

### 4. Test the Application

1. Open your browser to `http://localhost:8787`
2. Type a message in the chat input
3. Press Enter or click "Send"
4. The AI will respond using Llama 3.3
5. Continue the conversation - the AI remembers previous messages!

## 🌐 Deployment (Optional)

To deploy to Cloudflare's global network:

```bash
npm run deploy
```

Or:

```bash
npx wrangler deploy
```

After deployment, your app will be available at:
`https://cf-ai-chat-app.<your-subdomain>.workers.dev`

## 📁 Project Structure

```
cf_ai_/
├── src/
│   └── index.ts          # Main Worker code with AI integration
├── wrangler.toml         # Cloudflare Workers configuration
├── package.json          # Node.js dependencies
├── tsconfig.json         # TypeScript configuration
├── .gitignore           # Git ignore file
└── README.md            # This file
```

## 🔧 Configuration

### wrangler.toml

The `wrangler.toml` file configures:
- Workers AI binding (`AI`)
- Durable Object bindings (`CHAT_MEMORY`)
- Worker name and compatibility settings

### Environment Variables

No environment variables are required for local development. Workers AI and Durable Objects are automatically available in the Cloudflare Workers environment.

## 🎯 API Endpoints

The Worker exposes several endpoints:

- `GET /` - Serves the chat interface
- `POST /api/chat` - Send a message and get AI response
  ```json
  {
    "message": "Hello!",
    "sessionId": "user-xyz123"
  }
  ```
- `POST /api/clear` - Clear conversation history
  ```json
  {
    "sessionId": "user-xyz123"
  }
  ```
- `GET /api/history?sessionId=user-xyz123` - Get conversation history

## 💡 How It Works

1. **User sends a message** via the web interface
2. **Worker receives** the request at `/api/chat`
3. **Durable Object** stores the message and retrieves conversation history
4. **Workers AI** processes the conversation with Llama 3.3
5. **AI response** is stored in the Durable Object
6. **Response returned** to the user's browser
7. **UI updates** with the AI's message

### Memory Management

- Each user session has a unique ID
- Conversation history is stored in a Durable Object instance
- Last 20 messages are kept to manage memory efficiently
- History persists across page reloads

## 🎨 Features Demonstrated

### Workers AI Integration
```typescript
const response = await env.AI.run('@cf/meta/llama-3.3-70b-instruct-fp8-fast', {
    messages: aiMessages,
    stream: false
});
```

### Durable Objects for State
```typescript
const id = env.CHAT_MEMORY.idFromName(sessionId);
const stub = env.CHAT_MEMORY.get(id);
await stub.fetch('http://do/messages', { method: 'POST', ... });
```

### Persistent Storage
```typescript
await this.state.storage.put('messages', this.messages);
const stored = await this.state.storage.get('messages');
```

## 🔍 Troubleshooting

### "AI binding not found"
Make sure you're logged in to Cloudflare with `npx wrangler login`

### "Durable Object not found"
Ensure `wrangler.toml` has the correct Durable Object configuration

### Port already in use
Use a different port: `npx wrangler dev --port 8788`

### Module not found errors
Run `npm install` to install all dependencies

## 📚 Resources

- [Cloudflare Workers AI Documentation](https://developers.cloudflare.com/workers-ai/)
- [Durable Objects Guide](https://developers.cloudflare.com/durable-objects/)
- [Cloudflare Agents Documentation](https://developers.cloudflare.com/agents/)
- [Wrangler Documentation](https://developers.cloudflare.com/workers/wrangler/)

## 🤝 Contributing

This project was created for the Cloudflare SWE Intern Application.

## 📄 License

MIT
