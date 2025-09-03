import http from 'k6/http';
import { check, sleep } from 'k6';
import { Rate, Trend } from 'k6/metrics';

// Custom metrics
export const errorRate = new Rate('errors');
export const responseTime = new Trend('response_time');

// Test configuration
export const options = {
  stages: [
    { duration: '2m', target: 10 }, // Ramp up to 10 users
    { duration: '5m', target: 10 }, // Stay at 10 users
    { duration: '2m', target: 20 }, // Ramp up to 20 users
    { duration: '5m', target: 20 }, // Stay at 20 users
    { duration: '2m', target: 0 },  // Ramp down to 0 users
  ],
  thresholds: {
    http_req_duration: ['p(95)<2000'], // 95% of requests must complete below 2s
    http_req_failed: ['rate<0.1'],     // Error rate must be below 10%
    errors: ['rate<0.1'],              // Custom error rate must be below 10%
  },
};

// Base URL configuration
const BASE_URL = __ENV.BASE_URL || 'http://localhost:3001';
const API_BASE = `${BASE_URL}/api`;

// Test data
const testMessages = [
  'Hello, how are you?',
  'What tools are available?',
  'Can you help me with API testing?',
  'Show me the weather information',
  'How do I use the pet store API?',
  'What are the available endpoints?',
  'Can you explain the TMDB API?',
  'Help me understand the Trello integration',
];

export function setup() {
  // Setup function - runs once before the test
  console.log('Starting load test setup...');
  
  // Check if the API is available
  const healthResponse = http.get(`${API_BASE}/health`);
  if (healthResponse.status !== 200) {
    throw new Error('API is not available');
  }
  
  console.log('API is available, starting load test...');
  return { baseUrl: API_BASE };
}

export default function(data) {
  // Main test function - runs for each virtual user
  
  // Test 1: Health check
  const healthResponse = http.get(`${data.baseUrl}/health`);
  const healthCheck = check(healthResponse, {
    'health check status is 200': (r) => r.status === 200,
    'health check response time < 500ms': (r) => r.timings.duration < 500,
    'health check has correct content type': (r) => r.headers['Content-Type'].includes('application/json'),
  });
  
  if (!healthCheck) {
    errorRate.add(1);
  }
  
  responseTime.add(healthResponse.timings.duration);
  sleep(1);
  
  // Test 2: Get tools
  const toolsResponse = http.get(`${data.baseUrl}/tools`);
  const toolsCheck = check(toolsResponse, {
    'tools endpoint status is 200': (r) => r.status === 200,
    'tools endpoint response time < 2s': (r) => r.timings.duration < 2000,
    'tools endpoint returns array': (r) => {
      try {
        const body = JSON.parse(r.body);
        return Array.isArray(body.data);
      } catch (e) {
        return false;
      }
    },
  });
  
  if (!toolsCheck) {
    errorRate.add(1);
  }
  
  responseTime.add(toolsResponse.timings.duration);
  sleep(1);
  
  // Test 3: Search tools
  const searchQuery = testMessages[Math.floor(Math.random() * testMessages.length)];
  const searchResponse = http.get(`${data.baseUrl}/tools/search?q=${encodeURIComponent(searchQuery)}`);
  const searchCheck = check(searchResponse, {
    'search endpoint status is 200': (r) => r.status === 200,
    'search endpoint response time < 3s': (r) => r.timings.duration < 3000,
    'search endpoint returns results': (r) => {
      try {
        const body = JSON.parse(r.body);
        return body.success === true;
      } catch (e) {
        return false;
      }
    },
  });
  
  if (!searchCheck) {
    errorRate.add(1);
  }
  
  responseTime.add(searchResponse.timings.duration);
  sleep(1);
  
  // Test 4: Get specific tool (if tools are available)
  if (toolsResponse.status === 200) {
    try {
      const toolsBody = JSON.parse(toolsResponse.body);
      if (toolsBody.data && toolsBody.data.length > 0) {
        const toolId = toolsBody.data[0].id;
        const toolResponse = http.get(`${data.baseUrl}/tools/${toolId}`);
        const toolCheck = check(toolResponse, {
          'tool detail status is 200': (r) => r.status === 200,
          'tool detail response time < 2s': (r) => r.timings.duration < 2000,
          'tool detail returns tool data': (r) => {
            try {
              const body = JSON.parse(r.body);
              return body.success === true && body.data.id === toolId;
            } catch (e) {
              return false;
            }
          },
        });
        
        if (!toolCheck) {
          errorRate.add(1);
        }
        
        responseTime.add(toolResponse.timings.duration);
      }
    } catch (e) {
      console.error('Error parsing tools response:', e);
    }
  }
  
  sleep(2);
}

export function teardown(data) {
  // Teardown function - runs once after the test
  console.log('Load test completed');
  
  // Optional: Send test results to monitoring system
  const summary = {
    timestamp: new Date().toISOString(),
    test_duration: '16m',
    max_users: 20,
    base_url: data.baseUrl,
  };
  
  console.log('Test summary:', JSON.stringify(summary, null, 2));
}
