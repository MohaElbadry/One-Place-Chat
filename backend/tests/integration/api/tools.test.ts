import request from 'supertest';
import { Express } from 'express';
import serverApp from '../../src/api/server';

describe('Tools API Integration Tests', () => {
  let app: Express;

  beforeAll(async () => {
    // Set test environment
    process.env.NODE_ENV = 'test';
    process.env.PORT = '0';
    
    app = serverApp;
  });

  afterAll(async () => {
    if (app) {
      await new Promise<void>((resolve) => {
        // Express app doesn't need to be closed
        resolve();
      });
    }
  });

  describe('GET /api/tools', () => {
    it('should return list of tools', async () => {
      const response = await request(app)
        .get('/api/tools')
        .expect(200);

      expect(response.body).toHaveProperty('success', true);
      expect(response.body).toHaveProperty('data');
      expect(Array.isArray(response.body.data)).toBe(true);
    });

    it('should support pagination', async () => {
      const response = await request(app)
        .get('/api/tools?limit=5&offset=0')
        .expect(200);

      expect(response.body).toHaveProperty('data');
      expect(response.body).toHaveProperty('count');
      expect(response.body).toHaveProperty('limit', 5);
      expect(response.body).toHaveProperty('offset', 0);
    });

    it('should return tool structure', async () => {
      const response = await request(app)
        .get('/api/tools')
        .expect(200);

      if (response.body.data.length > 0) {
        const tool = response.body.data[0];
        expect(tool).toHaveProperty('id');
        expect(tool).toHaveProperty('name');
        expect(tool).toHaveProperty('description');
        expect(tool).toHaveProperty('method');
        expect(tool).toHaveProperty('path');
        expect(tool).toHaveProperty('tags');
        expect(tool).toHaveProperty('deprecated');
        expect(tool).toHaveProperty('title');
        expect(tool).toHaveProperty('readOnly');
        expect(tool).toHaveProperty('openWorld');
      }
    });

    it('should handle invalid pagination parameters', async () => {
      const response = await request(app)
        .get('/api/tools?limit=invalid&offset=invalid')
        .expect(400);

      expect(response.body).toHaveProperty('success', false);
      expect(response.body).toHaveProperty('error');
    });
  });

  describe('GET /api/tools/search', () => {
    it('should search tools by query', async () => {
      const response = await request(app)
        .get('/api/tools/search?q=test')
        .expect(200);

      expect(response.body).toHaveProperty('success', true);
      expect(response.body).toHaveProperty('data');
      expect(Array.isArray(response.body.data)).toBe(true);
    });

    it('should return empty results for non-matching query', async () => {
      const response = await request(app)
        .get('/api/tools/search?q=nonexistenttool')
        .expect(200);

      expect(response.body).toHaveProperty('success', true);
      expect(response.body.data).toEqual([]);
    });

    it('should require query parameter', async () => {
      const response = await request(app)
        .get('/api/tools/search')
        .expect(400);

      expect(response.body).toHaveProperty('success', false);
      expect(response.body).toHaveProperty('error');
    });

    it('should support limit parameter', async () => {
      const response = await request(app)
        .get('/api/tools/search?q=test&limit=3')
        .expect(200);

      expect(response.body.data.length).toBeLessThanOrEqual(3);
    });
  });

  describe('GET /api/tools/:id', () => {
    it('should return specific tool details', async () => {
      // First get a tool ID
      const toolsResponse = await request(app)
        .get('/api/tools')
        .expect(200);

      if (toolsResponse.body.data.length > 0) {
        const toolId = toolsResponse.body.data[0].id;
        
        const response = await request(app)
          .get(`/api/tools/${toolId}`)
          .expect(200);

        expect(response.body).toHaveProperty('success', true);
        expect(response.body).toHaveProperty('data');
        expect(response.body.data).toHaveProperty('id', toolId);
        expect(response.body.data).toHaveProperty('inputSchema');
        expect(response.body.data).toHaveProperty('endpoint');
        expect(response.body.data).toHaveProperty('security');
      }
    });

    it('should return 404 for non-existent tool', async () => {
      const response = await request(app)
        .get('/api/tools/nonexistent-id')
        .expect(404);

      expect(response.body).toHaveProperty('success', false);
      expect(response.body).toHaveProperty('error');
    });

    it('should validate tool ID format', async () => {
      const response = await request(app)
        .get('/api/tools/invalid-id-format')
        .expect(400);

      expect(response.body).toHaveProperty('success', false);
    });
  });

  describe('GET /api/tools/categories/:category', () => {
    it('should filter tools by category', async () => {
      const response = await request(app)
        .get('/api/tools/categories/test')
        .expect(200);

      expect(response.body).toHaveProperty('success', true);
      expect(response.body).toHaveProperty('data');
      expect(Array.isArray(response.body.data)).toBe(true);
    });

    it('should return empty results for non-existent category', async () => {
      const response = await request(app)
        .get('/api/tools/categories/nonexistent')
        .expect(200);

      expect(response.body).toHaveProperty('success', true);
      expect(response.body.data).toEqual([]);
    });
  });

  describe('GET /api/tools/stats', () => {
    it('should return tools statistics', async () => {
      const response = await request(app)
        .get('/api/tools/stats')
        .expect(200);

      expect(response.body).toHaveProperty('success', true);
      expect(response.body).toHaveProperty('data');
      expect(response.body.data).toHaveProperty('totalTools');
      expect(response.body.data).toHaveProperty('isLoaded');
      
      expect(typeof response.body.data.totalTools).toBe('number');
      expect(typeof response.body.data.isLoaded).toBe('boolean');
    });
  });

  describe('Error handling', () => {
    it('should handle malformed requests', async () => {
      const response = await request(app)
        .get('/api/tools?limit=-1')
        .expect(400);

      expect(response.body).toHaveProperty('success', false);
    });

    it('should handle server errors gracefully', async () => {
      // This would require mocking internal errors
      // For now, we test the error response structure
      const response = await request(app)
        .get('/api/tools/invalid')
        .expect(400);

      expect(response.body).toHaveProperty('success', false);
      expect(response.body).toHaveProperty('error');
    });
  });

  describe('Performance', () => {
    it('should respond quickly to tools list', async () => {
      const start = Date.now();
      
      await request(app)
        .get('/api/tools')
        .expect(200);
      
      const duration = Date.now() - start;
      expect(duration).toBeLessThan(2000); // Should respond within 2 seconds
    });

    it('should handle concurrent tool requests', async () => {
      const requests = Array(5).fill(null).map(() =>
        request(app).get('/api/tools').expect(200)
      );

      const responses = await Promise.all(requests);
      
      responses.forEach(response => {
        expect(response.body.success).toBe(true);
      });
    });
  });

  describe('CORS', () => {
    it('should include CORS headers', async () => {
      const response = await request(app)
        .get('/api/tools')
        .expect(200);

      expect(response.headers).toHaveProperty('access-control-allow-origin');
    });

    it('should handle preflight requests', async () => {
      await request(app)
        .options('/api/tools')
        .expect(204);
    });
  });
});
