import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import morgan from 'morgan';
import dotenv from 'dotenv';
import { toolsRouter } from './routes/tools.js';
import { conversationsRouter } from './routes/conversations.js';
import { healthRouter } from './routes/health.js';
import { setupSwagger } from './swagger.js';
import { 
  versionMiddleware, 
  compatibilityMiddleware, 
  getVersionInfo 
} from './middleware/versioning.js';

// Load environment variables
dotenv.config();

const app = express();
const PORT = process.env.PORT || 3001;

// Middleware
app.use(helmet());

// CORS configuration for both local development and Docker
const corsOrigins = [
  'http://localhost:3000',  // Local development
  'http://frontend:3000',   // Docker frontend container
  'http://localhost:3001',  // Direct backend access
  'http://backend:3001'     // Docker backend container
];

// Add environment-specific origins
if (process.env.FRONTEND_URL) {
  corsOrigins.push(process.env.FRONTEND_URL);
}
if (process.env.CORS_ORIGIN) {
  corsOrigins.push(process.env.CORS_ORIGIN);
}

app.use(cors({
  origin: (origin, callback) => {
    // Allow requests with no origin (like mobile apps or curl requests)
    if (!origin) return callback(null, true);
    
    // Check if origin is in allowed list
    if (corsOrigins.includes(origin)) {
      return callback(null, true);
    }
    
    // In development, be more permissive
    if (process.env.NODE_ENV === 'development') {
      console.log(`⚠️  CORS: Allowing origin in development: ${origin}`);
      return callback(null, true);
    }
    
    console.log(`❌ CORS: Blocked origin: ${origin}`);
    return callback(new Error('Not allowed by CORS'), false);
  },
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization', 'X-Requested-With']
}));
app.use(morgan('combined'));
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

// API versioning middleware
app.use(versionMiddleware);
app.use(compatibilityMiddleware);

// API version info endpoint
app.get('/api/version', getVersionInfo);

// Routes
app.use('/api/tools', toolsRouter);
app.use('/api/conversations', conversationsRouter);
app.use('/api/health', healthRouter);

// Setup Swagger documentation
setupSwagger(app);

// Root endpoint
app.get('/', (req, res) => {
  const apiVersion = (req as any).apiVersion;
  const versionInfo = (req as any).versionInfo;
  
  res.json({
    message: 'One-Place-Chat API Server',
    version: versionInfo.version,
    apiVersion: apiVersion,
    status: versionInfo.status,
    endpoints: {
      tools: '/api/tools',
      'tools-upload': '/api/tools/upload',
      conversations: '/api/conversations',
      health: '/api/health',
      version: '/api/version',
      documentation: '/api-docs'
    },
    documentation: {
      swagger: '/api-docs',
      openapi: '/api-docs.json',
      yaml: '/api-docs.yaml'
    }
  });
});

// 404 handler
// app.use('*', (req, res) => {
//   res.status(404).json({
//     error: 'Endpoint not found',
//     path: req.originalUrl
//   });
// });

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
