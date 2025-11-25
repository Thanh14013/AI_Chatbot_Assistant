# AI Chatbot Assistant

Ứng dụng chatbot AI với khả năng hội thoại thông minh, hỗ trợ nhiều tính năng nâng cao như upload file, tìm kiếm ngữ nghĩa, quản lý bộ nhớ hội thoại, và real-time messaging qua WebSocket.

## Mục lục

- [Tính năng chính](#tính-năng-chính)
- [Công nghệ sử dụng](#công-nghệ-sử-dụng)
- [Kiến trúc hệ thống](#kiến-trúc-hệ-thống)
- [Cài đặt](#cài-đặt)
- [Cấu hình](#cấu-hình)
- [Chạy ứng dụng](#chạy-ứng-dụng)
- [API Documentation](#api-documentation)
- [Cấu trúc thư mục](#cấu-trúc-thư-mục)
- [Tính năng bảo mật](#tính-năng-bảo-mật)
- [Testing](#testing)
- [Đóng góp](#đóng-góp)
- [License](#license)

## Tính năng chính

### Core Features

- **AI Chat Interface**: Giao diện chat hiện đại với OpenAI GPT-4o-mini
- **Real-time Messaging**: Sử dụng Socket.IO để truyền tin nhắn real-time
- **Streaming Responses**: AI responses được stream theo từng chunk
- **Multi-conversation Management**: Quản lý nhiều cuộc hội thoại đồng thời
- **Message Pinning**: Ghim tin nhắn quan trọng
- **Conversation Search**: Tìm kiếm nội dung trong hội thoại

### File & Media Features

- **File Upload**: Upload file (PDF, DOCX, images) lên Cloudinary
- **Document Processing**: Xử lý và trích xuất nội dung từ PDF và DOCX
- **Image Analysis**: Phân tích và mô tả nội dung hình ảnh với AI Vision
- **File Preview**: Preview file trực tiếp trong chat

### Memory & Intelligence

- **Semantic Memory**: Lưu trữ và truy vấn bộ nhớ dài hạn với vector embeddings
- **Context Management**: Tự động quản lý context window của AI
- **Smart Suggestions**: Gợi ý câu hỏi thông minh cho người dùng mới

### User Management

- **Authentication**: JWT-based authentication với access & refresh tokens
- **User Profiles**: Quản lý profile và avatar người dùng
- **Preferences**: Cài đặt tùy chỉnh (theme, ngôn ngữ, AI model)
- **Password Security**: Bcrypt hashing cho mật khẩu

### Performance & Scalability

- **Redis Caching**: Cache user data, conversations, và search results
- **Rate Limiting**: Bảo vệ API khỏi spam và abuse
- **Compression**: Response compression giảm 70-80% bandwidth
- **Database Optimization**: Sequelize ORM với PostgreSQL/MySQL

### Security Features

- **Helmet.js**: Security headers
- **CORS Protection**: Cấu hình CORS an toàn
- **XSS Protection**: Sanitize user input
- **Request Validation**: Validate tất cả input
- **Error Tracking**: Sentry integration cho monitoring

## Công nghệ sử dụng

### Frontend

| Công nghệ                    | Version | Mô tả                   |
| ---------------------------- | ------- | ----------------------- |
| **React**                    | 18.3.1  | UI framework            |
| **TypeScript**               | 5.9.3   | Type safety             |
| **Vite**                     | 7.1.7   | Build tool & dev server |
| **Ant Design**               | 5.27.4  | UI component library    |
| **React Router**             | 7.9.3   | Client-side routing     |
| **Axios**                    | 1.12.2  | HTTP client             |
| **Socket.IO Client**         | 4.8.1   | Real-time communication |
| **React Syntax Highlighter** | 16.1.0  | Code highlighting       |
| **Sentry**                   | 10.22.0 | Error tracking          |

### Backend

| Công nghệ      | Version           | Mô tả                      |
| -------------- | ----------------- | -------------------------- |
| **Node.js**    | ≥18.0.0           | Runtime environment        |
| **Express**    | 5.1.0             | Web framework              |
| **TypeScript** | 5.9.3             | Type safety                |
| **Sequelize**  | 6.37.7            | ORM for PostgreSQL/MySQL   |
| **Socket.IO**  | 4.8.1             | WebSocket server           |
| **Redis**      | via ioredis 5.8.1 | Caching & session store    |
| **OpenAI**     | 6.3.0             | AI integration             |
| **Cloudinary** | 2.7.0             | File storage               |
| **JWT**        | 9.0.2             | Authentication             |
| **Bcrypt**     | 6.0.0             | Password hashing           |
| **Winston**    | 3.18.3            | Logging                    |
| **Helmet**     | 8.1.0             | Security middleware        |
| **Sentry**     | 10.22.0           | Error tracking & profiling |

### DevOps & Tools

- **Docker**: Containerization (optional)
- **Swagger**: API documentation
- **ESLint & Prettier**: Code quality
- **Nodemon**: Development hot-reload

## Kiến trúc hệ thống

```
┌─────────────────┐         ┌─────────────────┐
│   React Client  │◄────────┤   Vite Dev      │
│   (Port 5173)   │         │   Server        │
└────────┬────────┘         └─────────────────┘
         │
         │ HTTP/WebSocket
         │
         ▼
┌─────────────────┐         ┌─────────────────┐
│  Express Server │◄────────┤   Socket.IO     │
│  (Port 3000)    │         │   Server        │
└────────┬────────┘         └─────────────────┘
         │
         ├──────────────┬──────────────┬──────────────┐
         ▼              ▼              ▼              ▼
    ┌────────┐    ┌─────────┐    ┌─────────┐   ┌──────────┐
    │PostgreSQL   │  Redis  │    │ OpenAI  │   │Cloudinary│
    │  MySQL │    │  Cache  │    │   API   │   │   CDN    │
    └────────┘    └─────────┘    └─────────┘   └──────────┘
```

### Flow xử lý tin nhắn

```
User Input → Client → WebSocket → Server → OpenAI API
                ↓                    ↓
            Local State         Save to DB
                ↓                    ↓
            Real-time UI ← Stream ← Redis Cache
```

## Cài đặt

### Yêu cầu hệ thống

- **Node.js** ≥18.0.0
- **npm** ≥9.0.0
- **PostgreSQL** hoặc **MySQL**
- **Redis** (optional, recommended cho production)
- **OpenAI API Key**
- **Cloudinary Account** (cho upload file)

### Clone Repository

```bash
git clone https://github.com/Thanh14013/AI_Chatbot_Assistant.git
cd AI_Chatbot_Assistant
```

### Cài đặt Dependencies

#### Backend

```bash
cd server
npm install
```

#### Frontend

```bash
cd client
npm install
```

## Cấu hình

### Backend Configuration

Tạo file `.env` trong thư mục `server/`:

```env
# ==================== Server Configuration ====================
NODE_ENV=development
PORT=3000

# ==================== Database Configuration ====================
# PostgreSQL
DB_HOST=localhost
DB_PORT=5432
DB_NAME=ai_chatbot_db
DB_USER=your_db_user
DB_PASS=your_db_password
DB_DIALECT=postgres

# MySQL (alternative)
# DB_DIALECT=mysql

# Database sync (chỉ dùng trong development)
DB_SYNC=false

# ==================== Redis Configuration ====================
REDIS_HOST=localhost
REDIS_PORT=6379
REDIS_PASSWORD=
REDIS_DB=0

# ==================== JWT Configuration ====================
JWT_ACCESS_SECRET=your_super_secret_access_key_min_32_chars
JWT_REFRESH_SECRET=your_super_secret_refresh_key_min_32_chars
JWT_ACCESS_EXPIRATION=1h
JWT_REFRESH_EXPIRATION=7d

# ==================== OpenAI Configuration ====================
OPENAI_API_KEY=sk-your-openai-api-key
OPENAI_MODEL=gpt-4o-mini
OPENAI_TEMPERATURE=0.7
OPENAI_MAX_TOKENS=2000

# ==================== Cloudinary Configuration ====================
CLOUDINARY_CLOUD_NAME=your_cloud_name
CLOUDINARY_API_KEY=your_api_key
CLOUDINARY_API_SECRET=your_api_secret

# ==================== CORS Configuration ====================
CORS_ORIGINS=http://localhost:5173

# ==================== Sentry (Optional) ====================
SENTRY_DSN=your_sentry_dsn

# ==================== File Upload Configuration ====================
MAX_FILE_SIZE=10485760
MAX_FILES_PER_MESSAGE=10
```

### Frontend Configuration

Tạo file `.env` trong thư mục `client/`:

```env
# API Base URL
VITE_API_BASE_URL=http://localhost:3000/api

# WebSocket URL
VITE_SOCKET_URL=http://localhost:3000

# Sentry (Optional)
VITE_SENTRY_DSN=your_sentry_dsn
```

### Database Setup

#### Option 1: Sử dụng Migration (Khuyến nghị)

```bash
cd server
npm run migrate
```

#### Option 2: Database Sync (Development only)

Set `DB_SYNC=true` trong file `.env` và restart server.

## Chạy ứng dụng

### Development Mode

#### Chạy Backend

```bash
cd server
npm run dev
```

Server sẽ chạy tại: `http://localhost:3000`

#### Chạy Frontend

```bash
cd client
npm run dev
```

Client sẽ chạy tại: `http://localhost:5173`

### Production Build

#### Build Backend

```bash
cd server
npm run build
npm start
```

#### Build Frontend

```bash
cd client
npm run build
npm run preview
```

### Chạy cả hai cùng lúc

Bạn có thể sử dụng `concurrently` hoặc mở 2 terminal riêng biệt.

## API Documentation

API documentation được tạo tự động với Swagger UI.

**Truy cập tại**: `http://localhost:3000/docs`

### Các API Endpoints chính

#### Authentication

- `POST /api/auth/register` - Đăng ký tài khoản mới
- `POST /api/auth/login` - Đăng nhập
- `POST /api/auth/refresh` - Refresh access token
- `POST /api/auth/logout` - Đăng xuất
- `POST /api/auth/change-password` - Đổi mật khẩu

#### User Management

- `GET /api/users/profile` - Lấy thông tin profile
- `PUT /api/users/profile` - Cập nhật profile
- `POST /api/users/avatar` - Upload avatar
- `GET /api/users/preferences` - Lấy preferences
- `PUT /api/users/preferences` - Cập nhật preferences

#### Conversations

- `GET /api/conversations` - Lấy danh sách conversations
- `POST /api/conversations` - Tạo conversation mới
- `GET /api/conversations/:id` - Lấy chi tiết conversation
- `PUT /api/conversations/:id` - Cập nhật conversation
- `DELETE /api/conversations/:id` - Xóa conversation
- `GET /api/conversations/:id/messages` - Lấy tin nhắn
- `POST /api/conversations/:id/messages` - Gửi tin nhắn
- `PUT /api/conversations/:id/messages/:messageId` - Cập nhật tin nhắn
- `DELETE /api/conversations/:id/messages/:messageId` - Xóa tin nhắn
- `POST /api/conversations/:id/messages/:messageId/pin` - Pin/unpin tin nhắn

#### Memory

- `GET /api/memory` - Lấy danh sách memories
- `POST /api/memory` - Tạo memory mới
- `PUT /api/memory/:id` - Cập nhật memory
- `DELETE /api/memory/:id` - Xóa memory

#### Search

- `GET /api/search/conversations` - Tìm kiếm conversations
- `POST /api/search/semantic` - Tìm kiếm ngữ nghĩa

#### File Upload

- `POST /api/upload/file` - Upload file
- `DELETE /api/upload/file` - Xóa file

#### Health Check

- `GET /api/health` - Kiểm tra trạng thái server

### WebSocket Events

#### Client → Server

- `join_conversation` - Join vào conversation
- `leave_conversation` - Leave conversation
- `send_message` - Gửi tin nhắn
- `typing_start` - Bắt đầu typing
- `typing_stop` - Dừng typing

#### Server → Client

- `message` - Nhận tin nhắn mới
- `message_update` - Tin nhắn được cập nhật
- `message_delete` - Tin nhắn bị xóa
- `user_typing` - User đang typing
- `conversation_update` - Conversation được cập nhật
- `error` - Lỗi xảy ra

## Cấu trúc thư mục

### Backend Structure

```
server/
├── src/
│   ├── config/              # Configuration files
│   │   ├── constants.ts     # App constants
│   │   ├── database.config.ts
│   │   └── redis.config.ts
│   ├── controllers/         # Request handlers
│   │   ├── auth.controller.ts
│   │   ├── conversation.controller.ts
│   │   ├── message.controller.ts
│   │   └── user.controller.ts
│   ├── db/                  # Database connection
│   ├── middlewares/         # Express middlewares
│   │   ├── auth.middleware.ts
│   │   ├── generalMiddleware.ts
│   │   └── validation.middleware.ts
│   ├── migrations/          # Database migrations
│   ├── models/              # Sequelize models
│   │   ├── User.model.ts
│   │   ├── Conversation.model.ts
│   │   ├── Message.model.ts
│   │   └── Memory.model.ts
│   ├── routes/              # API routes
│   │   ├── auth.route.ts
│   │   ├── conversation.route.ts
│   │   ├── user.route.ts
│   │   └── index.ts
│   ├── services/            # Business logic
│   │   ├── ai.service.ts
│   │   ├── socket.service.ts
│   │   ├── memory.service.ts
│   │   └── file.service.ts
│   ├── types/               # TypeScript types
│   ├── utils/               # Utility functions
│   │   ├── logger.util.ts
│   │   ├── validation.util.ts
│   │   └── token.util.ts
│   └── index.ts             # Entry point
├── logs/                    # Application logs
├── package.json
├── tsconfig.json
└── .env
```

### Frontend Structure

```
client/
├── src/
│   ├── assets/              # Static assets (images, fonts)
│   ├── components/          # React components
│   │   ├── ChatInput.tsx
│   │   ├── MessageBubble.tsx
│   │   ├── MessageList.tsx
│   │   ├── ConversationList.tsx
│   │   ├── FileAttachmentPreview.tsx
│   │   ├── CodeBlock.tsx
│   │   └── ...
│   ├── config/              # App configuration
│   │   └── api.config.ts
│   ├── hooks/               # Custom React hooks
│   │   ├── useAuth.tsx
│   │   ├── useSocket.ts
│   │   └── useConversation.ts
│   ├── pages/               # Page components
│   │   ├── ChatPage.tsx
│   │   ├── LoginPage.tsx
│   │   └── RegisterPage.tsx
│   ├── services/            # API services
│   │   ├── auth.service.ts
│   │   ├── conversation.service.ts
│   │   └── message.service.ts
│   ├── stores/              # State management
│   │   ├── preferences.store.tsx
│   │   └── sidebar.store.tsx
│   ├── types/               # TypeScript types
│   │   └── index.ts
│   ├── utils/               # Utility functions
│   │   ├── format.util.ts
│   │   └── validation.util.ts
│   ├── App.tsx              # Main App component
│   ├── main.tsx             # Entry point
│   └── index.css            # Global styles
├── public/                  # Public assets
├── package.json
├── vite.config.ts
└── .env
```

## Tính năng bảo mật

### Authentication & Authorization

- JWT-based authentication với access & refresh tokens
- Secure HTTP-only cookies cho refresh tokens
- Token rotation và revocation
- Password hashing với bcrypt (cost factor: 10)

### API Security

- Rate limiting (1000 requests/hour)
- Request timeout (30 seconds)
- Body size limits (2MB)
- CORS protection
- Helmet.js security headers
- XSS protection
- SQL injection prevention (Sequelize ORM)

### Data Protection

- Environment variables cho sensitive data
- Encrypted database connections
- Secure file upload validation
- Input sanitization và validation

### Monitoring

- Sentry error tracking
- Winston logging
- Request logging
- Performance monitoring

## Testing

### Backend Tests

```bash
cd server
npm run test
```

### Frontend Tests

```bash
cd client
npm run test
```

### Coding Standards

- Follow ESLint configuration
- Write meaningful commit messages
- Add comments cho code phức tạp
- Update documentation khi cần
- Write tests cho features mới

## Changelog

### Version 1.0.0 (Current)

- Initial release
- AI Chat với OpenAI GPT-4o-mini
- Real-time messaging với Socket.IO
- File upload & processing
- Semantic memory system
- User authentication & profiles
- Redis caching
- Swagger API documentation

## Known Issues

- WebSocket reconnection có thể gặp issue trên một số mạng restrictive
- File upload lớn hơn 10MB cần increase limit
- Redis cache invalidation cần optimize hơn

## Author

**Nguyen Vu Thanh**

- GitHub: [@Thanh14013](https://github.com/Thanh14013)
- Repository: [AI_Chatbot_Assistant](https://github.com/Thanh14013/AI_Chatbot_Assistant)
