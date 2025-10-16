import { Server as SocketIOServer } from "socket.io";
import { verifyAccessToken } from "../utils/generateToken.js";
// Store user socket mappings for room management
const userSockets = new Map(); // userId -> Set<socketId>
const socketUsers = new Map(); // socketId -> userId
/**
 * Socket.io Authentication Middleware
 * Verifies JWT token and attaches user info to socket
 */
const socketAuthMiddleware = (socket, next) => {
    try {
        // Get token from auth header or query parameter
        const token = socket.handshake.auth?.token ||
            socket.handshake.headers?.authorization?.replace("Bearer ", "") ||
            socket.handshake.query?.token;
        if (!token) {
            return next(new Error("Authentication token required"));
        }
        // Verify JWT token
        const result = verifyAccessToken(token);
        if (!result.valid) {
            return next(new Error(`Authentication failed: ${result.error}`));
        }
        // Attach user info to socket
        socket.user = result.decoded;
        // Extract user ID from decoded token
        if (typeof result.decoded === "object" && result.decoded.id) {
            socket.userId = result.decoded.id;
        }
        else {
            return next(new Error("Invalid token: missing user ID"));
        }
        // authentication succeeded; no logging
        next();
    }
    catch (error) {
        const message = error instanceof Error ? error.message : "Authentication error";
        // authentication failed; no logging
        next(new Error(message));
    }
};
/**
 * Handle user connection management
 */
const handleUserConnection = (socket) => {
    const userId = socket.userId;
    // Add socket to user's socket set
    if (!userSockets.has(userId)) {
        userSockets.set(userId, new Set());
    }
    userSockets.get(userId).add(socket.id);
    socketUsers.set(socket.id, userId);
    // user connection handled
};
/**
 * Handle user disconnection cleanup
 */
const handleUserDisconnection = (socket) => {
    const userId = socket.userId;
    if (userId) {
        // Remove socket from user's socket set
        const userSocketSet = userSockets.get(userId);
        if (userSocketSet) {
            userSocketSet.delete(socket.id);
            if (userSocketSet.size === 0) {
                userSockets.delete(userId);
            }
        }
        socketUsers.delete(socket.id);
        // user disconnection handled
    }
};
/**
 * Get all socket IDs for a user (for broadcasting)
 */
export const getUserSockets = (userId) => {
    return Array.from(userSockets.get(userId) || []);
};
/**
 * Get user ID from socket ID
 */
export const getUserFromSocket = (socketId) => {
    return socketUsers.get(socketId);
};
/**
 * Broadcast message to all sockets of a specific user (across all tabs/devices)
 */
export const broadcastToUser = (userId, event, data) => {
    const sockets = getUserSockets(userId);
    sockets.forEach((socketId) => {
        const socket = io?.sockets.sockets.get(socketId);
        if (socket) {
            socket.emit(event, data);
        }
    });
};
/**
 * Broadcast message to all users in a conversation
 */
export const broadcastToConversation = (conversationId, event, data) => {
    if (io) {
        io.to(`conversation:${conversationId}`).emit(event, data);
    }
};
/**
 * Get all users currently connected to a conversation
 */
export const getConversationUsers = (conversationId) => {
    if (!io)
        return [];
    const room = io.sockets.adapter.rooms.get(`conversation:${conversationId}`);
    if (!room)
        return [];
    const users = new Set();
    room.forEach((socketId) => {
        const userId = getUserFromSocket(socketId);
        if (userId) {
            users.add(userId);
        }
    });
    return Array.from(users);
};
/**
 * Check if a user is currently connected (has any active sockets)
 */
export const isUserOnline = (userId) => {
    return userSockets.has(userId) && (userSockets.get(userId)?.size || 0) > 0;
};
/**
 * Get Socket.io server instance
 */
export const getSocketIOInstance = () => {
    return io || null;
};
// Store io instance for use in event handlers
let io;
/**
 * Initialize Socket.io server with authentication and event handlers
 */
export const initializeSocketIO = (httpServer) => {
    io = new SocketIOServer(httpServer, {
        cors: {
            origin: process.env.CORS_ORIGIN || "http://localhost:5173",
            credentials: true,
            methods: ["GET", "POST"],
        },
        // Connection options
        pingTimeout: 60000,
        pingInterval: 25000,
        transports: ["websocket", "polling"],
    });
    // Apply authentication middleware
    io.use(socketAuthMiddleware);
    // Handle socket connections
    io.on("connection", (socket) => {
        // connection established
        // Handle user connection
        handleUserConnection(socket);
        // Join user to their personal room (for user-specific broadcasts)
        if (socket.userId) {
            socket.join(`user:${socket.userId}`);
        }
        // Handle joining conversation rooms
        socket.on("join:conversation", (conversationId) => {
            if (!conversationId) {
                socket.emit("error", { message: "Conversation ID is required" });
                return;
            }
            socket.join(`conversation:${conversationId}`);
            // user joined conversation room
            // Notify user they joined the conversation
            socket.emit("conversation:joined", { conversationId });
        });
        // Handle leaving conversation rooms
        socket.on("leave:conversation", (conversationId) => {
            if (!conversationId) {
                socket.emit("error", { message: "Conversation ID is required" });
                return;
            }
            socket.leave(`conversation:${conversationId}`);
            // user left conversation room
            // Notify user they left the conversation
            socket.emit("conversation:left", { conversationId });
        });
        // Handle message sending with streaming AI response
        socket.on("message:send", async (data) => {
            try {
                const { conversationId, content, messageId } = data;
                if (!conversationId || !content) {
                    socket.emit("error", { message: "Conversation ID and content are required" });
                    return;
                }
                // incoming message received
                // Import message service dynamically to avoid circular imports
                const { sendMessageAndStreamResponse } = await import("./message.service.js");
                // Stream AI response and broadcast user message early via onUserMessageCreated
                let assistantContent = "";
                const result = await sendMessageAndStreamResponse(conversationId, socket.userId, content, 
                // onChunk callback - stream to client
                (chunk) => {
                    assistantContent += chunk;
                    // chunk received and will be broadcast
                    // Broadcast chunk to conversation room (all users in conversation)
                    io.to(`conversation:${conversationId}`).emit("message:chunk", {
                        conversationId,
                        chunk,
                        content: assistantContent, // send accumulated content
                        messageId,
                    });
                }, 
                // onUserMessageCreated - broadcast the persisted user message immediately so other tabs see it
                (userMessage) => {
                    try {
                        // Broadcast user message to other participants in the conversation (exclude sender socket)
                        socket.to(`conversation:${conversationId}`).emit("message:new", {
                            conversationId,
                            message: userMessage,
                            messageId,
                        });
                        // Also notify other sockets of the same user that are NOT in the conversation room.
                        // This avoids sending the same message twice to sockets that are already in the conversation room
                        // (those sockets have already received the event above).
                        try {
                            const room = io.sockets.adapter.rooms.get(`conversation:${conversationId}`);
                            const roomSockets = room ? new Set(Array.from(room)) : new Set();
                            // getUserSockets is available in this module and returns all socket ids for the user
                            const userSocketIds = getUserSockets(socket.userId);
                            for (const sid of userSocketIds) {
                                // skip sender socket and any sockets already in the conversation room
                                if (sid === socket.id)
                                    continue;
                                if (roomSockets.has(sid))
                                    continue;
                                const target = io.sockets.sockets.get(sid);
                                if (target) {
                                    target.emit("message:new", {
                                        conversationId,
                                        message: userMessage,
                                    });
                                }
                            }
                        }
                        catch (e) {
                            // ignore per-socket notify failures
                        }
                        // After other clients have been notified about the user's message, start AI typing
                        // for everyone in the conversation room (including the sender) so the typing indicator
                        // appears after the user message in other tabs.
                        io.to(`conversation:${conversationId}`).emit("ai:typing:start", {
                            conversationId,
                            messageId,
                        });
                    }
                    catch (err) {
                        // ignore
                    }
                });
                // Stop typing indicator for ALL users in conversation room (including sender) for sync
                io.to(`conversation:${conversationId}`).emit("ai:typing:stop", {
                    conversationId,
                    messageId,
                });
                // Broadcast complete messages to conversation room
                io.to(`conversation:${conversationId}`).emit("message:complete", {
                    userMessage: result.userMessage,
                    assistantMessage: result.assistantMessage,
                    conversation: result.conversation,
                    messageId,
                });
                // Broadcast conversation update to user room for multi-tab conversation list sync
                if (result.conversation) {
                    broadcastToUser(socket.userId, "conversation:activity", {
                        conversationId,
                        lastActivity: new Date().toISOString(),
                        messageCount: result.conversation.message_count,
                        totalTokens: result.conversation.total_tokens_used,
                    });
                }
            }
            catch { }
        });
        socket.on("typing:stop", (conversationId) => {
            if (!conversationId)
                return;
            // typing stop received
            // Broadcast typing stop to other users in the conversation
            socket.to(`conversation:${conversationId}`).emit("user:typing:stop", {
                userId: socket.userId,
                conversationId,
            });
        });
        // Handle disconnection
        socket.on("disconnect", (reason) => {
            // socket disconnected
            handleUserDisconnection(socket);
        });
        // Handle conversation updates (for real-time sync across tabs)
        socket.on("conversation:update", (data) => {
            const { conversationId, update } = data;
            if (!conversationId) {
                socket.emit("error", { message: "Conversation ID is required" });
                return;
            }
            // conversation update received
            // Broadcast update to ALL sockets of the same user (including sender) via user room for complete sync
            broadcastToUser(socket.userId, "conversation:updated", {
                conversationId,
                update,
            });
            // ALSO broadcast update to all participants in the conversation room
            try {
                io.to(`conversation:${conversationId}`).emit("conversation:updated", {
                    conversationId,
                    update,
                });
            }
            catch (e) {
                // ignore
            }
        });
        // Handle conversation creation (for real-time sync across tabs)
        socket.on("conversation:create", (conversation) => {
            if (!conversation) {
                socket.emit("error", { message: "Conversation data is required" });
                return;
            }
            // conversation creation received
            // Broadcast creation to ALL sockets of the same user (including sender) via user room for complete sync
            broadcastToUser(socket.userId, "conversation:created", conversation);
            // ALSO broadcast creation to the conversation room (if any sockets already joined)
            try {
                if (conversation?.id) {
                    io.to(`conversation:${conversation.id}`).emit("conversation:created", conversation);
                }
            }
            catch { }
        });
        // Handle conversation deletion (for real-time sync across tabs)
        socket.on("conversation:delete", (conversationId) => {
            if (!conversationId) {
                socket.emit("error", { message: "Conversation ID is required" });
                return;
            }
            // conversation deletion requested
            // Broadcast deletion to ALL sockets of the same user (including sender) via user room for complete sync
            broadcastToUser(socket.userId, "conversation:deleted", { conversationId });
            // ALSO broadcast deletion to the conversation room (all participants)
            try {
                io.to(`conversation:${conversationId}`).emit("conversation:deleted", { conversationId });
            }
            catch { }
            // Remove all sockets from the conversation room
            // removing sockets from conversation room
            io.in(`conversation:${conversationId}`).socketsLeave(`conversation:${conversationId}`);
            // conversation room cleared
        });
        // Handle ping/pong for connection health
        socket.on("ping", () => {
            socket.emit("pong");
        });
        // Handle connection errors
        socket.on("error", ( /* error */) => {
            // socket error event
        });
    });
    return io;
};
export default initializeSocketIO;
