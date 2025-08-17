# One-Place-Chat Frontend

A modern Next.js chat interface for API interactions.

## Features

- 🎨 **Modern Dark Theme**: Beautiful dark UI with gradient accents
- 💬 **Real-time Chat**: Interactive chat interface with auto-resizing textarea
- 🔍 **Search & Filter**: Search conversations and tools
- 📱 **Responsive Design**: Works on all device sizes
- ⚡ **Fast Performance**: Built with Next.js 15 and React 19
- 🔌 **REST API Integration**: Full integration with backend REST API

## Components

- **ChatInterface**: Main orchestrator component
- **Sidebar**: Conversation management and search
- **ChatArea**: Main chat interface and message input
- **ToolsPanel**: API tools and endpoints display

## Setup

1. **Install dependencies**:
   ```bash
   npm install
   ```

2. **Create environment file**:
   Create `.env.local` in the root directory:
   ```env
   NEXT_PUBLIC_API_URL=http://localhost:3001/api
   NEXT_PUBLIC_APP_NAME=One-Place-Chat
   NEXT_PUBLIC_APP_VERSION=1.0.0
   ```

3. **Start the backend API server**:
   ```bash
   # In the backend directory
   npm run api:dev
   ```

4. **Run development server**:
   ```bash
   npm run dev
   ```

5. **Open browser**:
   Navigate to [http://localhost:3000](http://localhost:3000)

## API Integration

The frontend is designed to connect to a Node.js backend REST API. The API client (`src/lib/api.ts`) provides methods for:

### Tools Management
- `getTools(limit?, offset?)` - Get all available tools
- `searchTools(query, limit)` - Search tools by query
- `getTool(id)` - Get specific tool details
- `getToolsByCategory(category, limit)` - Get tools by category
- `getToolsStats()` - Get tools statistics

### Conversation Management
- `getConversations(limit?, offset?, search?)` - Get all conversations
- `createConversation(title?, userId?)` - Create new conversation
- `getConversation(id)` - Get specific conversation
- `addMessage(conversationId, role, content, metadata?)` - Add message
- `deleteConversation(id)` - Delete conversation
- `getConversationStats(id)` - Get conversation statistics

### Health Monitoring
- `healthCheck()` - Basic health check
- `detailedHealthCheck()` - Detailed health with service status
- `readinessCheck()` - Service readiness check

## Backend API Endpoints

The backend provides the following REST API endpoints:

- **Tools**: `/api/tools` - Tool management and search
- **Conversations**: `/api/conversations` - Conversation management
- **Health**: `/api/health` - System health monitoring

## Customization

- **Colors**: Modify the dark theme colors in `tailwind.config.ts`
- **Components**: Each component is modular and easily customizable
- **Styling**: Uses Tailwind CSS with custom CSS classes
- **API**: Configure API endpoints in `src/lib/api.ts`

## Development

- **TypeScript**: Full type safety with interfaces
- **React Hooks**: Modern React patterns with useState, useEffect
- **Tailwind CSS**: Utility-first CSS framework
- **Next.js 15**: Latest Next.js with App Router
- **REST API**: Full REST API integration with error handling

## Next Steps

1. ✅ Connect to your Node.js backend REST API
2. ✅ Implement real-time messaging
3. Add authentication
4. Integrate with your API tools
5. Add conversation persistence
6. Implement real-time updates with WebSockets