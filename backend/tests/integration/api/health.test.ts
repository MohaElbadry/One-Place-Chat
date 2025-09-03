import request from 'supertest';
import { Express } from 'express';
import express from 'express';
import { healthRouter } from '../../../src/api/routes/health.js'; 

describe('Health API Integration Tests', () => {
  let app: Express;

  beforeAll(async () => {
    // Set test environment
    process.env.NODE_ENV = 'test';
    process.env.PORT = '0'; // Use random port for testing
    
    app = express();
    app.use('/api/health', healthRouter);
  });

  afterAll(async () => {
    // Cleanup - no need to close Express app
  });

  describe('GET /api/health', () => {
    it('should return health status', async () => {
      const response = await request(app)
        .get('/api/health')
        .expect(200);

      expect(response.body).toHaveProperty('status');
      expect(response.body).toHaveProperty('timestamp');
      expect(response.body).toHaveProperty('uptime');
      expect(response.body).toHaveProperty('environment');
      expect(response.body).toHaveProperty('version');
      
      expect(response.body.status).toBe('healthy');
      expect(response.body.environment).toBe('test');
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

      const timestamp = new Date(response.body.timestamp);
      expect(timestamp).toBeInstanceOf(Date);
      expect(timestamp.getTime()).not.toBeNaN();
    });

    it('should include uptime as number', async () => {
      const response = await request(app)
        .get('/api/health')
        .expect(200);

      expect(typeof response.body.uptime).toBe('number');
      expect(response.body.uptime).toBeGreaterThanOrEqual(0);
    });
  });

  describe('GET /api/health/detailed', () => {
    it('should return detailed health information', async () => {
      const response = await request(app)
        .get('/api/health/detailed')
        .expect(200);

      expect(response.body).toHaveProperty('status');
      expect(response.body).toHaveProperty('timestamp');
      expect(response.body).toHaveProperty('uptime');
      expect(response.body).toHaveProperty('environment');
      expect(response.body).toHaveProperty('version');
      expect(response.body).toHaveProperty('services');
      
      expect(response.body.services).toHaveProperty('chromadb');
      expect(response.body.services).toHaveProperty('memory');
      expect(response.body.services).toHaveProperty('platform');
      expect(response.body.services).toHaveProperty('nodeVersion');
    });

    it('should include memory information', async () => {
      const response = await request(app)
        .get('/api/health/detailed')
        .expect(200);

      const memory = response.body.services.memory;
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

      expect(response.body.services.platform).toBeDefined();
      expect(response.body.services.nodeVersion).toBeDefined();
    });
  });

  describe('GET /api/health/ready', () => {
    it('should return readiness status', async () => {
      const response = await request(app)
        .get('/api/health/ready')
        .expect(200);

      expect(response.body).toHaveProperty('status');
      expect(response.body).toHaveProperty('ready');
      expect(response.body).toHaveProperty('timestamp');
      
      expect(response.body.ready).toBe(true);
    });

    it('should return 200 when ready', async () => {
      await request(app)
        .get('/api/health/ready')
        .expect(200);
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
        .expect(204);
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
        expect(response.body.status).toBe('healthy');
      });
    });
  });
});
