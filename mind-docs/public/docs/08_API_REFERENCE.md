# MIND API Reference

**Document Version:** 1.0  
**Last Updated:** December 2025  
**Base URL:** `http://your-loadbalancer-url`  
**API Version:** v1

---

## Table of Contents

1. [API Overview](#api-overview)
2. [Authentication](#authentication)
3. [Error Handling](#error-handling)
4. [Rate Limiting](#rate-limiting)
5. [Authentication Endpoints](#authentication-endpoints)
6. [Notes Endpoints](#notes-endpoints)
7. [Health Check Endpoints](#health-check-endpoints)
8. [Request/Response Examples](#requestresponse-examples)
9. [SDKs and Client Libraries](#sdks-and-client-libraries)

---

## API Overview

### General Information

- **Protocol:** HTTP/1.1
- **Data Format:** JSON
- **Character Encoding:** UTF-8
- **API Style:** RESTful
- **Authentication:** JWT Bearer Token

### Base URLs

| Environment | URL | Description |
|-------------|-----|-------------|
| **Development** | `http://localhost:8080` | Local development |
| **Staging** | `http://staging-lb.example.com` | Testing environment |
| **Production** | `http://prod-lb.example.com` | Production environment |

### HTTP Methods

| Method | Usage |
|--------|-------|
| `GET` | Retrieve resources |
| `POST` | Create new resources |
| `PUT` | Update existing resources |
| `DELETE` | Delete resources |
| `PATCH` | Partial update (not used) |

### Common Headers

```http
Content-Type: application/json
Authorization: Bearer <jwt_token>
Accept: application/json
```

---

## Authentication

### Authentication Flow

```
1. Register new user
   POST /api/auth/register
   ↓
2. Receive JWT token
   ↓
3. Include token in subsequent requests
   Authorization: Bearer <token>
   ↓
4. Token expires after 24 hours
   ↓
5. Login again to get new token
```

### JWT Token Format

```
eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1c2VyX2lkIjoxLCJlbWFpbCI6InVzZXJAZXhhbXBsZS5jb20iLCJleHAiOjE3MzMwOTc2MDAsImlhdCI6MTczMzAxMTIwMH0.signature
```

**Decoded Payload:**
```json
{
  "user_id": 1,
  "email": "user@example.com",
  "exp": 1733097600,
  "iat": 1733011200
}
```

### Using the Token

**In HTTP Header:**
```http
GET /api/notes HTTP/1.1
Host: api.example.com
Authorization: Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...
Content-Type: application/json
```

**In cURL:**
```bash
curl -H "Authorization: Bearer YOUR_TOKEN" \
     -H "Content-Type: application/json" \
     http://api.example.com/api/notes
```

**In JavaScript:**
```javascript
fetch('http://api.example.com/api/notes', {
  headers: {
    'Authorization': `Bearer ${token}`,
    'Content-Type': 'application/json'
  }
})
```

---

## Error Handling

### Error Response Format

```json
{
  "error": "Error message describing what went wrong",
  "code": "ERROR_CODE",
  "details": {
    "field": "additional context"
  }
}
```

### HTTP Status Codes

| Code | Status | Description |
|------|--------|-------------|
| `200` | OK | Request succeeded |
| `201` | Created | Resource created successfully |
| `204` | No Content | Success, no response body |
| `400` | Bad Request | Invalid request format |
| `401` | Unauthorized | Missing or invalid authentication |
| `403` | Forbidden | Authenticated but not authorized |
| `404` | Not Found | Resource doesn't exist |
| `409` | Conflict | Resource already exists |
| `422` | Unprocessable Entity | Validation error |
| `429` | Too Many Requests | Rate limit exceeded |
| `500` | Internal Server Error | Server error |
| `503` | Service Unavailable | Service temporarily down |

### Common Error Responses

**Unauthorized (401):**
```json
{
  "error": "Authorization header required"
}
```

**Not Found (404):**
```json
{
  "error": "Note not found"
}
```

**Validation Error (422):**
```json
{
  "error": "Validation failed",
  "details": {
    "title": "Title is required",
    "content": "Content must be at least 1 character"
  }
}
```

---

## Rate Limiting

### Limits

| Endpoint Type | Rate Limit | Window |
|---------------|------------|--------|
| Authentication | 10 requests | 15 minutes |
| Notes API | 100 requests | 1 minute |
| Search | 30 requests | 1 minute |

### Rate Limit Headers

```http
X-RateLimit-Limit: 100
X-RateLimit-Remaining: 95
X-RateLimit-Reset: 1733011260
```

### Rate Limit Exceeded Response

```json
HTTP/1.1 429 Too Many Requests
Content-Type: application/json

{
  "error": "Rate limit exceeded",
  "retry_after": 60
}
```

---

## Authentication Endpoints

### Register User

Create a new user account.

**Endpoint:** `POST /api/auth/register`

**Request Body:**
```json
{
  "email": "user@example.com",
  "password": "SecurePassword123!"
}
```

**Validation Rules:**
- `email`: Valid email format, unique
- `password`: Minimum 8 characters

**Success Response (201):**
```json
{
  "user": {
    "id": 1,
    "email": "user@example.com",
    "created_at": "2025-12-01T10:00:00Z",
    "updated_at": "2025-12-01T10:00:00Z"
  },
  "token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..."
}
```

**Error Responses:**

*Email already exists (409):*
```json
{
  "error": "Email already registered"
}
```

*Invalid email format (400):*
```json
{
  "error": "Invalid email format"
}
```

*Password too short (400):*
```json
{
  "error": "Password must be at least 8 characters"
}
```

**Example cURL:**
```bash
curl -X POST http://api.example.com/api/auth/register \
  -H "Content-Type: application/json" \
  -d '{
    "email": "user@example.com",
    "password": "SecurePassword123!"
  }'
```

---

### Login

Authenticate existing user and receive JWT token.

**Endpoint:** `POST /api/auth/login`

**Request Body:**
```json
{
  "email": "user@example.com",
  "password": "SecurePassword123!"
}
```

**Success Response (200):**
```json
{
  "user": {
    "id": 1,
    "email": "user@example.com"
  },
  "token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..."
}
```

**Error Responses:**

*Invalid credentials (401):*
```json
{
  "error": "Invalid email or password"
}
```

*Account locked (403):*
```json
{
  "error": "Account locked due to multiple failed attempts",
  "retry_after": 900
}
```

**Example cURL:**
```bash
curl -X POST http://api.example.com/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{
    "email": "user@example.com",
    "password": "SecurePassword123!"
  }'
```

---

## Notes Endpoints

### Get All Notes

Retrieve all notes for the authenticated user.

**Endpoint:** `GET /api/notes`

**Authentication:** Required

**Query Parameters:**

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `status` | string | No | Filter by status |
| `color` | string | No | Filter by color |
| `starred` | boolean | No | Filter starred notes |
| `sort` | string | No | Sort field (default: created_at) |
| `order` | string | No | Sort order: asc/desc (default: desc) |
| `limit` | integer | No | Number of results (default: 50, max: 100) |
| `offset` | integer | No | Pagination offset (default: 0) |

**Success Response (200):**
```json
{
  "notes": [
    {
      "id": 1,
      "user_id": 1,
      "title": "My First Note",
      "content": "This is the content of my note",
      "color": "yellow",
      "status": "pending",
      "starred": false,
      "created_at": "2025-12-01T10:00:00Z",
      "updated_at": "2025-12-01T10:00:00Z"
    },
    {
      "id": 2,
      "user_id": 1,
      "title": "Another Note",
      "content": "More content here",
      "color": "blue",
      "status": "completed",
      "starred": true,
      "created_at": "2025-12-01T11:00:00Z",
      "updated_at": "2025-12-01T11:30:00Z"
    }
  ],
  "total": 2,
  "limit": 50,
  "offset": 0
}
```

**Example cURL:**
```bash
# Get all notes
curl -H "Authorization: Bearer YOUR_TOKEN" \
     http://api.example.com/api/notes

# Get starred notes only
curl -H "Authorization: Bearer YOUR_TOKEN" \
     "http://api.example.com/api/notes?starred=true"

# Get notes with specific status
curl -H "Authorization: Bearer YOUR_TOKEN" \
     "http://api.example.com/api/notes?status=completed"
```

---

### Get Single Note

Retrieve a specific note by ID.

**Endpoint:** `GET /api/notes/:id`

**Authentication:** Required

**Path Parameters:**

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `id` | integer | Yes | Note ID |

**Success Response (200):**
```json
{
  "id": 1,
  "user_id": 1,
  "title": "My First Note",
  "content": "This is the content of my note",
  "color": "yellow",
  "status": "pending",
  "starred": false,
  "created_at": "2025-12-01T10:00:00Z",
  "updated_at": "2025-12-01T10:00:00Z"
}
```

**Error Responses:**

*Not found (404):*
```json
{
  "error": "Note not found"
}
```

*Unauthorized access (403):*
```json
{
  "error": "You don't have permission to access this note"
}
```

**Example cURL:**
```bash
curl -H "Authorization: Bearer YOUR_TOKEN" \
     http://api.example.com/api/notes/1
```

---

### Create Note

Create a new note.

**Endpoint:** `POST /api/notes`

**Authentication:** Required

**Request Body:**
```json
{
  "title": "New Note Title",
  "content": "Note content goes here",
  "color": "blue",
  "status": "pending"
}
```

**Field Specifications:**

| Field | Type | Required | Constraints |
|-------|------|----------|-------------|
| `title` | string | Yes | Max 200 characters |
| `content` | string | Yes | Min 1 character |
| `color` | string | Yes | One of: yellow, blue, green, pink, purple |
| `status` | string | Yes | One of: pending, in-progress, completed, archived |

**Success Response (201):**
```json
{
  "id": 3,
  "user_id": 1,
  "title": "New Note Title",
  "content": "Note content goes here",
  "color": "blue",
  "status": "pending",
  "starred": false,
  "created_at": "2025-12-01T12:00:00Z",
  "updated_at": "2025-12-01T12:00:00Z"
}
```

**Error Responses:**

*Validation error (400):*
```json
{
  "error": "Validation failed",
  "details": {
    "title": "Title is required and must be less than 200 characters",
    "color": "Color must be one of: yellow, blue, green, pink, purple"
  }
}
```

**Example cURL:**
```bash
curl -X POST http://api.example.com/api/notes \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "title": "New Note",
    "content": "This is my new note",
    "color": "green",
    "status": "pending"
  }'
```

---

### Update Note

Update an existing note.

**Endpoint:** `PUT /api/notes/:id`

**Authentication:** Required

**Path Parameters:**

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `id` | integer | Yes | Note ID |

**Request Body:**
```json
{
  "title": "Updated Title",
  "content": "Updated content",
  "color": "pink",
  "status": "in-progress",
  "starred": true
}
```

**Note:** All fields are optional. Only include fields you want to update.

**Success Response (200):**
```json
{
  "id": 1,
  "user_id": 1,
  "title": "Updated Title",
  "content": "Updated content",
  "color": "pink",
  "status": "in-progress",
  "starred": true,
  "created_at": "2025-12-01T10:00:00Z",
  "updated_at": "2025-12-01T13:00:00Z"
}
```

**Error Responses:**

*Not found (404):*
```json
{
  "error": "Note not found"
}
```

*Validation error (400):*
```json
{
  "error": "Invalid color value"
}
```

**Example cURL:**
```bash
# Update title only
curl -X PUT http://api.example.com/api/notes/1 \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"title": "New Title"}'

# Update multiple fields
curl -X PUT http://api.example.com/api/notes/1 \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "status": "completed",
    "starred": true
  }'
```

---

### Delete Note

Delete a note permanently.

**Endpoint:** `DELETE /api/notes/:id`

**Authentication:** Required

**Path Parameters:**

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `id` | integer | Yes | Note ID |

**Success Response (204):**
```
No content (empty response body)
```

**Error Responses:**

*Not found (404):*
```json
{
  "error": "Note not found"
}
```

*Unauthorized (403):*
```json
{
  "error": "You don't have permission to delete this note"
}
```

**Example cURL:**
```bash
curl -X DELETE http://api.example.com/api/notes/1 \
  -H "Authorization: Bearer YOUR_TOKEN"
```

---

### Search Notes

Search notes by title or content.

**Endpoint:** `GET /api/notes/search`

**Authentication:** Required

**Query Parameters:**

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `q` | string | Yes | Search query |
| `limit` | integer | No | Results limit (default: 20, max: 100) |

**Success Response (200):**
```json
{
  "notes": [
    {
      "id": 1,
      "user_id": 1,
      "title": "Meeting Notes",
      "content": "Discussion about project timeline",
      "color": "yellow",
      "status": "pending",
      "starred": false,
      "created_at": "2025-12-01T10:00:00Z",
      "updated_at": "2025-12-01T10:00:00Z"
    }
  ],
  "query": "meeting",
  "total": 1
}
```

**Example cURL:**
```bash
# Search for "meeting"
curl -H "Authorization: Bearer YOUR_TOKEN" \
     "http://api.example.com/api/notes/search?q=meeting"

# Search with limit
curl -H "Authorization: Bearer YOUR_TOKEN" \
     "http://api.example.com/api/notes/search?q=project&limit=10"
```

---

## Health Check Endpoints

### Application Health

Check if the API is running and healthy.

**Endpoint:** `GET /health`

**Authentication:** Not required

**Success Response (200):**
```json
{
  "status": "healthy",
  "timestamp": "2025-12-01T10:00:00Z",
  "version": "1.0.0"
}
```

**Example cURL:**
```bash
curl http://api.example.com/health
```

### Database Health

Check database connectivity.

**Endpoint:** `GET /health/db`

**Authentication:** Not required

**Success Response (200):**
```json
{
  "status": "healthy",
  "database": "connected",
  "response_time_ms": 5
}
```

**Error Response (503):**
```json
{
  "status": "unhealthy",
  "database": "disconnected",
  "error": "connection timeout"
}
```

---

## Request/Response Examples

### Complete User Journey

**1. Register:**
```bash
curl -X POST http://api.example.com/api/auth/register \
  -H "Content-Type: application/json" \
  -d '{
    "email": "john@example.com",
    "password": "SecurePass123!"
  }'

# Response:
{
  "user": {"id": 1, "email": "john@example.com"},
  "token": "eyJhbGci..."
}
```

**2. Create Note:**
```bash
curl -X POST http://api.example.com/api/notes \
  -H "Authorization: Bearer eyJhbGci..." \
  -H "Content-Type: application/json" \
  -d '{
    "title": "My First Note",
    "content": "Hello World",
    "color": "blue",
    "status": "pending"
  }'

# Response:
{
  "id": 1,
  "title": "My First Note",
  "content": "Hello World",
  "color": "blue",
  "status": "pending",
  "starred": false,
  "created_at": "2025-12-01T10:00:00Z"
}
```

**3. Get All Notes:**
```bash
curl -H "Authorization: Bearer eyJhbGci..." \
     http://api.example.com/api/notes

# Response:
{
  "notes": [
    {
      "id": 1,
      "title": "My First Note",
      "content": "Hello World",
      "color": "blue",
      "status": "pending",
      "starred": false
    }
  ],
  "total": 1
}
```

**4. Update Note:**
```bash
curl -X PUT http://api.example.com/api/notes/1 \
  -H "Authorization: Bearer eyJhbGci..." \
  -H "Content-Type: application/json" \
  -d '{
    "status": "completed",
    "starred": true
  }'

# Response:
{
  "id": 1,
  "status": "completed",
  "starred": true,
  "updated_at": "2025-12-01T11:00:00Z"
}
```

**5. Delete Note:**
```bash
curl -X DELETE http://api.example.com/api/notes/1 \
  -H "Authorization: Bearer eyJhbGci..."

# Response: 204 No Content
```

---

## SDKs and Client Libraries

### JavaScript/TypeScript Client

```javascript
// Example client implementation
class MindAPIClient {
  constructor(baseURL, token = null) {
    this.baseURL = baseURL;
    this.token = token;
  }

  setToken(token) {
    this.token = token;
  }

  async request(method, endpoint, data = null) {
    const headers = {
      'Content-Type': 'application/json',
    };

    if (this.token) {
      headers['Authorization'] = `Bearer ${this.token}`;
    }

    const options = {
      method,
      headers,
    };

    if (data) {
      options.body = JSON.stringify(data);
    }

    const response = await fetch(`${this.baseURL}${endpoint}`, options);
    
    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.error || 'Request failed');
    }

    return response.status === 204 ? null : await response.json();
  }

  // Authentication
  async register(email, password) {
    const data = await this.request('POST', '/api/auth/register', { email, password });
    this.setToken(data.token);
    return data;
  }

  async login(email, password) {
    const data = await this.request('POST', '/api/auth/login', { email, password });
    this.setToken(data.token);
    return data;
  }

  // Notes
  async getNotes(params = {}) {
    const query = new URLSearchParams(params).toString();
    return this.request('GET', `/api/notes${query ? '?' + query : ''}`);
  }

  async getNote(id) {
    return this.request('GET', `/api/notes/${id}`);
  }

  async createNote(noteData) {
    return this.request('POST', '/api/notes', noteData);
  }

  async updateNote(id, noteData) {
    return this.request('PUT', `/api/notes/${id}`, noteData);
  }

  async deleteNote(id) {
    return this.request('DELETE', `/api/notes/${id}`);
  }

  async searchNotes(query, limit = 20) {
    return this.request('GET', `/api/notes/search?q=${encodeURIComponent(query)}&limit=${limit}`);
  }
}

// Usage
const client = new MindAPIClient('http://api.example.com');

// Register
await client.register('user@example.com', 'password123');

// Create note
const note = await client.createNote({
  title: 'My Note',
  content: 'Content here',
  color: 'blue',
  status: 'pending'
});

// Get all notes
const { notes } = await client.getNotes({ status: 'pending' });
```

---

## Postman Collection

Download the complete Postman collection:

[MIND API Postman Collection](https://www.postman.com/mind-api/collection)

**Import into Postman:**
1. Open Postman
2. Click "Import"
3. Select the JSON file
4. Configure environment variables:
   - `base_url`: Your API URL
   - `token`: Your JWT token (auto-populated after login)

---

**Documentation Complete! 🎉**

For questions or support, contact: support@mind-project.com
