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
        next();
    }
    catch (error) {
        const message = error instanceof Error ? error.message : "Authentication error";
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
    console.log(`User ${userId} connected with socket ${socket.id}`);
    console.log(`Total sockets for user ${userId}: ${userSockets.get(userId)?.size}`);
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
        console.log(`User ${userId} disconnected with socket ${socket.id}`);
        console.log(`Remaining sockets for user ${userId}: ${userSocketSet?.size || 0}`);
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
        console.log(`Socket connected: ${socket.id}`);
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
            console.log(`Socket ${socket.id} joined conversation ${conversationId}`);
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
            console.log(`Socket ${socket.id} left conversation ${conversationId}`);
            // Notify user they left the conversation
            socket.emit("conversation:left", { conversationId });
        });
        // Handle message sending with streaming AI response
        socket.on("message:send", async (data) => {
            try {
                const { conversationId, content } = data;
                if (!conversationId || !content) {
                    socket.emit("error", { message: "Conversation ID and content are required" });
                    return;
                }
                console.log(`Message received from ${socket.id} for conversation ${conversationId}`);
                // Import message service dynamically to avoid circular imports
                const { sendMessageAndStreamResponse } = await import("./message.service.js");
                // Emit typing indicator to show AI is processing
                socket.to(`conversation:${conversationId}`).emit("ai:typing:start", {
                    conversationId,
                });
                // Stream AI response
                let assistantContent = "";
                const result = await sendMessageAndStreamResponse(conversationId, socket.userId, content, 
                // onChunk callback - stream to client
                (chunk) => {
                    assistantContent += chunk;
                    console.log(`[Socket Service] Broadcasting chunk: "${chunk}" to conversation ${conversationId}`);
                    // Broadcast chunk to conversation room (all users in conversation)
                    io.to(`conversation:${conversationId}`).emit("message:chunk", {
                        conversationId,
                        chunk,
                        content: assistantContent, // send accumulated content
                    });
                });
                // Stop typing indicator
                socket.to(`conversation:${conversationId}`).emit("ai:typing:stop", {
                    conversationId,
                });
                // Broadcast complete messages to conversation room
                io.to(`conversation:${conversationId}`).emit("message:complete", {
                    userMessage: result.userMessage,
                    assistantMessage: result.assistantMessage,
                    conversation: result.conversation,
                });
                console.log(`Message processed for conversation ${conversationId}`);
            }
            catch (error) {
                console.error(`Error processing message from ${socket.id}:`, error);
                const errorMessage = error instanceof Error ? error.message : "Failed to process message";
                socket.emit("error", {
                    message: errorMessage,
                    type: "message_error",
                });
                // Stop typing indicator on error
                if (data.conversationId) {
                    socket.to(`conversation:${data.conversationId}`).emit("ai:typing:stop", {
                        conversationId: data.conversationId,
                    });
                }
            }
        });
        // Handle typing indicators
        socket.on("typing:start", (conversationId) => {
            if (!conversationId)
                return;
            // Broadcast typing start to other users in the conversation
            socket.to(`conversation:${conversationId}`).emit("user:typing:start", {
                userId: socket.userId,
                conversationId,
            });
        });
        socket.on("typing:stop", (conversationId) => {
            if (!conversationId)
                return;
            // Broadcast typing stop to other users in the conversation
            socket.to(`conversation:${conversationId}`).emit("user:typing:stop", {
                userId: socket.userId,
                conversationId,
            });
        });
        // Handle disconnection
        socket.on("disconnect", (reason) => {
            console.log(`Socket ${socket.id} disconnected: ${reason}`);
            handleUserDisconnection(socket);
        });
        // Handle conversation updates (for real-time sync across tabs)
        socket.on("conversation:update", (data) => {
            const { conversationId, update } = data;
            if (!conversationId) {
                socket.emit("error", { message: "Conversation ID is required" });
                return;
            }
            // Broadcast update to all user's sockets
            getUserSockets(socket.userId).forEach((socketId) => {
                if (io.sockets.sockets.get(socketId) && socketId !== socket.id) {
                    io.to(socketId).emit("conversation:updated", {
                        conversationId,
                        update,
                    });
                }
            });
        });
        // Handle conversation creation (for real-time sync across tabs)
        socket.on("conversation:create", (conversation) => {
            if (!conversation) {
                socket.emit("error", { message: "Conversation data is required" });
                return;
            }
            // Broadcast new conversation to all user's other sockets
            getUserSockets(socket.userId).forEach((socketId) => {
                if (io.sockets.sockets.get(socketId) && socketId !== socket.id) {
                    io.to(socketId).emit("conversation:created", conversation);
                }
            });
        });
        // Handle conversation deletion (for real-time sync across tabs)
        socket.on("conversation:delete", (conversationId) => {
            if (!conversationId) {
                socket.emit("error", { message: "Conversation ID is required" });
                return;
            }
            // Broadcast deletion to all user's sockets
            getUserSockets(socket.userId).forEach((socketId) => {
                if (io.sockets.sockets.get(socketId)) {
                    io.to(socketId).emit("conversation:deleted", { conversationId });
                }
            });
            // Remove all sockets from the conversation room
            io.in(`conversation:${conversationId}`).socketsLeave(`conversation:${conversationId}`);
        });
        // Handle ping/pong for connection health
        socket.on("ping", () => {
            socket.emit("pong");
        });
        // Handle connection errors
        socket.on("error", (error) => {
            console.error(`Socket ${socket.id} error:`, error);
        });
    });
    return io;
};
export default initializeSocketIO;
