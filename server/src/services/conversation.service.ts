import Conversation from "../models/conversation.model.js";
import Message from "../models/message.model.js";
import { Op } from "sequelize";
import type {
  CreateConversationInput,
  UpdateConversationInput,
  ConversationResponse,
} from "../types/conversation.type.js";
import { cacheAside, CACHE_TTL, invalidateCachePattern, deleteCache } from "./cache.service.js";
import {
  conversationListKey,
  conversationListPattern,
  conversationMetaKey,
  popularTagsKey,
  projectListPattern,
} from "../utils/cache-key.util.js";
import { sanitizeTags } from "../utils/tag.util.js";
import sequelize from "../db/database.config.js";

/**
 * Create a new conversation
 *
 * @param data - Conversation creation data
 * @returns Created conversation
 */
export const createConversation = async (
  data: CreateConversationInput
): Promise<ConversationResponse> => {
  // Validate required fields
  if (!data.user_id || !data.title) {
    throw new Error("User ID and title are required");
  }

  // Use transaction to prevent race conditions
  const conversation = await sequelize.transaction(async (t) => {
    // Check for duplicate title in active conversations (prevent spam clicking)
    const existing = await Conversation.findOne({
      where: {
        user_id: data.user_id,
        title: data.title,
        deleted_at: null,
      },
      transaction: t,
      lock: true, // Use row-level locking
    });

    if (existing) {
      // If conversation with same title exists and was created within last 5 seconds,
      // it's likely a duplicate request (spam click)
      const timeDiff = Date.now() - new Date(existing.createdAt).getTime();
      if (timeDiff < 5000) {
        // Return existing conversation instead of creating duplicate
        return existing;
      }
    }

    // Sanitize tags
    const tags = sanitizeTags(data.tags || []);

    // Create conversation with default values
    const newConversation = await Conversation.create(
      {
        user_id: data.user_id,
        title: data.title,
        model: data.model || "gpt-4o-mini",
        context_window: data.context_window || 10,
        total_tokens_used: 0,
        message_count: 0,
        tags,
        project_id: data.project_id || null, // Assign to project if provided
        order_in_project: 0, // Default order
        deleted_at: null,
      },
      { transaction: t }
    );

    return newConversation;
  });

  // Invalidate conversation list cache for this user
  await invalidateCachePattern(conversationListPattern(data.user_id));
  // Invalidate popular tags cache
  await deleteCache(popularTagsKey(data.user_id));

  // Return conversation response
  return {
    id: conversation.id,
    user_id: conversation.user_id,
    title: conversation.title,
    model: conversation.model,
    context_window: conversation.context_window,
    total_tokens_used: conversation.total_tokens_used,
    message_count: conversation.message_count,
    tags: conversation.tags,
    project_id: conversation.project_id,
    order_in_project: conversation.order_in_project,
    createdAt: conversation.createdAt,
    updatedAt: conversation.updatedAt,
    deleted_at: conversation.deleted_at,
  };
};

/**
 * Get all conversations for a user with pagination and optional search
 *
 * @param userId - User ID
 * @param page - Page number (default: 1)
 * @param limit - Items per page (default: 20)
 * @param search - Optional search query to filter conversation titles
 * @param tags - Optional tags to filter by
 * @param tagMode - Tag filtering mode: "any" (default) or "all"
 * @returns Array of conversations with pagination info
 */
export const getUserConversations = async (
  userId: string,
  page: number = 1,
  limit: number = 20,
  search?: string,
  tags?: string[],
  tagMode: "any" | "all" = "any",
  standalone?: boolean // New parameter to filter by project_id
): Promise<{
  conversations: ConversationResponse[];
  pagination: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
  };
}> => {
  // Use cache for conversation lists (include tags in cache key)
  const tagsStr = tags?.join(",") || "";
  const standaloneStr = standalone !== undefined ? `:standalone:${standalone}` : "";
  const cacheKey = `${conversationListKey(userId, page, limit, search)}:tags:${tagsStr}:mode:${tagMode}${standaloneStr}`;
  const fetchConversations = async () => {
    // Calculate offset
    const offset = (page - 1) * limit;

    // Build where clause with optional search filter and tag filter
    const whereClause: any = {
      user_id: userId,
      deleted_at: null,
    };

    // Filter by project_id if standalone parameter is provided
    if (standalone === true) {
      // Only fetch conversations without project_id (standalone conversations)
      whereClause.project_id = null;
    } else if (standalone === false) {
      // Only fetch conversations with project_id
      whereClause.project_id = {
        [Op.ne]: null, // Not equal to null
      };
    }
    // If standalone is undefined, fetch all conversations (existing behavior)

    // Add search filter if provided
    if (search && search.trim()) {
      whereClause.title = {
        [Op.iLike]: `%${search.trim()}%`, // Case-insensitive search
      };
    }

    // Add tag filter if provided
    if (tags && tags.length > 0) {
      if (tagMode === "all") {
        // Conversation must have ALL specified tags
        whereClause.tags = {
          [Op.contains]: tags, // PostgreSQL array contains operator
        };
      } else {
        // Conversation must have ANY of the specified tags (default)
        whereClause.tags = {
          [Op.overlap]: tags, // PostgreSQL array overlap operator
        };
      }
    }

    // Get total count for pagination
    const total = await Conversation.count({
      where: whereClause,
    });

    // Get conversations with pagination
    const conversations = await Conversation.findAll({
      where: whereClause,
      order: [["updatedAt", "DESC"]], // Most recently updated first
      limit,
      offset,
    });

    if (conversations[0]) {
      const firstConv = conversations[0];
    }

    // Map to response format
    const conversationResponses: ConversationResponse[] = conversations.map((conv) => ({
      id: conv.id,
      user_id: conv.user_id,
      title: conv.title,
      model: conv.model,
      context_window: conv.context_window,
      total_tokens_used: conv.total_tokens_used,
      message_count: conv.message_count,
      tags: conv.tags,
      project_id: conv.project_id,
      order_in_project: conv.order_in_project,
      createdAt: conv.createdAt,
      updatedAt: conv.updatedAt,
      deleted_at: conv.deleted_at,
    }));

    // Calculate total pages
    const totalPages = Math.ceil(total / limit);

    return {
      conversations: conversationResponses,
      pagination: {
        page,
        limit,
        total,
        totalPages,
      },
    };
  };

  return await cacheAside(cacheKey, fetchConversations, CACHE_TTL.CONVERSATION_LIST);
};

/**
 * Get a specific conversation by ID
 *
 * @param conversationId - Conversation ID
 * @param userId - User ID (for authorization check)
 * @returns Conversation details
 * @throws Error if conversation not found or user not authorized
 */
export const getConversationById = async (
  conversationId: string,
  userId: string
): Promise<ConversationResponse> => {
  // Find conversation
  const conversation = await Conversation.findOne({
    where: {
      id: conversationId,
      deleted_at: null,
    },
  });

  // Check if conversation exists
  if (!conversation) {
    throw new Error("Conversation not found");
  }

  // Check if user is authorized
  if (conversation.user_id !== userId) {
    throw new Error("Unauthorized access to conversation");
  }

  // Return conversation response
  return {
    id: conversation.id,
    user_id: conversation.user_id,
    title: conversation.title,
    model: conversation.model,
    context_window: conversation.context_window,
    total_tokens_used: conversation.total_tokens_used,
    message_count: conversation.message_count,
    tags: conversation.tags,
    project_id: conversation.project_id,
    order_in_project: conversation.order_in_project,
    createdAt: conversation.createdAt,
    updatedAt: conversation.updatedAt,
    deleted_at: conversation.deleted_at,
  };
};

/**
 * Update a conversation
 *
 * @param conversationId - Conversation ID
 * @param userId - User ID (for authorization check)
 * @param data - Update data
 * @returns Updated conversation
 * @throws Error if conversation not found or user not authorized
 */
export const updateConversation = async (
  conversationId: string,
  userId: string,
  data: UpdateConversationInput
): Promise<ConversationResponse> => {
  // Find conversation
  const conversation = await Conversation.findOne({
    where: {
      id: conversationId,
      deleted_at: null,
    },
  });

  // Check if conversation exists
  if (!conversation) {
    throw new Error("Conversation not found");
  }

  // Check if user is authorized
  if (conversation.user_id !== userId) {
    throw new Error("Unauthorized access to conversation");
  }

  // Track if project_id changed (for cache invalidation)
  const projectIdChanged =
    data.project_id !== undefined && data.project_id !== conversation.project_id;

  // Update fields if provided
  if (data.title !== undefined) {
    conversation.title = data.title;
  }
  if (data.model !== undefined) {
    conversation.model = data.model;
  }
  if (data.context_window !== undefined) {
    conversation.context_window = data.context_window;
  }
  if (data.tags !== undefined) {
    const sanitizedTags = sanitizeTags(data.tags);
    conversation.tags = sanitizedTags;
  }

  // Save changes
  await conversation.save();

  // Invalidate caches
  await invalidateCachePattern(conversationListPattern(userId));
  await deleteCache(conversationMetaKey(conversationId));
  await deleteCache(popularTagsKey(userId));

  // If project_id changed, invalidate project list cache (conversation counts changed)
  if (projectIdChanged) {
    await invalidateCachePattern(projectListPattern(userId));
  }

  // Return updated conversation
  return {
    id: conversation.id,
    user_id: conversation.user_id,
    title: conversation.title,
    model: conversation.model,
    context_window: conversation.context_window,
    total_tokens_used: conversation.total_tokens_used,
    message_count: conversation.message_count,
    tags: conversation.tags,
    project_id: conversation.project_id,
    order_in_project: conversation.order_in_project,
    createdAt: conversation.createdAt,
    updatedAt: conversation.updatedAt,
    deleted_at: conversation.deleted_at,
  };
};

/**
 * Soft delete a conversation
 *
 * @param conversationId - Conversation ID
 * @param userId - User ID (for authorization check)
 * @returns Deleted conversation
 * @throws Error if conversation not found or user not authorized
 */
export const deleteConversation = async (
  conversationId: string,
  userId: string
): Promise<{ message: string }> => {
  // Find conversation
  const conversation = await Conversation.findOne({
    where: {
      id: conversationId,
      deleted_at: null,
    },
  });

  // Check if conversation exists
  if (!conversation) {
    throw new Error("Conversation not found");
  }

  // Check if user is authorized
  if (conversation.user_id !== userId) {
    throw new Error("Unauthorized access to conversation");
  }

  // Track if conversation belongs to a project (for cache invalidation)
  const belongsToProject = conversation.project_id !== null;

  // Soft delete (set deleted_at timestamp) immediately so the conversation
  // disappears from user lists. Message deletion will be performed
  // asynchronously (fire-and-forget) to avoid blocking the request when
  // conversations have many messages.
  conversation.deleted_at = new Date();
  await conversation.save();

  // Invalidate all caches related to this conversation
  await invalidateCachePattern(conversationListPattern(userId));
  await deleteCache(conversationMetaKey(conversationId));

  // If conversation was in a project, invalidate project list cache (conversation count changed)
  if (belongsToProject) {
    await invalidateCachePattern(projectListPattern(userId));
  }

  // Fire-and-forget: delete messages in background and log any failures.
  // We intentionally do NOT await this Promise so the HTTP response can
  // return quickly. This keeps UX snappy when conversations contain many messages.
  Message.deleteByConversation(conversationId)
    .then(() => {
      // Optionally: add more detailed logging or metrics here.
    })
    .catch((err) => {
      // Log failures for investigation; do not interrupt user flow.
    });

  return {
    message: "Conversation deleted successfully",
  };
};

/**
 * Generate a smart title for a conversation based on first messages
 * Uses OpenAI to create a concise, relevant title
 *
 * @param userMessage - First user message content
 * @param assistantMessage - First assistant message content
 * @returns Generated title (max 60 characters)
 */
export const generateConversationTitle = async (
  userMessage: string,
  assistantMessage: string
): Promise<string> => {
  try {
    const openai = (await import("./openai.service.js")).default;

    // Create a prompt to generate a concise title
    const prompt = `Based on this conversation, generate a short, concise title (maximum 60 characters). Only return the title, nothing else.

User: ${userMessage.substring(0, 200)}
Assistant: ${assistantMessage.substring(0, 200)}

Title:`;

    const response = await openai.chat.completions.create({
      model: "gpt-4o-mini",
      messages: [
        {
          role: "system",
          content:
            "You are a helpful assistant that creates short, concise conversation titles. Return only the title, maximum 60 characters.",
        },
        { role: "user", content: prompt },
      ],
      max_completion_tokens: 20,
    });

    const title = response.choices[0]?.message?.content?.trim() || "New Chat";

    // Ensure title doesn't exceed 60 characters
    return title.length > 60 ? title.substring(0, 57) + "..." : title;
  } catch (error) {
    // Return a default title if generation fails
    return "New Chat";
  }
};

/**
 * Get popular tags for a user based on their conversations
 * Returns top 20 most used tags with usage count
 *
 * @param userId - User ID
 * @returns Array of popular tags with counts
 */
export const getPopularTags = async (
  userId: string
): Promise<{ name: string; count: number }[]> => {
  // Use cache for popular tags
  const cacheKey = popularTagsKey(userId);
  const fetchPopularTags = async () => {
    // Query to get all tags from user's conversations and count occurrences
    // Uses PostgreSQL unnest() to flatten tag arrays
    const result = await sequelize.query(
      `
      SELECT tag_name as name, COUNT(*) as count
      FROM conversations, unnest(tags) as tag_name
      WHERE user_id = :userId AND deleted_at IS NULL
      GROUP BY tag_name
      ORDER BY count DESC, tag_name ASC
      LIMIT 20
      `,
      {
        replacements: { userId },
        type: "SELECT" as any,
      }
    );

    // Convert count from string to number
    return (result as any[]).map((row: any) => ({
      name: row.name,
      count: parseInt(row.count, 10),
    }));
  };

  return await cacheAside(cacheKey, fetchPopularTags, 300); // Cache for 5 minutes
};
