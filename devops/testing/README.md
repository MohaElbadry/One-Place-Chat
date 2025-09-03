# One-Place-Chat Testing Suite

This directory contains comprehensive testing infrastructure for the One-Place-Chat project, including unit tests, integration tests, API tests, and load testing.

## 📁 Directory Structure

```
devops/testing/
├── README.md                    # This documentation
├── backend/                     # Backend test configurations
│   ├── jest.config.js          # Jest configuration
│   └── setup.ts                # Test setup
├── frontend/                    # Frontend test configurations
│   ├── jest.config.js          # Jest configuration
│   └── setup.js                # Test setup
└── load-tests/                  # Load testing scripts
    ├── k6-load-test.js         # Standard load test
    ├── stress-test.js          # Stress test
    ├── smoke-test.js           # Smoke test
    └── run-load-tests.sh       # Load test runner
```

## 🧪 Test Types

### 1. Unit Tests
- **Purpose**: Test individual functions and components in isolation
- **Location**: `backend/tests/unit/`, `frontend/src/**/__tests__/`
- **Framework**: Jest
- **Coverage**: Functions, classes, utilities

### 2. Integration Tests
- **Purpose**: Test component interactions and API endpoints
- **Location**: `backend/tests/integration/`
- **Framework**: Jest + Supertest
- **Coverage**: API routes, database interactions, service integrations

### 3. End-to-End Tests
- **Purpose**: Test complete user workflows
- **Location**: `backend/tests/e2e/`
- **Framework**: Jest + Puppeteer/Playwright
- **Coverage**: Full application flows

### 4. Load Tests
- **Purpose**: Test system performance under load
- **Location**: `devops/load-tests/`
- **Framework**: k6
- **Coverage**: API performance, concurrent users, stress testing

## 🚀 Quick Start

### Backend Testing

```bash
# Navigate to backend directory
cd backend

# Install dependencies
npm install

# Run all tests
npm test

# Run specific test types
npm run test:unit
npm run test:integration
npm run test:e2e

# Run tests with coverage
npm run test:coverage

# Run tests in watch mode
npm run test:watch
```

### Frontend Testing

```bash
# Navigate to frontend directory
cd frontend

# Install dependencies
npm install

# Run all tests
npm test

# Run specific test types
npm run test:unit
npm run test:integration

# Run tests with coverage
npm run test:coverage

# Run tests in watch mode
npm run test:watch
```

### Load Testing

```bash
# Navigate to load tests directory
cd devops/load-tests

# Install k6 (if not already installed)
# Ubuntu/Debian: sudo apt-get install k6
# macOS: brew install k6

# Run load tests
./run-load-tests.sh load

# Run stress tests
./run-load-tests.sh stress

# Run smoke tests
./run-load-tests.sh smoke

# Run all tests
./run-load-tests.sh all
```

## 📊 Test Coverage

### Backend Coverage Targets
- **Branches**: 70%
- **Functions**: 70%
- **Lines**: 70%
- **Statements**: 70%

### Frontend Coverage Targets
- **Branches**: 60%
- **Functions**: 60%
- **Lines**: 60%
- **Statements**: 60%

### Coverage Reports
- **HTML Reports**: Generated in `coverage/` directory
- **LCOV Reports**: For CI/CD integration
- **Console Output**: Real-time coverage during test runs

## 🔧 Configuration

### Jest Configuration

#### Backend (`backend/jest.config.js`)
```javascript
module.exports = {
  preset: 'ts-jest',
  testEnvironment: 'node',
  roots: ['<rootDir>/src', '<rootDir>/tests'],
  testMatch: [
    '**/__tests__/**/*.ts',
    '**/?(*.)+(spec|test).ts'
  ],
  collectCoverageFrom: [
    'src/**/*.ts',
    '!src/**/*.d.ts',
    '!src/**/*.test.ts',
    '!src/**/*.spec.ts',
  ],
  coverageThreshold: {
    global: {
      branches: 70,
      functions: 70,
      lines: 70,
      statements: 70
    }
  }
};
```

#### Frontend (`frontend/jest.config.js`)
```javascript
const nextJest = require('next/jest');

const createJestConfig = nextJest({
  dir: './',
});

const customJestConfig = {
  setupFilesAfterEnv: ['<rootDir>/jest.setup.js'],
  testEnvironment: 'jest-environment-jsdom',
  collectCoverageFrom: [
    'src/**/*.{js,jsx,ts,tsx}',
    '!src/**/*.d.ts',
    '!src/**/*.stories.{js,jsx,ts,tsx}',
  ],
  coverageThreshold: {
    global: {
      branches: 60,
      functions: 60,
      lines: 60,
      statements: 60
    }
  }
};

module.exports = createJestConfig(customJestConfig);
```

### Load Testing Configuration

#### k6 Load Test (`devops/load-tests/k6-load-test.js`)
```javascript
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
  },
};
```

## 📝 Writing Tests

### Unit Test Example

```typescript
// backend/tests/unit/core/ConversationalEngine.test.ts
import { ConversationalEngine } from '../../../src/core/ConversationalEngine';

describe('ConversationalEngine', () => {
  let engine: ConversationalEngine;

  beforeEach(() => {
    engine = new ConversationalEngine('gpt-4');
  });

  it('should create a new conversation', () => {
    const conversationId = engine.startConversation();
    expect(conversationId).toBeDefined();
    expect(typeof conversationId).toBe('string');
  });

  it('should process messages', async () => {
    const conversationId = engine.startConversation();
    const response = await engine.processMessage(conversationId, 'Hello');
    
    expect(response).toBeDefined();
    expect(response.message).toBeDefined();
  });
});
```

### Integration Test Example

```typescript
// backend/tests/integration/api/health.test.ts
import request from 'supertest';
import { createServer } from '../../src/api/server';

describe('Health API Integration Tests', () => {
  let app: Express;

  beforeAll(async () => {
    app = await createServer();
  });

  it('should return health status', async () => {
    const response = await request(app)
      .get('/api/health')
      .expect(200);

    expect(response.body).toHaveProperty('status');
    expect(response.body.status).toBe('healthy');
  });
});
```

### Load Test Example

```javascript
// devops/load-tests/k6-load-test.js
import http from 'k6/http';
import { check } from 'k6';

export default function() {
  const response = http.get('http://localhost:3001/api/health');
  check(response, {
    'status is 200': (r) => r.status === 200,
    'response time < 500ms': (r) => r.timings.duration < 500,
  });
}
```

## 🚨 Test Best Practices

### 1. Test Structure
- **Arrange**: Set up test data and mocks
- **Act**: Execute the code under test
- **Assert**: Verify the expected outcomes

### 2. Naming Conventions
- **Test files**: `*.test.ts` or `*.spec.ts`
- **Test directories**: `__tests__/` or `tests/`
- **Test descriptions**: Clear, descriptive names

### 3. Mocking
- **External services**: Mock API calls and database operations
- **Dependencies**: Mock internal dependencies for unit tests
- **Time**: Mock timers for time-dependent tests

### 4. Test Data
- **Fixtures**: Use consistent test data
- **Factories**: Create test data dynamically
- **Cleanup**: Clean up test data after each test

### 5. Assertions
- **Specific**: Use specific assertions
- **Descriptive**: Include descriptive error messages
- **Complete**: Test all code paths and edge cases

## 🔍 Debugging Tests

### Backend Tests
```bash
# Run tests with debug output
npm test -- --verbose

# Run specific test file
npm test -- ConversationalEngine.test.ts

# Run tests matching pattern
npm test -- --testNamePattern="should create conversation"
```

### Frontend Tests
```bash
# Run tests with debug output
npm test -- --verbose

# Run tests in watch mode
npm test -- --watch

# Run tests with coverage
npm test -- --coverage
```

### Load Tests
```bash
# Run with verbose output
k6 run --verbose k6-load-test.js

# Run with custom thresholds
k6 run --threshold http_req_duration=p(95)<1000 k6-load-test.js

# Run with custom environment
k6 run --env BASE_URL=http://staging.yourapp.com k6-load-test.js
```

## 📈 CI/CD Integration

### GitHub Actions
```yaml
# .github/workflows/ci-cd.yml
- name: Run Backend Tests
  run: |
    cd backend
    npm run test:ci

- name: Run Frontend Tests
  run: |
    cd frontend
    npm run test:ci

- name: Run Load Tests
  run: |
    cd devops/load-tests
    ./run-load-tests.sh smoke
```

### Test Reports
- **Coverage**: Uploaded to Codecov
- **Load Tests**: Results stored in `devops/load-tests/results/`
- **Test Reports**: Generated HTML reports for review

## 🛠️ Troubleshooting

### Common Issues

#### Tests Failing
1. **Check dependencies**: Ensure all packages are installed
2. **Check environment**: Verify test environment variables
3. **Check mocks**: Ensure mocks are properly configured
4. **Check timing**: Add appropriate waits for async operations

#### Coverage Issues
1. **Check patterns**: Verify coverage collection patterns
2. **Check thresholds**: Adjust coverage thresholds if needed
3. **Check exclusions**: Ensure test files are excluded from coverage

#### Load Test Issues
1. **Check k6 installation**: Verify k6 is properly installed
2. **Check API availability**: Ensure API is running and accessible
3. **Check thresholds**: Adjust performance thresholds if needed

### Debug Commands
```bash
# Backend
npm test -- --verbose --no-coverage
npm test -- --detectOpenHandles

# Frontend
npm test -- --verbose --no-coverage
npm test -- --detectOpenHandles

# Load Tests
k6 run --verbose k6-load-test.js
k6 run --http-debug k6-load-test.js
```

## 📚 Additional Resources

- [Jest Documentation](https://jestjs.io/docs/getting-started)
- [k6 Documentation](https://k6.io/docs/)
- [Testing Library Documentation](https://testing-library.com/)
- [Supertest Documentation](https://github.com/visionmedia/supertest)

---

**Last Updated**: December 2024  
**Version**: 1.0.0
