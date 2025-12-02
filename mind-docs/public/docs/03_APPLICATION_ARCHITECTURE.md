# MIND Application Architecture

**Document Version:** 1.0  
**Last Updated:** December 2025  
**Repository:** [MIND](https://github.com/who-sam/MIND)

---

## Table of Contents

1. [Application Overview](#application-overview)
2. [System Architecture](#system-architecture)
3. [Frontend Architecture](#frontend-architecture)
4. [Backend Architecture](#backend-architecture)
5. [Database Design](#database-design)
6. [API Specification](#api-specification)
7. [Authentication & Authorization](#authentication--authorization)
8. [Data Flow](#data-flow)
9. [Performance Optimization](#performance-optimization)
10. [Error Handling](#error-handling)

---

## Application Overview

### Technology Stack Summary

| Layer | Technology | Version | Purpose |
|-------|-----------|---------|---------|
| **Frontend** | React | 18.2 | User interface |
| **Build Tool** | Vite | Latest | Development & building |
| **Styling** | Tailwind CSS | Latest | UI styling |
| **Backend** | Go | 1.23 | API server |
| **Framework** | Gin | Latest | HTTP routing |
| **Database** | PostgreSQL | 15 | Data persistence |
| **Authentication** | JWT | Latest | Stateless auth |
| **Password Hashing** | bcrypt | Latest | Secure storage |

### Application Features

**Core Functionality:**
- User authentication (register/login)
- Note CRUD operations (Create, Read, Update, Delete)
- Note categorization with colors and statuses
- Search and filter capabilities
- Star/favorite notes
- Responsive design

**Technical Features:**
- RESTful API design
- JWT-based authentication
- Real-time validation
- Error handling and recovery
- Secure password storage
- CORS enabled for cross-origin requests

---

## System Architecture

### Three-Tier Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                     Presentation Layer                      │
│                                                             │
│  ┌───────────────────────────────────────────────────────┐  │
│  │  React Application (Port 80)                          │  │
│  │  ├─ Components (UI Elements)                          │  │
│  │  ├─ Pages (Route Views)                               │  │
│  │  ├─ Services (API Calls)                              │  │
│  │  ├─ Context (State Management)                        │  │
│  │  └─ Utils (Helper Functions)                          │  │
│  └───────────────────────────────────────────────────────┘  │
└─────────────────────────────────────────────────────────────┘
                            ↓ HTTP/HTTPS
┌─────────────────────────────────────────────────────────────┐
│                      Business Logic Layer                   │
│                                                             │
│  ┌───────────────────────────────────────────────────────┐  │
│  │  Go API Server (Port 8080)                            │  │
│  │  ├─ Routes (HTTP Endpoints)                           │  │
│  │  ├─ Controllers (Request Handlers)                    │  │
│  │  ├─ Services (Business Logic)                         │  │
│  │  ├─ Middleware (Auth, CORS, Logging)                  │  │
│  │  └─ Models (Data Structures)                          │  │
│  └───────────────────────────────────────────────────────┘  │
└─────────────────────────────────────────────────────────────┘
                            ↓ SQL
┌─────────────────────────────────────────────────────────────┐
│                        Data Layer                           │
│                                                             │
│  ┌───────────────────────────────────────────────────────┐  │
│  │  PostgreSQL Database (Port 5432)                      │  │
│  │  ├─ users table                                       │  │
│  │  ├─ notes table                                       │  │
│  │  ├─ Indexes                                           │  │
│  │  └─ Constraints                                       │  │
│  └───────────────────────────────────────────────────────┘  │
└─────────────────────────────────────────────────────────────┘
```

### Communication Patterns

**Frontend ↔ Backend:**
- Protocol: HTTP/HTTPS
- Format: JSON
- Authentication: JWT in Authorization header
- Content-Type: application/json

**Backend ↔ Database:**
- Protocol: PostgreSQL Wire Protocol
- Driver: lib/pq (Go)
- Connection Pool: 10-25 connections
- SSL Mode: require (production)

---

## Frontend Architecture

### Project Structure

```
frontend/
├── public/
│   └── vite.svg
├── src/
│   ├── assets/           # Static assets
│   ├── components/       # Reusable UI components
│   │   ├── Auth/
│   │   │   ├── LoginForm.jsx
│   │   │   └── RegisterForm.jsx
│   │   ├── Notes/
│   │   │   ├── NoteCard.jsx
│   │   │   ├── NoteForm.jsx
│   │   │   ├── NoteList.jsx
│   │   │   └── NoteFilters.jsx
│   │   └── Common/
│   │       ├── Header.jsx
│   │       ├── Footer.jsx
│   │       └── Loading.jsx
│   ├── pages/            # Page components
│   │   ├── Home.jsx
│   │   ├── Login.jsx
│   │   ├── Register.jsx
│   │   └── Dashboard.jsx
│   ├── services/         # API service layer
│   │   ├── api.js
│   │   ├── authService.js
│   │   └── notesService.js
│   ├── context/          # React Context
│   │   └── AuthContext.jsx
│   ├── utils/            # Utility functions
│   │   ├── validators.js
│   │   └── formatters.js
│   ├── App.jsx           # Root component
│   ├── main.jsx          # Entry point
│   └── index.css         # Global styles
├── Dockerfile            # Production build
├── Dockerfile.dev        # Development build
├── package.json
├── vite.config.js
└── tailwind.config.js
```

### Key Components

**1. Authentication Context**

```javascript
// src/context/AuthContext.jsx
import React, { createContext, useState, useEffect } from 'react';
import { authService } from '../services/authService';

export const AuthContext = createContext();

export const AuthProvider = ({ children }) => {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);
  const [token, setToken] = useState(localStorage.getItem('token'));

  useEffect(() => {
    if (token) {
      authService.verifyToken(token)
        .then(userData => setUser(userData))
        .catch(() => logout())
        .finally(() => setLoading(false));
    } else {
      setLoading(false);
    }
  }, [token]);

  const login = async (email, password) => {
    const { user, token } = await authService.login(email, password);
    localStorage.setItem('token', token);
    setToken(token);
    setUser(user);
  };

  const logout = () => {
    localStorage.removeItem('token');
    setToken(null);
    setUser(null);
  };

  return (
    <AuthContext.Provider value={{ user, login, logout, loading }}>
      {children}
    </AuthContext.Provider>
  );
};
```

**2. API Service Layer**

```javascript
// src/services/api.js
import axios from 'axios';

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:8080';

const api = axios.create({
  baseURL: API_URL,
  headers: {
    'Content-Type': 'application/json',
  },
});

// Request interceptor for adding auth token
api.interceptors.request.use(
  (config) => {
    const token = localStorage.getItem('token');
    if (token) {
      config.headers.Authorization = `Bearer ${token}`;
    }
    return config;
  },
  (error) => Promise.reject(error)
);

// Response interceptor for handling errors
api.interceptors.response.use(
  (response) => response,
  (error) => {
    if (error.response?.status === 401) {
      localStorage.removeItem('token');
      window.location.href = '/login';
    }
    return Promise.reject(error);
  }
);

export default api;
```

**3. Notes Service**

```javascript
// src/services/notesService.js
import api from './api';

export const notesService = {
  // Get all notes for logged-in user
  getNotes: async () => {
    const response = await api.get('/api/notes');
    return response.data;
  },

  // Get single note by ID
  getNoteById: async (id) => {
    const response = await api.get(`/api/notes/${id}`);
    return response.data;
  },

  // Create new note
  createNote: async (noteData) => {
    const response = await api.post('/api/notes', noteData);
    return response.data;
  },

  // Update existing note
  updateNote: async (id, noteData) => {
    const response = await api.put(`/api/notes/${id}`, noteData);
    return response.data;
  },

  // Delete note
  deleteNote: async (id) => {
    const response = await api.delete(`/api/notes/${id}`);
    return response.data;
  },

  // Search notes
  searchNotes: async (query) => {
    const response = await api.get(`/api/notes/search?q=${encodeURIComponent(query)}`);
    return response.data;
  },
};
```

**4. Note Card Component**

```javascript
// src/components/Notes/NoteCard.jsx
import React from 'react';
import { Star, Trash2, Edit } from 'lucide-react';

const NoteCard = ({ note, onEdit, onDelete, onToggleStar }) => {
  const colorClasses = {
    yellow: 'bg-yellow-100 border-yellow-300',
    blue: 'bg-blue-100 border-blue-300',
    green: 'bg-green-100 border-green-300',
    pink: 'bg-pink-100 border-pink-300',
    purple: 'bg-purple-100 border-purple-300',
  };

  const statusLabels = {
    pending: 'Pending',
    'in-progress': 'In Progress',
    completed: 'Completed',
    archived: 'Archived',
  };

  return (
    <div className={`p-4 rounded-lg border-2 ${colorClasses[note.color]} relative`}>
      <button
        onClick={() => onToggleStar(note.id)}
        className="absolute top-2 right-2"
      >
        <Star
          className={`w-5 h-5 ${note.starred ? 'fill-yellow-400 text-yellow-400' : 'text-gray-400'}`}
        />
      </button>
      
      <h3 className="font-bold text-lg mb-2 pr-8">{note.title}</h3>
      <p className="text-gray-700 mb-4">{note.content}</p>
      
      <div className="flex items-center justify-between">
        <span className="text-xs bg-white px-2 py-1 rounded">
          {statusLabels[note.status]}
        </span>
        
        <div className="flex gap-2">
          <button
            onClick={() => onEdit(note)}
            className="p-1 hover:bg-white rounded"
          >
            <Edit className="w-4 h-4" />
          </button>
          <button
            onClick={() => onDelete(note.id)}
            className="p-1 hover:bg-white rounded text-red-500"
          >
            <Trash2 className="w-4 h-4" />
          </button>
        </div>
      </div>
      
      <div className="text-xs text-gray-500 mt-2">
        {new Date(note.updated_at).toLocaleDateString()}
      </div>
    </div>
  );
};

export default NoteCard;
```

### State Management

**Approach:** React Context API + Local State

**Why not Redux?**
- Application complexity doesn't justify Redux overhead
- Context API sufficient for authentication state
- Local state works well for component-specific data
- Reduces bundle size and complexity

---

## Backend Architecture

### Project Structure

```
backend/
├── cmd/
│   └── server/
│       └── main.go         # Application entry point
├── internal/
│   ├── config/
│   │   └── config.go       # Configuration management
│   ├── database/
│   │   └── database.go     # Database connection
│   ├── handlers/
│   │   ├── auth.go         # Authentication handlers
│   │   └── notes.go        # Notes handlers
│   ├── middleware/
│   │   ├── auth.go         # JWT middleware
│   │   ├── cors.go         # CORS middleware
│   │   └── logger.go       # Logging middleware
│   ├── models/
│   │   ├── user.go         # User model
│   │   └── note.go         # Note model
│   ├── repository/
│   │   ├── user_repo.go    # User data access
│   │   └── note_repo.go    # Note data access
│   └── services/
│       ├── auth_service.go # Authentication logic
│       └── note_service.go # Notes business logic
├── migrations/
│   └── init.sql            # Database schema
├── Dockerfile
├── Dockerfile.dev
├── go.mod
└── go.sum
```

### Main Application (cmd/server/main.go)

```go
package main

import (
    "log"
    "os"
    
    "github.com/gin-gonic/gin"
    "github.com/who-sam/MIND/internal/config"
    "github.com/who-sam/MIND/internal/database"
    "github.com/who-sam/MIND/internal/handlers"
    "github.com/who-sam/MIND/internal/middleware"
)

func main() {
    // Load configuration
    cfg := config.Load()
    
    // Connect to database
    db, err := database.Connect(cfg.DatabaseURL)
    if err != nil {
        log.Fatal("Failed to connect to database:", err)
    }
    defer db.Close()
    
    // Initialize Gin router
    router := gin.Default()
    
    // Apply middleware
    router.Use(middleware.CORS())
    router.Use(middleware.Logger())
    
    // Public routes
    auth := handlers.NewAuthHandler(db, cfg.JWTSecret)
    router.POST("/api/auth/register", auth.Register)
    router.POST("/api/auth/login", auth.Login)
    
    // Protected routes
    authorized := router.Group("/api")
    authorized.Use(middleware.AuthMiddleware(cfg.JWTSecret))
    {
        notes := handlers.NewNotesHandler(db)
        authorized.GET("/notes", notes.GetNotes)
        authorized.GET("/notes/:id", notes.GetNote)
        authorized.POST("/notes", notes.CreateNote)
        authorized.PUT("/notes/:id", notes.UpdateNote)
        authorized.DELETE("/notes/:id", notes.DeleteNote)
        authorized.GET("/notes/search", notes.SearchNotes)
    }
    
    // Health check
    router.GET("/health", func(c *gin.Context) {
        c.JSON(200, gin.H{"status": "healthy"})
    })
    
    // Start server
    port := os.Getenv("PORT")
    if port == "" {
        port = "8080"
    }
    
    log.Printf("Server starting on port %s", port)
    if err := router.Run(":" + port); err != nil {
        log.Fatal("Failed to start server:", err)
    }
}
```

### Models

**User Model (internal/models/user.go)**

```go
package models

import (
    "time"
    
    "golang.org/x/crypto/bcrypt"
)

type User struct {
    ID           int       `json:"id"`
    Email        string    `json:"email"`
    PasswordHash string    `json:"-"`
    CreatedAt    time.Time `json:"created_at"`
    UpdatedAt    time.Time `json:"updated_at"`
}

func (u *User) SetPassword(password string) error {
    hash, err := bcrypt.GenerateFromPassword([]byte(password), bcrypt.DefaultCost)
    if err != nil {
        return err
    }
    u.PasswordHash = string(hash)
    return nil
}

func (u *User) CheckPassword(password string) bool {
    err := bcrypt.CompareHashAndPassword([]byte(u.PasswordHash), []byte(password))
    return err == nil
}
```

**Note Model (internal/models/note.go)**

```go
package models

import "time"

type Note struct {
    ID        int       `json:"id"`
    UserID    int       `json:"user_id"`
    Title     string    `json:"title" binding:"required,max=200"`
    Content   string    `json:"content" binding:"required"`
    Color     string    `json:"color" binding:"required,oneof=yellow blue green pink purple"`
    Status    string    `json:"status" binding:"required,oneof=pending in-progress completed archived"`
    Starred   bool      `json:"starred"`
    CreatedAt time.Time `json:"created_at"`
    UpdatedAt time.Time `json:"updated_at"`
}

type CreateNoteRequest struct {
    Title   string `json:"title" binding:"required,max=200"`
    Content string `json:"content" binding:"required"`
    Color   string `json:"color" binding:"required,oneof=yellow blue green pink purple"`
    Status  string `json:"status" binding:"required,oneof=pending in-progress completed archived"`
}

type UpdateNoteRequest struct {
    Title   string `json:"title" binding:"omitempty,max=200"`
    Content string `json:"content" binding:"omitempty"`
    Color   string `json:"color" binding:"omitempty,oneof=yellow blue green pink purple"`
    Status  string `json:"status" binding:"omitempty,oneof=pending in-progress completed archived"`
    Starred *bool  `json:"starred" binding:"omitempty"`
}
```

### Authentication Middleware

```go
package middleware

import (
    "net/http"
    "strings"
    
    "github.com/gin-gonic/gin"
    "github.com/golang-jwt/jwt/v5"
)

func AuthMiddleware(jwtSecret string) gin.HandlerFunc {
    return func(c *gin.Context) {
        authHeader := c.GetHeader("Authorization")
        if authHeader == "" {
            c.JSON(http.StatusUnauthorized, gin.H{"error": "Authorization header required"})
            c.Abort()
            return
        }
        
        tokenString := strings.TrimPrefix(authHeader, "Bearer ")
        
        token, err := jwt.Parse(tokenString, func(token *jwt.Token) (interface{}, error) {
            return []byte(jwtSecret), nil
        })
        
        if err != nil || !token.Valid {
            c.JSON(http.StatusUnauthorized, gin.H{"error": "Invalid token"})
            c.Abort()
            return
        }
        
        claims, ok := token.Claims.(jwt.MapClaims)
        if !ok {
            c.JSON(http.StatusUnauthorized, gin.H{"error": "Invalid token claims"})
            c.Abort()
            return
        }
        
        userID := int(claims["user_id"].(float64))
        c.Set("user_id", userID)
        c.Next()
    }
}
```

---

## Database Design

### Schema

**Users Table:**
```sql
CREATE TABLE users (
    id SERIAL PRIMARY KEY,
    email VARCHAR(255) UNIQUE NOT NULL,
    password_hash VARCHAR(255) NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_users_email ON users(email);
```

**Notes Table:**
```sql
CREATE TABLE notes (
    id SERIAL PRIMARY KEY,
    user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    title VARCHAR(200) NOT NULL,
    content TEXT NOT NULL,
    color VARCHAR(20) NOT NULL CHECK (color IN ('yellow', 'blue', 'green', 'pink', 'purple')),
    status VARCHAR(20) NOT NULL CHECK (status IN ('pending', 'in-progress', 'completed', 'archived')),
    starred BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_notes_user_id ON notes(user_id);
CREATE INDEX idx_notes_status ON notes(status);
CREATE INDEX idx_notes_starred ON notes(starred);
CREATE INDEX idx_notes_created_at ON notes(created_at DESC);

-- Full-text search index
CREATE INDEX idx_notes_search ON notes USING GIN(to_tsvector('english', title || ' ' || content));
```

### Entity Relationship

```
┌─────────────────┐
│     users       │
├─────────────────┤
│ id (PK)         │
│ email           │
│ password_hash   │
│ created_at      │
│ updated_at      │
└─────────────────┘
        │
        │ 1
        │
        │ N
        ▼
┌─────────────────┐
│     notes       │
├─────────────────┤
│ id (PK)         │
│ user_id (FK)    │
│ title           │
│ content         │
│ color           │
│ status          │
│ starred         │
│ created_at      │
│ updated_at      │
└─────────────────┘
```

---

## API Specification

### Authentication Endpoints

**POST /api/auth/register**
```json
Request:
{
  "email": "user@example.com",
  "password": "securepassword"
}

Response (201):
{
  "user": {
    "id": 1,
    "email": "user@example.com",
    "created_at": "2025-12-01T00:00:00Z"
  },
  "token": "eyJhbGciOiJIUzI1NiIs..."
}
```

**POST /api/auth/login**
```json
Request:
{
  "email": "user@example.com",
  "password": "securepassword"
}

Response (200):
{
  "user": {
    "id": 1,
    "email": "user@example.com"
  },
  "token": "eyJhbGciOiJIUzI1NiIs..."
}
```

### Notes Endpoints

**GET /api/notes**
```
Headers: Authorization: Bearer <token>

Response (200):
{
  "notes": [
    {
      "id": 1,
      "user_id": 1,
      "title": "My Note",
      "content": "Note content",
      "color": "yellow",
      "status": "pending",
      "starred": false,
      "created_at": "2025-12-01T00:00:00Z",
      "updated_at": "2025-12-01T00:00:00Z"
    }
  ]
}
```

**POST /api/notes**
```json
Headers: Authorization: Bearer <token>

Request:
{
  "title": "New Note",
  "content": "Note content",
  "color": "blue",
  "status": "pending"
}

Response (201):
{
  "id": 2,
  "user_id": 1,
  "title": "New Note",
  "content": "Note content",
  "color": "blue",
  "status": "pending",
  "starred": false,
  "created_at": "2025-12-01T00:00:00Z",
  "updated_at": "2025-12-01T00:00:00Z"
}
```

---

## Authentication & Authorization

### JWT Structure

```
Header:
{
  "alg": "HS256",
  "typ": "JWT"
}

Payload:
{
  "user_id": 1,
  "email": "user@example.com",
  "exp": 1733097600,
  "iat": 1733011200
}

Signature:
HMACSHA256(
  base64UrlEncode(header) + "." + base64UrlEncode(payload),
  secret
)
```

### Token Lifetime

- **Expiration:** 24 hours from issuance
- **Refresh:** Not implemented (future enhancement)
- **Storage:** LocalStorage (frontend)

---

## Data Flow

### Note Creation Flow

```
1. User fills NoteForm in React
   ↓
2. Form validation (client-side)
   ↓
3. POST /api/notes with JWT token
   ↓
4. AuthMiddleware verifies JWT
   ↓
5. Controller validates request body
   ↓
6. Service creates note in database
   ↓
7. Response sent back to client
   ↓
8. UI updates with new note
```

---

## Performance Optimization

### Frontend
- Code splitting with Vite
- Lazy loading components
- Debounced search
- Optimistic UI updates

### Backend
- Database connection pooling
- Prepared statements
- Index optimization
- Query result caching (planned)

### Database
- Indexes on frequently queried columns
- Query optimization
- Connection pooling

---

## Error Handling

### Frontend Error Handling

```javascript
try {
  await notesService.createNote(noteData);
  setSuccess('Note created successfully');
} catch (error) {
  if (error.response) {
    setError(error.response.data.error);
  } else {
    setError('Network error. Please try again.');
  }
}
```

### Backend Error Handling

```go
if err := c.ShouldBindJSON(&req); err != nil {
    c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
    return
}
```

---

**Next Document:** [CI/CD Pipeline](04_CICD_PIPELINE.md)
