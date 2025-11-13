import { getUserProfile, getUserEvents, generateChatSuggestions, getRecentConversationSummaries, clearUserProfile, isLTMEnabled, getLTMConfig, } from "../services/memory.service.js";
import sequelize from "../db/database.config.js";
export const getProfile = async (req, res) => {
    try {
        if (!isLTMEnabled()) {
            res.status(200).json({
                success: true,
                data: null,
                message: "Long Term Memory is disabled",
            });
            return;
        }
        const user = req.user;
        const userId = user?.id;
        if (!userId) {
            res.status(401).json({
                success: false,
                message: "Unauthorized",
            });
            return;
        }
        const profile = await getUserProfile(userId);
        if (profile) {
            const factsByCategory = {};
            if (profile.facts.personal) {
                const personalFacts = [];
                const p = profile.facts.personal;
                if (p.name)
                    personalFacts.push(`Name: ${p.name}`);
                if (p.location)
                    personalFacts.push(`Location: ${p.location}`);
                if (p.occupation)
                    personalFacts.push(`Occupation: ${p.occupation}`);
                if (p.company)
                    personalFacts.push(`Company: ${p.company}`);
                if (p.timezone)
                    personalFacts.push(`Timezone: ${p.timezone}`);
                if (p.language)
                    personalFacts.push(`Language: ${p.language}`);
                if (personalFacts.length > 0) {
                    factsByCategory["Personal"] = personalFacts;
                }
            }
            if (profile.facts.preferences) {
                const prefFacts = [];
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
            if (profile.facts.technical_context) {
                const techFacts = [];
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
            const recentConversations = await getRecentConversationSummaries(userId, 5);
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
                    ...profile,
                    factsByCategory,
                    recentTopics: Array.from(recentTopics).slice(0, 10),
                },
            });
        }
        else {
            res.status(200).json({
                success: true,
                data: null,
            });
        }
    }
    catch (error) {
        res.status(500).json({
            success: false,
            message: error instanceof Error ? error.message : "Internal server error",
        });
    }
};
export const getEvents = async (req, res) => {
    try {
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
        const user = req.user;
        const userId = user?.id;
        if (!userId) {
            res.status(401).json({
                success: false,
                message: "Unauthorized",
            });
            return;
        }
        const page = parseInt(req.query.page) || 1;
        const limit = Math.min(parseInt(req.query.limit) || 50, 100);
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
export const getSuggestions = async (req, res) => {
    try {
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
        const user = req.user;
        const userId = user?.id;
        if (!userId) {
            res.status(401).json({
                success: false,
                message: "Unauthorized",
            });
            return;
        }
        const [suggestions, recentConversations] = await Promise.all([
            generateChatSuggestions(userId),
            getRecentConversationSummaries(userId, 5),
        ]);
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
export const clearMemory = async (req, res) => {
    try {
        const user = req.user;
        const userId = user?.id;
        if (!userId) {
            res.status(401).json({
                success: false,
                message: "Unauthorized",
            });
            return;
        }
        const [eventsResult, summariesResult] = await Promise.all([
            sequelize.query(`DELETE FROM user_memory_events WHERE user_id = :userId`, {
                replacements: { userId },
            }),
            sequelize.query(`DELETE FROM user_conversation_summary WHERE user_id = :userId`, {
                replacements: { userId },
            }),
        ]);
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
        const user = req.user;
        const userId = user?.id;
        if (!userId) {
            res.status(401).json({
                success: false,
                message: "Unauthorized",
            });
            return;
        }
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
        let totalFacts = 0;
        if (profile?.facts) {
            const { personal, preferences, technical_context } = profile.facts;
            if (personal) {
                totalFacts += Object.values(personal).filter((v) => v !== undefined && v !== null).length;
            }
            if (preferences) {
                const prefArrays = [preferences.languages, preferences.topics, preferences.frameworks];
                totalFacts += prefArrays.reduce((sum, arr) => sum + (arr?.length || 0), 0);
                if (preferences.communication_style)
                    totalFacts++;
                if (preferences.learning_style)
                    totalFacts++;
            }
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
                factsByCategory: eventTypesData.reduce((acc, t) => {
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
