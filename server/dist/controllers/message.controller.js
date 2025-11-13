import { getConversationMessages, sendMessageAndStreamResponse, deleteMessage, } from "../services/message.service.js";
import User from "../models/user.model.js";
const getUserIdFromRequest = async (req) => {
    const userEmail = req.body?.user?.email;
    if (!userEmail)
        return null;
    const user = await User.findByEmail(userEmail);
    return user ? user.id : null;
};
export const getMessages = async (req, res) => {
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
        let page = parseInt(req.query.page) || 1;
        let limit = parseInt(req.query.limit) || 30;
        const before = req.query.before;
        page = Math.max(1, page);
        limit = Math.max(1, Math.min(100, limit));
        const result = await getConversationMessages(conversationId, userId, page, limit, before);
        res.status(200).json({
            success: true,
            message: "Messages retrieved successfully",
            data: result.messages,
            pagination: result.pagination,
        });
    }
    catch (error) {
        const errorMessage = error instanceof Error ? error.message : "Failed to get messages";
        if (errorMessage.includes("not found")) {
            res.status(404).json({
                success: false,
                message: errorMessage,
            });
            return;
        }
        if (errorMessage.includes("Unauthorized")) {
            res.status(403).json({
                success: false,
                message: errorMessage,
            });
            return;
        }
        res.status(500).json({
            success: false,
            message: "Internal server error",
            error: errorMessage,
        });
    }
};
export const sendMessage = async (req, res) => {
    res
        .status(410)
        .json({ success: false, message: "Deprecated: use streaming endpoint /messages/stream" });
};
export const sendMessageStream = async (req, res) => {
    try {
        const userId = await getUserIdFromRequest(req);
        if (!userId) {
            res.status(401).json({ success: false, message: "Authentication required" });
            return;
        }
        const conversationId = req.params.id;
        if (!conversationId) {
            res.status(400).json({ success: false, message: "Conversation ID is required" });
            return;
        }
        const { content, attachments, metadata } = req.body;
        if (!content || typeof content !== "string" || content.trim().length === 0) {
            res.status(400).json({ success: false, message: "Message content is required" });
            return;
        }
        if (attachments && !Array.isArray(attachments)) {
            res.status(400).json({ success: false, message: "Attachments must be an array" });
            return;
        }
        res.setHeader("Content-Type", "text/event-stream");
        res.setHeader("Cache-Control", "no-cache");
        res.setHeader("Connection", "keep-alive");
        res.flushHeaders?.();
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
        await sendMessageAndStreamResponse(conversationId, userId, content, async (chunk) => {
            res.write(`data: ${JSON.stringify({ type: "chunk", text: chunk })}\n\n`);
        }, undefined, enrichedAttachments, metadata)
            .then((result) => {
            const doneEvent = { type: "done", ...result };
            res.write(`data: ${JSON.stringify(doneEvent)}\n\n`);
            res.end();
        })
            .catch((err) => {
            res.write(`data: ${JSON.stringify({ type: "error", message: err.message || String(err) })}\n\n`);
            res.end();
        });
    }
    catch (error) {
        const message = error?.message || "Failed to stream message";
        res.status(500).json({ success: false, message });
    }
};
export const remove = async (req, res) => {
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
        const result = await deleteMessage(messageId, userId);
        res.status(200).json({
            success: true,
            message: result.message,
        });
    }
    catch (error) {
        const errorMessage = error instanceof Error ? error.message : "Failed to delete message";
        if (errorMessage.includes("not found")) {
            res.status(404).json({
                success: false,
                message: errorMessage,
            });
            return;
        }
        if (errorMessage.includes("Unauthorized")) {
            res.status(403).json({
                success: false,
                message: errorMessage,
            });
            return;
        }
        res.status(500).json({
            success: false,
            message: "Internal server error",
            error: errorMessage,
        });
    }
};
