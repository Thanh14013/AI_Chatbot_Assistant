# Server (Backend)

This folder contains the backend server for the AI Chatbot Assistant.

## Quick setup

1. Copy `.env.example` to `.env` and fill the values (DATABASE_URL, JWT secrets, etc.).

2. Install dependencies:

```powershell
cd server
npm install
```

3. Run migrations (requires a running Postgres instance):

```powershell
npm run migrate
```

4. Start development server:

```powershell
npm run dev
```

The server will run on the port defined in `.env` (default 3000). Health check: http://localhost:3000/health

## Swagger API docs

After starting the server, API docs are available at:

http://localhost:3000/docs

The docs include all authentication endpoints with examples.

## Auth endpoints

Base path: `/api/auth`

- POST /api/auth/register
  - Body JSON: { name, email, password, confirmPassword? }
  - Success 201: { success: true, message: "User registered successfully" }

- POST /api/auth/login
  - Body JSON: { email, password }
  - Success 200: Sets HttpOnly cookie `refreshToken`; response body includes `data.accessToken` and `data.user`.

- POST /api/auth/refresh
  - Body JSON (optional): { refreshToken }
  - Can also read refresh token from HttpOnly cookie `refreshToken`.
  - Success 200: { success: true, message: "Token refreshed successfully", data: { accessToken } }

- POST /api/auth/logout
  - Body JSON (optional): { refreshToken }
  - Clears refresh token cookie and revokes tokens server-side.

## Notes

- The server expects `refreshToken` to be stored as an HttpOnly cookie named `refreshToken` for normal flows. The refresh endpoint also accepts a `refreshToken` in the body for non-browser clients.
- See `/src/swagger.json` for the OpenAPI spec used by the docs.

## Database Models

### User Model

- Manages user accounts and authentication
- Fields: id, name, email, password (hashed)
- Relationships: hasMany RefreshTokens, hasMany Conversations

### RefreshToken Model

- Stores JWT refresh tokens for authentication
- Fields: id, user_id, token, expires_at, is_revoked
- Relationships: belongsTo User

### Conversation Model (NEW in Sprint 2)

- Represents a chat conversation between user and AI
- Fields: id, user_id, title, model, context_window, total_tokens_used, message_count, deleted_at
- Supports soft delete (deleted_at field)
- Relationships: belongsTo User, hasMany Messages
- Methods:
  - `findByUserId(userId)` - Get all active conversations for a user
  - `findByIdActive(id)` - Get conversation by ID (non-deleted only)
  - `softDelete(id)` - Soft delete a conversation
  - `incrementStats(tokens)` - Update message count and token usage

### Message Model (NEW in Sprint 2)

- Stores individual messages in conversations
- Fields: id, conversation_id, role (user/assistant/system), content, tokens_used, model
- Immutable (no updatedAt timestamp)
- Relationships: belongsTo Conversation
- Methods:
  - `findByConversationId(id)` - Get all messages for a conversation
  - `findRecentMessages(id, limit)` - Get last N messages for context window
  - `countByConversation(id)` - Count messages in a conversation
  - `deleteByConversation(id)` - Delete all messages (cascade)

## Database Migrations

All migrations are located in `src/migrations/`. Current migrations:

1. `20241004000001-create-users.js` - Users table
2. `20241004000002-create-refresh-tokens.js` - Refresh tokens table
3. `20241004000003-create-conversations.js` - Conversations table with indexes
4. `20241004000004-create-messages.js` - Messages table with indexes

Run migrations: `npm run migrate`
Check status: `npm run migrate:status`
Rollback: `npm run migrate:undo`

## Testing Models

A test script is available to verify the models work correctly:

```powershell
node --no-warnings --loader ts-node/esm src/test-models.ts
```

This will create a test conversation and messages, then clean up.
