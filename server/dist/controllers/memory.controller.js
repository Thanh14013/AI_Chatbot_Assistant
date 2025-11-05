/**
 * Memory Controller
 * Handles API endpoints for Long Term Memory operations
 *
 * Endpoints:
 * - GET /api/memory/profile - Get user profile
 * - GET /api/memory/events - Get memory events
 * - GET /api/memory/suggestions - Get chat suggestions
 * - DELETE /api/memory/clear - Clear user memory
 * - GET /api/memory/stats - Get memory statistics
 */
import { getUserProfile, getUserEvents, generateChatSuggestions, getRecentConversationSummaries, clearUserProfile, isLTMEnabled, getLTMConfig, } from "../services/memory.service.js";
import sequelize from "../db/database.config.js";
/**
 * GET /api/memory/profile
 * Get user profile with facts
 */
export const getProfile = async (req, res) => {
    try {
        // Check if LTM is enabled
        if (!isLTMEnabled()) {
            res.status(200).json({
                success: true,
                data: null,
                message: "Long Term Memory is disabled",
            });
            return;
        }
        const userId = req.userId; // From auth middleware
        if (!userId) {
            res.status(401).json({
                success: false,
                message: "Unauthorized",
            });
            return;
        }
        const profile = await getUserProfile(userId);
        res.status(200).json({
            success: true,
            data: profile,
        });
    }
    catch (error) {
        res.status(500).json({
            success: false,
            message: error instanceof Error ? error.message : "Internal server error",
        });
    }
};
/**
 * GET /api/memory/events
 * Get memory events with pagination
 * Query params: page (default: 1), limit (default: 50)
 */
export const getEvents = async (req, res) => {
    try {
        // Check if LTM is enabled
        if (!isLTMEnabled()) {
            res.status(200).json({
                success: true,
                data: {
                    events: [],
                    total: 0,
                },
                message: "Long Term Memory is disabled",
            });
            return;
        }
        const userId = req.userId;
        if (!userId) {
            res.status(401).json({
                success: false,
                message: "Unauthorized",
            });
            return;
        }
        const page = parseInt(req.query.page) || 1;
        const limit = Math.min(parseInt(req.query.limit) || 50, 100); // Max 100
        const offset = (page - 1) * limit;
        const { events, total } = await getUserEvents(userId, limit, offset);
        res.status(200).json({
            success: true,
            data: {
                events,
                total,
                page,
                limit,
            },
        });
    }
    catch (error) {
        res.status(500).json({
            success: false,
            message: error instanceof Error ? error.message : "Internal server error",
        });
    }
};
/**
 * GET /api/memory/suggestions
 * Get smart chat suggestions based on user history
 */
export const getSuggestions = async (req, res) => {
    try {
        // Check if LTM is enabled
        if (!isLTMEnabled()) {
            res.status(200).json({
                success: true,
                data: {
                    suggestions: [],
                    recent_topics: [],
                    recent_conversations: [],
                },
                message: "Long Term Memory is disabled",
            });
            return;
        }
        const userId = req.userId;
        if (!userId) {
            res.status(401).json({
                success: false,
                message: "Unauthorized",
            });
            return;
        }
        // Get suggestions and recent conversations in parallel
        const [suggestions, recentConversations] = await Promise.all([
            generateChatSuggestions(userId),
            getRecentConversationSummaries(userId, 5),
        ]);
        // Extract recent topics
        const recentTopics = new Set();
        recentConversations.forEach((conv) => {
            if (conv.key_topics) {
                conv.key_topics.forEach((topic) => recentTopics.add(topic));
            }
            if (conv.technical_topics) {
                conv.technical_topics.forEach((topic) => recentTopics.add(topic));
            }
        });
        res.status(200).json({
            success: true,
            data: {
                suggestions,
                recent_topics: Array.from(recentTopics).slice(0, 10),
                recent_conversations: recentConversations.map((conv) => ({
                    conversation_id: conv.conversation_id,
                    title: conv.title,
                    summary: conv.summary,
                    updated_at: conv.updated_at,
                })),
            },
        });
    }
    catch (error) {
        res.status(500).json({
            success: false,
            message: error instanceof Error ? error.message : "Internal server error",
        });
    }
};
/**
 * DELETE /api/memory/clear
 * Clear all user memory (profile, events, summaries)
 */
export const clearMemory = async (req, res) => {
    try {
        const userId = req.userId;
        if (!userId) {
            res.status(401).json({
                success: false,
                message: "Unauthorized",
            });
            return;
        }
        // Delete in parallel
        const [eventsResult, summariesResult] = await Promise.all([
            // Delete events
            sequelize.query(`DELETE FROM user_memory_events WHERE user_id = :userId`, {
                replacements: { userId },
            }),
            // Delete summaries
            sequelize.query(`DELETE FROM user_conversation_summary WHERE user_id = :userId`, {
                replacements: { userId },
            }),
        ]);
        // Clear Redis profile
        await clearUserProfile(userId);
        const eventsDeleted = eventsResult[0].rowCount || 0;
        const summariesDeleted = summariesResult[0].rowCount || 0;
        res.status(200).json({
            success: true,
            message: "Memory cleared successfully",
            data: {
                events_deleted: eventsDeleted,
                summaries_deleted: summariesDeleted,
                profile_cleared: true,
            },
        });
    }
    catch (error) {
        res.status(500).json({
            success: false,
            message: error instanceof Error ? error.message : "Internal server error",
        });
    }
};
/**
 * GET /api/memory/stats
 * Get memory statistics for the user
 */
export const getStats = async (req, res) => {
    try {
        if (!isLTMEnabled()) {
            res.status(200).json({
                success: true,
                data: null,
                message: "Long Term Memory is disabled",
            });
            return;
        }
        const userId = req.userId;
        if (!userId) {
            res.status(401).json({
                success: false,
                message: "Unauthorized",
            });
            return;
        }
        // Get statistics
        const [profile, eventsStats, summariesStats, topicStats, eventTypeStats] = await Promise.all([
            getUserProfile(userId),
            sequelize.query(`
        SELECT 
          COUNT(*) as total,
          AVG(importance_score) as avg_importance
        FROM user_memory_events
        WHERE user_id = :userId
      `, { replacements: { userId } }),
            sequelize.query(`
        SELECT COUNT(*) as total
        FROM user_conversation_summary
        WHERE user_id = :userId
      `, { replacements: { userId } }),
            sequelize.query(`
        SELECT UNNEST(key_topics) as topic, COUNT(*) as count
        FROM user_conversation_summary
        WHERE user_id = :userId
        GROUP BY topic
        ORDER BY count DESC
        LIMIT 10
      `, { replacements: { userId } }),
            sequelize.query(`
        SELECT event_type, COUNT(*) as count
        FROM user_memory_events
        WHERE user_id = :userId
        GROUP BY event_type
        ORDER BY count DESC
      `, { replacements: { userId } }),
        ]);
        const eventsData = eventsStats[0][0];
        const summariesData = summariesStats[0][0];
        const topicsData = topicStats[0];
        const eventTypesData = eventTypeStats[0];
        res.status(200).json({
            success: true,
            data: {
                total_events: parseInt(eventsData.total),
                total_conversations_summarized: parseInt(summariesData.total),
                profile_version: profile?.version || 0,
                profile_last_updated: profile?.updated_at || null,
                average_importance_score: parseFloat(eventsData.avg_importance) || 0,
                most_common_topics: topicsData.map((t) => t.topic),
                most_common_event_types: eventTypesData.reduce((acc, t) => {
                    acc[t.event_type] = parseInt(t.count);
                    return acc;
                }, {}),
            },
        });
    }
    catch (error) {
        res.status(500).json({
            success: false,
            message: error instanceof Error ? error.message : "Internal server error",
        });
    }
};
/**
 * GET /api/memory/config
 * Get LTM configuration (for debugging)
 */
export const getConfig = async (req, res) => {
    try {
        const config = getLTMConfig();
        res.status(200).json({
            success: true,
            data: config,
        });
    }
    catch (error) {
        res.status(500).json({
            success: false,
            message: error instanceof Error ? error.message : "Internal server error",
        });
    }
};
export default {
    getProfile,
    getEvents,
    getSuggestions,
    clearMemory,
    getStats,
    getConfig,
};
