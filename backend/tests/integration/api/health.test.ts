import request from 'supertest';
import { Express } from 'express';
import express from 'express';
import cors from 'cors';
import { healthRouter } from '../../../src/api/routes/health.js'; 


describe('Health API Integration Tests', () => {
  let app: Express;

  beforeAll(async () => {
    // Set test environment
    process.env.NODE_ENV = 'test';
    process.env.PORT = '0'; // Use random port for testing
    
    app = express();
    app.use(cors());
    app.use(express.json());
    app.use('/api/health', healthRouter);
    
    // Add 404 handler for testing
    app.use('*', (req, res) => {
      res.status(404).json({
        error: 'Endpoint not found',
        path: req.originalUrl
      });
    });
  });

  afterAll(async () => {
    // Cleanup - no need to close Express app
  });

  describe('GET /api/health', () => {
    it('should return health status', async () => {
      const response = await request(app)
        .get('/api/health')
        .expect(200);

      expect(response.body).toHaveProperty('success');
      expect(response.body).toHaveProperty('data');
      expect(response.body.data).toHaveProperty('status');
      expect(response.body.data).toHaveProperty('timestamp');
      expect(response.body.data).toHaveProperty('uptime');
      expect(response.body.data).toHaveProperty('environment');
      expect(response.body.data).toHaveProperty('version');
      
      expect(response.body.success).toBe(true);
      expect(response.body.data.status).toBe('healthy');
      expect(response.body.data.environment).toBe('test');
    });

    it('should return correct content type', async () => {
      const response = await request(app)
        .get('/api/health')
        .expect(200);

      expect(response.headers['content-type']).toMatch(/application\/json/);
    });

    it('should include timestamp in ISO format', async () => {
      const response = await request(app)
        .get('/api/health')
        .expect(200);

      const timestamp = new Date(response.body.data.timestamp);
      expect(timestamp).toBeInstanceOf(Date);
      expect(timestamp.getTime()).not.toBeNaN();
    });

    it('should include uptime as number', async () => {
      const response = await request(app)
        .get('/api/health')
        .expect(200);

      expect(typeof response.body.data.uptime).toBe('number');
      expect(response.body.data.uptime).toBeGreaterThanOrEqual(0);
    });
  });

  describe('GET /api/health/detailed', () => {
    it('should return detailed health information', async () => {
      const response = await request(app)
        .get('/api/health/detailed')
        .expect(200);

      expect(response.body).toHaveProperty('success');
      expect(response.body).toHaveProperty('data');
      expect(response.body.data).toHaveProperty('status');
      expect(response.body.data).toHaveProperty('timestamp');
      expect(response.body.data).toHaveProperty('uptime');
      expect(response.body.data).toHaveProperty('environment');
      expect(response.body.data).toHaveProperty('version');
      expect(response.body.data).toHaveProperty('services');
      
      expect(response.body.data.services).toHaveProperty('chromadb');
      expect(response.body.data.services).toHaveProperty('memory');
      expect(response.body.data.services).toHaveProperty('platform');
      expect(response.body.data.services).toHaveProperty('nodeVersion');
    });

    it('should include memory information', async () => {
      const response = await request(app)
        .get('/api/health/detailed')
        .expect(200);

      const memory = response.body.data.services.memory;
      expect(memory).toHaveProperty('used');
      expect(memory).toHaveProperty('total');
      expect(memory).toHaveProperty('external');
      
      expect(typeof memory.used).toBe('number');
      expect(typeof memory.total).toBe('number');
      expect(typeof memory.external).toBe('number');
    });

    it('should include platform information', async () => {
      const response = await request(app)
        .get('/api/health/detailed')
        .expect(200);

      expect(response.body.data.services.platform).toBeDefined();
      expect(response.body.data.services.nodeVersion).toBeDefined();
    });
  });

  describe('GET /api/health/ready', () => {
    it('should return readiness status', async () => {
      const response = await request(app)
        .get('/api/health/ready')
        .expect(503); // ChromaDB is not available in test environment

      expect(response.body).toHaveProperty('success');
      expect(response.body).toHaveProperty('error');
      expect(response.body.success).toBe(false);
      expect(response.body.error).toBe('Service not ready');
    });

    it('should return 503 when not ready', async () => {
      await request(app)
        .get('/api/health/ready')
        .expect(503);
    });
  });

  describe('Error handling', () => {
    it('should handle invalid endpoints', async () => {
      const response = await request(app)
        .get('/api/health/invalid')
        .expect(404);

      expect(response.body).toHaveProperty('error');
    });

    it('should handle CORS preflight requests', async () => {
      await request(app)
        .options('/api/health')
        .expect(204); // CORS middleware returns 204 for OPTIONS preflight
    });
  });

  describe('Performance', () => {
    it('should respond quickly', async () => {
      const start = Date.now();
      
      await request(app)
        .get('/api/health')
        .expect(200);
      
      const duration = Date.now() - start;
      expect(duration).toBeLessThan(1000); // Should respond within 1 second
    });

    it('should handle concurrent requests', async () => {
      const requests = Array(10).fill(null).map(() =>
        request(app).get('/api/health').expect(200)
      );

      const responses = await Promise.all(requests);
      
      responses.forEach(response => {
        expect(response.body.data.status).toBe('healthy');
      });
    });
  });
});
