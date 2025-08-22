# Bunner API Document Example

An example application demonstrating the `enableApiDocument` feature of the Bunner framework.

## 📋 Overview

This example demonstrates various methods of providing API documentation using the Bunner framework.

## 🚀 Getting Started

### Development Environment Setup

```bash
# 1. Navigate to project root
cd examples/api-doc

# 2. Install dependencies
bun install

# 3. Start server
bun start
```

### Server Access

Once the server starts, you can access various API documentation through the following URLs:

- **Main page**: http://localhost:4000
- **YAML file based API documentation**: http://localhost:4000/api-doc-yaml
- **JSON file based API documentation**: http://localhost:4000/api-doc-json
- **Inline YAML content API documentation**: http://localhost:4000/api-doc-inline-yaml
- **Inline JSON content API documentation**: http://localhost:4000/api-doc-inline-json
- **External URL based API documentation**: http://localhost:4000/api-doc-external

## 🔧 Features

### API Documentation Generation

The Bunner framework can generate API documentation in various ways.

#### File-based API Documentation

Provides API documentation using existing API YAML or JSON files.

```typescript
// YAML file based
await app.enableApiDocument('/api-doc-yaml', './spec.yaml');

// JSON file based
await app.enableApiDocument('/api-doc-json', './spec.json');
```

#### Inline Content-based API Documentation

Provides dynamically generated API specifications directly as strings.

```typescript
// YAML content
const yamlContent = `
openapi: 3.0.0
info:
  title: My API
  version: 1.0.0
paths:
  /api/example:
    get:
      summary: Example endpoint
      responses:
        '200':
          description: Success
`;
await app.enableApiDocument('/api-doc-inline-yaml', yamlContent);

// JSON content
const jsonContent = JSON.stringify({
  openapi: '3.0.0',
  info: {
    title: 'My API',
    version: '1.0.0'
  },
  paths: {
    '/api/example': {
      get: {
        summary: 'Example endpoint',
        responses: {
          '200': {
            description: 'Success'
          }
        }
      }
    }
  }
}, null, 2);
await app.enableApiDocument('/api-doc-inline-json', jsonContent);
```

#### External URL-based API Documentation

Directly references API specifications hosted externally.

```typescript
// External URL based (GitHub API example)
await app.enableApiDocument('/api-doc-external', 'https://api.apis.guru/v2/specs/github.com/1.1.4/openapi.yaml');
```

### Automatic Format Detection

Bunner automatically detects whether the provided content is YAML or JSON format and processes it accordingly.

### Dynamic Route Generation

When `enableApiDocument` is called, it automatically creates the necessary routes for serving the API documentation:

- **UI**: `/api-doc` (specified path)
- **Spec File**: `/api-doc/spec.yaml` or `/api-doc/spec.json` (depending on format)

### Performance Optimization

The framework optimizes performance by caching templates and pre-processing content for faster response times.

## 🔍 API Endpoints

The example provides the following API endpoints:

### Users API

API for managing user information.

- `GET /api/users` - Get users list
- `GET /api/users/{id}` - Get specific user
- `POST /api/users` - Create new user

### Posts API

API for managing post information.

- `GET /api/posts` - Get posts list
- `GET /api/posts/{id}` - Get specific post
- `POST /api/posts` - Create new post

### API Usage Examples

```bash
# Get users list
curl http://localhost:4000/api/users

# Get specific user
curl http://localhost:4000/api/users/1

# Create new user
curl -X POST http://localhost:4000/api/users \
  -H "Content-Type: application/json" \
  -d '{"name":"New User","email":"new@example.com"}'

# Get posts list
curl http://localhost:4000/api/posts

# Get specific post
curl http://localhost:4000/api/posts/1

# Create new post
curl -X POST http://localhost:4000/api/posts \
  -H "Content-Type: application/json" \
  -d '{"title":"New Post","content":"Content","authorId":1}'
```

These endpoints are examples for demonstrating actual API behavior and manage data in memory.

## 📁 File Structure

```
examples/api-doc/
├── package.json          # Project configuration
├── main.ts              # Main server code
├── spec.yaml            # YAML format API spec
├── spec.json            # JSON format API spec
└── README.md            # This file
```

## 🎯 Example Scenarios

### Scenario 1: Using Existing API Files

You can provide API documentation using existing API YAML or JSON files as-is.

### Scenario 2: Dynamic Content Generation

You can read schemas from a database and dynamically generate and document API specifications.

### Scenario 3: Multiple API Documentation

You can provide multiple API documentation at different paths from a single server.

### Scenario 4: External API Documentation Integration

You can integrate externally hosted API documentation into your internal system.
