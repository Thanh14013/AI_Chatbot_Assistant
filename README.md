# 🤖 AI Chatbot Assistant

> A full-featured, production-ready AI chat application with intelligent responses, advanced file handling, project management, and real-time collaboration.

[![License: MIT](https://img.shields.io/badge/License-MIT-blue.svg)](https://opensource.org/licenses/MIT)
[![TypeScript](https://img.shields.io/badge/TypeScript-5.9-blue)](https://www.typescriptlang.org/)
[![React](https://img.shields.io/badge/React-18.3-blue)](https://reactjs.org/)
[![Node.js](https://img.shields.io/badge/Node.js-20+-green)](https://nodejs.org/)
[![PostgreSQL](https://img.shields.io/badge/PostgreSQL-16+-blue)](https://www.postgresql.org/)

## 📋 Table of Contents

- [Overview](#-overview)
- [Key Features](#-key-features)
- [Tech Stack](#-tech-stack)
- [Architecture](#-architecture)
- [Getting Started](#-getting-started)
- [API Documentation](#-api-documentation)
- [Project Structure](#-project-structure)
- [Environment Variables](#-environment-variables)
- [Screenshots](#-screenshots)
- [Contributing](#-contributing)
- [License](#-license)

## 🌟 Overview

AI Chatbot Assistant is a modern, full-stack chat application that leverages OpenAI's GPT models to provide intelligent, context-aware responses. Built with enterprise-grade architecture, it features real-time communication, semantic search, file management, and project organization capabilities.

### Why This Project?

This project demonstrates:

- **Full-Stack Expertise**: Modern React frontend + Node.js/Express backend
- **Real-time Systems**: WebSocket implementation with Socket.IO
- **AI Integration**: OpenAI API with streaming responses and file processing
- **Database Design**: PostgreSQL with vector embeddings (pgvector) for semantic search
- **Cloud Services**: Cloudinary for media management, Redis for caching
- **Security Best Practices**: JWT authentication, password hashing, input validation
- **Scalable Architecture**: Microservices-ready design with separation of concerns

## ✨ Key Features

### 🔐 Authentication & Security

- **JWT-based Authentication** with access/refresh token system
- **Secure Password Management** with bcrypt hashing
- **Multi-device Session Support** with automatic token refresh
- **Role-based Access Control** for data protection

### 💬 Real-time Messaging

- **WebSocket Communication** via Socket.IO for instant updates
- **Streaming AI Responses** using Server-Sent Events (SSE)
- **Typing Indicators** for both users and AI
- **Message Pinning** (up to 10 per conversation)
- **Multi-tab Synchronization** across browser tabs and devices
- **Unread Message Tracking** with smart notifications

### 🔍 Advanced Search Capabilities

- **Semantic Search** powered by PostgreSQL pgvector extension
- **Vector Embeddings** using OpenAI's text-embedding-3-small model
- **Global Search** across all conversations with best match highlighting
- **Contextual Results** with surrounding messages for better understanding
- **Conversation-specific Search** with customizable similarity thresholds

### 📁 File Management System

- **Multi-format Upload Support**:
  - Images (JPG, PNG, GIF, WebP)
  - Videos (MP4, WebM, MOV)
  - Documents (PDF, DOC, DOCX, TXT)
- **Cloudinary Integration** for secure cloud storage and CDN delivery
- **OpenAI File API** integration for AI-assisted file processing
- **PDF Text Extraction** with automatic parsing
- **Thumbnail Generation** for media files
- **Upload Statistics** tracking (storage usage, file counts)

### 📂 Project Organization

- **Project Management** to organize conversations
- **Drag & Drop** interface for reordering conversations
- **Custom Styling** with color-coded projects and emoji icons
- **Batch Operations** for efficient conversation management
- **Project Statistics** (conversation count, last activity)

### 👤 User Preferences & Profile

- **Customizable AI Settings**:
  - Model selection (GPT-4, GPT-3.5, etc.)
  - Context window size (1-50 messages)
  - Custom response style/personality
- **Theme Support** (Light, Dark, System)
- **Avatar Upload** with image optimization
- **User Bio & Profile** management
- **Redis Caching** for high-performance preference loading

### 🚀 Smart Features

- **AI-generated Follow-up Suggestions** based on conversation context
- **Auto-generated Conversation Titles** using AI
- **Token Usage Tracking** per conversation
- **Infinite Scroll Pagination** for conversations and messages
- **Message Status Tracking** (sent, delivered, read)
- **Conversation Activity Monitoring** with live updates

### 🔄 Real-time Synchronization

- **Cross-device Sync** with instant updates
- **Conversation CRUD Operations** with realtime broadcast
- **Project Updates** synchronized across all clients
- **Typing Status** propagation
- **Connection Health Monitoring** with ping/pong

## 🛠 Tech Stack

### Frontend

- **React 18.3** - Modern UI library with hooks
- **TypeScript** - Type-safe JavaScript
- **Ant Design 5.27** - Enterprise-grade UI components
- **Socket.IO Client** - Real-time bidirectional communication
- **Axios** - HTTP client with interceptors
- **Vite** - Fast build tool and dev server
- **React Router DOM** - Client-side routing

### Backend

- **Node.js 20+** - JavaScript runtime
- **Express 5** - Web application framework
- **TypeScript** - Type-safe backend development
- **Socket.IO** - Real-time event-based communication
- **Sequelize ORM** - Database abstraction layer
- **PostgreSQL 16** - Relational database with pgvector
- **Redis** - In-memory caching and session storage
- **JWT** - Secure authentication tokens
- **Bcrypt** - Password hashing

### Third-party Services

- **OpenAI API** - GPT models and embeddings
- **Cloudinary** - Media storage and CDN
- **Redis Cloud** - Distributed caching (optional)

### DevOps & Tools

- **Docker** - Containerization
- **Docker Compose** - Multi-container orchestration
- **ESLint** - Code linting
- **Prettier** - Code formatting
- **Swagger/OpenAPI** - API documentation
- **Git** - Version control

## 🏗 Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                         Client Layer                         │
│  (React + TypeScript + Socket.IO Client + Ant Design)       │
└────────────────┬────────────────────────────────────────────┘
                 │
                 │ HTTP/REST + WebSocket
                 │
┌────────────────▼────────────────────────────────────────────┐
│                      API Gateway Layer                       │
│              (Express Routes + Middlewares)                  │
├─────────────────────────────────────────────────────────────┤
│                     Business Logic Layer                     │
│  ┌──────────────┬──────────────┬──────────────────────────┐ │
│  │ Auth Service │ Chat Service │ File Service             │ │
│  ├──────────────┼──────────────┼──────────────────────────┤ │
│  │ User Service │ Search Svc   │ Project Service          │ │
│  └──────────────┴──────────────┴──────────────────────────┘ │
└────────────────┬────────────────────────────────────────────┘
                 │
     ┌───────────┼───────────┬──────────────┐
     │           │           │              │
┌────▼────┐ ┌───▼────┐ ┌───▼─────┐  ┌────▼─────┐
│PostgreSQL│ │ Redis  │ │ OpenAI  │  │Cloudinary│
│(+pgvector│ │        │ │   API   │  │          │
└──────────┘ └────────┘ └─────────┘  └──────────┘
```

### Database Schema Highlights

- **Users** - User accounts with authentication
- **Conversations** - Chat conversations with AI settings
- **Messages** - Individual messages with embeddings for search
- **Projects** - Organization structure for conversations
- **UserPreferences** - User-specific settings and preferences
- **FileUploads** - File metadata with Cloudinary/OpenAI references
- **RefreshTokens** - Secure session management

### Key Design Patterns

- **Repository Pattern** - Data access abstraction
- **Service Layer** - Business logic separation
- **Dependency Injection** - Loose coupling
- **Event-Driven Architecture** - Real-time updates
- **Caching Strategy** - Redis for performance optimization

## 🚀 Getting Started

### Prerequisites

- **Node.js** 20+ and npm
- **PostgreSQL** 16+ with pgvector extension
- **Redis** (optional, for caching)
- **OpenAI API Key**
- **Cloudinary Account** (for file uploads)

### Installation

1. **Clone the repository**

```bash
git clone https://github.com/Thanh14013/AI_Chatbot_Assistant.git
cd AI_Chatbot_Assistant
```

2. **Install dependencies**

Backend:

```bash
cd server
npm install
```

Frontend:

```bash
cd client
npm install
```

3. **Set up PostgreSQL with pgvector**

```sql
-- Create database
CREATE DATABASE ai_chatbot;

-- Connect to database
\c ai_chatbot

-- Enable pgvector extension
CREATE EXTENSION IF NOT EXISTS vector;
```

4. **Configure environment variables**

Backend (`.env`):

```env
# Server
PORT=3000
NODE_ENV=development

# Database
DB_HOST=localhost
DB_PORT=5432
DB_NAME=ai_chatbot
DB_USER=your_db_user
DB_PASSWORD=your_db_password

# JWT
JWT_SECRET=your_super_secret_jwt_key_here
JWT_REFRESH_SECRET=your_refresh_token_secret_here
JWT_EXPIRATION=15m
JWT_REFRESH_EXPIRATION=7d

# OpenAI
OPENAI_API_KEY=sk-your-openai-api-key

# Redis (optional)
REDIS_HOST=localhost
REDIS_PORT=6379
REDIS_PASSWORD=

# Cloudinary
CLOUDINARY_CLOUD_NAME=your_cloud_name
CLOUDINARY_API_KEY=your_api_key
CLOUDINARY_API_SECRET=your_api_secret

# CORS
CLIENT_URL=http://localhost:5173
```

Frontend (`.env`):

```env
VITE_API_URL=http://localhost:3000/api
VITE_SOCKET_URL=http://localhost:3000
```

5. **Run database migrations**

```bash
cd server
npm run migrate
```

6. **Start the application**

Backend:

```bash
cd server
npm run dev
```

Frontend:

```bash
cd client
npm run dev
```

The application will be available at:

- Frontend: http://localhost:5173
- Backend API: http://localhost:3000/api
- API Documentation: http://localhost:3000/api-docs

### Docker Deployment (Alternative)

```bash
# Start all services with Docker Compose
docker-compose up -d

# View logs
docker-compose logs -f

# Stop services
docker-compose down
```

## 📚 API Documentation

Complete API documentation is available via Swagger UI:

**Local Development**: http://localhost:3000/api-docs

### API Overview

#### Authentication Endpoints

- `POST /api/auth/register` - Register new user
- `POST /api/auth/login` - Login and get tokens
- `POST /api/auth/refresh` - Refresh access token
- `POST /api/auth/logout` - Logout and invalidate token

#### Conversation Endpoints

- `GET /api/conversations` - List conversations (paginated)
- `POST /api/conversations` - Create conversation
- `GET /api/conversations/:id` - Get conversation details
- `PATCH /api/conversations/:id` - Update conversation
- `DELETE /api/conversations/:id` - Delete conversation
- `POST /api/conversations/generate-title` - AI-generated title

#### Message Endpoints

- `GET /api/conversations/:id/messages` - Get messages (paginated)
- `POST /api/conversations/:id/messages/stream` - Send message with streaming response
- `DELETE /api/messages/:id` - Delete message
- `PATCH /api/messages/:id/pin` - Pin message
- `PATCH /api/messages/:id/unpin` - Unpin message
- `GET /api/conversations/:id/messages/pinned` - Get pinned messages

#### Search Endpoints

- `POST /api/search/all` - Global semantic search
- `POST /api/search/conversation/:id` - Search within conversation
- `POST /api/conversations/:id/search` - Conversation search with context

#### Project Endpoints

- `GET /api/projects` - List all projects
- `POST /api/projects` - Create project
- `PUT /api/projects/:id` - Update project
- `DELETE /api/projects/:id` - Delete project
- `GET /api/projects/:id/conversations` - Get project conversations
- `PUT /api/conversations/:id/move` - Move conversation to project

#### File Endpoints

- `POST /api/files/upload-signature` - Generate upload signature
- `POST /api/files/metadata` - Save file metadata
- `GET /api/files/:id` - Get file details
- `DELETE /api/files/:id` - Delete file
- `GET /api/files/conversation/:id` - Get conversation files
- `GET /api/files/stats` - Get upload statistics

#### User Endpoints

- `GET /api/users/profile` - Get user profile
- `PUT /api/users/profile` - Update profile
- `POST /api/users/avatar` - Upload avatar
- `DELETE /api/users/avatar` - Remove avatar
- `GET /api/users/preferences` - Get preferences
- `PUT /api/users/preferences` - Update preferences
- `PUT /api/users/change-password` - Change password

### WebSocket Events

**Client → Server**

- `join:conversation` - Join conversation room
- `leave:conversation` - Leave conversation room
- `message:send` - Send message (with streaming response)
- `typing:start` - Start typing indicator
- `typing:stop` - Stop typing indicator
- `request_followups` - Request AI follow-up suggestions

**Server → Client**

- `message:chunk` - Streaming AI response chunk
- `message:complete` - Complete message data
- `message:new` - New message notification
- `message:pinned` - Message pinned notification
- `message:unpinned` - Message unpinned notification
- `conversation:created` - New conversation created
- `conversation:updated` - Conversation updated
- `conversation:deleted` - Conversation deleted
- `project:created` - New project created
- `project:updated` - Project updated
- `project:deleted` - Project deleted
- `followups_response` - AI follow-up suggestions
- `user:typing:start` - User typing started
- `user:typing:stop` - User typing stopped

## 📁 Project Structure

```
AI_Chatbot_Assistant/
├── client/                      # Frontend React application
│   ├── public/                  # Static assets
│   ├── src/
│   │   ├── assets/             # Images, fonts, etc.
│   │   ├── components/         # Reusable UI components
│   │   │   ├── ChatInput.tsx
│   │   │   ├── MessageBubble.tsx
│   │   │   ├── ConversationList.tsx
│   │   │   ├── ProjectCard.tsx
│   │   │   └── ...
│   │   ├── config/             # Configuration files
│   │   ├── hooks/              # Custom React hooks
│   │   ├── pages/              # Page components
│   │   ├── services/           # API service layer
│   │   ├── stores/             # State management
│   │   ├── types/              # TypeScript type definitions
│   │   ├── utils/              # Utility functions
│   │   ├── App.tsx             # Root component
│   │   └── main.tsx            # Entry point
│   ├── package.json
│   └── vite.config.ts          # Vite configuration
│
├── server/                      # Backend Node.js application
│   ├── src/
│   │   ├── config/             # App configuration
│   │   │   ├── database.ts     # Database connection
│   │   │   └── redis.ts        # Redis connection
│   │   ├── controllers/        # Request handlers
│   │   │   ├── auth.controller.ts
│   │   │   ├── conversation.controller.ts
│   │   │   ├── message.controller.ts
│   │   │   ├── project.controller.ts
│   │   │   ├── fileUpload.controller.ts
│   │   │   └── ...
│   │   ├── db/                 # Database setup
│   │   ├── middlewares/        # Express middlewares
│   │   │   ├── auth.middleware.ts
│   │   │   ├── validation.middleware.ts
│   │   │   └── error.middleware.ts
│   │   ├── migrations/         # Database migrations
│   │   ├── models/             # Sequelize models
│   │   │   ├── user.model.ts
│   │   │   ├── conversation.model.ts
│   │   │   ├── message.model.ts
│   │   │   ├── project.model.ts
│   │   │   └── ...
│   │   ├── routes/             # API routes
│   │   │   ├── auth.route.ts
│   │   │   ├── conversation.route.ts
│   │   │   ├── search.route.ts
│   │   │   ├── project.routes.ts
│   │   │   └── ...
│   │   ├── services/           # Business logic
│   │   │   ├── openai.service.ts
│   │   │   ├── socket.service.ts
│   │   │   ├── cache.service.ts
│   │   │   ├── cloudinary.service.ts
│   │   │   ├── pdf-parser.service.ts
│   │   │   └── ...
│   │   ├── types/              # TypeScript types
│   │   ├── utils/              # Utility functions
│   │   ├── index.ts            # Entry point
│   │   └── swagger.json        # API documentation
│   ├── docker-compose.yml      # Docker services
│   ├── Dockerfile              # Docker image
│   └── package.json
│
└── README.md                    # This file
```

## 🔐 Environment Variables

### Backend Environment Variables

| Variable                 | Description           | Required | Default               |
| ------------------------ | --------------------- | -------- | --------------------- |
| `PORT`                   | Server port           | No       | 3000                  |
| `NODE_ENV`               | Environment mode      | No       | development           |
| `DB_HOST`                | PostgreSQL host       | Yes      | -                     |
| `DB_PORT`                | PostgreSQL port       | No       | 5432                  |
| `DB_NAME`                | Database name         | Yes      | -                     |
| `DB_USER`                | Database user         | Yes      | -                     |
| `DB_PASSWORD`            | Database password     | Yes      | -                     |
| `JWT_SECRET`             | JWT signing key       | Yes      | -                     |
| `JWT_REFRESH_SECRET`     | Refresh token key     | Yes      | -                     |
| `JWT_EXPIRATION`         | Access token expiry   | No       | 15m                   |
| `JWT_REFRESH_EXPIRATION` | Refresh token expiry  | No       | 7d                    |
| `OPENAI_API_KEY`         | OpenAI API key        | Yes      | -                     |
| `REDIS_HOST`             | Redis host            | No       | localhost             |
| `REDIS_PORT`             | Redis port            | No       | 6379                  |
| `REDIS_PASSWORD`         | Redis password        | No       | -                     |
| `CLOUDINARY_CLOUD_NAME`  | Cloudinary cloud name | Yes      | -                     |
| `CLOUDINARY_API_KEY`     | Cloudinary API key    | Yes      | -                     |
| `CLOUDINARY_API_SECRET`  | Cloudinary API secret | Yes      | -                     |
| `CLIENT_URL`             | Frontend URL (CORS)   | No       | http://localhost:5173 |

### Frontend Environment Variables

| Variable          | Description          | Required |
| ----------------- | -------------------- | -------- |
| `VITE_API_URL`    | Backend API URL      | Yes      |
| `VITE_SOCKET_URL` | WebSocket server URL | Yes      |

## 📸 Screenshots

> Add screenshots of your application here

## 🤝 Contributing

Contributions are welcome! Please feel free to submit a Pull Request.

1. Fork the project
2. Create your feature branch (`git checkout -b feature/AmazingFeature`)
3. Commit your changes (`git commit -m 'Add some AmazingFeature'`)
4. Push to the branch (`git push origin feature/AmazingFeature`)
5. Open a Pull Request

## 📄 License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.

## 👨‍💻 Author

**Nguyen Vu Thanh**

- GitHub: [@Thanh14013](https://github.com/Thanh14013)
- LinkedIn: [Add your LinkedIn]
- Portfolio: [Add your portfolio]

## 🙏 Acknowledgments

- OpenAI for providing powerful AI models
- The React and Node.js communities
- All contributors who have helped this project grow

---

⭐ If you found this project helpful, please give it a star!
