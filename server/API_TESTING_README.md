# API Testing Guide with Postman

This guide provides step-by-step instructions for testing all API endpoints using Postman.

## Table of Contents

- [Setup](#setup)
- [Environment Variables](#environment-variables)
- [Authentication Flow](#authentication-flow)
- [Conversation Endpoints](#conversation-endpoints)
- [Message Endpoints](#message-endpoints)
- [Complete Test Workflow](#complete-test-workflow)

---

## Setup

### Prerequisites

1. Install [Postman](https://www.postman.com/downloads/)
2. Server must be running at `http://localhost:3000`
3. PostgreSQL database must be configured and running
4. OpenAI API key must be set in server `.env` file

### Base URL

```
http://localhost:3000/api
```

---

## Environment Variables

Create a Postman environment with these variables:

| Variable         | Initial Value               | Description                      |
| ---------------- | --------------------------- | -------------------------------- |
| `baseUrl`        | `http://localhost:3000/api` | API base URL                     |
| `accessToken`    | (empty)                     | Will be auto-filled after login  |
| `conversationId` | (empty)                     | Will be set manually for testing |
| `messageId`      | (empty)                     | Will be set manually for testing |

---

## Authentication Flow

### 1. Register a New User

**Endpoint:** `POST {{baseUrl}}/auth/register`

**Headers:**

```
Content-Type: application/json
```

**Body (JSON):**

```json
{
  "name": "Test User",
  "email": "test@example.com",
  "password": "password123",
  "confirmPassword": "password123"
}
```

**Expected Response (201 Created):**

```json
{
  "success": true,
  "message": "User registered successfully"
}
```

---

### 2. Login

**Endpoint:** `POST {{baseUrl}}/auth/login`

**Headers:**

```
Content-Type: application/json
```

**Body (JSON):**

```json
{
  "email": "test@example.com",
  "password": "password123"
}
```

**Expected Response (200 OK):**

```json
{
  "success": true,
  "message": "Login successful",
  "data": {
    "user": {
      "id": "uuid-here",
      "name": "Test User",
      "email": "test@example.com",
      "createdAt": "2024-01-01T00:00:00.000Z",
      "updatedAt": "2024-01-01T00:00:00.000Z"
    },
    "accessToken": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..."
  }
}
```

**Post-Request Script (Postman):**

```javascript
// Automatically save the access token to environment
const response = pm.response.json();
if (response.success && response.data.accessToken) {
  pm.environment.set("accessToken", response.data.accessToken);
}
```

---

### 3. Refresh Token

**Endpoint:** `POST {{baseUrl}}/auth/refresh`

**Headers:**

```
Content-Type: application/json
```

**Body:** (empty - uses cookie automatically)

**Expected Response (200 OK):**

```json
{
  "success": true,
  "message": "Token refreshed successfully",
  "data": {
    "accessToken": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..."
  }
}
```

---

### 4. Logout

**Endpoint:** `POST {{baseUrl}}/auth/logout`

**Headers:**

```
Authorization: Bearer {{accessToken}}
```

**Expected Response (200 OK):**

```json
{
  "success": true,
  "message": "Logout successful, revoked X token(s)"
}
```

---

## Conversation Endpoints

> **Note:** All conversation endpoints require authentication. Include the `Authorization` header with Bearer token.

### 1. Create New Conversation

**Endpoint:** `POST {{baseUrl}}/conversations`

**Headers:**

```
Content-Type: application/json
Authorization: Bearer {{accessToken}}
```

**Body (JSON):**

```json
{
  "title": "My First Chat",
  "model": "gpt-5-nano",
  "context_window": 10
}
```

**Expected Response (201 Created):**

```json
{
  "success": true,
  "message": "Conversation created successfully",
  "data": {
    "id": "conversation-uuid",
    "user_id": "user-uuid",
    "title": "My First Chat",
    "model": "gpt-5-nano",
    "context_window": 10,
    "total_tokens_used": 0,
    "message_count": 0,
    "createdAt": "2024-01-01T00:00:00.000Z",
    "updatedAt": "2024-01-01T00:00:00.000Z",
    "deleted_at": null
  }
}
```

**Post-Request Script (Postman):**

```javascript
// Save conversation ID for later use
const response = pm.response.json();
if (response.success && response.data.id) {
  pm.environment.set("conversationId", response.data.id);
}
```

---

### 2. Get All Conversations (with pagination)

**Endpoint:** `GET {{baseUrl}}/conversations?page=1&limit=20`

**Headers:**

```
Authorization: Bearer {{accessToken}}
```

**Query Parameters:**

- `page` (optional, default: 1): Page number
- `limit` (optional, default: 20, max: 100): Items per page

**Expected Response (200 OK):**

```json
{
  "success": true,
  "message": "Conversations retrieved successfully",
  "data": [
    {
      "id": "conversation-uuid",
      "user_id": "user-uuid",
      "title": "My First Chat",
      "model": "gpt-5-nano",
      "context_window": 10,
      "total_tokens_used": 0,
      "message_count": 0,
      "createdAt": "2024-01-01T00:00:00.000Z",
      "updatedAt": "2024-01-01T00:00:00.000Z",
      "deleted_at": null
    }
  ],
  "pagination": {
    "page": 1,
    "limit": 20,
    "total": 1,
    "totalPages": 1
  }
}
```

---

### 3. Get Specific Conversation

**Endpoint:** `GET {{baseUrl}}/conversations/{{conversationId}}`

**Headers:**

```
Authorization: Bearer {{accessToken}}
```

**Expected Response (200 OK):**

```json
{
  "success": true,
  "message": "Conversation retrieved successfully",
  "data": {
    "id": "conversation-uuid",
    "user_id": "user-uuid",
    "title": "My First Chat",
    "model": "gpt-5-nano",
    "context_window": 10,
    "total_tokens_used": 150,
    "message_count": 4,
    "createdAt": "2024-01-01T00:00:00.000Z",
    "updatedAt": "2024-01-01T00:00:00.000Z",
    "deleted_at": null
  }
}
```

---

### 4. Update Conversation

**Endpoint:** `PATCH {{baseUrl}}/conversations/{{conversationId}}`

**Headers:**

```
Content-Type: application/json
Authorization: Bearer {{accessToken}}
```

**Body (JSON):**

```json
{
  "title": "Updated Chat Title",
  "context_window": 15
}
```

**Expected Response (200 OK):**

```json
{
  "success": true,
  "message": "Conversation updated successfully",
  "data": {
    "id": "conversation-uuid",
    "user_id": "user-uuid",
    "title": "Updated Chat Title",
    "model": "gpt-5-nano",
    "context_window": 15,
    "total_tokens_used": 150,
    "message_count": 4,
    "createdAt": "2024-01-01T00:00:00.000Z",
    "updatedAt": "2024-01-01T01:00:00.000Z",
    "deleted_at": null
  }
}
```

---

### 5. Delete Conversation (Soft Delete)

**Endpoint:** `DELETE {{baseUrl}}/conversations/{{conversationId}}`

**Headers:**

```
Authorization: Bearer {{accessToken}}
```

**Expected Response (200 OK):**

```json
{
  "success": true,
  "message": "Conversation deleted successfully"
}
```

---

## Message Endpoints

> **Note:** All message endpoints require authentication. Include the `Authorization` header with Bearer token.

### 1. Get Messages from Conversation

**Endpoint:** `GET {{baseUrl}}/conversations/{{conversationId}}/messages?page=1&limit=30`

**Headers:**

```
Authorization: Bearer {{accessToken}}
```

**Query Parameters:**

- `page` (optional, default: 1): Page number
- `limit` (optional, default: 30, max: 100): Messages per page

**Expected Response (200 OK):**

```json
{
  "success": true,
  "message": "Messages retrieved successfully",
  "data": [
    {
      "id": "message-uuid-1",
      "conversation_id": "conversation-uuid",
      "role": "user",
      "content": "Hello, how are you?",
      "tokens_used": 5,
      "model": "gpt-5-nano",
      "createdAt": "2024-01-01T00:00:00.000Z"
    },
    {
      "id": "message-uuid-2",
      "conversation_id": "conversation-uuid",
      "role": "assistant",
      "content": "I'm doing well, thank you! How can I help you today?",
      "tokens_used": 12,
      "model": "gpt-5-nano",
      "createdAt": "2024-01-01T00:00:05.000Z"
    }
  ],
  "pagination": {
    "page": 1,
    "limit": 30,
    "total": 2,
    "totalPages": 1
  }
}
```

**Note:** Messages are returned in chronological order (oldest first). The latest 30 messages are shown on page 1.

---

### 2. Send Message and Get AI Response

**Endpoint:** `POST {{baseUrl}}/conversations/{{conversationId}}/messages`

**Headers:**

```
Content-Type: application/json
Authorization: Bearer {{accessToken}}
```

**Body (JSON):**

```json
{
  "content": "What is the capital of France?"
}
```

**Expected Response (201 Created):**

```json
{
  "success": true,
  "message": "Message sent successfully",
  "data": {
    "userMessage": {
      "id": "user-message-uuid",
      "conversation_id": "conversation-uuid",
      "role": "user",
      "content": "What is the capital of France?",
      "tokens_used": 7,
      "model": "gpt-5-nano",
      "createdAt": "2024-01-01T00:00:00.000Z"
    },
    "assistantMessage": {
      "id": "assistant-message-uuid",
      "conversation_id": "conversation-uuid",
      "role": "assistant",
      "content": "The capital of France is Paris. It's one of the most famous cities in the world...",
      "tokens_used": 145,
      "model": "gpt-5-nano",
      "createdAt": "2024-01-01T00:00:03.000Z"
    },
    "conversation": {
      "id": "conversation-uuid",
      "total_tokens_used": 152,
      "message_count": 2
    }
  }
}
```

**Note:** This endpoint:

1. Saves your message to the database
2. Builds context from conversation history
3. Calls OpenAI API to get response
4. Saves AI response to database
5. Returns both messages and updated conversation stats

---

## Complete Test Workflow

Follow these steps to test the complete flow:

### Step 1: Setup

1. Start the server
2. Open Postman
3. Create an environment with the variables listed above

### Step 2: Authentication

1. **Register** a new user
2. **Login** with the registered user (saves access token automatically)

### Step 3: Create First Conversation

1. **Create a conversation** with title "Test Chat" (saves conversation ID)
2. **Get all conversations** to verify it was created
3. **Get the specific conversation** by ID

### Step 4: Chat with AI

1. **Send a message**: "Hello, who are you?"
2. Check the response - you should receive both user message and AI reply
3. **Send another message**: "Tell me a fun fact about space"
4. **Get all messages** to see the conversation history

### Step 5: Pagination Test

1. Send 40+ messages to the conversation
2. **Get messages** with `?page=1&limit=30` - should return last 30 messages
3. **Get messages** with `?page=2&limit=30` - should return older messages

### Step 6: Update and Delete

1. **Update the conversation** title to "Space Facts Chat"
2. **Get the conversation** to verify the title changed
3. **Delete the conversation**
4. Try to **get the deleted conversation** - should return 404

### Step 7: Multiple Conversations

1. Create 3 different conversations
2. Send messages to each one
3. **Get all conversations** to see them listed
4. Verify each conversation has correct message count

---

## Error Responses

### 400 Bad Request

```json
{
  "success": false,
  "message": "Message content is required"
}
```

### 401 Unauthorized

```json
{
  "success": false,
  "message": "Authentication required"
}
```

### 403 Forbidden

```json
{
  "success": false,
  "message": "Unauthorized access to conversation"
}
```

### 404 Not Found

```json
{
  "success": false,
  "message": "Conversation not found"
}
```

### 503 Service Unavailable

```json
{
  "success": false,
  "message": "AI service temporarily unavailable",
  "error": "Failed to get AI response: OpenAI rate limit exceeded"
}
```

---

## Tips for Testing

1. **Use Environment Variables**: Set `{{baseUrl}}`, `{{accessToken}}`, and `{{conversationId}}` in your Postman environment for easy switching.

2. **Auto-save Tokens**: Use the post-request scripts provided to automatically save tokens and IDs.

3. **Test Edge Cases**:
   - Empty message content
   - Very long messages (1000+ characters)
   - Special characters in conversation titles
   - Invalid UUIDs
   - Expired tokens

4. **Monitor Token Usage**: Check the `total_tokens_used` field to monitor OpenAI API usage.

5. **Test Pagination**: Create many conversations/messages to test pagination properly.

6. **Test Authorization**: Try accessing another user's conversations (should fail with 403).

---

## Postman Collection

You can import this JSON into Postman to get started quickly:

```json
{
  "info": {
    "name": "AI Chatbot API",
    "schema": "https://schema.getpostman.com/json/collection/v2.1.0/collection.json"
  },
  "variable": [
    {
      "key": "baseUrl",
      "value": "http://localhost:3000/api"
    }
  ]
}
```

---

## Common Issues

### Issue: "Authentication required"

- **Solution**: Make sure you've logged in and the access token is saved in environment variables. Check the `Authorization` header is set correctly.

### Issue: "OpenAI API error"

- **Solution**: Verify `OPENAI_API_KEY` is set in the server's `.env` file and is valid.

### Issue: "Conversation not found"

- **Solution**: Verify the `conversationId` is correct and the conversation hasn't been deleted.

### Issue: Token expired

- **Solution**: Use the refresh token endpoint or log in again.

---

## Support

For issues or questions, check:

- Server logs for detailed error messages
- Database to verify data is being saved
- `.env` file for correct configuration

---

**Happy Testing! 🚀**
