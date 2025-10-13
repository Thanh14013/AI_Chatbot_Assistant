# WebSocket Backend Setup - Implementation Documentation

## Overview

This document describes the complete implementation of WebSocket functionality for the AI Chatbot Assistant backend using Socket.io. The implementation provides real-time messaging, multi-tab synchronization, and room-based communication.

## ✅ Task 13.1: Install and Configure Socket.io Server

### What was implemented:

1. **Socket.io Integration**
   - Integrated Socket.io with existing Express server using HTTP server
   - Modified `src/index.ts` to create HTTP server and initialize Socket.io
   - Added global Socket.io instance for access across modules

2. **Authentication Middleware**
   - Created `socketAuthMiddleware` that verifies JWT tokens from:
     - `socket.handshake.auth.token`
     - `socket.handshake.headers.authorization` (Bearer format)
     - `socket.handshake.query.token`
   - Attaches user information to socket instance
   - Provides secure authentication for WebSocket connections

3. **CORS Configuration**
   - Configured CORS for WebSocket connections
   - Supports credentials and proper origin handling
   - Compatible with frontend development server

4. **Connection Management**
   - User-to-socket mapping for multi-device support
   - Socket-to-user mapping for reverse lookups
   - Automatic cleanup on disconnection

### Files created/modified:

- `src/services/socket.service.ts` - Main Socket.io service
- `src/index.ts` - Integration with Express server
- `src/types/socket.type.ts` - TypeScript interfaces for events

## ✅ Task 13.2: Implement WebSocket Event Handlers

### Events Implemented:

#### **Connection Events**

- `connection` - Handles new client connections with authentication
- `disconnect` - Cleanup user connections and leave all rooms

#### **Conversation Management**

- `join:conversation` - Join conversation room by ID
- `leave:conversation` - Leave conversation room
- `conversation:create` - Broadcast new conversation to user's other tabs
- `conversation:update` - Sync conversation updates across tabs
- `conversation:delete` - Sync conversation deletion and cleanup rooms

#### **Message Events**

- `message:send` - Receive user message and process with AI
  - Validates conversation access
  - Streams AI response using OpenAI service
  - Broadcasts chunks in real-time
  - Saves messages to database
- `message:chunk` - Streams AI response chunks to client
- `message:complete` - Final message data when AI response is complete

#### **Typing Indicators**

- `typing:start` - User starts typing
- `typing:stop` - User stops typing
- `ai:typing:start` - AI is processing (shown to user)
- `ai:typing:stop` - AI finished processing

#### **Health Check**

- `ping` / `pong` - Connection health monitoring

### Integration with Services:

- **Message Service**: Integrated with `sendMessageAndStreamResponse` for real-time AI responses
- **Authentication**: Uses existing JWT verification utilities
- **Database**: Automatic message and conversation updates

## ✅ Task 13.3: Room-based Messaging

### Room Structure:

1. **User Rooms**: `user:{userId}`
   - Every socket joins their user room on connection
   - Used for broadcasting user-specific updates

2. **Conversation Rooms**: `conversation:{conversationId}`
   - Sockets join when accessing a specific conversation
   - Used for conversation-specific events (typing, messages)

### Multi-Tab/Device Support:

#### **Connection Tracking**

```typescript
userSockets: Map<userId, Set<socketId>>; // Track all user's sockets
socketUsers: Map<socketId, userId>; // Reverse lookup
```

#### **Broadcasting Strategies**

- **To User (All Tabs)**: `broadcastToUser()` - Sends to all user's sockets
- **To Conversation**: `broadcastToConversation()` - Sends to all users in conversation
- **Cross-Tab Sync**: New conversations, updates, and deletions sync across all user's tabs

#### **Room Cleanup**

- Automatic room leaving on socket disconnect
- Conversation room cleanup when conversation is deleted
- User connection tracking with proper cleanup

### Utility Functions:

```typescript
getUserSockets(userId); // Get all socket IDs for a user
getUserFromSocket(socketId); // Get user ID from socket ID
broadcastToUser(userId, event, data); // Broadcast to all user's sockets
broadcastToConversation(convId, event, data); // Broadcast to conversation
getConversationUsers(convId); // Get all users in conversation
isUserOnline(userId); // Check if user has active connections
```

## Technical Features

### **Type Safety**

- Complete TypeScript interfaces for all Socket.io events
- Typed server-to-client and client-to-server events
- Proper error handling with typed error responses

### **Error Handling**

- Comprehensive error handling for authentication failures
- Message processing errors with user feedback
- Connection error logging and recovery

### **Performance Optimizations**

- Efficient room-based messaging
- Minimal database queries per message
- Streaming responses for better perceived performance

### **Security Features**

- JWT token verification for all connections
- User authorization for conversation access
- Secure room isolation (users can only access their conversations)

## Usage Examples

### **Client Connection**

```javascript
const socket = io("http://localhost:3000", {
  auth: {
    token: "your-jwt-token",
  },
});
```

### **Sending a Message**

```javascript
socket.emit("message:send", {
  conversationId: "conv-id",
  content: "Hello AI!",
});
```

### **Receiving Streaming Response**

```javascript
socket.on("message:chunk", (data) => {
  console.log("AI chunk:", data.chunk);
  console.log("Full content so far:", data.content);
});

socket.on("message:complete", (data) => {
  console.log("Complete messages:", data.userMessage, data.assistantMessage);
});
```

### **Joining Conversation**

```javascript
socket.emit("join:conversation", "conversation-id");
```

## Environment Variables

Ensure these environment variables are set:

```
JWT_ACCESS_SECRET=your-jwt-secret
CORS_ORIGIN=http://localhost:5173
OPENAI_API_KEY=your-openai-key
```

## Next Steps for Frontend Integration

1. **Install socket.io-client** in frontend
2. **Create WebSocket service** wrapper
3. **Integrate with React hooks** for real-time updates
4. **Implement typing indicators** in UI
5. **Handle connection states** (connecting, connected, disconnected)
6. **Multi-tab synchronization** testing

## Testing Recommendations

1. **Multiple Browser Tabs** - Test conversation sync
2. **Network Disconnection** - Test reconnection logic
3. **Authentication** - Test with invalid/expired tokens
4. **Message Streaming** - Test long AI responses
5. **Typing Indicators** - Test with multiple users
6. **Room Management** - Test join/leave behavior

This WebSocket implementation provides a robust foundation for real-time communication in the AI Chatbot Assistant application.
