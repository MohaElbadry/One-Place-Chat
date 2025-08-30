import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import morgan from 'morgan';
import dotenv from 'dotenv';
import { toolsRouter } from './routes/tools.js';
import { conversationsRouter } from './routes/conversations.js';
import { healthRouter } from './routes/health.js';

// Load environment variables
dotenv.config();

const app = express();
const PORT = process.env.PORT || 3001;

// Middleware
app.use(helmet());
app.use(cors({
  origin: process.env.FRONTEND_URL || 'http://localhost:3000',
  credentials: true
}));
app.use(morgan('combined'));
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

// Routes
app.use('/api/tools', toolsRouter);
app.use('/api/conversations', conversationsRouter);
app.use('/api/health', healthRouter);

// Root endpoint
app.get('/', (req, res) => {
  res.json({
    message: 'One-Place-Chat API Server',
    version: '1.0.0',
    endpoints: {
      tools: '/api/tools',
      'tools-upload': '/api/tools/upload',
      conversations: '/api/conversations',
      health: '/api/health'
    }
  });
});

// 404 handler
app.use('*', (req, res) => {
  res.status(404).json({
    error: 'Endpoint not found',
    path: req.originalUrl
  });
});

// Error handler
app.use((err: any, req: express.Request, res: express.Response, next: express.NextFunction) => {
  console.error('Error:', err);
  res.status(err.status || 500).json({
    error: err.message || 'Internal server error',
    ...(process.env.NODE_ENV === 'development' && { stack: err.stack })
  });
});

// Start server
app.listen(PORT, () => {
  console.log(`🚀 API Server running on port ${PORT}`);
  console.log(`📚 API Documentation: http://localhost:${PORT}`);
  console.log(`🔧 Tools endpoint: http://localhost:${PORT}/api/tools`);
  console.log(`📤 Tools upload endpoint: http://localhost:${PORT}/api/tools/upload`);
  console.log(`💬 Conversations endpoint: http://localhost:${PORT}/api/conversations`);
});

export default app;
