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

import type { Request, Response } from "express";
import {
  getUserProfile,
  getUserEvents,
  generateChatSuggestions,
  getRecentConversationSummaries,
  clearUserProfile,
  isLTMEnabled,
  getLTMConfig,
} from "../services/memory.service.js";
import sequelize from "../db/database.config.js";
import type {
  GetProfileResponse,
  GetEventsResponse,
  GetSuggestionsResponse,
  ClearMemoryResponse,
} from "../types/memory.type.js";

/**
 * GET /api/memory/profile
 * Get user profile with facts
 */
export const getProfile = async (req: Request, res: Response): Promise<void> => {
  try {
    // Check if LTM is enabled
    if (!isLTMEnabled()) {
      res.status(200).json({
        success: true,
        data: null,
        message: "Long Term Memory is disabled",
      } as GetProfileResponse);
      return;
    }

    // Extract user ID from JWT payload (set by auth middleware)
    const user = (req as any).user;
    const userId = user?.id;

    if (!userId) {
      res.status(401).json({
        success: false,
        message: "Unauthorized",
      });
      return;
    }

    const profile = await getUserProfile(userId);

    // Transform profile data to match client expectations
    if (profile) {
      // Build factsByCategory from the profile facts structure
      const factsByCategory: Record<string, string[]> = {};

      // Personal facts
      if (profile.facts.personal) {
        const personalFacts: string[] = [];
        const p = profile.facts.personal;
        if (p.name) personalFacts.push(`Name: ${p.name}`);
        if (p.location) personalFacts.push(`Location: ${p.location}`);
        if (p.occupation) personalFacts.push(`Occupation: ${p.occupation}`);
        if (p.company) personalFacts.push(`Company: ${p.company}`);
        if (p.timezone) personalFacts.push(`Timezone: ${p.timezone}`);
        if (p.language) personalFacts.push(`Language: ${p.language}`);
        if (personalFacts.length > 0) {
          factsByCategory["Personal"] = personalFacts;
        }
      }

      // Preferences facts
      if (profile.facts.preferences) {
        const prefFacts: string[] = [];
        const pref = profile.facts.preferences;
        if (pref.languages && pref.languages.length > 0) {
          prefFacts.push(`Programming Languages: ${pref.languages.join(", ")}`);
        }
        if (pref.topics && pref.topics.length > 0) {
          prefFacts.push(`Topics of Interest: ${pref.topics.join(", ")}`);
        }
        if (pref.frameworks && pref.frameworks.length > 0) {
          prefFacts.push(`Frameworks: ${pref.frameworks.join(", ")}`);
        }
        if (pref.communication_style) {
          prefFacts.push(`Communication Style: ${pref.communication_style}`);
        }
        if (pref.learning_style) {
          prefFacts.push(`Learning Style: ${pref.learning_style}`);
        }
        if (prefFacts.length > 0) {
          factsByCategory["Preferences"] = prefFacts;
        }
      }

      // Technical context facts
      if (profile.facts.technical_context) {
        const techFacts: string[] = [];
        const tech = profile.facts.technical_context;
        if (tech.current_projects && tech.current_projects.length > 0) {
          techFacts.push(`Current Projects: ${tech.current_projects.join(", ")}`);
        }
        if (tech.frameworks && tech.frameworks.length > 0) {
          techFacts.push(`Using Frameworks: ${tech.frameworks.join(", ")}`);
        }
        if (tech.challenges && tech.challenges.length > 0) {
          techFacts.push(`Challenges: ${tech.challenges.join(", ")}`);
        }
        if (tech.goals && tech.goals.length > 0) {
          techFacts.push(`Goals: ${tech.goals.join(", ")}`);
        }
        if (tech.recent_technologies && tech.recent_technologies.length > 0) {
          techFacts.push(`Recent Technologies: ${tech.recent_technologies.join(", ")}`);
        }
        if (techFacts.length > 0) {
          factsByCategory["Technical Context"] = techFacts;
        }
      }

      // Get recent topics from recent conversations
      const recentConversations = await getRecentConversationSummaries(userId, 5);
      const recentTopics = new Set<string>();
      recentConversations.forEach((conv) => {
        if (conv.key_topics) {
          conv.key_topics.forEach((topic) => recentTopics.add(topic));
        }
        if (conv.technical_topics) {
          conv.technical_topics.forEach((topic) => recentTopics.add(topic));
        }
      });

      // Return transformed data
      res.status(200).json({
        success: true,
        data: {
          ...profile,
          factsByCategory,
          recentTopics: Array.from(recentTopics).slice(0, 10),
        },
      } as GetProfileResponse);
    } else {
      // No profile found
      res.status(200).json({
        success: true,
        data: null,
      } as GetProfileResponse);
    }
  } catch (error) {
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
export const getEvents = async (req: Request, res: Response): Promise<void> => {
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
      } as GetEventsResponse);
      return;
    }

    // Extract user ID from JWT payload (set by auth middleware)
    const user = (req as any).user;
    const userId = user?.id;

    if (!userId) {
      res.status(401).json({
        success: false,
        message: "Unauthorized",
      });
      return;
    }

    const page = parseInt(req.query.page as string) || 1;
    const limit = Math.min(parseInt(req.query.limit as string) || 50, 100); // Max 100
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
    } as GetEventsResponse);
  } catch (error) {
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
export const getSuggestions = async (req: Request, res: Response): Promise<void> => {
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
      } as GetSuggestionsResponse);
      return;
    }

    // Extract user ID from JWT payload (set by auth middleware)
    const user = (req as any).user;
    const userId = user?.id;

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
    const recentTopics = new Set<string>();
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
    } as GetSuggestionsResponse);
  } catch (error) {
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
export const clearMemory = async (req: Request, res: Response): Promise<void> => {
  try {
    // Extract user ID from JWT payload (set by auth middleware)
    const user = (req as any).user;
    const userId = user?.id;

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

    const eventsDeleted = (eventsResult[0] as any).rowCount || 0;
    const summariesDeleted = (summariesResult[0] as any).rowCount || 0;

    res.status(200).json({
      success: true,
      message: "Memory cleared successfully",
      data: {
        events_deleted: eventsDeleted,
        summaries_deleted: summariesDeleted,
        profile_cleared: true,
      },
    } as ClearMemoryResponse);
  } catch (error) {
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
export const getStats = async (req: Request, res: Response): Promise<void> => {
  try {
    if (!isLTMEnabled()) {
      res.status(200).json({
        success: true,
        data: null,
        message: "Long Term Memory is disabled",
      });
      return;
    }

    // Extract user ID from JWT payload (set by auth middleware)
    const user = (req as any).user;
    const userId = user?.id;

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
      sequelize.query(
        `
        SELECT 
          COUNT(*) as total,
          AVG(importance_score) as avg_importance
        FROM user_memory_events
        WHERE user_id = :userId
      `,
        { replacements: { userId } }
      ),
      sequelize.query(
        `
        SELECT COUNT(*) as total
        FROM user_conversation_summary
        WHERE user_id = :userId
      `,
        { replacements: { userId } }
      ),
      sequelize.query(
        `
        SELECT UNNEST(key_topics) as topic, COUNT(*) as count
        FROM user_conversation_summary
        WHERE user_id = :userId
        GROUP BY topic
        ORDER BY count DESC
        LIMIT 10
      `,
        { replacements: { userId } }
      ),
      sequelize.query(
        `
        SELECT event_type, COUNT(*) as count
        FROM user_memory_events
        WHERE user_id = :userId
        GROUP BY event_type
        ORDER BY count DESC
      `,
        { replacements: { userId } }
      ),
    ]);

    const eventsData = (eventsStats[0] as any[])[0];
    const summariesData = (summariesStats[0] as any[])[0];
    const topicsData = topicStats[0] as any[];
    const eventTypesData = eventTypeStats[0] as any[];

    // Count total facts from profile
    let totalFacts = 0;
    if (profile?.facts) {
      const { personal, preferences, technical_context } = profile.facts;
      // Count personal facts
      if (personal) {
        totalFacts += Object.values(personal).filter((v) => v !== undefined && v !== null).length;
      }
      // Count preference facts
      if (preferences) {
        const prefArrays = [preferences.languages, preferences.topics, preferences.frameworks];
        totalFacts += prefArrays.reduce((sum, arr) => sum + (arr?.length || 0), 0);
        if (preferences.communication_style) totalFacts++;
        if (preferences.learning_style) totalFacts++;
      }
      // Count technical context facts
      if (technical_context) {
        const techArrays = [
          technical_context.current_projects,
          technical_context.frameworks,
          technical_context.challenges,
          technical_context.goals,
          technical_context.recent_technologies,
        ];
        totalFacts += techArrays.reduce((sum, arr) => sum + (arr?.length || 0), 0);
      }
    }

    res.status(200).json({
      success: true,
      data: {
        totalFacts: totalFacts,
        totalConversations: parseInt(summariesData.total) || 0,
        totalMessages: parseInt(eventsData.total) || 0,
        lastUpdated: profile?.updated_at || null,
        factsByCategory: eventTypesData.reduce(
          (acc, t) => {
            acc[t.event_type] = parseInt(t.count);
            return acc;
          },
          {} as Record<string, number>
        ),
      },
    });
  } catch (error) {
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
export const getConfig = async (req: Request, res: Response): Promise<void> => {
  try {
    const config = getLTMConfig();

    res.status(200).json({
      success: true,
      data: config,
    });
  } catch (error) {
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
