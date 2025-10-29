import { Server as SocketIOServer } from "socket.io";
import type { Server as HTTPServer } from "http";
import type { Socket } from "socket.io";
import { verifyAccessToken } from "../utils/generateToken.js";
import type { JwtPayload } from "jsonwebtoken";
import type {
  ServerToClientEvents,
  ClientToServerEvents,
  InterServerEvents,
  SocketData,
  MessageSendData,
} from "../types/socket.type.js";

// Extended Socket interface with user information
interface AuthenticatedSocket
  extends Socket<ClientToServerEvents, ServerToClientEvents, InterServerEvents, SocketData> {
  user?: string | JwtPayload;
  userId?: string;
}

// Store user socket mappings for room management
const userSockets = new Map<string, Set<string>>(); // userId -> Set<socketId>
const socketUsers = new Map<string, string>(); // socketId -> userId

// Store conversation view state for unread tracking (multi-tab)
const socketViewingConversation = new Map<string, string | null>(); // socketId -> conversationId | null
const socketUnreadConversations = new Map<string, Set<string>>(); // socketId -> Set<conversationId>

// Message debouncer with auto-cleanup
const messageCompleteDebouncer = new Map<string, number>();

// Auto-cleanup timer for debouncer (prevent memory leak)
setInterval(() => {
  const now = Date.now();
  const threshold = 5 * 60 * 1000; // 5 minutes

  for (const [key, timestamp] of messageCompleteDebouncer.entries()) {
    if (now - timestamp > threshold) {
      messageCompleteDebouncer.delete(key);
    }
  }
}, 60000); // Cleanup every minute

/**
 * Socket.io Authentication Middleware
 * Verifies JWT token and attaches user info to socket
 */
const socketAuthMiddleware = (socket: AuthenticatedSocket, next: (err?: Error) => void) => {
  try {
    // Get token from auth header or query parameter
    const token =
      socket.handshake.auth?.token ||
      socket.handshake.headers?.authorization?.replace("Bearer ", "") ||
      (socket.handshake.query?.token as string);

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
    } else {
      return next(new Error("Invalid token: missing user ID"));
    }

    // authentication succeeded; no logging

    next();
  } catch (error) {
    const message = error instanceof Error ? error.message : "Authentication error";
    // authentication failed; no logging

    next(new Error(message));
  }
};

/**
 * Handle user connection management
 */
const handleUserConnection = (socket: AuthenticatedSocket) => {
  const userId = socket.userId!;

  // Add socket to user's socket set
  if (!userSockets.has(userId)) {
    userSockets.set(userId, new Set());
  }
  userSockets.get(userId)!.add(socket.id);
  socketUsers.set(socket.id, userId);

  // Initialize unread tracking for this socket
  if (!socketUnreadConversations.has(socket.id)) {
    socketUnreadConversations.set(socket.id, new Set());
  }

  // user connection handled
};

/**
 * Handle user disconnection cleanup
 */
const handleUserDisconnection = (socket: AuthenticatedSocket) => {
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

    // Cleanup unread tracking
    socketViewingConversation.delete(socket.id);
    socketUnreadConversations.delete(socket.id);

    // Force leave all rooms to prevent memory leaks
    const rooms = Array.from(socket.rooms);
    rooms.forEach((room) => {
      if (room !== socket.id) {
        // Don't leave default room
        socket.leave(room);
      }
    });

    // user disconnection handled
  }
};

/**
 * Get all socket IDs for a user (for broadcasting)
 */
export const getUserSockets = (userId: string): string[] => {
  return Array.from(userSockets.get(userId) || []);
};

/**
 * Get user ID from socket ID
 */
export const getUserFromSocket = (socketId: string): string | undefined => {
  return socketUsers.get(socketId);
};

/**
 * Mark a conversation as read for a specific socket
 */
export const markConversationAsRead = (socketId: string, conversationId: string): void => {
  // Set this socket as viewing this conversation
  socketViewingConversation.set(socketId, conversationId);

  // Remove from unread set if present
  const unreadSet = socketUnreadConversations.get(socketId);
  if (unreadSet) {
    unreadSet.delete(conversationId);
  }
};

/**
 * Mark a conversation as unread for a specific socket
 */
export const markConversationAsUnread = (socketId: string, conversationId: string): void => {
  // Only mark as unread if socket is NOT currently viewing this conversation
  const viewing = socketViewingConversation.get(socketId);
  if (viewing === conversationId) {
    return; // Socket is viewing this conversation, don't mark as unread
  }

  // Add to unread set
  let unreadSet = socketUnreadConversations.get(socketId);
  if (!unreadSet) {
    unreadSet = new Set();
    socketUnreadConversations.set(socketId, unreadSet);
  }
  unreadSet.add(conversationId);
};

/**
 * Get unread conversations for a socket
 */
export const getUnreadConversations = (socketId: string): string[] => {
  const unreadSet = socketUnreadConversations.get(socketId);
  return unreadSet ? Array.from(unreadSet) : [];
};

/**
 * Broadcast unread status for a conversation to all sockets of a user
 */
export const broadcastUnreadStatus = (
  userId: string,
  conversationId: string,
  hasUnread: boolean,
  targetSocketId?: string
): void => {
  const sockets = getUserSockets(userId);
  sockets.forEach((socketId) => {
    const socket = io?.sockets.sockets.get(socketId);
    if (socket) {
      (socket as any).emit("conversation:unread_status", {
        conversationId,
        hasUnread,
        socketId: targetSocketId,
      });
    }
  });
};

/**
 * Leave conversation view for a socket
 */
export const leaveConversationView = (socketId: string): void => {
  socketViewingConversation.set(socketId, null);
};

/**
 * Broadcast message to all sockets of a specific user (across all tabs/devices)
 * @param userId - User ID to broadcast to
 * @param event - Event name
 * @param data - Event data
 * @param excludeSocketId - Optional socket ID to exclude (e.g., the sender)
 */
export const broadcastToUser = (
  userId: string,
  event: string,
  data: any,
  excludeSocketId?: string
): void => {
  const sockets = getUserSockets(userId);
  sockets.forEach((socketId) => {
    // Skip excluded socket (usually the sender)
    if (excludeSocketId && socketId === excludeSocketId) {
      return;
    }
    const socket = io?.sockets.sockets.get(socketId);
    if (socket) {
      (socket as any).emit(event, data);
    }
  });
};

/**
 * Broadcast message to all users in a conversation
 */
export const broadcastToConversation = (conversationId: string, event: string, data: any): void => {
  if (io) {
    (io as any).to(`conversation:${conversationId}`).emit(event, data);
  }
};

/**
 * Get all users currently connected to a conversation
 */
export const getConversationUsers = (conversationId: string): string[] => {
  if (!io) return [];

  const room = io.sockets.adapter.rooms.get(`conversation:${conversationId}`);
  if (!room) return [];

  const users = new Set<string>();
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
export const isUserOnline = (userId: string): boolean => {
  return userSockets.has(userId) && (userSockets.get(userId)?.size || 0) > 0;
};

/**
 * Get Socket.io server instance
 */
export const getSocketIOInstance = (): SocketIOServer<
  ClientToServerEvents,
  ServerToClientEvents,
  InterServerEvents,
  SocketData
> | null => {
  return io || null;
};

// Store io instance for use in event handlers
let io: SocketIOServer<ClientToServerEvents, ServerToClientEvents, InterServerEvents, SocketData>;

/**
 * Initialize Socket.io server with authentication and event handlers
 */
export const initializeSocketIO = (
  httpServer: HTTPServer
): SocketIOServer<ClientToServerEvents, ServerToClientEvents, InterServerEvents, SocketData> => {
  io = new SocketIOServer<
    ClientToServerEvents,
    ServerToClientEvents,
    InterServerEvents,
    SocketData
  >(httpServer, {
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
  io.on("connection", (socket: AuthenticatedSocket) => {
    // connection established

    // Handle user connection
    handleUserConnection(socket);

    // Join user to their personal room (for user-specific broadcasts)
    // Also join a session room using userId as sessionId for multi-tab sync
    if (socket.userId) {
      socket.join(`user:${socket.userId}`);
      socket.join(`session:${socket.userId}`); // Session room for multi-tab sync
    }

    // Handle joining conversation rooms
    socket.on("join:conversation", (conversationId: string) => {
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
    socket.on("leave:conversation", (conversationId: string) => {
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
        const { conversationId, content, messageId, attachments } = data as {
          conversationId: string;
          content: string;
          messageId?: string;
          attachments?: Array<{
            public_id: string;
            secure_url: string;
            resource_type: string;
            format?: string;
            extracted_text?: string;
          }>;
        };

        if (!conversationId || !content) {
          socket.emit("error", { message: "Conversation ID and content are required" });
          return;
        }

        // incoming message received

        // Import message service dynamically to avoid circular imports
        const { sendMessageAndStreamResponse } = await import("./message.service.js");

        // CRITICAL FIX: Fetch attachments from database to get openai_file_id
        let enrichedAttachments: any[] | undefined;
        if (attachments && attachments.length > 0) {
          try {
            const FileUploadModel = (await import("../models/fileUpload.model.js")).default;
            const publicIds = attachments.map((att: any) => att.public_id);

            // Fetch full file metadata including openai_file_id from database
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
                  openai_file_id: fileData.openai_file_id, // NOW INCLUDES FILE_ID!
                });
              }
            }
          } catch (err: any) {
            // Fallback to client attachments if DB fetch fails
            enrichedAttachments = attachments;
          }
        }

        // Stream AI response and broadcast user message early via onUserMessageCreated
        let assistantContent = "";

        try {
          const result = await sendMessageAndStreamResponse(
            conversationId,
            socket.userId!,
            content,
            // onChunk callback - stream to client
            (chunk: string) => {
              assistantContent += chunk;
              // chunk received and will be broadcast

              // Broadcast chunks to ALL sockets in conversation room (including sender)
              // Sender NEEDS chunks to display streaming AI response
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
                  const roomSockets = room ? new Set(Array.from(room)) : new Set<string>();

                  // getUserSockets is available in this module and returns all socket ids for the user
                  const userSocketIds = getUserSockets(socket.userId!);

                  for (const sid of userSocketIds) {
                    // skip sender socket and any sockets already in the conversation room
                    if (sid === socket.id) {
                      continue;
                    }
                    if (roomSockets.has(sid)) {
                      continue;
                    }

                    const target = io.sockets.sockets.get(sid);
                    if (target) {
                      (target as any).emit("message:new", {
                        conversationId,
                        message: userMessage,
                      });
                    }
                  }
                } catch (e) {
                  // ignore per-socket notify failures
                }

                // After other clients have been notified about the user's message, start AI typing
                // for everyone in the conversation room (including the sender) so the typing indicator
                // appears after the user message in other tabs.
                io.to(`conversation:${conversationId}`).emit("ai:typing:start", {
                  conversationId,
                  messageId,
                });

                // Mark conversation as unread for sockets of this user that are NOT viewing it
                if (socket.userId) {
                  const userSocketIds = getUserSockets(socket.userId);
                  userSocketIds.forEach((sid) => {
                    // Skip if socket is currently viewing this conversation
                    const viewingConv = socketViewingConversation.get(sid);
                    if (viewingConv === conversationId) {
                      return;
                    }

                    // Mark as unread for this socket
                    markConversationAsUnread(sid, conversationId);

                    // Emit unread status to this socket
                    const targetSocket = io.sockets.sockets.get(sid);
                    if (targetSocket) {
                      (targetSocket as any).emit("conversation:unread_status", {
                        conversationId,
                        hasUnread: true,
                        socketId: socket.id,
                      });
                    }
                  });
                }
              } catch (err) {
                // ignore
              }
            },
            enrichedAttachments // Pass ENRICHED attachments with openai_file_id
          );

          // CRITICAL FIX: Broadcast complete messages with different content for sender vs others
          // - Others (non-sender): Get both userMessage and assistantMessage
          // - Sender: Get assistantMessage + userMessage (need userMessage to replace optimistic temp_id)

          // 1. Broadcast to conversation room EXCLUDING sender
          socket.to(`conversation:${conversationId}`).emit("message:complete", {
            userMessage: result.userMessage,
            assistantMessage: result.assistantMessage,
            conversation: result.conversation,
            messageId,
          });

          // 2. Send to sender socket with BOTH messages
          // IMPORTANT: Sender NEEDS userMessage to replace optimistic message (temp_id)
          socket.emit("message:complete", {
            userMessage: result.userMessage, // Include userMessage for temp_id replacement
            assistantMessage: result.assistantMessage,
            conversation: result.conversation,
            messageId,
          });

          // 3. Send to sender's OTHER sockets (other tabs of same user)
          // IMPORTANT: Only send to sockets that are NOT in the conversation room
          // (those in the room already received the broadcast in step 1)
          try {
            const room = io.sockets.adapter.rooms.get(`conversation:${conversationId}`);
            const roomSockets = room ? new Set(Array.from(room)) : new Set<string>();

            const userSocketIds = getUserSockets(socket.userId!);
            for (const sid of userSocketIds) {
              // Skip current sender socket (already handled in step 2)
              if (sid === socket.id) {
                continue;
              }

              // Skip if socket is already in the conversation room
              // (it already received the message in step 1)
              if (roomSockets.has(sid)) {
                continue;
              }

              const target = io.sockets.sockets.get(sid);
              if (target) {
                (target as any).emit("message:complete", {
                  userMessage: result.userMessage,
                  assistantMessage: result.assistantMessage,
                  conversation: result.conversation,
                  messageId,
                });
              }
            }
          } catch (e) {
            // ignore per-socket notify failures
          }

          // Broadcast conversation update to user room for multi-tab conversation list sync
          if (result.conversation) {
            broadcastToUser(socket.userId!, "conversation:activity", {
              conversationId,
              lastActivity: new Date().toISOString(),
              messageCount: result.conversation.message_count,
              totalTokens: result.conversation.total_tokens_used,
            });
          }
        } catch (streamErr: any) {
          // CRITICAL FIX: Handle streaming errors properly
          console.error(
            `[Socket] Stream error for conversation ${conversationId}:`,
            streamErr.message || streamErr
          );

          // Emit error event to client so they can handle it gracefully
          io.to(`conversation:${conversationId}`).emit("error", {
            message: streamErr.message || "Streaming failed",
            conversationId,
            messageId,
            timestamp: new Date().toISOString(),
          } as any);
        } finally {
          // CRITICAL FIX: Always stop typing indicator, even if streaming failed
          // This ensures client UI doesn't get stuck in "typing" state
          io.to(`conversation:${conversationId}`).emit("ai:typing:stop", {
            conversationId,
            messageId,
          });
        }
      } catch {}
    });

    socket.on("typing:stop", (conversationId: string) => {
      if (!conversationId) return;

      // typing stop received
      // Broadcast typing stop to other users in the conversation
      socket.to(`conversation:${conversationId}`).emit("user:typing:stop", {
        userId: socket.userId,
        conversationId,
      });
    });

    // Handle follow-up suggestions request
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

        // Import followup service dynamically
        const { generateFollowupSuggestions } = await import("./followup.service.js");

        // Generate suggestions with context
        const suggestions = await generateFollowupSuggestions(lastUserMessage, lastBotMessage);

        // Broadcast suggestions to all sockets in the same session (multi-tab sync)
        io.to(`session:${sessionId}`).emit("followups_response", {
          messageId,
          suggestions,
        });
      } catch (error: any) {
        const messageId = (data as any)?.messageId || "";
        const sessionId = (data as any)?.sessionId || "";

        // Broadcast error to all sockets in the same session
        if (sessionId) {
          io.to(`session:${sessionId}`).emit("followups_error", {
            messageId,
            error: error?.message || "Failed to generate suggestions",
          });
        } else {
          socket.emit("followups_error", {
            messageId,
            error: error?.message || "Failed to generate suggestions",
          });
        }
      }
    });

    // Handle conversation-based follow-up suggestions request (for input lightbulb)
    socket.on("request_conversation_followups", async (data) => {
      try {
        const { sessionId, conversationId, messages } = data;

        if (!sessionId || !conversationId) {
          socket.emit("conversation_followups_error", {
            conversationId: conversationId || "",
            error: "Session ID and conversation ID are required",
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

        // Import followup service dynamically
        const { generateConversationFollowups } = await import("./followup.service.js");

        // Generate suggestions based on conversation history
        const suggestions = await generateConversationFollowups(messages);

        // Broadcast suggestions to all sockets in the same session (multi-tab sync)
        io.to(`session:${sessionId}`).emit("conversation_followups_response", {
          conversationId,
          suggestions,
        });
      } catch (error: any) {
        const conversationId = (data as any)?.conversationId || "";
        const sessionId = (data as any)?.sessionId || "";

        // Broadcast error to all sockets in the same session
        if (sessionId) {
          io.to(`session:${sessionId}`).emit("conversation_followups_error", {
            conversationId,
            error: error?.message || "Failed to generate conversation suggestions",
          });
        } else {
          socket.emit("conversation_followups_error", {
            conversationId,
            error: error?.message || "Failed to generate conversation suggestions",
          });
        }
      }
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

      // Broadcast update to other sockets of the same user (excluding sender) via user room for multi-tab sync
      broadcastToUser(
        socket.userId!,
        "conversation:updated",
        {
          conversationId,
          update,
        },
        socket.id
      );

      // ALSO broadcast update to all other participants in the conversation room (excluding sender)
      try {
        socket.broadcast.to(`conversation:${conversationId}`).emit("conversation:updated", {
          conversationId,
          update,
        });
      } catch (e) {
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

      // Broadcast creation to other sockets of the same user (excluding sender) via user room for multi-tab sync
      broadcastToUser(socket.userId!, "conversation:created", conversation, socket.id);

      // ALSO broadcast creation to the conversation room (if any other sockets already joined, excluding sender)
      try {
        if (conversation?.id) {
          socket.broadcast
            .to(`conversation:${conversation.id}`)
            .emit("conversation:created", conversation);
        }
      } catch {}
    });

    // Handle conversation deletion (for real-time sync across tabs)
    socket.on("conversation:delete", (conversationId) => {
      if (!conversationId) {
        socket.emit("error", { message: "Conversation ID is required" });
        return;
      }

      // conversation deletion requested

      // Broadcast deletion to other sockets of the same user (excluding sender) via user room for multi-tab sync
      broadcastToUser(socket.userId!, "conversation:deleted", { conversationId }, socket.id);

      // ALSO broadcast deletion to the conversation room (all other participants, excluding sender)
      try {
        socket.broadcast
          .to(`conversation:${conversationId}`)
          .emit("conversation:deleted", { conversationId });
      } catch {}

      // Remove all sockets from the conversation room
      // removing sockets from conversation room

      io.in(`conversation:${conversationId}`).socketsLeave(`conversation:${conversationId}`);
      // conversation room cleared
    });

    // Handle conversation view (for unread tracking - multi-tab)
    socket.on("conversation:view", (data) => {
      const { conversationId } = data;

      if (!conversationId) {
        socket.emit("error", { message: "Conversation ID is required" });
        return;
      }

      // Mark conversation as read for this socket
      markConversationAsRead(socket.id, conversationId);

      // Broadcast to all sockets of this user that this conversation is now read
      // This allows other tabs to update their UI
      if (socket.userId) {
        const userSocketIds = getUserSockets(socket.userId);
        userSocketIds.forEach((sid) => {
          const targetSocket = io.sockets.sockets.get(sid);
          if (targetSocket) {
            (targetSocket as any).emit("conversation:unread_status", {
              conversationId,
              hasUnread: false,
              socketId: socket.id,
            });
          }
        });
      }
    });

    // Handle leaving conversation view (for unread tracking - multi-tab)
    socket.on("conversation:leave_view", (data) => {
      const { conversationId } = data;

      if (!conversationId) {
        socket.emit("error", { message: "Conversation ID is required" });
        return;
      }

      // Clear viewing state for this socket
      leaveConversationView(socket.id);
    });

    // Handle ping/pong for connection health
    socket.on("ping", () => {
      socket.emit("pong");
    });

    // Handle connection errors
    socket.on("error", (/* error */) => {
      // socket error event
    });
  });

  return io;
};

export default initializeSocketIO;
