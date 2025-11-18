/**
 * 🚀 SIDEBAR STATE STORE - Single Source of Truth
 * Centralized state management for sidebar with optimistic UI updates
 *
 * Architecture:
 * - Projects: Map<projectId, Project>
 * - Conversations: Map<conversationId, Conversation>
 * - Calculated Fields: conversation_count computed from actual conversations
 *
 * Benefits:
 * - Instant UI updates (optimistic)
 * - Consistent state across components
 * - Automatic badge count calculation
 * - Rollback mechanism for errors
 */

import React, {
  createContext,
  useContext,
  useState,
  useCallback,
  useMemo,
  ReactNode,
} from "react";
import type { ConversationListItem } from "../types/chat.type";
import type { Project } from "../types/project.type";

// ==================== TYPES ====================

interface SidebarState {
  // Core data stores (Single Source of Truth)
  conversations: Map<string, ConversationListItem>;
  projects: Map<string, Project>;

  // UI state
  isLoading: boolean;
  error: string | null;

  // Transaction tracking for rollback
  pendingTransactions: Map<string, Transaction>;
}

interface Transaction {
  id: string;
  type: "move" | "create" | "update" | "delete";
  timestamp: number;
  rollback: () => void;
}

interface SidebarContextValue extends SidebarState {
  // Computed properties
  conversationsByProject: (projectId: string | null) => ConversationListItem[];
  projectConversationCount: (projectId: string) => number;
  allStandaloneConversations: ConversationListItem[];

  // Actions
  setConversations: (conversations: ConversationListItem[]) => void;
  addConversations: (conversations: ConversationListItem[]) => void; // Merge without replacing
  setProjects: (projects: Project[]) => void;

  // Optimistic updates
  moveConversationOptimistic: (
    conversationId: string,
    fromProjectId: string | null,
    toProjectId: string | null
  ) => string; // Returns transaction ID

  createConversationOptimistic: (conversation: ConversationListItem) => void;
  updateConversationOptimistic: (
    conversationId: string,
    updates: Partial<ConversationListItem>
  ) => void;
  deleteConversationOptimistic: (conversationId: string) => string;

  createProjectOptimistic: (project: Project) => void;
  updateProjectOptimistic: (
    projectId: string,
    updates: Partial<Project>
  ) => void;
  deleteProjectOptimistic: (projectId: string) => string;

  // Transaction management
  commitTransaction: (transactionId: string) => void;
  rollbackTransaction: (transactionId: string) => void;

  // Utility
  refreshConversation: (
    conversationId: string,
    data: ConversationListItem
  ) => void;
  refreshProject: (projectId: string, data: Project) => void;
  setError: (error: string | null) => void;
  setLoading: (loading: boolean) => void;
}

// ==================== CONTEXT ====================

const SidebarContext = createContext<SidebarContextValue | null>(null);

export const useSidebarStore = () => {
  const context = useContext(SidebarContext);
  if (!context) {
    throw new Error("useSidebarStore must be used within SidebarProvider");
  }
  return context;
};

// ==================== PROVIDER ====================

interface SidebarProviderProps {
  children: ReactNode;
}

export const SidebarProvider: React.FC<SidebarProviderProps> = ({
  children,
}) => {
  const [state, setState] = useState<SidebarState>({
    conversations: new Map(),
    projects: new Map(),
    isLoading: false,
    error: null,
    pendingTransactions: new Map(),
  });

  // ==================== COMPUTED PROPERTIES ====================

  /**
   * Get conversations for a specific project (or standalone if projectId is null)
   */
  const conversationsByProject = useCallback(
    (projectId: string | null): ConversationListItem[] => {
      return Array.from(state.conversations.values())
        .filter((conv) => conv.project_id === projectId)
        .sort((a, b) => {
          // Sort by order_in_project if in a project, otherwise by updatedAt
          if (projectId !== null) {
            return (a.order_in_project || 0) - (b.order_in_project || 0);
          }
          return (
            new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime()
          );
        });
    },
    [state.conversations]
  );

  /**
   * 🔥 KEY FEATURE: Calculate project conversation count from actual state
   * This fixes the desync issue where badge shows (1) but no conversations visible
   */
  const projectConversationCount = useCallback(
    (projectId: string): number => {
      return Array.from(state.conversations.values()).filter(
        (conv) => conv.project_id === projectId
      ).length;
    },
    [state.conversations]
  );

  /**
   * Get all standalone conversations (not in any project)
   */
  const allStandaloneConversations = useMemo(() => {
    return conversationsByProject(null);
  }, [conversationsByProject]);

  // ==================== BASIC SETTERS ====================

  const setConversations = useCallback(
    (conversations: ConversationListItem[]) => {
      setState((prev) => ({
        ...prev,
        conversations: new Map(conversations.map((c) => [c.id, c])),
      }));
    },
    []
  );

  /**
   * Add/merge conversations into existing store without replacing
   */
  const addConversations = useCallback(
    (conversations: ConversationListItem[]) => {
      setState((prev) => {
        const newConversations = new Map(prev.conversations);
        conversations.forEach((c) => {
          newConversations.set(c.id, c);
        });
        return {
          ...prev,
          conversations: newConversations,
        };
      });
    },
    []
  );

  const setProjects = useCallback((projects: Project[]) => {
    setState((prev) => ({
      ...prev,
      projects: new Map(projects.map((p) => [p.id, p])),
    }));
  }, []);

  const setError = useCallback((error: string | null) => {
    setState((prev) => ({ ...prev, error }));
  }, []);

  const setLoading = useCallback((loading: boolean) => {
    setState((prev) => ({ ...prev, isLoading: loading }));
  }, []);

  // ==================== OPTIMISTIC UPDATES ====================

  /**
   * 🚀 OPTIMISTIC: Move conversation between projects
   * Returns transaction ID for rollback if needed
   */
  const moveConversationOptimistic = useCallback(
    (
      conversationId: string,
      fromProjectId: string | null,
      toProjectId: string | null
    ): string => {
      // 🔥 P1 FIX: Use crypto.randomUUID() instead of timestamp to prevent collision
      const transactionId = `move_${conversationId}_${crypto.randomUUID()}`;
      const conversation = state.conversations.get(conversationId);

      if (!conversation) {
        console.warn(`Conversation ${conversationId} not found for move`);
        return transactionId;
      }

      // Save rollback state
      const oldProjectId = conversation.project_id;
      const oldOrder = conversation.order_in_project;

      const rollback = () => {
        setState((prev) => {
          const newConversations = new Map(prev.conversations);
          const conv = newConversations.get(conversationId);
          if (conv) {
            newConversations.set(conversationId, {
              ...conv,
              project_id: oldProjectId,
              order_in_project: oldOrder,
            });
          }
          return {
            ...prev,
            conversations: newConversations,
            pendingTransactions: new Map(
              Array.from(prev.pendingTransactions).filter(
                ([id]) => id !== transactionId
              )
            ),
          };
        });
      };

      // Optimistic update
      setState((prev) => {
        const newConversations = new Map(prev.conversations);
        newConversations.set(conversationId, {
          ...conversation,
          project_id: toProjectId,
          order_in_project: toProjectId ? 0 : conversation.order_in_project,
          updatedAt: new Date().toISOString(), // Move to top
        });

        const newTransactions = new Map(prev.pendingTransactions);
        newTransactions.set(transactionId, {
          id: transactionId,
          type: "move",
          timestamp: Date.now(),
          rollback,
        });

        return {
          ...prev,
          conversations: newConversations,
          pendingTransactions: newTransactions,
        };
      });

      return transactionId;
    },
    [state.conversations]
  );

  /**
   * 🚀 OPTIMISTIC: Create new conversation
   */
  const createConversationOptimistic = useCallback(
    (conversation: ConversationListItem) => {
      setState((prev) => {
        const newConversations = new Map(prev.conversations);
        newConversations.set(conversation.id, conversation);
        return {
          ...prev,
          conversations: newConversations,
        };
      });
    },
    []
  );

  /**
   * 🚀 OPTIMISTIC: Update conversation
   */
  const updateConversationOptimistic = useCallback(
    (conversationId: string, updates: Partial<ConversationListItem>) => {
      setState((prev) => {
        const newConversations = new Map(prev.conversations);
        const existing = newConversations.get(conversationId);
        if (existing) {
          newConversations.set(conversationId, { ...existing, ...updates });
        }
        return {
          ...prev,
          conversations: newConversations,
        };
      });
    },
    []
  );

  /**
   * 🚀 OPTIMISTIC: Delete conversation
   */
  const deleteConversationOptimistic = useCallback(
    (conversationId: string): string => {
      // 🔥 P1 FIX: Use crypto.randomUUID() instead of timestamp
      const transactionId = `delete_${conversationId}_${crypto.randomUUID()}`;
      const conversation = state.conversations.get(conversationId);

      const rollback = () => {
        if (conversation) {
          setState((prev) => {
            const newConversations = new Map(prev.conversations);
            newConversations.set(conversationId, conversation);
            return {
              ...prev,
              conversations: newConversations,
              pendingTransactions: new Map(
                Array.from(prev.pendingTransactions).filter(
                  ([id]) => id !== transactionId
                )
              ),
            };
          });
        }
      };

      setState((prev) => {
        const newConversations = new Map(prev.conversations);
        newConversations.delete(conversationId);

        const newTransactions = new Map(prev.pendingTransactions);
        newTransactions.set(transactionId, {
          id: transactionId,
          type: "delete",
          timestamp: Date.now(),
          rollback,
        });

        return {
          ...prev,
          conversations: newConversations,
          pendingTransactions: newTransactions,
        };
      });

      return transactionId;
    },
    [state.conversations]
  );

  /**
   * 🚀 OPTIMISTIC: Create new project
   */
  const createProjectOptimistic = useCallback((project: Project) => {
    setState((prev) => {
      const newProjects = new Map(prev.projects);
      newProjects.set(project.id, project);
      return {
        ...prev,
        projects: newProjects,
      };
    });
  }, []);

  /**
   * 🚀 OPTIMISTIC: Update project
   */
  const updateProjectOptimistic = useCallback(
    (projectId: string, updates: Partial<Project>) => {
      setState((prev) => {
        const newProjects = new Map(prev.projects);
        const existing = newProjects.get(projectId);
        if (existing) {
          newProjects.set(projectId, { ...existing, ...updates });
        }
        return {
          ...prev,
          projects: newProjects,
        };
      });
    },
    []
  );

  /**
   * 🚀 OPTIMISTIC: Delete project
   */
  const deleteProjectOptimistic = useCallback(
    (projectId: string): string => {
      // 🔥 P1 FIX: Use crypto.randomUUID() instead of timestamp
      const transactionId = `delete_project_${projectId}_${crypto.randomUUID()}`;
      const project = state.projects.get(projectId);

      const rollback = () => {
        if (project) {
          setState((prev) => {
            const newProjects = new Map(prev.projects);
            newProjects.set(projectId, project);
            return {
              ...prev,
              projects: newProjects,
              pendingTransactions: new Map(
                Array.from(prev.pendingTransactions).filter(
                  ([id]) => id !== transactionId
                )
              ),
            };
          });
        }
      };

      setState((prev) => {
        const newProjects = new Map(prev.projects);
        newProjects.delete(projectId);

        // Also move all conversations from this project to standalone
        const newConversations = new Map(prev.conversations);
        Array.from(newConversations.values())
          .filter((conv) => conv.project_id === projectId)
          .forEach((conv) => {
            newConversations.set(conv.id, { ...conv, project_id: null });
          });

        const newTransactions = new Map(prev.pendingTransactions);
        newTransactions.set(transactionId, {
          id: transactionId,
          type: "delete",
          timestamp: Date.now(),
          rollback,
        });

        return {
          ...prev,
          projects: newProjects,
          conversations: newConversations,
          pendingTransactions: newTransactions,
        };
      });

      return transactionId;
    },
    [state.projects]
  );

  // ==================== TRANSACTION MANAGEMENT ====================

  /**
   * Commit transaction (remove from pending)
   */
  const commitTransaction = useCallback((transactionId: string) => {
    setState((prev) => {
      const newTransactions = new Map(prev.pendingTransactions);
      newTransactions.delete(transactionId);
      return {
        ...prev,
        pendingTransactions: newTransactions,
      };
    });
  }, []);

  /**
   * Rollback transaction (undo optimistic update)
   */
  const rollbackTransaction = useCallback((transactionId: string) => {
    setState((prev) => {
      const transaction = prev.pendingTransactions.get(transactionId);
      if (transaction) {
        transaction.rollback();
      }
      return prev; // Rollback function will update state
    });
  }, []);

  // ==================== UTILITY ====================

  /**
   * Refresh single conversation from server data
   */
  const refreshConversation = useCallback(
    (conversationId: string, data: ConversationListItem) => {
      setState((prev) => {
        const newConversations = new Map(prev.conversations);
        newConversations.set(conversationId, data);
        return {
          ...prev,
          conversations: newConversations,
        };
      });
    },
    []
  );

  /**
   * Refresh single project from server data
   */
  const refreshProject = useCallback((projectId: string, data: Project) => {
    setState((prev) => {
      const newProjects = new Map(prev.projects);
      newProjects.set(projectId, data);
      return {
        ...prev,
        projects: newProjects,
      };
    });
  }, []);

  // ==================== CONTEXT VALUE ====================

  const value: SidebarContextValue = {
    ...state,
    conversationsByProject,
    projectConversationCount,
    allStandaloneConversations,
    setConversations,
    addConversations,
    setProjects,
    moveConversationOptimistic,
    createConversationOptimistic,
    updateConversationOptimistic,
    deleteConversationOptimistic,
    createProjectOptimistic,
    updateProjectOptimistic,
    deleteProjectOptimistic,
    commitTransaction,
    rollbackTransaction,
    refreshConversation,
    refreshProject,
    setError,
    setLoading,
  };

  return (
    <SidebarContext.Provider value={value}>{children}</SidebarContext.Provider>
  );
};
