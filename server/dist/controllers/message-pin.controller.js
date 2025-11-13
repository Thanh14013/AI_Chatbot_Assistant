import User from "../models/user.model.js";
import Message from "../models/message.model.js";
import Conversation from "../models/conversation.model.js";
import { getSocketIOInstance } from "../services/socket.service.js";
import { invalidateCachePattern } from "../services/cache.service.js";
import { messageHistoryPattern } from "../utils/cache-key.util.js";
const getUserIdFromRequest = async (req) => {
    const userEmail = req.body?.user?.email;
    if (!userEmail)
        return null;
    const user = await User.findByEmail(userEmail);
    return user ? user.id : null;
};
export const pinMessage = async (req, res) => {
    try {
        const userId = await getUserIdFromRequest(req);
        if (!userId) {
            res.status(401).json({
                success: false,
                message: "Authentication required",
            });
            return;
        }
        const messageId = req.params.messageId;
        if (!messageId) {
            res.status(400).json({
                success: false,
                message: "Message ID is required",
            });
            return;
        }
        const message = await Message.findByPk(messageId);
        if (!message) {
            res.status(404).json({
                success: false,
                message: "Message not found",
            });
            return;
        }
        const conversation = await Conversation.findByPk(message.conversation_id);
        if (!conversation) {
            res.status(404).json({
                success: false,
                message: "Conversation not found",
            });
            return;
        }
        if (conversation.user_id !== userId) {
            res.status(403).json({
                success: false,
                message: "Unauthorized: You can only pin messages in your own conversations",
            });
            return;
        }
        if (message.pinned) {
            res.status(200).json({
                success: true,
                message: "Message is already pinned",
                data: {
                    id: message.id,
                    pinned: message.pinned,
                },
            });
            return;
        }
        const pinnedCount = await Message.countPinnedByConversation(message.conversation_id);
        if (pinnedCount >= 10) {
            res.status(400).json({
                success: false,
                message: "Maximum number of pinned messages reached (10). Please unpin a message first.",
            });
            return;
        }
        const updatedMessage = await Message.pinMessage(messageId);
        try {
            await invalidateCachePattern(messageHistoryPattern(message.conversation_id));
        }
        catch (cacheError) {
        }
        try {
            const io = getSocketIOInstance();
            if (!io) {
            }
            else {
                const roomName = `conversation:${message.conversation_id}`;
                const senderSocketId = req.headers["x-socket-id"];
                if (senderSocketId) {
                    const senderSocket = io.sockets.sockets.get(senderSocketId);
                    if (senderSocket) {
                        senderSocket.broadcast.to(roomName).emit("message:pinned", {
                            conversationId: message.conversation_id,
                            messageId: updatedMessage.id,
                            message: {
                                id: updatedMessage.id,
                                conversation_id: updatedMessage.conversation_id,
                                role: updatedMessage.role,
                                content: updatedMessage.content,
                                tokens_used: updatedMessage.tokens_used,
                                model: updatedMessage.model,
                                pinned: updatedMessage.pinned,
                                createdAt: updatedMessage.createdAt,
                            },
                        });
                    }
                    else {
                        io.to(roomName).emit("message:pinned", {
                            conversationId: message.conversation_id,
                            messageId: updatedMessage.id,
                            message: {
                                id: updatedMessage.id,
                                conversation_id: updatedMessage.conversation_id,
                                role: updatedMessage.role,
                                content: updatedMessage.content,
                                tokens_used: updatedMessage.tokens_used,
                                model: updatedMessage.model,
                                pinned: updatedMessage.pinned,
                                createdAt: updatedMessage.createdAt,
                            },
                        });
                    }
                }
                else {
                    io.to(roomName).emit("message:pinned", {
                        conversationId: message.conversation_id,
                        messageId: updatedMessage.id,
                        message: {
                            id: updatedMessage.id,
                            conversation_id: updatedMessage.conversation_id,
                            role: updatedMessage.role,
                            content: updatedMessage.content,
                            tokens_used: updatedMessage.tokens_used,
                            model: updatedMessage.model,
                            pinned: updatedMessage.pinned,
                            createdAt: updatedMessage.createdAt,
                        },
                    });
                }
            }
        }
        catch (socketError) {
        }
        res.status(200).json({
            success: true,
            message: "Message pinned successfully",
            data: {
                id: updatedMessage.id,
                pinned: updatedMessage.pinned,
            },
        });
    }
    catch (error) {
        const errorMessage = error instanceof Error ? error.message : "Failed to pin message";
        res.status(500).json({
            success: false,
            message: "Internal server error",
            error: errorMessage,
        });
    }
};
export const unpinMessage = async (req, res) => {
    try {
        const userId = await getUserIdFromRequest(req);
        if (!userId) {
            res.status(401).json({
                success: false,
                message: "Authentication required",
            });
            return;
        }
        const messageId = req.params.messageId;
        if (!messageId) {
            res.status(400).json({
                success: false,
                message: "Message ID is required",
            });
            return;
        }
        const message = await Message.findByPk(messageId);
        if (!message) {
            res.status(404).json({
                success: false,
                message: "Message not found",
            });
            return;
        }
        const conversation = await Conversation.findByPk(message.conversation_id);
        if (!conversation) {
            res.status(404).json({
                success: false,
                message: "Conversation not found",
            });
            return;
        }
        if (conversation.user_id !== userId) {
            res.status(403).json({
                success: false,
                message: "Unauthorized: You can only unpin messages in your own conversations",
            });
            return;
        }
        if (!message.pinned) {
            res.status(200).json({
                success: true,
                message: "Message is not pinned",
                data: {
                    id: message.id,
                    pinned: message.pinned,
                },
            });
            return;
        }
        const updatedMessage = await Message.unpinMessage(messageId);
        try {
            await invalidateCachePattern(messageHistoryPattern(message.conversation_id));
        }
        catch (cacheError) {
        }
        try {
            const io = getSocketIOInstance();
            if (!io) {
            }
            else {
                const roomName = `conversation:${message.conversation_id}`;
                const senderSocketId = req.headers["x-socket-id"];
                if (senderSocketId) {
                    const senderSocket = io.sockets.sockets.get(senderSocketId);
                    if (senderSocket) {
                        senderSocket.broadcast.to(roomName).emit("message:unpinned", {
                            conversationId: message.conversation_id,
                            messageId: updatedMessage.id,
                        });
                    }
                    else {
                        io.to(roomName).emit("message:unpinned", {
                            conversationId: message.conversation_id,
                            messageId: updatedMessage.id,
                        });
                    }
                }
                else {
                    io.to(roomName).emit("message:unpinned", {
                        conversationId: message.conversation_id,
                        messageId: updatedMessage.id,
                    });
                }
            }
        }
        catch (socketError) {
        }
        res.status(200).json({
            success: true,
            message: "Message unpinned successfully",
            data: {
                id: updatedMessage.id,
                pinned: updatedMessage.pinned,
            },
        });
    }
    catch (error) {
        const errorMessage = error instanceof Error ? error.message : "Failed to unpin message";
        res.status(500).json({
            success: false,
            message: "Internal server error",
            error: errorMessage,
        });
    }
};
export const getPinnedMessages = async (req, res) => {
    try {
        const userId = await getUserIdFromRequest(req);
        if (!userId) {
            res.status(401).json({
                success: false,
                message: "Authentication required",
            });
            return;
        }
        const conversationId = req.params.id;
        if (!conversationId) {
            res.status(400).json({
                success: false,
                message: "Conversation ID is required",
            });
            return;
        }
        const conversation = await Conversation.findByPk(conversationId);
        if (!conversation) {
            res.status(404).json({
                success: false,
                message: "Conversation not found",
            });
            return;
        }
        if (conversation.user_id !== userId) {
            res.status(403).json({
                success: false,
                message: "Unauthorized: You can only view pinned messages in your own conversations",
            });
            return;
        }
        const pinnedMessages = await Message.findPinnedMessages(conversationId);
        res.status(200).json({
            success: true,
            messages: pinnedMessages,
            count: pinnedMessages.length,
        });
    }
    catch (error) {
        const errorMessage = error instanceof Error ? error.message : "Failed to get pinned messages";
        res.status(500).json({
            success: false,
            message: "Internal server error",
            error: errorMessage,
        });
    }
};
