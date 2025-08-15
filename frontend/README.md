# One-Place-Chat Frontend

A modern Next.js chat interface for API interactions.

## Features

- 🎨 **Modern Dark Theme**: Beautiful dark UI with gradient accents
- 💬 **Real-time Chat**: Interactive chat interface with auto-resizing textarea
- 🔍 **Search & Filter**: Search conversations and tools
- 📱 **Responsive Design**: Works on all device sizes
- ⚡ **Fast Performance**: Built with Next.js 15 and React 19

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

3. **Run development server**:
   ```bash
   npm run dev
   ```

4. **Open browser**:
   Navigate to [http://localhost:3000](http://localhost:3000)

## API Integration

The frontend is designed to connect to a Node.js backend. The API client (`src/lib/api.ts`) provides methods for:

- Managing conversations
- Fetching available tools
- Health checks

## Customization

- **Colors**: Modify the dark theme colors in `tailwind.config.ts`
- **Components**: Each component is modular and easily customizable
- **Styling**: Uses Tailwind CSS with custom CSS classes

## Development

- **TypeScript**: Full type safety with interfaces
- **React Hooks**: Modern React patterns with useState, useEffect
- **Tailwind CSS**: Utility-first CSS framework
- **Next.js 15**: Latest Next.js with App Router

## Next Steps

1. Connect to your Node.js backend
2. Implement real-time messaging
3. Add authentication
4. Integrate with your API tools
5. Add conversation persistence