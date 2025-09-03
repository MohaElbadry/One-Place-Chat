import http from 'k6/http';
import { check, sleep } from 'k6';
import { Rate, Trend, Counter } from 'k6/metrics';

// Custom metrics
export const errorRate = new Rate('errors');
export const responseTime = new Trend('response_time');
export const requestCount = new Counter('requests');

// Stress test configuration
export const options = {
  stages: [
    { duration: '1m', target: 50 },   // Ramp up to 50 users
    { duration: '2m', target: 50 },   // Stay at 50 users
    { duration: '1m', target: 100 },  // Ramp up to 100 users
    { duration: '2m', target: 100 },  // Stay at 100 users
    { duration: '1m', target: 150 },  // Ramp up to 150 users
    { duration: '2m', target: 150 },  // Stay at 150 users
    { duration: '1m', target: 0 },    // Ramp down to 0 users
  ],
  thresholds: {
    http_req_duration: ['p(95)<5000'], // 95% of requests must complete below 5s
    http_req_failed: ['rate<0.2'],     // Error rate must be below 20%
    errors: ['rate<0.2'],              // Custom error rate must be below 20%
  },
};

// Base URL configuration
const BASE_URL = __ENV.BASE_URL || 'http://localhost:3001';
const API_BASE = `${BASE_URL}/api`;

// Test scenarios
const scenarios = [
  'health_check',
  'tools_list',
  'tools_search',
  'tool_detail',
  'conversation_start',
  'message_send',
];

export function setup() {
  console.log('Starting stress test setup...');
  
  // Check if the API is available
  const healthResponse = http.get(`${API_BASE}/health`);
  if (healthResponse.status !== 200) {
    throw new Error('API is not available for stress testing');
  }
  
  console.log('API is available, starting stress test...');
  return { baseUrl: API_BASE };
}

export default function(data) {
  // Randomly select a scenario
  const scenario = scenarios[Math.floor(Math.random() * scenarios.length)];
  
  switch (scenario) {
    case 'health_check':
      runHealthCheck(data);
      break;
    case 'tools_list':
      runToolsList(data);
      break;
    case 'tools_search':
      runToolsSearch(data);
      break;
    case 'tool_detail':
      runToolDetail(data);
      break;
    case 'conversation_start':
      runConversationStart(data);
      break;
    case 'message_send':
      runMessageSend(data);
      break;
  }
  
  requestCount.add(1);
  sleep(Math.random() * 2); // Random sleep between 0-2 seconds
}

function runHealthCheck(data) {
  const response = http.get(`${data.baseUrl}/health`);
  const checkResult = check(response, {
    'health check status is 200': (r) => r.status === 200,
    'health check response time < 1s': (r) => r.timings.duration < 1000,
  });
  
  if (!checkResult) {
    errorRate.add(1);
  }
  
  responseTime.add(response.timings.duration);
}

function runToolsList(data) {
  const response = http.get(`${data.baseUrl}/tools`);
  const checkResult = check(response, {
    'tools list status is 200': (r) => r.status === 200,
    'tools list response time < 3s': (r) => r.timings.duration < 3000,
  });
  
  if (!checkResult) {
    errorRate.add(1);
  }
  
  responseTime.add(response.timings.duration);
}

function runToolsSearch(data) {
  const searchQueries = [
    'weather',
    'pet',
    'movie',
    'trello',
    'api',
    'test',
    'data',
    'user',
  ];
  
  const query = searchQueries[Math.floor(Math.random() * searchQueries.length)];
  const response = http.get(`${data.baseUrl}/tools/search?q=${encodeURIComponent(query)}`);
  const checkResult = check(response, {
    'tools search status is 200': (r) => r.status === 200,
    'tools search response time < 5s': (r) => r.timings.duration < 5000,
  });
  
  if (!checkResult) {
    errorRate.add(1);
  }
  
  responseTime.add(response.timings.duration);
}

function runToolDetail(data) {
  // First get a tool ID
  const toolsResponse = http.get(`${data.baseUrl}/tools`);
  
  if (toolsResponse.status === 200) {
    try {
      const toolsBody = JSON.parse(toolsResponse.body);
      if (toolsBody.data && toolsBody.data.length > 0) {
        const toolId = toolsBody.data[Math.floor(Math.random() * toolsBody.data.length)].id;
        const response = http.get(`${data.baseUrl}/tools/${toolId}`);
        const checkResult = check(response, {
          'tool detail status is 200': (r) => r.status === 200,
          'tool detail response time < 3s': (r) => r.timings.duration < 3000,
        });
        
        if (!checkResult) {
          errorRate.add(1);
        }
        
        responseTime.add(response.timings.duration);
      }
    } catch (e) {
      errorRate.add(1);
    }
  } else {
    errorRate.add(1);
  }
}

function runConversationStart(data) {
  const response = http.post(`${data.baseUrl}/conversations`, JSON.stringify({
    title: 'Stress Test Conversation',
  }), {
    headers: { 'Content-Type': 'application/json' },
  });
  
  const checkResult = check(response, {
    'conversation start status is 201': (r) => r.status === 201,
    'conversation start response time < 2s': (r) => r.timings.duration < 2000,
  });
  
  if (!checkResult) {
    errorRate.add(1);
  }
  
  responseTime.add(response.timings.duration);
}

function runMessageSend(data) {
  const messages = [
    'Hello, how are you?',
    'What tools are available?',
    'Can you help me with testing?',
    'Show me the weather',
    'How do I use the API?',
    'What endpoints are available?',
    'Can you explain the integration?',
    'Help me understand the system',
  ];
  
  const message = messages[Math.floor(Math.random() * messages.length)];
  const response = http.post(`${data.baseUrl}/conversations/test-conversation/messages`, JSON.stringify({
    content: message,
  }), {
    headers: { 'Content-Type': 'application/json' },
  });
  
  const checkResult = check(response, {
    'message send status is 200 or 201': (r) => r.status === 200 || r.status === 201,
    'message send response time < 10s': (r) => r.timings.duration < 10000,
  });
  
  if (!checkResult) {
    errorRate.add(1);
  }
  
  responseTime.add(response.timings.duration);
}

export function teardown(data) {
  console.log('Stress test completed');
  
  const summary = {
    timestamp: new Date().toISOString(),
    test_duration: '10m',
    max_users: 150,
    base_url: data.baseUrl,
    test_type: 'stress',
  };
  
  console.log('Stress test summary:', JSON.stringify(summary, null, 2));
}
