# One-Place-Chat API Documentation

This directory contains comprehensive API documentation for the One-Place-Chat system, including OpenAPI specifications, versioning information, and integration guides.

## 📁 Directory Structure

```
devops/api-docs/
├── README.md                    # This documentation
├── openapi/                     # OpenAPI specifications
│   ├── v1/                     # API version 1.0.0
│   │   ├── openapi.json        # OpenAPI 3.0 specification
│   │   └── openapi.yaml        # OpenAPI 3.0 specification (YAML)
│   └── v2/                     # API version 2.0.0 (beta)
│       ├── openapi.json        # OpenAPI 3.0 specification
│       └── openapi.yaml        # OpenAPI 3.0 specification (YAML)
├── postman/                     # Postman collections
│   ├── One-Place-Chat-v1.json  # Postman collection for v1
│   └── One-Place-Chat-v2.json  # Postman collection for v2
└── examples/                    # API usage examples
    ├── curl/                    # cURL examples
    ├── javascript/              # JavaScript/Node.js examples
    ├── python/                  # Python examples
    └── typescript/              # TypeScript examples
```

## 🚀 Quick Start

### Accessing API Documentation

1. **Swagger UI**: Visit `http://localhost:3001/api-docs` when the server is running
2. **OpenAPI JSON**: `http://localhost:3001/api-docs.json`
3. **OpenAPI YAML**: `http://localhost:3001/api-docs.yaml`

### API Base URLs

- **Development**: `http://localhost:3001`
- **Staging**: `https://staging-api.yourapp.com`
- **Production**: `https://api.yourapp.com`

## 📋 API Versions

### Version 1.0.0 (Stable)
- **Status**: Stable
- **Release Date**: December 1, 2024
- **Deprecation Date**: None
- **Sunset Date**: None

### Version 2.0.0 (Beta)
- **Status**: Beta
- **Release Date**: December 15, 2024
- **Deprecation Date**: None
- **Sunset Date**: None

## 🔧 API Versioning

### Version Header
```http
API-Version: v1
```

### Query Parameter
```http
GET /api/tools?version=v1
```

### Default Version
If no version is specified, the API defaults to version 1.0.0.

## 📊 API Endpoints

### Health Endpoints

#### GET /api/health
Get basic health status of the API.

```bash
curl -X GET "http://localhost:3001/api/health" \
  -H "API-Version: v1"
```

**Response:**
```json
{
  "success": true,
  "data": {
    "status": "healthy",
    "timestamp": "2024-12-01T10:00:00Z",
    "uptime": 3600,
    "environment": "production",
    "version": "1.0.0"
  }
}
```

#### GET /api/health/detailed
Get detailed health status including service dependencies.

```bash
curl -X GET "http://localhost:3001/api/health/detailed" \
  -H "API-Version: v1"
```

#### GET /api/health/ready
Get readiness status for Kubernetes probes.

```bash
curl -X GET "http://localhost:3001/api/health/ready" \
  -H "API-Version: v1"
```

### Tools Endpoints

#### GET /api/tools
Get a paginated list of available tools.

```bash
curl -X GET "http://localhost:3001/api/tools?limit=10&offset=0" \
  -H "API-Version: v1"
```

**Parameters:**
- `limit` (optional): Number of tools per page (1-100, default: 10)
- `offset` (optional): Number of tools to skip (default: 0)

**Response:**
```json
{
  "success": true,
  "data": [
    {
      "id": "tool-123",
      "name": "Get Weather",
      "description": "Get current weather information for a location",
      "method": "GET",
      "path": "/weather",
      "tags": ["weather", "location"],
      "deprecated": false,
      "title": "Weather API",
      "readOnly": true,
      "openWorld": false,
      "inputSchema": {
        "type": "object",
        "properties": {
          "location": {
            "type": "string",
            "description": "Location to get weather for"
          }
        },
        "required": ["location"]
      },
      "endpoint": {
        "method": "GET",
        "path": "/weather",
        "baseUrl": "https://api.weather.com"
      },
      "security": []
    }
  ],
  "count": 25,
  "limit": 10,
  "offset": 0
}
```

#### GET /api/tools/search
Search tools by query.

```bash
curl -X GET "http://localhost:3001/api/tools/search?q=weather" \
  -H "API-Version: v1"
```

**Parameters:**
- `q` (required): Search query
- `limit` (optional): Maximum number of results (default: 10)

#### GET /api/tools/{id}
Get specific tool details.

```bash
curl -X GET "http://localhost:3001/api/tools/tool-123" \
  -H "API-Version: v1"
```

#### GET /api/tools/categories/{category}
Get tools by category.

```bash
curl -X GET "http://localhost:3001/api/tools/categories/weather" \
  -H "API-Version: v1"
```

#### GET /api/tools/stats
Get tools statistics.

```bash
curl -X GET "http://localhost:3001/api/tools/stats" \
  -H "API-Version: v1"
```

#### POST /api/tools/upload
Upload OpenAPI specification to add new tools.

```bash
curl -X POST "http://localhost:3001/api/tools/upload" \
  -H "API-Version: v1" \
  -H "Content-Type: multipart/form-data" \
  -F "file=@openapi-spec.json"
```

### Conversations Endpoints

#### GET /api/conversations
Get list of conversations.

```bash
curl -X GET "http://localhost:3001/api/conversations" \
  -H "API-Version: v1"
```

#### POST /api/conversations
Create a new conversation.

```bash
curl -X POST "http://localhost:3001/api/conversations" \
  -H "API-Version: v1" \
  -H "Content-Type: application/json" \
  -d '{"title": "Weather Discussion"}'
```

#### GET /api/conversations/{id}
Get specific conversation.

```bash
curl -X GET "http://localhost:3001/api/conversations/conv-123" \
  -H "API-Version: v1"
```

#### POST /api/conversations/{id}/messages
Send a message to a conversation.

```bash
curl -X POST "http://localhost:3001/api/conversations/conv-123/messages" \
  -H "API-Version: v1" \
  -H "Content-Type: application/json" \
  -d '{"content": "What is the weather like today?"}'
```

### Version Endpoints

#### GET /api/version
Get API version information.

```bash
curl -X GET "http://localhost:3001/api/version" \
  -H "API-Version: v1"
```

**Response:**
```json
{
  "success": true,
  "data": {
    "currentVersion": "v1",
    "versionInfo": {
      "version": "1.0.0",
      "status": "stable",
      "releaseDate": "2024-12-01",
      "deprecationDate": null,
      "sunsetDate": null
    },
    "allVersions": {
      "v1": {
        "version": "1.0.0",
        "status": "stable",
        "releaseDate": "2024-12-01",
        "deprecationDate": null,
        "sunsetDate": null
      },
      "v2": {
        "version": "2.0.0",
        "status": "beta",
        "releaseDate": "2024-12-15",
        "deprecationDate": null,
        "sunsetDate": null
      }
    },
    "supportedVersions": ["v1", "v2"]
  }
}
```

## 🔐 Authentication

### API Key Authentication
```http
X-API-Key: your-api-key-here
```

### Bearer Token Authentication
```http
Authorization: Bearer your-jwt-token-here
```

## 📝 Error Handling

### Error Response Format
```json
{
  "success": false,
  "error": "Error message",
  "code": "ERROR_CODE",
  "timestamp": "2024-12-01T10:00:00Z",
  "version": "v1"
}
```

### HTTP Status Codes
- `200` - Success
- `201` - Created
- `400` - Bad Request
- `401` - Unauthorized
- `403` - Forbidden
- `404` - Not Found
- `409` - Conflict
- `410` - Gone (API version sunset)
- `422` - Unprocessable Entity
- `429` - Too Many Requests
- `500` - Internal Server Error
- `503` - Service Unavailable

### Common Error Codes
- `BAD_REQUEST` - Invalid request parameters
- `UNAUTHORIZED` - Authentication required
- `FORBIDDEN` - Access denied
- `NOT_FOUND` - Resource not found
- `VALIDATION_ERROR` - Request validation failed
- `RATE_LIMIT_EXCEEDED` - Too many requests
- `INTERNAL_ERROR` - Internal server error
- `SERVICE_UNAVAILABLE` - Service temporarily unavailable

## 🚦 Rate Limiting

### Rate Limits
- **Default**: 100 requests per minute per IP
- **Authenticated**: 1000 requests per minute per API key
- **Burst**: 10 requests per second

### Rate Limit Headers
```http
X-RateLimit-Limit: 100
X-RateLimit-Remaining: 95
X-RateLimit-Reset: 1640995200
```

## 📊 Response Headers

### Standard Headers
```http
Content-Type: application/json
X-API-Version: v1
X-API-Version-Status: stable
X-API-Release-Date: 2024-12-01
X-Request-ID: req-123456
X-Response-Time: 150ms
```

### Deprecation Headers
```http
X-API-Deprecation-Warning: Version v1 is deprecated
X-API-Deprecation-Date: 2025-06-01
X-API-Sunset-Date: 2025-12-01
```

## 🔄 Pagination

### Pagination Parameters
- `limit`: Number of items per page (1-100, default: 10)
- `offset`: Number of items to skip (default: 0)

### Pagination Response
```json
{
  "success": true,
  "data": [...],
  "count": 100,
  "limit": 10,
  "offset": 0,
  "hasMore": true
}
```

## 🔍 Filtering and Sorting

### Filtering
```bash
# Filter by category
GET /api/tools?category=weather

# Filter by method
GET /api/tools?method=GET

# Filter by tags
GET /api/tools?tags=weather,location
```

### Sorting
```bash
# Sort by name
GET /api/tools?sort=name

# Sort by name descending
GET /api/tools?sort=-name

# Sort by multiple fields
GET /api/tools?sort=category,name
```

## 📱 SDKs and Libraries

### JavaScript/Node.js
```bash
npm install one-place-chat-sdk
```

```javascript
import { OnePlaceChatClient } from 'one-place-chat-sdk';

const client = new OnePlaceChatClient({
  baseUrl: 'http://localhost:3001',
  apiVersion: 'v1',
  apiKey: 'your-api-key'
});

// Get tools
const tools = await client.tools.list();

// Send message
const response = await client.conversations.sendMessage('conv-123', 'Hello!');
```

### Python
```bash
pip install one-place-chat-sdk
```

```python
from one_place_chat import OnePlaceChatClient

client = OnePlaceChatClient(
    base_url='http://localhost:3001',
    api_version='v1',
    api_key='your-api-key'
)

# Get tools
tools = client.tools.list()

# Send message
response = client.conversations.send_message('conv-123', 'Hello!')
```

## 🧪 Testing

### Postman Collection
Import the Postman collection from `postman/One-Place-Chat-v1.json` to test the API.

### cURL Examples
See `examples/curl/` directory for comprehensive cURL examples.

### Test Environment
```bash
# Health check
curl -X GET "http://localhost:3001/api/health"

# Get tools
curl -X GET "http://localhost:3001/api/tools"

# Search tools
curl -X GET "http://localhost:3001/api/tools/search?q=weather"
```

## 📚 Additional Resources

- [OpenAPI 3.0 Specification](https://swagger.io/specification/)
- [REST API Best Practices](https://restfulapi.net/)
- [HTTP Status Codes](https://httpstatuses.com/)
- [API Versioning Strategies](https://blog.postman.com/api-versioning/)

## 🆘 Support

For API support and questions:

1. **Documentation**: Check this documentation and Swagger UI
2. **Issues**: Report issues on GitHub
3. **Contact**: Email support@yourapp.com
4. **Status**: Check API status at https://status.yourapp.com

---

**Last Updated**: December 2024  
**API Version**: 1.0.0  
**Documentation Version**: 1.0.0
