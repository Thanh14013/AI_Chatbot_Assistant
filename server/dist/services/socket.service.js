import { Server as SocketIOServer } from "socket.io";
import { createAdapter } from "@socket.io/redis-adapter";
import { verifyAccessToken } from "../utils/generateToken.js";
import redisClient, { isRedisConnected } from "../config/redis.config.js";
import { logInfo, logWarn } from "../utils/logger.util.js";
const userSockets = new Map();
const socketUsers = new Map();
const socketViewingConversation = new Map();
const socketUnreadConversations = new Map();
const messageCompleteDebouncer = new Map();
setInterval(() => {
    const now = Date.now();
    const threshold = 5 * 60 * 1000;
    for (const [key, timestamp] of messageCompleteDebouncer.entries()) {
        if (now - timestamp > threshold) {
            messageCompleteDebouncer.delete(key);
        }
    }
}, 60000);
const socketAuthMiddleware = (socket, next) => {
    try {
        const token = socket.handshake.auth?.token ||
            socket.handshake.headers?.authorization?.replace("Bearer ", "") ||
            socket.handshake.query?.token;
        if (!token) {
            return next(new Error("Authentication token required"));
        }
        const result = verifyAccessToken(token);
        if (!result.valid) {
            return next(new Error(`Authentication failed: ${result.error}`));
        }
        socket.user = result.decoded;
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
const handleUserConnection = (socket) => {
    const userId = socket.userId;
    if (!userSockets.has(userId)) {
        userSockets.set(userId, new Set());
    }
    userSockets.get(userId).add(socket.id);
    socketUsers.set(socket.id, userId);
    if (!socketUnreadConversations.has(socket.id)) {
        socketUnreadConversations.set(socket.id, new Set());
    }
};
const handleUserDisconnection = (socket) => {
    const userId = socket.userId;
    if (userId) {
        const userSocketSet = userSockets.get(userId);
        if (userSocketSet) {
            userSocketSet.delete(socket.id);
            if (userSocketSet.size === 0) {
                userSockets.delete(userId);
            }
        }
        socketUsers.delete(socket.id);
        socketViewingConversation.delete(socket.id);
        socketUnreadConversations.delete(socket.id);
        const rooms = Array.from(socket.rooms);
        rooms.forEach((room) => {
            if (room !== socket.id) {
                socket.leave(room);
            }
        });
    }
};
export const getUserSockets = (userId) => {
    return Array.from(userSockets.get(userId) || []);
};
export const getUserFromSocket = (socketId) => {
    return socketUsers.get(socketId);
};
export const markConversationAsRead = (socketId, conversationId) => {
    socketViewingConversation.set(socketId, conversationId);
    const unreadSet = socketUnreadConversations.get(socketId);
    if (unreadSet) {
        unreadSet.delete(conversationId);
    }
};
export const markConversationAsUnread = (socketId, conversationId) => {
    const viewing = socketViewingConversation.get(socketId);
    if (viewing === conversationId) {
        return;
    }
    let unreadSet = socketUnreadConversations.get(socketId);
    if (!unreadSet) {
        unreadSet = new Set();
        socketUnreadConversations.set(socketId, unreadSet);
    }
    unreadSet.add(conversationId);
};
export const getUnreadConversations = (socketId) => {
    const unreadSet = socketUnreadConversations.get(socketId);
    return unreadSet ? Array.from(unreadSet) : [];
};
export const broadcastUnreadStatus = (userId, conversationId, hasUnread, targetSocketId) => {
    const sockets = getUserSockets(userId);
    sockets.forEach((socketId) => {
        const socket = io?.sockets.sockets.get(socketId);
        if (socket) {
            socket.emit("conversation:unread_status", {
                conversationId,
                hasUnread,
                socketId: targetSocketId,
            });
        }
    });
};
export const leaveConversationView = (socketId) => {
    socketViewingConversation.set(socketId, null);
};
export const broadcastToUser = (userId, event, data, excludeSocketId) => {
    const sockets = getUserSockets(userId);
    sockets.forEach((socketId) => {
        if (excludeSocketId && socketId === excludeSocketId) {
            return;
        }
        const socket = io?.sockets.sockets.get(socketId);
        if (socket) {
            socket.emit(event, data);
        }
    });
};
export const broadcastToConversation = (conversationId, event, data) => {
    if (io) {
        io.to(`conversation:${conversationId}`).emit(event, data);
    }
};
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
export const isUserOnline = (userId) => {
    return userSockets.has(userId) && (userSockets.get(userId)?.size || 0) > 0;
};
export const getSocketIOInstance = () => {
    return io || null;
};
let io;
export const initializeSocketIO = (httpServer) => {
    io = new SocketIOServer(httpServer, {
        cors: {
            origin: process.env.CORS_ORIGINS
                ? process.env.CORS_ORIGINS.split(",").map((o) => o.trim())
                : ["http://localhost:5173"],
            credentials: true,
            methods: ["GET", "POST"],
        },
        pingTimeout: 60000,
        pingInterval: 25000,
        transports: ["websocket", "polling"],
    });
    if (isRedisConnected()) {
        try {
            const pubClient = redisClient.duplicate();
            const subClient = redisClient.duplicate();
            Promise.all([pubClient.connect(), subClient.connect()])
                .then(() => {
                io.adapter(createAdapter(pubClient, subClient));
                logInfo("Socket.IO Redis Adapter initialized - horizontal scaling enabled");
            })
                .catch((error) => {
                logWarn("Failed to initialize Socket.IO Redis Adapter - running in single-server mode", {
                    error,
                });
            });
        }
        catch (error) {
            logWarn("Failed to setup Socket.IO Redis Adapter - running in single-server mode", {
                error,
            });
        }
    }
    else {
        logWarn("Redis not available - Socket.IO running without adapter (single-server only)");
    }
    io.use(socketAuthMiddleware);
    io.on("connection", (socket) => {
        handleUserConnection(socket);
        if (socket.userId) {
            socket.join(`user:${socket.userId}`);
            socket.join(`session:${socket.userId}`);
        }
        socket.on("join:conversation", (conversationId) => {
            if (!conversationId) {
                socket.emit("error", { message: "Conversation ID is required" });
                return;
            }
            socket.join(`conversation:${conversationId}`);
            socket.emit("conversation:joined", { conversationId });
        });
        socket.on("leave:conversation", (conversationId) => {
            if (!conversationId) {
                socket.emit("error", { message: "Conversation ID is required" });
                return;
            }
            socket.leave(`conversation:${conversationId}`);
            socket.emit("conversation:left", { conversationId });
        });
        socket.on("message:send", async (data) => {
            try {
                const { conversationId, content, messageId, attachments } = data;
                if (!conversationId || !content) {
                    socket.emit("error", { message: "Conversation ID and content are required" });
                    return;
                }
                const { sendMessageAndStreamResponse } = await import("./message.service.js");
                const { buildMemoryEnhancedPrompt, analyzeAndUpdateMemory, isLTMEnabled } = await import("./memory.service.js");
                let enrichedAttachments;
                if (attachments && attachments.length > 0) {
                    try {
                        const FileUploadModel = (await import("../models/fileUpload.model.js")).default;
                        const publicIds = attachments.map((att) => att.public_id);
                        enrichedAttachments = [];
                        for (const publicId of publicIds) {
                            const fileData = await FileUploadModel.findByPublicId(publicId);
                            if (fileData) {
                                enrichedAttachments.push({
                                    public_id: fileData.public_id,
                                    secure_url: fileData.secure_url,
                                    resource_type: fileData.resource_type,
                                    format: fileData.format,
                                    extracted_text: fileData.extracted_text,
                                    openai_file_id: fileData.openai_file_id,
                                });
                            }
                        }
                    }
                    catch (err) {
                        enrichedAttachments = attachments;
                    }
                }
                let assistantContent = "";
                try {
                    let enhancedSystemPrompt;
                    if (isLTMEnabled()) {
                        try {
                            const basePrompt = "You are a helpful AI assistant. Provide clear, accurate, and helpful responses.";
                            enhancedSystemPrompt = await buildMemoryEnhancedPrompt(socket.userId, content, basePrompt);
                        }
                        catch (memError) {
                            enhancedSystemPrompt = undefined;
                        }
                    }
                    const result = await sendMessageAndStreamResponse(conversationId, socket.userId, content, (chunk) => {
                        assistantContent += chunk;
                        io.to(`conversation:${conversationId}`).emit("message:chunk", {
                            conversationId,
                            chunk,
                            content: assistantContent,
                            messageId,
                        });
                    }, (userMessage) => {
                        try {
                            socket.to(`conversation:${conversationId}`).emit("message:new", {
                                conversationId,
                                message: userMessage,
                                messageId,
                            });
                            try {
                                const room = io.sockets.adapter.rooms.get(`conversation:${conversationId}`);
                                const roomSockets = room ? new Set(Array.from(room)) : new Set();
                                const userSocketIds = getUserSockets(socket.userId);
                                for (const sid of userSocketIds) {
                                    if (sid === socket.id) {
                                        continue;
                                    }
                                    if (roomSockets.has(sid)) {
                                        continue;
                                    }
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
                            }
                            io.to(`conversation:${conversationId}`).emit("ai:typing:start", {
                                conversationId,
                                messageId,
                            });
                            if (socket.userId) {
                                const userSocketIds = getUserSockets(socket.userId);
                                userSocketIds.forEach((sid) => {
                                    const viewingConv = socketViewingConversation.get(sid);
                                    if (viewingConv === conversationId) {
                                        return;
                                    }
                                    markConversationAsUnread(sid, conversationId);
                                    const targetSocket = io.sockets.sockets.get(sid);
                                    if (targetSocket) {
                                        targetSocket.emit("conversation:unread_status", {
                                            conversationId,
                                            hasUnread: true,
                                            socketId: socket.id,
                                        });
                                    }
                                });
                            }
                        }
                        catch (err) {
                        }
                    }, enrichedAttachments, undefined, enhancedSystemPrompt);
                    if (isLTMEnabled() && result.assistantMessage) {
                        analyzeAndUpdateMemory(socket.userId, conversationId, content, result.assistantMessage.content).catch((err) => {
                        });
                    }
                    socket.to(`conversation:${conversationId}`).emit("message:complete", {
                        userMessage: result.userMessage,
                        assistantMessage: result.assistantMessage,
                        conversation: result.conversation,
                        messageId,
                    });
                    socket.emit("message:complete", {
                        userMessage: result.userMessage,
                        assistantMessage: result.assistantMessage,
                        conversation: result.conversation,
                        messageId,
                    });
                    try {
                        const room = io.sockets.adapter.rooms.get(`conversation:${conversationId}`);
                        const roomSockets = room ? new Set(Array.from(room)) : new Set();
                        const userSocketIds = getUserSockets(socket.userId);
                        for (const sid of userSocketIds) {
                            if (sid === socket.id) {
                                continue;
                            }
                            if (roomSockets.has(sid)) {
                                continue;
                            }
                            const target = io.sockets.sockets.get(sid);
                            if (target) {
                                target.emit("message:complete", {
                                    userMessage: result.userMessage,
                                    assistantMessage: result.assistantMessage,
                                    conversation: result.conversation,
                                    messageId,
                                });
                            }
                        }
                    }
                    catch (e) {
                    }
                    if (result.conversation) {
                        broadcastToUser(socket.userId, "conversation:activity", {
                            conversationId,
                            lastActivity: new Date().toISOString(),
                            messageCount: result.conversation.message_count,
                            totalTokens: result.conversation.total_tokens_used,
                        });
                    }
                    if (result.conversation) {
                        const currentTitle = result.conversation.title || "";
                        const trimmedTitle = currentTitle.trim();
                        const messageCount = result.conversation.message_count;
                        const isDefaultTitle = trimmedTitle === "" ||
                            trimmedTitle === "New Chat" ||
                            trimmedTitle === "New Conversation";
                        const shouldAutoTitle = messageCount === 2 && isDefaultTitle;
                        if (shouldAutoTitle) {
                            setImmediate(async () => {
                                try {
                                    const { generateConversationTitle, updateConversation } = await import("./conversation.service.js");
                                    const smartTitle = await generateConversationTitle(content, assistantContent || result.assistantMessage?.content || "");
                                    if (smartTitle && smartTitle.trim() !== "") {
                                        await updateConversation(conversationId, socket.userId, {
                                            title: smartTitle,
                                        });
                                        broadcastToUser(socket.userId, "conversation:updated", {
                                            conversationId,
                                            update: { title: smartTitle },
                                        });
                                        if (process.env.NODE_ENV !== "production") {
                                            console.log("[Auto-title] ✅ Title updated and broadcast:", {
                                                conversationId,
                                                title: smartTitle,
                                                userId: socket.userId,
                                            });
                                        }
                                    }
                                }
                                catch (err) {
                                    console.error("[Auto-title] Failed to generate title:", err);
                                }
                            });
                        }
                    }
                }
                catch (streamErr) {
                    io.to(`conversation:${conversationId}`).emit("error", {
                        message: streamErr.message || "Streaming failed",
                        conversationId,
                        messageId,
                        timestamp: new Date().toISOString(),
                    });
                }
                finally {
                    io.to(`conversation:${conversationId}`).emit("ai:typing:stop", {
                        conversationId,
                        messageId,
                    });
                }
            }
            catch (error) {
            }
        });
        socket.on("typing:stop", (conversationId) => {
            if (!conversationId)
                return;
            socket.to(`conversation:${conversationId}`).emit("user:typing:stop", {
                userId: socket.userId,
                conversationId,
            });
        });
        socket.on("request_followups", async (data) => {
            try {
                const { sessionId, messageId, lastUserMessage, lastBotMessage } = data;
                if (!sessionId || !messageId || !lastBotMessage) {
                    socket.emit("followups_error", {
                        messageId: messageId || "",
                        error: "Session ID, message ID, and bot message are required",
                    });
                    return;
                }
                if (!lastUserMessage || lastUserMessage.trim().length === 0) {
                    socket.emit("followups_error", {
                        messageId: messageId || "",
                        error: "User message context is required for generating follow-up suggestions",
                    });
                    return;
                }
                const { generateFollowupSuggestions } = await import("./followup.service.js");
                const suggestions = await generateFollowupSuggestions(lastUserMessage, lastBotMessage);
                io.to(`session:${sessionId}`).emit("followups_response", {
                    messageId,
                    suggestions,
                });
            }
            catch (error) {
                const messageId = data?.messageId || "";
                const sessionId = data?.sessionId || "";
                if (sessionId) {
                    io.to(`session:${sessionId}`).emit("followups_error", {
                        messageId,
                        error: error?.message || "Failed to generate suggestions",
                    });
                }
                else {
                    socket.emit("followups_error", {
                        messageId,
                        error: error?.message || "Failed to generate suggestions",
                    });
                }
            }
        });
        socket.on("request_conversation_followups", async (data) => {
            try {
                const { sessionId, conversationId, messages, forceRegenerate } = data;
                if (!sessionId || !conversationId) {
                    socket.emit("conversation_followups_error", {
                        conversationId: conversationId || "",
                        error: "Session ID and conversation ID are required",
                    });
                    return;
                }
                if (conversationId === "new_chat_suggestions") {
                    const { getNewChatSuggestions } = await import("./new-chat-suggestions.service.js");
                    const userId = socket.userId;
                    if (!userId) {
                        socket.emit("conversation_followups_error", {
                            conversationId,
                            error: "User ID is required",
                        });
                        return;
                    }
                    const suggestions = await getNewChatSuggestions(userId, forceRegenerate || false);
                    io.to(`session:${sessionId}`).emit("conversation_followups_response", {
                        conversationId,
                        suggestions,
                    });
                    return;
                }
                if (!messages || !Array.isArray(messages) || messages.length === 0) {
                    socket.emit("conversation_followups_error", {
                        conversationId,
                        error: "At least one message is required for context",
                    });
                    return;
                }
                const { generateConversationFollowups } = await import("./followup.service.js");
                const suggestions = await generateConversationFollowups(messages);
                io.to(`session:${sessionId}`).emit("conversation_followups_response", {
                    conversationId,
                    suggestions,
                });
            }
            catch (error) {
                const conversationId = data?.conversationId || "";
                const sessionId = data?.sessionId || "";
                if (sessionId) {
                    io.to(`session:${sessionId}`).emit("conversation_followups_error", {
                        conversationId,
                        error: error?.message || "Failed to generate conversation suggestions",
                    });
                }
                else {
                    socket.emit("conversation_followups_error", {
                        conversationId,
                        error: error?.message || "Failed to generate conversation suggestions",
                    });
                }
            }
        });
        socket.on("disconnect", (reason) => {
            handleUserDisconnection(socket);
        });
        socket.on("conversation:update", (data) => {
            const { conversationId, update } = data;
            if (!conversationId) {
                socket.emit("error", { message: "Conversation ID is required" });
                return;
            }
            broadcastToUser(socket.userId, "conversation:updated", {
                conversationId,
                update,
            }, socket.id);
            try {
                socket.broadcast.to(`conversation:${conversationId}`).emit("conversation:updated", {
                    conversationId,
                    update,
                });
            }
            catch (e) {
            }
        });
        socket.on("conversation:create", (conversation) => {
            if (!conversation) {
                socket.emit("error", { message: "Conversation data is required" });
                return;
            }
            broadcastToUser(socket.userId, "conversation:created", conversation, socket.id);
            try {
                if (conversation?.id) {
                    socket.broadcast
                        .to(`conversation:${conversation.id}`)
                        .emit("conversation:created", conversation);
                }
            }
            catch (error) {
            }
        });
        socket.on("conversation:delete", (conversationId) => {
            if (!conversationId) {
                socket.emit("error", { message: "Conversation ID is required" });
                return;
            }
            broadcastToUser(socket.userId, "conversation:deleted", { conversationId }, socket.id);
            try {
                socket.broadcast
                    .to(`conversation:${conversationId}`)
                    .emit("conversation:deleted", { conversationId });
            }
            catch (error) {
            }
            io.in(`conversation:${conversationId}`).socketsLeave(`conversation:${conversationId}`);
        });
        socket.on("conversation:view", (data) => {
            const { conversationId } = data;
            if (!conversationId) {
                socket.emit("error", { message: "Conversation ID is required" });
                return;
            }
            markConversationAsRead(socket.id, conversationId);
            if (socket.userId) {
                const userSocketIds = getUserSockets(socket.userId);
                userSocketIds.forEach((sid) => {
                    const targetSocket = io.sockets.sockets.get(sid);
                    if (targetSocket) {
                        targetSocket.emit("conversation:unread_status", {
                            conversationId,
                            hasUnread: false,
                            socketId: socket.id,
                        });
                    }
                });
            }
        });
        socket.on("conversation:leave_view", (data) => {
            const { conversationId } = data;
            if (!conversationId) {
                socket.emit("error", { message: "Conversation ID is required" });
                return;
            }
            leaveConversationView(socket.id);
        });
        socket.on("ping", () => {
            socket.emit("pong");
        });
        socket.on("error", () => {
        });
    });
    return io;
};
export default initializeSocketIO;
