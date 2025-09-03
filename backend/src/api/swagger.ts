import { Application } from 'express';
import swaggerJsdoc from 'swagger-jsdoc';
import swaggerUi from 'swagger-ui-express';
import { version } from '../../package.json';

const options: swaggerJsdoc.Options = {
  definition: {
    openapi: '3.0.0',
    info: {
      title: 'One-Place-Chat API',
      version: version,
      description: 'Conversational AI system for API interactions with tool discovery and execution capabilities',
      contact: {
        name: 'API Support',
        email: 'support@yourapp.com',
        url: 'https://yourapp.com/support',
      },
      license: {
        name: 'MIT',
        url: 'https://opensource.org/licenses/MIT',
      },
    },
    servers: [
      {
        url: 'http://localhost:3001',
        description: 'Development server',
      },
      {
        url: 'https://api.yourapp.com',
        description: 'Production server',
      },
    ],
    components: {
      securitySchemes: {
        ApiKeyAuth: {
          type: 'apiKey',
          in: 'header',
          name: 'X-API-Key',
          description: 'API key for authentication',
        },
        BearerAuth: {
          type: 'http',
          scheme: 'bearer',
          bearerFormat: 'JWT',
          description: 'JWT token for authentication',
        },
      },
      schemas: {
        Error: {
          type: 'object',
          properties: {
            success: {
              type: 'boolean',
              example: false,
            },
            error: {
              type: 'string',
              example: 'Error message',
            },
            code: {
              type: 'string',
              example: 'ERROR_CODE',
            },
            timestamp: {
              type: 'string',
              format: 'date-time',
              example: '2024-12-01T10:00:00Z',
            },
          },
          required: ['success', 'error'],
        },
        Success: {
          type: 'object',
          properties: {
            success: {
              type: 'boolean',
              example: true,
            },
            data: {
              type: 'object',
              description: 'Response data',
            },
            timestamp: {
              type: 'string',
              format: 'date-time',
              example: '2024-12-01T10:00:00Z',
            },
          },
          required: ['success'],
        },
        HealthStatus: {
          type: 'object',
          properties: {
            status: {
              type: 'string',
              enum: ['healthy', 'unhealthy'],
              example: 'healthy',
            },
            timestamp: {
              type: 'string',
              format: 'date-time',
              example: '2024-12-01T10:00:00Z',
            },
            uptime: {
              type: 'number',
              description: 'Server uptime in seconds',
              example: 3600,
            },
            environment: {
              type: 'string',
              example: 'production',
            },
            version: {
              type: 'string',
              example: '1.0.0',
            },
          },
          required: ['status', 'timestamp', 'uptime', 'environment', 'version'],
        },
        DetailedHealthStatus: {
          allOf: [
            { $ref: '#/components/schemas/HealthStatus' },
            {
              type: 'object',
              properties: {
                services: {
                  type: 'object',
                  properties: {
                    chromadb: {
                      type: 'object',
                      properties: {
                        status: {
                          type: 'string',
                          enum: ['connected', 'disconnected', 'error'],
                        },
                        responseTime: {
                          type: 'number',
                          description: 'Response time in milliseconds',
                        },
                      },
                    },
                    memory: {
                      type: 'object',
                      properties: {
                        used: {
                          type: 'number',
                          description: 'Used memory in bytes',
                        },
                        total: {
                          type: 'number',
                          description: 'Total memory in bytes',
                        },
                        external: {
                          type: 'number',
                          description: 'External memory in bytes',
                        },
                      },
                    },
                    platform: {
                      type: 'string',
                      example: 'linux',
                    },
                    nodeVersion: {
                      type: 'string',
                      example: 'v20.10.0',
                    },
                  },
                },
              },
            },
          ],
        },
        Tool: {
          type: 'object',
          properties: {
            id: {
              type: 'string',
              example: 'tool-123',
              description: 'Unique tool identifier',
            },
            name: {
              type: 'string',
              example: 'Get Weather',
              description: 'Tool name',
            },
            description: {
              type: 'string',
              example: 'Get current weather information for a location',
              description: 'Tool description',
            },
            method: {
              type: 'string',
              enum: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH'],
              example: 'GET',
              description: 'HTTP method',
            },
            path: {
              type: 'string',
              example: '/weather',
              description: 'API endpoint path',
            },
            tags: {
              type: 'array',
              items: {
                type: 'string',
              },
              example: ['weather', 'location', 'forecast'],
              description: 'Tool tags for categorization',
            },
            deprecated: {
              type: 'boolean',
              example: false,
              description: 'Whether the tool is deprecated',
            },
            title: {
              type: 'string',
              example: 'Weather API',
              description: 'Tool title',
            },
            readOnly: {
              type: 'boolean',
              example: true,
              description: 'Whether the tool is read-only',
            },
            openWorld: {
              type: 'boolean',
              example: false,
              description: 'Whether the tool accepts open-world parameters',
            },
            inputSchema: {
              type: 'object',
              description: 'JSON schema for tool input parameters',
            },
            endpoint: {
              type: 'object',
              properties: {
                method: {
                  type: 'string',
                  example: 'GET',
                },
                path: {
                  type: 'string',
                  example: '/weather',
                },
                baseUrl: {
                  type: 'string',
                  example: 'https://api.weather.com',
                },
              },
            },
            security: {
              type: 'array',
              items: {
                type: 'object',
              },
              description: 'Security requirements for the tool',
            },
          },
          required: ['id', 'name', 'description', 'method', 'path', 'tags', 'deprecated', 'title', 'readOnly', 'openWorld'],
        },
        ToolList: {
          type: 'object',
          properties: {
            success: {
              type: 'boolean',
              example: true,
            },
            data: {
              type: 'array',
              items: {
                $ref: '#/components/schemas/Tool',
              },
            },
            count: {
              type: 'number',
              example: 25,
              description: 'Total number of tools',
            },
            limit: {
              type: 'number',
              example: 10,
              description: 'Number of tools per page',
            },
            offset: {
              type: 'number',
              example: 0,
              description: 'Number of tools to skip',
            },
          },
          required: ['success', 'data', 'count'],
        },
        Conversation: {
          type: 'object',
          properties: {
            id: {
              type: 'string',
              example: 'conv-123',
              description: 'Unique conversation identifier',
            },
            title: {
              type: 'string',
              example: 'Weather Discussion',
              description: 'Conversation title',
            },
            messages: {
              type: 'array',
              items: {
                $ref: '#/components/schemas/Message',
              },
              description: 'Conversation messages',
            },
            metadata: {
              type: 'object',
              properties: {
                startTime: {
                  type: 'string',
                  format: 'date-time',
                  example: '2024-12-01T10:00:00Z',
                },
                lastActivity: {
                  type: 'string',
                  format: 'date-time',
                  example: '2024-12-01T10:30:00Z',
                },
                messageCount: {
                  type: 'number',
                  example: 5,
                },
              },
            },
          },
          required: ['id', 'title', 'messages'],
        },
        Message: {
          type: 'object',
          properties: {
            id: {
              type: 'string',
              example: 'msg-123',
              description: 'Unique message identifier',
            },
            role: {
              type: 'string',
              enum: ['user', 'assistant', 'system'],
              example: 'user',
              description: 'Message role',
            },
            content: {
              type: 'string',
              example: 'What is the weather like today?',
              description: 'Message content',
            },
            timestamp: {
              type: 'string',
              format: 'date-time',
              example: '2024-12-01T10:00:00Z',
              description: 'Message timestamp',
            },
            metadata: {
              type: 'object',
              description: 'Additional message metadata',
            },
          },
          required: ['id', 'role', 'content', 'timestamp'],
        },
        ConversationList: {
          type: 'object',
          properties: {
            success: {
              type: 'boolean',
              example: true,
            },
            data: {
              type: 'array',
              items: {
                $ref: '#/components/schemas/Conversation',
              },
            },
            count: {
              type: 'number',
              example: 10,
              description: 'Total number of conversations',
            },
          },
          required: ['success', 'data', 'count'],
        },
        ToolStats: {
          type: 'object',
          properties: {
            success: {
              type: 'boolean',
              example: true,
            },
            data: {
              type: 'object',
              properties: {
                totalTools: {
                  type: 'number',
                  example: 25,
                  description: 'Total number of available tools',
                },
                isLoaded: {
                  type: 'boolean',
                  example: true,
                  description: 'Whether tools are loaded in memory',
                },
                lastUpdated: {
                  type: 'string',
                  format: 'date-time',
                  example: '2024-12-01T10:00:00Z',
                  description: 'Last time tools were updated',
                },
                categories: {
                  type: 'object',
                  additionalProperties: {
                    type: 'number',
                  },
                  example: {
                    'weather': 3,
                    'petstore': 5,
                    'trello': 8,
                  },
                  description: 'Number of tools per category',
                },
              },
            },
          },
          required: ['success', 'data'],
        },
      },
      responses: {
        BadRequest: {
          description: 'Bad Request',
          content: {
            'application/json': {
              schema: {
                $ref: '#/components/schemas/Error',
              },
              example: {
                success: false,
                error: 'Invalid request parameters',
                code: 'BAD_REQUEST',
                timestamp: '2024-12-01T10:00:00Z',
              },
            },
          },
        },
        Unauthorized: {
          description: 'Unauthorized',
          content: {
            'application/json': {
              schema: {
                $ref: '#/components/schemas/Error',
              },
              example: {
                success: false,
                error: 'Authentication required',
                code: 'UNAUTHORIZED',
                timestamp: '2024-12-01T10:00:00Z',
              },
            },
          },
        },
        Forbidden: {
          description: 'Forbidden',
          content: {
            'application/json': {
              schema: {
                $ref: '#/components/schemas/Error',
              },
              example: {
                success: false,
                error: 'Access denied',
                code: 'FORBIDDEN',
                timestamp: '2024-12-01T10:00:00Z',
              },
            },
          },
        },
        NotFound: {
          description: 'Not Found',
          content: {
            'application/json': {
              schema: {
                $ref: '#/components/schemas/Error',
              },
              example: {
                success: false,
                error: 'Resource not found',
                code: 'NOT_FOUND',
                timestamp: '2024-12-01T10:00:00Z',
              },
            },
          },
        },
        InternalServerError: {
          description: 'Internal Server Error',
          content: {
            'application/json': {
              schema: {
                $ref: '#/components/schemas/Error',
              },
              example: {
                success: false,
                error: 'Internal server error',
                code: 'INTERNAL_ERROR',
                timestamp: '2024-12-01T10:00:00Z',
              },
            },
          },
        },
      },
    },
    tags: [
      {
        name: 'Health',
        description: 'Health check endpoints',
      },
      {
        name: 'Tools',
        description: 'Tool discovery and management',
      },
      {
        name: 'Conversations',
        description: 'Conversation management',
      },
    ],
  },
  apis: ['./src/api/routes/*.ts'], // Path to the API files
};

const specs = swaggerJsdoc(options);

export function setupSwagger(app: Application): void {
  // Swagger UI options
  const swaggerUiOptions = {
    customCss: '.swagger-ui .topbar { display: none }',
    customSiteTitle: 'One-Place-Chat API Documentation',
    customfavIcon: '/favicon.ico',
    swaggerOptions: {
      persistAuthorization: true,
      displayRequestDuration: true,
      docExpansion: 'none',
      filter: true,
      showExtensions: true,
      showCommonExtensions: true,
    },
  };

  // Serve Swagger UI
  app.use('/api-docs', swaggerUi.serve, swaggerUi.setup(specs, swaggerUiOptions));

  // Serve OpenAPI JSON
  app.get('/api-docs.json', (req, res) => {
    res.setHeader('Content-Type', 'application/json');
    res.send(specs);
  });

  // Serve OpenAPI YAML
  app.get('/api-docs.yaml', (req, res) => {
    res.setHeader('Content-Type', 'application/x-yaml');
    res.send(specs);
  });
}
