import { Router } from 'express';
import { ChromaDBService } from '../../database/ChromaDBService.js';

const router = Router();
const chromaService = new ChromaDBService();

/**
 * @swagger
 * /api/health:
 *   get:
 *     summary: Get basic health status
 *     description: Returns the basic health status of the API
 *     tags: [Health]
 *     responses:
 *       200:
 *         description: Health status retrieved successfully
 *         content:
 *           application/json:
 *             schema:
 *               allOf:
 *                 - $ref: '#/components/schemas/Success'
 *                 - type: object
 *                   properties:
 *                     data:
 *                       $ref: '#/components/schemas/HealthStatus'
 *             example:
 *               success: true
 *               data:
 *                 status: "healthy"
 *                 timestamp: "2024-12-01T10:00:00Z"
 *                 uptime: 3600
 *                 environment: "production"
 *                 version: "1.0.0"
 *       500:
 *         $ref: '#/components/responses/InternalServerError'
 */
// GET /api/health - Basic health check
router.get('/', (req, res) => {
  res.json({
    success: true,
    data: {
      status: 'healthy',
      timestamp: new Date().toISOString(),
      uptime: process.uptime(),
      environment: process.env.NODE_ENV || 'development',
      version: '1.0.0'
    }
  });
});

/**
 * @swagger
 * /api/health/detailed:
 *   get:
 *     summary: Get detailed health status
 *     description: Returns detailed health status including service dependencies
 *     tags: [Health]
 *     responses:
 *       200:
 *         description: Detailed health status retrieved successfully
 *         content:
 *           application/json:
 *             schema:
 *               allOf:
 *                 - $ref: '#/components/schemas/Success'
 *                 - type: object
 *                   properties:
 *                     data:
 *                       $ref: '#/components/schemas/DetailedHealthStatus'
 *             example:
 *               success: true
 *               data:
 *                 status: "healthy"
 *                 timestamp: "2024-12-01T10:00:00Z"
 *                 uptime: 3600
 *                 environment: "production"
 *                 version: "1.0.0"
 *                 services:
 *                   chromadb: "healthy"
 *                   memory:
 *                     used: 128
 *                     total: 512
 *                     external: 64
 *                   platform: "linux"
 *                   nodeVersion: "v20.10.0"
 *       500:
 *         $ref: '#/components/responses/InternalServerError'
 */
// GET /api/health/detailed - Detailed health check with service status
router.get('/detailed', async (req, res) => {
  try {
    const healthStatus: any = {
      status: 'healthy',
      timestamp: new Date().toISOString(),
      uptime: process.uptime(),
      environment: process.env.NODE_ENV || 'development',
      version: '1.0.0',
      services: {
        chromadb: 'unknown',
        memory: {
          used: Math.round(process.memoryUsage().heapUsed / 1024 / 1024),
          total: Math.round(process.memoryUsage().heapTotal / 1024 / 1024),
          external: Math.round(process.memoryUsage().external / 1024 / 1024)
        },
        platform: process.platform,
        nodeVersion: process.version
      }
    };

    // Check ChromaDB connection
    try {
      await chromaService.initialize();
      const stats = await chromaService.getDatabaseStats();
      healthStatus.services.chromadb = 'healthy';
      healthStatus.services.chromadbStats = stats;
    } catch (error) {
      healthStatus.services.chromadb = 'unhealthy';
      healthStatus.services.chromadbError = error instanceof Error ? error.message : 'Unknown error';
      healthStatus.status = 'degraded';
    }

    res.json({
      success: true,
      data: healthStatus
    });
  } catch (error) {
    console.error('Health check error:', error);
    res.status(500).json({
      success: false,
      error: 'Health check failed',
      message: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

/**
 * @swagger
 * /api/health/ready:
 *   get:
 *     summary: Get readiness status
 *     description: Returns readiness status for Kubernetes readiness probes
 *     tags: [Health]
 *     responses:
 *       200:
 *         description: Service is ready
 *         content:
 *           application/json:
 *             schema:
 *               allOf:
 *                 - $ref: '#/components/schemas/Success'
 *                 - type: object
 *                   properties:
 *                     data:
 *                       type: object
 *                       properties:
 *                         status:
 *                           type: string
 *                           example: "ready"
 *                         timestamp:
 *                           type: string
 *                           format: date-time
 *                         services:
 *                           type: object
 *                           properties:
 *                             chromadb:
 *                               type: string
 *                               example: "ready"
 *       503:
 *         description: Service is not ready
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Error'
 *             example:
 *               success: false
 *               error: "Service not ready"
 *               message: "ChromaDB service is not available"
 */
// GET /api/health/ready - Readiness probe
router.get('/ready', async (req, res) => {
  try {
    // Check if ChromaDB is accessible
    await chromaService.initialize();
    const stats = await chromaService.getDatabaseStats();
    
    res.json({
      success: true,
      data: {
        status: 'ready',
        timestamp: new Date().toISOString(),
        services: {
          chromadb: 'ready',
          stats
        }
      }
    });
  } catch (error) {
    console.error('Readiness check failed:', error);
    res.status(503).json({
      success: false,
      error: 'Service not ready',
      message: 'ChromaDB service is not available',
      details: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

export { router as healthRouter };
