/**
 * ChatPage Component
 * Main chat interface with sidebar and message area
 */

import React, { useState, useEffect, useRef } from "react";
import { Layout, Typography, App } from "antd";
import {
  createConversation as apiCreateConversation,
  generateConversationTitle as apiGenerateTitle,
  updateConversation as apiUpdateConversation,
} from "../services/chat.service";
import { useNavigate, useParams, useLocation } from "react-router-dom";
import Sidebar from "../components/Sidebar";
import MessageList from "../components/MessageList";
import ChatInput from "../components/ChatInput";
import type { FileAttachment } from "../types/file.types";
import { ConversationSearch } from "../components/ConversationSearch";
import {
  SettingsModal,
  ProfileModal,
  PinnedMessagesDropdown,
  NewChatSuggestions,
  MemoryDashboard,
} from "../components";
// ConversationForm not used anymore in new draft mode flow
// import ConversationForm, {
//   ConversationFormValues,
// } from "../components/ConversationForm";
import { useChat, useWebSocket, useRealTimeChat } from "../hooks";
import {
  Conversation,
  ConversationListItem,
  Message,
} from "../types/chat.type";
import { PendingMessage } from "../types/offline-message.type";
import { websocketService } from "../services/websocket.service";
import { NetworkStatus, TypingIndicator } from "../components";
import {
  searchConversation,
  ContextMessage,
  SearchMessage,
} from "../services/searchService";
import { useAuthContext } from "../hooks/useAuthContext";
import { usePreferences } from "../stores/preferences.store";
import styles from "./ChatPage.module.css";

const { Content } = Layout;
const { Title } = Typography;

/**
 * LocalStorage key for cached new chat suggestions
 */
const NEW_CHAT_SUGGESTIONS_CACHE_KEY = "newChatSuggestionsCache";

/**
 * Helper function to load cached suggestions from localStorage
 */
const loadCachedSuggestions = (): string[] => {
  try {
    const cached = localStorage.getItem(NEW_CHAT_SUGGESTIONS_CACHE_KEY);
    if (cached) {
      const parsed = JSON.parse(cached);
      if (Array.isArray(parsed) && parsed.length > 0) {
        return parsed;
      }
    }
  } catch (err) {
    console.error("[Cache] Failed to load cached suggestions:", err);
  }
  return [];
};

/**
 * Helper function to save suggestions to localStorage
 */
const saveSuggestionsToCache = (suggestions: string[]): void => {
  try {
    localStorage.setItem(
      NEW_CHAT_SUGGESTIONS_CACHE_KEY,
      JSON.stringify(suggestions)
    );
  } catch (err) {
    console.error("[Cache] Failed to save suggestions to cache:", err);
  }
};

/**
 * Helper function to dispatch both message:sent and conversation:activity events
 * This ensures conversation list updates immediately when a message is sent
 */
const notifyMessageSent = (conversationId: string) => {
  try {
    window.dispatchEvent(new Event("message:sent"));
    window.dispatchEvent(
      new CustomEvent("conversation:activity", {
        detail: {
          conversationId,
          lastActivity: new Date().toISOString(),
        },
      })
    );
  } catch {
    // Ignore errors in event dispatch
  }
};

/**
 * ChatPage component
 * Main layout for chat interface with sidebar and message area
 */
const ChatPage: React.FC = () => {
  const { message: antdMessage } = App.useApp();
  const { user } = useAuthContext();

  // Fetch user preferences on mount
  const { fetchPreferences } = usePreferences();

  // Settings modal state
  const [settingsModalOpen, setSettingsModalOpen] = useState(false);

  // Profile modal state
  const [profileModalOpen, setProfileModalOpen] = useState(false);

  // Memory Dashboard modal state
  const [memoryDashboardOpen, setMemoryDashboardOpen] = useState(false);

  // Search state
  const [searchQuery, setSearchQuery] = useState<string>("");

  // Network status
  const [isOnline, setIsOnline] = useState(navigator.onLine);

  // Ref to store message DOM elements for scroll-to functionality
  const messageRefs = useRef<Map<string, HTMLElement>>(new Map());
  const [highlightedMessageId, setHighlightedMessageId] = useState<
    string | null
  >(null);

  const {
    conversations,
    isLoading: isLoadingConversations,
    isLoadingMore: isLoadingMoreConversations,
    hasMore: conversationsHasMore,
    loadMore: loadMoreConversations,
    updateConversationOptimistic,
    moveConversationToTop,
    removeConversation,
    refreshConversations,
  } = useChat({ searchQuery, limit: 20 });

  // Message and UI state
  const [currentConversation, setCurrentConversation] =
    useState<Conversation | null>(null);

  // WebSocket integration
  const { isConnected } = useWebSocket();
  const {
    sendMessage: sendRealtimeMessage,
    isAITyping,
    startTyping,
    stopTyping,
    isSending: isSendingRealtimeMessage,
    joinConversation,
    leaveConversation,
  } = useRealTimeChat({
    conversation: currentConversation,
    onConversationUpdate: (update) => {
      if (currentConversation) {
        setCurrentConversation((prev) =>
          prev ? { ...prev, ...update } : null
        );
      }
    },
  });

  // Message and UI state
  const [messages, setMessages] = useState<Message[]>([]);
  const [messagesPage, setMessagesPage] = useState<number>(1);
  const [messagesHasMore, setMessagesHasMore] = useState<boolean>(false);
  const [isLoadingMessages, setIsLoadingMessages] = useState(false);
  const [isSendingMessage, setIsSendingMessage] = useState(false);

  // Pinned messages refresh trigger
  const [pinnedRefreshTrigger, setPinnedRefreshTrigger] = useState(0);

  // 🚀 OPTIMISTIC UI: Client-side pin state management
  const [pinnedMessageIds, setPinnedMessageIds] = useState<Set<string>>(
    new Set()
  );

  // Unread tracking state (multi-tab)
  const [unreadConversations, setUnreadConversations] = useState<Set<string>>(
    new Set()
  );

  // Conversation followup suggestions state
  const [conversationSuggestions, setConversationSuggestions] = useState<
    string[]
  >([]);

  // Ref to prevent concurrent conversation loads (fixes freezing issue)
  const loadingConversationRef = useRef<string | null>(null);
  const [
    isLoadingConversationSuggestions,
    setIsLoadingConversationSuggestions,
  ] = useState(false);

  // New Chat suggestions state (for empty chat screen)
  // Initialize with cached suggestions for instant display
  const [newChatSuggestions, setNewChatSuggestions] = useState<string[]>(
    loadCachedSuggestions()
  );
  const [isLoadingNewChatSuggestions, setIsLoadingNewChatSuggestions] =
    useState(false);

  // Sidebar is rendered by the new Sidebar component

  // Modal/form state for creating conversation - deprecated in draft mode
  // const [isModalVisible, setIsModalVisible] = useState(false);
  // const [isCreating, setIsCreating] = useState(false);
  const navigate = useNavigate();
  const params = useParams();
  const location = useLocation();

  // Load messages for a conversation from server
  const loadMessages = async (conversationId: string, page = 1) => {
    // 🚀 PERFORMANCE: Check cache first
    const { default: messageCache } = await import(
      "../services/message-cache.service"
    );
    const cached = messageCache.get(conversationId, page);

    if (cached) {
      // Use cached data immediately - instant load!
      if (page === 1) {
        setMessages(cached.messages);

        // 🔥 FIX: Initialize pinnedMessageIds from loaded messages
        const pinnedIds = new Set(
          cached.messages.filter((msg) => msg.pinned).map((msg) => msg.id)
        );
        setPinnedMessageIds(pinnedIds);
      } else {
        setMessages((prev) => [...cached.messages, ...prev]);

        // 🔥 FIX: Merge pinned message IDs from older pages
        setPinnedMessageIds((prev) => {
          const newSet = new Set(prev);
          cached.messages.forEach((msg) => {
            if (msg.pinned) newSet.add(msg.id);
          });
          return newSet;
        });
      }
      setMessagesPage(cached.pagination.page);
      setMessagesHasMore(cached.pagination.hasMore);

      // No loading indicator needed for cached data
      return;
    }

    // Cache miss - fetch from server
    setIsLoadingMessages(true);
    try {
      const svc = await import("../services/chat.service");
      const result = await svc.getMessages(conversationId, page, 20);

      // Store in cache for future use
      messageCache.set(conversationId, page, result.messages, {
        ...result.pagination,
        hasMore: result.pagination.page < result.pagination.totalPages,
      });

      if (page === 1) {
        // initial load: replace messages with the most recent page
        setMessages(result.messages);

        // 🔥 FIX: Initialize pinnedMessageIds from loaded messages
        const pinnedIds = new Set(
          result.messages.filter((msg) => msg.pinned).map((msg) => msg.id)
        );
        setPinnedMessageIds(pinnedIds);
      } else {
        // older pages (page > 1): prepend older messages before existing list
        setMessages((prev) => [...result.messages, ...prev]);

        // 🔥 FIX: Merge pinned message IDs from older pages
        setPinnedMessageIds((prev) => {
          const newSet = new Set(prev);
          result.messages.forEach((msg) => {
            if (msg.pinned) newSet.add(msg.id);
          });
          return newSet;
        });
      }
      setMessagesPage(result.pagination.page);
      setMessagesHasMore(result.pagination.page < result.pagination.totalPages);
    } catch (err: any) {
      console.error("[ChatPage] Failed to load messages:", {
        conversationId,
        page,
        error: err?.message || err,
        response: err?.response?.data,
      });
      antdMessage.error("Failed to load messages");
      setMessages([]);
    } finally {
      setIsLoadingMessages(false);
    }
  };

  /**
   * Handle search result click - scroll to message and highlight
   */
  // Keep track of ongoing result scroll attempts to avoid duplicates
  const resultScrollInProgress = useRef<Map<string, boolean>>(new Map());

  const handleSearchResultClick = async (
    messageId: string,
    match?: SearchMessage,
    context?: { before: ContextMessage[]; after: ContextMessage[] }
  ) => {
    if (!messageId) return;

    // Avoid duplicate concurrent attempts for the same message
    if (resultScrollInProgress.current.get(messageId)) return;
    resultScrollInProgress.current.set(messageId, true);

    const attemptScroll = async (attemptsLeft = 8): Promise<boolean> => {
      const messageElement = messageRefs.current.get(messageId);
      if (messageElement) {
        try {
          // Decide whether to use smooth scrolling or instant jump based on distance
          let behavior: ScrollBehavior = "smooth";
          try {
            const container = messageElement.closest(
              "[data-message-list]"
            ) as HTMLElement | null;
            if (container) {
              const elTop = messageElement.offsetTop;
              const scrollTop = container.scrollTop;
              const centerTarget = elTop - container.clientHeight / 2;
              const distance = Math.abs(centerTarget - scrollTop);
              if (distance > 1200) {
                // Large distance -> immediate jump
                behavior = "auto";
              }
            }
          } catch (e) {
            /* fail silently */
          }

          messageElement.scrollIntoView({ behavior, block: "center" });
        } catch (err) {
          // ignore scroll errors
        }

        // Add highlight
        setHighlightedMessageId(messageId);

        // Remove highlight after 3 seconds
        setTimeout(() => {
          setHighlightedMessageId(null);
        }, 3000);

        return true;
      }

      // If not found, but we have search context around this message, insert those messages
      if (
        !messageElement &&
        context &&
        (context.before.length > 0 || context.after.length > 0) &&
        currentConversation
      ) {
        // Convert context messages to Message type and merge (dedupe)
        const toAdd: Message[] = [];

        const mapToMsg = (cm: ContextMessage | SearchMessage): Message => ({
          id: cm.message_id,
          conversation_id:
            "conversation_id" in cm && cm.conversation_id
              ? cm.conversation_id
              : currentConversation.id,
          role: cm.role,
          content: cm.content,
          tokens_used: ("tokens_used" in cm && (cm as any).tokens_used) || 0,
          model: ("model" in cm && (cm as any).model) || "",
          createdAt: cm.createdAt || new Date().toISOString(),
        });

        // Add before, match (if provided), after
        context.before.forEach((cm) => toAdd.push(mapToMsg(cm)));
        if (match) toAdd.push(mapToMsg(match));
        context.after.forEach((cm) => toAdd.push(mapToMsg(cm)));

        // Merge into messages, avoid duplicates by id
        setMessages((prev) => {
          const existingIds = new Set(prev.map((m) => m.id));
          const merged = [...prev];
          toAdd.forEach((m) => {
            if (!existingIds.has(m.id)) {
              merged.push(m);
            }
          });
          // Sort by timestamp
          merged.sort(
            (a, b) =>
              new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime()
          );
          return merged;
        });

        // Wait for DOM to update with a small retry loop (up to ~500ms)
        let retryElement: HTMLElement | undefined = undefined;
        for (let i = 0; i < 8; i++) {
          retryElement = messageRefs.current.get(messageId);
          if (retryElement) break;
          await new Promise((r) => setTimeout(r, 60));
        }
        if (retryElement) {
          try {
            retryElement.scrollIntoView({ behavior: "auto", block: "center" });
          } catch {}

          setHighlightedMessageId(messageId);
          setTimeout(() => setHighlightedMessageId(null), 3000);
          return true;
        }
      }

      // Otherwise, if not found and there are more messages, load earlier pages and retry
      if (attemptsLeft > 0 && messagesHasMore) {
        try {
          await loadEarlier();
          // Wait a short period for React refs to be set after loading
          await new Promise((r) => setTimeout(r, 160));
          return attemptScroll(attemptsLeft - 1);
        } catch (err) {
          // If load earlier fails, stop retrying
          return false;
        }
      }

      return false;
    };

    try {
      await attemptScroll();
    } finally {
      resultScrollInProgress.current.delete(messageId);
    }
  };

  /**
   * Handle creating a new conversation
   * Deprecated: Modal approach replaced with inline draft mode
   */
  /*
  const openNewConversationModal = () => {
    setIsModalVisible(true);
  };

  const handleCreateSubmit = async (values: ConversationFormValues) => {
    const payload = {
      title: values.title,
      model: values.model || "gpt-4o-mini",
      context_window: values.context_window || 10,
    };

    setIsCreating(true);
    try {
      const conversation = await apiCreateConversation(payload as any);
      antdMessage.success("Conversation created");

      setIsModalVisible(false);

      navigate(`/conversations/${conversation.id}`);

      await refreshConversations();

      try {
        window.dispatchEvent(new Event("conversations:refresh"));
      } catch {}

      if (isConnected) {
        try {
          websocketService.notifyConversationCreated(conversation as any);
        } catch {}
      }
      setCurrentConversation(conversation as any);
      setMessages([]);
    } catch (err: any) {
      antdMessage.error(
        err?.response?.data?.message || "Failed to create conversation"
      );
    } finally {
      setIsCreating(false);
    }
  };
  */

  /**
   * Handle New Conversation button click
   * Navigate to home route to show empty chat (draft mode)
   * 🔥 OVERLOADED: Accepts boolean (forceRegenerate) or string (projectId)
   */
  const handleNewConversation = (
    forceRegenerateOrProjectId: boolean | string = false
  ) => {
    // If string parameter (projectId), delegate to ProjectSection logic
    if (typeof forceRegenerateOrProjectId === "string") {
      // ProjectSection will handle creating conversation with projectId
      // This code path shouldn't navigate or clear state
      return;
    }

    // Boolean parameter: Handle double-click smart suggestion logic
    const forceRegenerate = forceRegenerateOrProjectId;

    // Navigate to home route to show empty chat interface
    navigate("/");
    // Clear current conversation to show draft mode
    setCurrentConversation(null);
    setMessages([]);
    setMessagesPage(1);
    setMessagesHasMore(false);

    // 🔥 FIX: Clear pinned message IDs when creating new conversation
    setPinnedMessageIds(new Set());

    // 🔥 SMART SUGGESTION LOADING:
    // Single click (forceRegenerate=false): Show cached suggestions instantly
    // Double click (forceRegenerate=true): Regenerate fresh suggestions from recent context
    fetchNewChatSuggestions(forceRegenerate);
  };

  /**
   * Handle selecting a conversation
   */
  const handleSelectConversation = (conversationId: string) => {
    // Navigate to conversation URL which will trigger loader via useEffect
    navigate(`/conversations/${conversationId}`);
  };

  // Auto-load conversation when params.id changes
  // Avoid including `currentConversation` in deps because we set it inside
  // this effect which would cause an infinite loop. Track previous id with a ref
  // so we can leave the old conversation when navigating to a new one.
  const prevConversationIdRef = useRef<string | null>(null);

  // Track newly created conversations to avoid race condition with message loading
  const justCreatedConversationIdRef = useRef<string | null>(null);

  // Track if we're currently creating and sending for a new conversation
  // This prevents useEffect from interfering during the critical send phase
  const isCreatingAndSendingRef = useRef<boolean>(false);

  // Debounce map for message:complete events to prevent duplicate processing
  const messageCompleteDebouncer = useRef(new Map<string, number>());

  // Message queue system to handle concurrent sends
  interface QueuedMessage {
    content: string;
    attachments?: FileAttachment[];
    metadata?: {
      resendMessageId?: string;
      editMessageId?: string;
      originalContent?: string;
    };
    timestamp: number;
  }

  const messageQueueRef = useRef<QueuedMessage[]>([]);
  const isProcessingQueueRef = useRef<boolean>(false);

  // Fetch user preferences on mount (auto-creates if doesn't exist)
  useEffect(() => {
    fetchPreferences().catch((err) => {});
  }, [fetchPreferences]);

  // Cleanup effect to prevent memory leaks
  useEffect(() => {
    return () => {
      // Clear message refs map to prevent memory leak
      messageRefs.current.clear();

      // Clear debouncer
      messageCompleteDebouncer.current.clear();

      // Clear message queue
      messageQueueRef.current = [];

      // Reset processing flags
      isCreatingAndSendingRef.current = false;
      isProcessingQueueRef.current = false;
    };
  }, []);

  // Limit messageRefs size to prevent unbounded growth
  useEffect(() => {
    if (messageRefs.current.size > 200) {
      // Keep only last 200 message refs
      const entries = Array.from(messageRefs.current.entries());
      const lastEntries = entries.slice(-200);
      messageRefs.current.clear();
      lastEntries.forEach(([key, value]) => {
        messageRefs.current.set(key, value);
      });
    }
  }, [messages.length]);

  // Network connectivity monitoring
  useEffect(() => {
    const handleOnline = () => {
      setIsOnline(true);
      antdMessage.success("Connection restored. You can now send messages.");
    };

    const handleOffline = () => {
      setIsOnline(false);
      antdMessage.warning(
        "Connection lost. Messages will be queued and sent when online."
      );

      // Mark all pending/sending messages as failed when going offline
      setMessages((prev) =>
        prev.map((msg) =>
          msg.localStatus === "pending" || msg.localStatus === "sending"
            ? {
                ...msg,
                localStatus: "failed",
                errorMessage: "Connection lost. Click retry when online.",
                lastAttemptAt: new Date().toISOString(),
              }
            : msg
        )
      );
    };

    window.addEventListener("online", handleOnline);
    window.addEventListener("offline", handleOffline);

    return () => {
      window.removeEventListener("online", handleOnline);
      window.removeEventListener("offline", handleOffline);
    };
  }, [antdMessage]);

  useEffect(() => {
    const id = params.id;
    const prevId = prevConversationIdRef.current;

    // If we previously joined a conversation and the id changed, leave it.
    if (prevId && prevId !== id) {
      leaveConversation(prevId);
    }

    // Update the ref to the current params id
    prevConversationIdRef.current = id || null;

    // If there's no id in params (navigated to '/'), clear current conversation and messages
    if (!id) {
      setCurrentConversation(null);
      setMessages([]);
      setMessagesPage(1);
      setMessagesHasMore(false);

      // 🔥 FIX: Clear pinned message IDs when navigating to home
      setPinnedMessageIds(new Set());

      return;
    }

    const loadConversation = async (convId: string) => {
      // CRITICAL: Validate conversation ID
      if (!convId || typeof convId !== "string" || convId.trim() === "") {
        console.warn("[ChatPage] Invalid conversation ID:", convId);
        setCurrentConversation(null);
        setMessages([]);
        loadingConversationRef.current = null;
        setIsLoadingMessages(false);
        return;
      }

      // IMPORTANT: Don't load if we're in the middle of creating and sending
      // This prevents race condition where useEffect clears optimistic messages
      if (isCreatingAndSendingRef.current) {
        return;
      }

      // IMPORTANT: Prevent concurrent loads of the same conversation
      // This fixes the freezing issue caused by race conditions
      if (loadingConversationRef.current === convId) {
        return;
      }

      // IMPORTANT: Don't reload if we already have this conversation loaded with messages
      // This prevents unnecessary reloads after streaming completes
      if (
        currentConversation?.id === convId &&
        messages.length > 0 &&
        !isLoadingMessages
      ) {
        return;
      }

      loadingConversationRef.current = convId;
      setIsLoadingMessages(true);
      try {
        const svc = await import("../services/chat.service");
        const conv = await svc.getConversation(convId);

        // CRITICAL: Validate conversation data before setting state
        if (!conv || !conv.id) {
          throw new Error("Invalid conversation data received from server");
        }

        setCurrentConversation(conv as any);

        // Join WebSocket room for this conversation will be handled by useRealTimeChat effect

        // Skip loading messages if this conversation was just created
        // (to avoid race condition where we clear optimistic messages)
        const isJustCreated = justCreatedConversationIdRef.current === convId;
        if (isJustCreated) {
          // Clear the flag after using it
          justCreatedConversationIdRef.current = null;
          setIsLoadingMessages(false);
          return;
        }

        const result = await svc.getMessages(convId, 1, 20);
        setMessages(result.messages);
        setMessagesPage(result.pagination.page);
        setMessagesHasMore(
          result.pagination.page < result.pagination.totalPages
        );

        // 🔥 FIX: Initialize pinnedMessageIds from loaded messages
        const pinnedIds = new Set(
          result.messages.filter((msg) => msg.pinned).map((msg) => msg.id)
        );
        setPinnedMessageIds(pinnedIds);

        // If navigation included a q param (from global search), and highlight not found,
        // call the conversation-local search API to find the bestMatch and highlight it.
        const searchParams = new URLSearchParams(location.search);
        const qParam = searchParams.get("q");
        const highlightParam = searchParams.get("highlight");
        if (qParam) {
          // Only proceed if no highlight param (to avoid double processing)

          try {
            const convSearch = await searchConversation(convId, {
              query: qParam,
              limit: 1,
              contextMessages: 2,
            });
            const bestMatch = convSearch.bestMatch;

            if (bestMatch && bestMatch.message_id) {
              const bestRes = convSearch.results.find(
                (r) => r.match.message_id === bestMatch.message_id
              );
              // Wait for refs to be ready, then highlight
              requestAnimationFrame(() => {
                setTimeout(() => {
                  handleSearchResultClick(bestMatch.message_id, bestMatch, {
                    before: bestRes?.contextBefore ?? [],
                    after: bestRes?.contextAfter ?? [],
                  });
                }, 100);
              });
              // Remove q param from URL to avoid repeated actions
              try {
                const url = new URL(window.location.href);
                url.searchParams.delete("q");
                window.history.replaceState({}, "", url.toString());
              } catch {}
            }
          } catch (err) {
            // Non-fatal: conversation-local search failed, no highlight
          }
        }
        // Ensure message list scrolls to bottom when conversation loads,
        // but skip if we have a highlight or q param (to avoid conflict with highlight scroll).
        const hasHighlightIntent = highlightParam || qParam;
        if (!hasHighlightIntent) {
          // Use requestAnimationFrame for smoother scroll
          requestAnimationFrame(() => {
            try {
              window.dispatchEvent(new Event("messages:scrollToBottom"));
            } catch {}
            setTimeout(() => {
              try {
                window.dispatchEvent(new Event("messages:scrollToBottom"));
              } catch {}
            }, 100);
          });
        }
      } catch (err: any) {
        console.error("[ChatPage] Failed to load conversation:", {
          conversationId: convId,
          error: err?.message || err,
          response: err?.response?.data,
          stack: err?.stack,
        });
        const errorMsg =
          err?.response?.data?.message ||
          err?.message ||
          "Failed to load conversation";
        antdMessage.error(errorMsg);
        setCurrentConversation(null);
        setMessages([]);
      } finally {
        loadingConversationRef.current = null;
        setIsLoadingMessages(false);
      }
    };

    loadConversation(id);
    // Intentionally omit currentConversation from deps to avoid effect re-run
    // Only depend on params.id (removed isConnected to fix freezing/race conditions)
  }, [params.id]);

  // WebSocket event listeners for real-time updates
  // 🔥 P0 FIX: Buffer chunks during WebSocket disconnection
  const chunkBufferRef = useRef<
    Map<string, { content: string; timestamp: number }>
  >(new Map());
  const CHUNK_BUFFER_TIMEOUT = 5000; // 5 seconds

  useEffect(() => {
    if (!currentConversation) return;

    const handleMessageChunk = (event: CustomEvent) => {
      const { conversationId, chunk, content, messageId } = event.detail;
      if (conversationId !== currentConversation.id) return;

      // 🔥 CRITICAL FIX: Buffer chunks if WebSocket disconnected
      if (!isConnected) {
        const bufferKey = `${conversationId}_${messageId || "streaming"}`;
        chunkBufferRef.current.set(bufferKey, {
          content,
          timestamp: Date.now(),
        });
        return;
      }

      // Update messages with streaming content. IMPORTANT: keep isTyping=true
      // so subsequent chunks continue to update the same typing placeholder.
      setMessages((prev) => {
        // Find the last typing assistant message to update
        // (There should only be one due to hasTyping check, but be defensive)
        let foundTyping = false;

        const updated = prev.map((msg) => {
          // Update the last (most recent) typing message
          if (!foundTyping && msg.role === "assistant" && msg.isTyping) {
            foundTyping = true;
            return { ...msg, content };
          }
          return msg;
        });

        // If no typing message found, don't update
        // (This can happen if ai:typing:start event hasn't arrived yet)
        return foundTyping ? updated : prev;
      });
    };

    // 🔥 P0 FIX: Apply buffered chunks when reconnected
    const applyBufferedChunks = () => {
      if (!isConnected || chunkBufferRef.current.size === 0) return;

      const now = Date.now();
      chunkBufferRef.current.forEach((buffer, key) => {
        // Skip expired chunks (older than 5 seconds)
        if (now - buffer.timestamp > CHUNK_BUFFER_TIMEOUT) {
          chunkBufferRef.current.delete(key);
          return;
        }

        // Apply buffered content
        setMessages((prev) => {
          let foundTyping = false;
          const updated = prev.map((msg) => {
            if (!foundTyping && msg.role === "assistant" && msg.isTyping) {
              foundTyping = true;
              return { ...msg, content: buffer.content };
            }
            return msg;
          });
          return foundTyping ? updated : prev;
        });
      });

      // Clear buffer after applying
      chunkBufferRef.current.clear();
    };

    // Apply buffered chunks when connection is established
    if (isConnected) {
      applyBufferedChunks();
    }

    const handleMessageComplete = (event: CustomEvent) => {
      const { userMessage, assistantMessage, conversation } = event.detail;

      // IMPORTANT: For sender socket, userMessage may be null (to avoid duplicate)
      // We still need to process assistantMessage and reset isSendingMessage

      // If userMessage exists, verify it belongs to current conversation
      if (
        userMessage &&
        userMessage.conversation_id !== currentConversation.id
      ) {
        return;
      }

      // If assistantMessage exists, verify it belongs to current conversation
      if (
        assistantMessage &&
        assistantMessage.conversation_id !== currentConversation.id
      ) {
        return;
      }

      // If neither message exists or belongs to current conversation, skip
      if (!userMessage && !assistantMessage) {
        return;
      }

      // DEBOUNCE: Prevent duplicate processing if same message comes quickly
      // Use both assistantMessage.id and userMessage.id as debounce keys
      const debounceKey = [assistantMessage?.id, userMessage?.id]
        .filter(Boolean)
        .join("_");

      if (debounceKey) {
        const lastProcessed = messageCompleteDebouncer.current.get(debounceKey);
        const now = Date.now();
        if (lastProcessed && now - lastProcessed < 500) {
          return;
        }
        messageCompleteDebouncer.current.set(debounceKey, now);

        // Cleanup old entries (keep only last 50)
        if (messageCompleteDebouncer.current.size > 50) {
          const entries = Array.from(
            messageCompleteDebouncer.current.entries()
          );
          entries.sort((a, b) => b[1] - a[1]); // Sort by timestamp desc
          messageCompleteDebouncer.current = new Map(entries.slice(0, 50));
        }
      }

      // Replace streaming message with final messages
      setMessages((prev) => {
        // Build a set of existing message IDs to avoid duplicates
        const existingIds = new Set<string>();

        // First pass: collect IDs and handle replacements
        let replacedTyping = false;
        let replacedUser = false;

        const processedMessages: Message[] = [];

        for (const m of prev) {
          // IMPROVED: Replace ALL typing assistant messages, not just first
          if (m.isTyping && m.role === "assistant") {
            if (!replacedTyping && assistantMessage) {
              // Replace first typing message with final assistant message
              processedMessages.push({ ...assistantMessage, isTyping: false });
              existingIds.add(assistantMessage.id);
              replacedTyping = true;
            }
            // Skip all other typing messages (cleanup stale typing indicators)
            continue;
          }

          // CRITICAL FIX: Replace optimistic pending user message with server version
          // Match by either:
          // 1. Standard conditions (localStatus, role, conversation_id)
          // 2. Fallback: Match by content if no pending message found yet
          if (!replacedUser && userMessage && m.role === "user") {
            const standardMatch =
              m.localStatus === "pending" &&
              m.conversation_id === userMessage.conversation_id;

            const contentMatch =
              !replacedUser &&
              String(m.content || "")
                .trim()
                .toLowerCase() ===
                String(userMessage.content || "")
                  .trim()
                  .toLowerCase() &&
              m.id.startsWith("temp_"); // Only match temp IDs

            if (standardMatch || contentMatch) {
              // IMPORTANT: Preserve attachments from optimistic message if server doesn't return them
              const mergedUserMessage = {
                ...userMessage,
                attachments:
                  userMessage.attachments && userMessage.attachments.length > 0
                    ? userMessage.attachments
                    : m.attachments || [],
              };

              processedMessages.push(mergedUserMessage);
              existingIds.add(userMessage.id);
              replacedUser = true;
              continue;
            }
          }

          // Keep existing message
          if (m.id) {
            existingIds.add(m.id);
          }
          processedMessages.push(m);
        }

        // CRITICAL FIX: Before appending userMessage, check for content duplicates
        // This prevents duplicate if optimistic message was somehow not matched
        if (!replacedUser && userMessage) {
          const hasDuplicateContent = processedMessages.some(
            (m) =>
              m.role === "user" &&
              String(m.content || "")
                .trim()
                .toLowerCase() ===
                String(userMessage.content || "")
                  .trim()
                  .toLowerCase() &&
              Math.abs(
                new Date(m.createdAt).getTime() -
                  new Date(userMessage.createdAt).getTime()
              ) < 10000 // Within 10 seconds
          );

          if (!hasDuplicateContent && !existingIds.has(userMessage.id)) {
            processedMessages.push(userMessage);
            existingIds.add(userMessage.id);
          } else if (hasDuplicateContent) {
          }
        }

        // Append assistant message if no typing message was replaced
        if (
          !replacedTyping &&
          assistantMessage &&
          !existingIds.has(assistantMessage.id)
        ) {
          processedMessages.push(assistantMessage);
        }

        return processedMessages;
      });

      // Update conversation metadata
      if (conversation) {
        setCurrentConversation((prev) =>
          prev
            ? {
                ...prev,
                total_tokens_used: conversation.total_tokens_used,
                message_count: conversation.message_count,
                updatedAt: new Date().toISOString(),
              }
            : prev
        );

        // 🚀 PERFORMANCE: Invalidate cache for this conversation (new messages added)
        (async () => {
          const { default: messageCache } = await import(
            "../services/message-cache.service"
          );
          messageCache.invalidate(currentConversation.id);
        })();

        // Ensure the conversation list reflects the recent activity
        try {
          moveConversationToTop(currentConversation.id);
          updateConversationOptimistic(currentConversation.id, {
            message_count: conversation.message_count,
            updatedAt: new Date().toISOString(),
          });
          // Fire-and-forget refresh to fetch latest conversations from server
          refreshConversations().catch(() => {});

          // Notify WebSocket about conversation activity for multi-tab sync
          if (isConnected) {
            try {
              websocketService.notifyConversationUpdated(
                currentConversation.id,
                {
                  message_count: conversation.message_count,
                  updatedAt: new Date().toISOString(),
                }
              );
            } catch {}
          }
        } catch {}
      }

      // CRITICAL: Reset isSendingMessage to re-enable input after message is complete
      setIsSendingMessage(false);

      // CRITICAL: Clear the flag to allow useEffect to run normally for NEW conversations
      // Only clear if this is the conversation we're currently creating
      if (
        isCreatingAndSendingRef.current &&
        (userMessage?.conversation_id === currentConversation.id ||
          assistantMessage?.conversation_id === currentConversation.id)
      ) {
        isCreatingAndSendingRef.current = false;
      }
    };

    // Add event listeners
    window.addEventListener(
      "message:chunk",
      handleMessageChunk as EventListener
    );
    window.addEventListener(
      "message:complete",
      handleMessageComplete as EventListener
    );

    // Handle socket errors (streaming failures)
    const handleSocketError = (event: CustomEvent) => {
      const { message: errorMessage, conversationId, messageId } = event.detail;

      if (conversationId !== currentConversation?.id) {
        return;
      }

      // Clear sending flags to allow retry
      setIsSendingMessage(false);
      isCreatingAndSendingRef.current = false;

      // Remove typing message if present
      setMessages((prev) => prev.filter((m) => !m.isTyping));

      // Show error notification
      antdMessage.error(
        errorMessage || "Message sending failed. Please try again."
      );
    };

    window.addEventListener("socket:error", handleSocketError as EventListener);

    const handleMessageNew = (event: Event) => {
      const { conversationId, message } = (event as CustomEvent).detail;

      if (conversationId !== currentConversation?.id) {
        return;
      }

      setMessages((prev) => {
        // Avoid duplicates: if message id already exists, don't add
        if (prev.some((m) => m.id === message.id)) {
          return prev;
        }

        // CRITICAL FIX: Find and REPLACE optimistic pending message instead of just filtering
        const matchingPendingIndex = prev.findIndex((m) => {
          if (m.localStatus !== "pending" || m.role !== "user") return false;
          if (m.conversation_id !== message.conversation_id) return false;

          const contentMatch =
            String(m.content || "").trim() ===
            String(message.content || "").trim();
          if (!contentMatch) return false;

          // Check if sent within last 5 seconds (timestamp window)
          try {
            const msgTime = new Date(message.createdAt).getTime();
            const optimisticTime = new Date(m.createdAt).getTime();
            const timeDiff = Math.abs(msgTime - optimisticTime);
            return timeDiff < 5000; // 5 second window
          } catch {
            // If timestamp parsing fails, assume it's a match to be safe
            return true;
          }
        });

        // If found matching optimistic message, REPLACE it with real message
        // IMPORTANT: Preserve attachments from optimistic message if server message doesn't have them
        if (matchingPendingIndex !== -1) {
          const optimisticMsg = prev[matchingPendingIndex];
          const newMessages = [...prev];

          // Merge attachments: prefer server's attachments, fallback to optimistic
          const mergedMessage = {
            ...message,
            attachments:
              message.attachments && message.attachments.length > 0
                ? message.attachments
                : optimisticMsg.attachments || [],
          };

          newMessages[matchingPendingIndex] = mergedMessage;
          return newMessages;
        }

        // Otherwise append normally
        return [...prev, message];
      });
    };

    const handleConversationDeleted = async (event: Event) => {
      const { conversationId } = (event as CustomEvent).detail;

      // 🚀 PERFORMANCE: Invalidate cache for deleted conversation
      const { default: messageCache } = await import(
        "../services/message-cache.service"
      );
      messageCache.invalidate(conversationId);

      // If current conversation is deleted, redirect to home
      if (conversationId === currentConversation?.id) {
        navigate("/", { replace: true });
      }
    };

    const handleAITypingStart = (event: Event) => {
      const { conversationId } = (event as CustomEvent).detail;
      if (conversationId !== currentConversation?.id) return;

      // Add AI typing message if not already present
      setMessages((prev) => {
        const hasTyping = prev.some(
          (m) => m.role === "assistant" && m.isTyping
        );
        if (hasTyping) return prev;

        const typingId = `typing_ai_${Date.now()}`;
        const typingMsg: Message = {
          id: typingId,
          conversation_id: conversationId,
          role: "assistant",
          content: "",
          tokens_used: 0,
          model: currentConversation?.model || "gpt-4o-mini",
          createdAt: new Date().toISOString(),
          isTyping: true,
        };
        return [...prev, typingMsg];
      });
    };

    const handleAITypingStop = (event: Event) => {
      const { conversationId } = (event as CustomEvent).detail;
      if (conversationId !== currentConversation?.id) return;

      // IMPORTANT: Don't remove typing messages that have content - just mark them as finalized
      // This prevents losing streamed content in the sender tab
      setMessages((prev) =>
        prev
          .map((m) => {
            if (m.isTyping && m.role === "assistant") {
              // If typing message has content, keep it but mark as finalized
              if (m.content && m.content.trim().length > 0) {
                return { ...m, isTyping: false };
              }
              // If typing message is empty, it's a stale placeholder - remove it
              return null;
            }
            return m;
          })
          .filter((m): m is Message => m !== null)
      );
    };

    window.addEventListener("message:new", handleMessageNew as EventListener);
    window.addEventListener(
      "conversation:deleted",
      handleConversationDeleted as EventListener
    );
    window.addEventListener(
      "ai:typing:start",
      handleAITypingStart as EventListener
    );
    window.addEventListener(
      "ai:typing:stop",
      handleAITypingStop as EventListener
    );

    return () => {
      window.removeEventListener(
        "message:chunk",
        handleMessageChunk as EventListener
      );
      window.removeEventListener(
        "message:complete",
        handleMessageComplete as EventListener
      );
      window.removeEventListener(
        "socket:error",
        handleSocketError as EventListener
      );
      window.removeEventListener(
        "message:new",
        handleMessageNew as EventListener
      );
      window.removeEventListener(
        "conversation:deleted",
        handleConversationDeleted as EventListener
      );
      window.removeEventListener(
        "ai:typing:start",
        handleAITypingStart as EventListener
      );
      window.removeEventListener(
        "ai:typing:stop",
        handleAITypingStop as EventListener
      );
    };
  }, [currentConversation]);

  /**
   * Handle unread status tracking (multi-tab)
   * - Emit conversation:view when user opens a conversation
   * - Listen for unread status updates from server
   */
  useEffect(() => {
    // Emit view event when currentConversation changes
    if (currentConversation && isConnected) {
      websocketService.viewConversation(currentConversation.id);

      // Mark as read immediately in local state
      setUnreadConversations((prev) => {
        const next = new Set(prev);
        next.delete(currentConversation.id);
        return next;
      });
    }

    // Cleanup: emit leave_view when unmounting or switching conversation
    return () => {
      if (currentConversation && isConnected) {
        websocketService.leaveConversationView(currentConversation.id);
      }
    };
  }, [currentConversation?.id, isConnected]);

  /**
   * Listen for unread status updates from WebSocket
   */
  useEffect(() => {
    const handleUnreadStatus = (event: CustomEvent) => {
      const { conversationId, hasUnread } = event.detail;

      setUnreadConversations((prev) => {
        const next = new Set(prev);
        if (hasUnread) {
          next.add(conversationId);
        } else {
          next.delete(conversationId);
        }
        return next;
      });
    };

    window.addEventListener(
      "conversation:unread_status",
      handleUnreadStatus as EventListener
    );

    return () => {
      window.removeEventListener(
        "conversation:unread_status",
        handleUnreadStatus as EventListener
      );
    };
  }, []);

  /**
   * Listen for conversation updates (title changes, etc.) from WebSocket
   */
  useEffect(() => {
    const handleConversationUpdated = (event: CustomEvent) => {
      const { conversationId, update } = event.detail;

      // Update current conversation if it matches
      if (currentConversation && conversationId === currentConversation.id) {
        setCurrentConversation((prev) =>
          prev ? { ...prev, ...update } : null
        );
      }

      // Update conversation in sidebar list
      updateConversationOptimistic(conversationId, update);
    };

    window.addEventListener(
      "conversation:updated",
      handleConversationUpdated as EventListener
    );

    return () => {
      window.removeEventListener(
        "conversation:updated",
        handleConversationUpdated as EventListener
      );
    };
  }, [currentConversation, updateConversationOptimistic]);

  /**
   * 🔄 Background refresh of New Chat suggestions every 5 minutes after login
   * Load cached suggestions immediately (already done in useState initialization)
   * Refresh in background without showing loading state for smooth UX
   */
  useEffect(() => {
    if (!user?.id) {
      return;
    }

    // Fetch fresh suggestions in background (don't clear cached ones)
    fetchNewChatSuggestions(false);

    // Then refresh every 5 minutes in background
    const intervalId = setInterval(() => {
      fetchNewChatSuggestions(false);
    }, 5 * 60 * 1000); // 5 minutes in milliseconds

    // Cleanup: stop schedule when user logs out or component unmounts
    return () => {
      clearInterval(intervalId);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user?.id]);

  /**
   * Listen for conversation followup suggestions response
   */
  useEffect(() => {
    const handleConversationFollowupsResponse = (event: CustomEvent) => {
      const { conversationId, suggestions } = event.detail;

      // For current conversation suggestions (lightbulb in input)
      if (currentConversation && conversationId === currentConversation.id) {
        setConversationSuggestions(suggestions);
        setIsLoadingConversationSuggestions(false);
      }
      // For new chat suggestions (empty screen)
      else if (
        !currentConversation &&
        conversationId === "new_chat_suggestions"
      ) {
        setNewChatSuggestions(suggestions);
        setIsLoadingNewChatSuggestions(false);

        // CRITICAL: Cache suggestions for instant display on next visit
        saveSuggestionsToCache(suggestions);
      }
    };

    const handleConversationFollowupsError = (event: CustomEvent) => {
      const { conversationId, error } = event.detail;

      // Silently handle error

      // Check which type of suggestion request failed
      if (currentConversation && conversationId === currentConversation.id) {
        setIsLoadingConversationSuggestions(false);
        setConversationSuggestions([]);
      } else if (
        !currentConversation &&
        conversationId === "new_chat_suggestions"
      ) {
        setIsLoadingNewChatSuggestions(false);
        setNewChatSuggestions([]);
      }
    };

    window.addEventListener(
      "conversation_followups_response",
      handleConversationFollowupsResponse as EventListener
    );
    window.addEventListener(
      "conversation_followups_error",
      handleConversationFollowupsError as EventListener
    );

    return () => {
      window.removeEventListener(
        "conversation_followups_response",
        handleConversationFollowupsResponse as EventListener
      );
      window.removeEventListener(
        "conversation_followups_error",
        handleConversationFollowupsError as EventListener
      );
    };
  }, [currentConversation]);

  // Listen for location changes to handle highlight params from navigation
  useEffect(() => {
    const searchParams = new URLSearchParams(location.search);
    const highlightParam = searchParams.get("highlight");

    if (highlightParam && currentConversation && messages.length > 0) {
      // Try to find and highlight the message
      const tryHighlight = async (attemptsLeft = 6) => {
        // Give React a moment to render refs
        await new Promise((r) => setTimeout(r, 120));
        const el = messageRefs.current.get(highlightParam);
        if (el) {
          handleSearchResultClick(highlightParam);
          // Remove highlight param from URL to avoid repeated actions
          try {
            const url = new URL(window.location.href);
            url.searchParams.delete("highlight");
            window.history.replaceState({}, "", url.toString());
          } catch {}
          return true;
        }

        // If not found and there are more pages, load next (older) page and retry
        if (attemptsLeft > 0 && messagesHasMore) {
          try {
            await loadEarlier();
            return tryHighlight(attemptsLeft - 1);
          } catch {
            return false;
          }
        }

        return false;
      };

      void tryHighlight();
    }
  }, [location.search, currentConversation, messages.length, messagesHasMore]);

  /**
   * Process message queue sequentially to prevent race conditions
   */
  const processMessageQueue = async () => {
    // Already processing, skip
    if (isProcessingQueueRef.current) {
      return;
    }

    // Queue empty, nothing to do
    if (messageQueueRef.current.length === 0) {
      return;
    }
    isProcessingQueueRef.current = true;

    while (messageQueueRef.current.length > 0) {
      const queuedMsg = messageQueueRef.current.shift();
      if (!queuedMsg) break;

      try {
        await handleSendMessageInternal(
          queuedMsg.content,
          queuedMsg.attachments,
          queuedMsg.metadata
        );

        // Small delay between messages to avoid overwhelming server
        await new Promise((resolve) => setTimeout(resolve, 100));
      } catch (err) {
        antdMessage.error("Failed to send queued message. Please try again.");
        // Continue processing other messages
      }
    }

    isProcessingQueueRef.current = false;
  };

  /**
   * Handle sending a message (with queueing)
   */
  const handleSendMessage = async (
    content: string,
    attachments?: FileAttachment[],
    metadata?: {
      resendMessageId?: string;
      editMessageId?: string;
      originalContent?: string;
    }
  ) => {
    // Check if offline first
    if (!isOnline) {
      antdMessage.warning(
        "You are offline. Please check your connection and try again."
      );
      return;
    }

    // For new conversation or if not currently processing, send immediately
    // Otherwise queue it to prevent concurrent sends
    if (!currentConversation || !isProcessingQueueRef.current) {
      return handleSendMessageInternal(content, attachments, metadata);
    }

    // Queue the message for sequential processing

    messageQueueRef.current.push({
      content,
      attachments,
      metadata,
      timestamp: Date.now(),
    });

    // Trigger queue processing
    processMessageQueue();
  };

  /**
   * Internal message sending logic (actual implementation)
   */
  const handleSendMessageInternal = async (
    content: string,
    attachments?: FileAttachment[],
    metadata?: {
      resendMessageId?: string;
      editMessageId?: string;
      originalContent?: string;
    }
  ) => {
    // Prevent sending if already sending
    if (isSendingMessage || isSendingRealtimeMessage) return;

    // Clear conversation suggestions when sending a message
    setConversationSuggestions([]);
    setIsLoadingConversationSuggestions(false);

    // ============ NEW CONVERSATION FLOW ============
    if (!currentConversation) {
      // CRITICAL: Set flag to prevent useEffect from interfering
      isCreatingAndSendingRef.current = true;
      setIsSendingMessage(true);

      try {
        // Step 1: Create conversation with default title 'New Chat'
        // Server will auto-generate smart title after first message (like ChatGPT/Gemini)
        const newConversation = await apiCreateConversation({
          title: "New Chat",
          model: "gpt-4o-mini",
          context_window: 10,
        });

        // Mark this conversation as just created to skip message reload
        justCreatedConversationIdRef.current = newConversation.id;

        // ⚡ HIGHEST PRIORITY: Refresh conversation list IMMEDIATELY after creation
        // This ensures new conversation appears at top of sidebar BEFORE any AI processing
        try {
          await refreshConversations();
          notifyMessageSent(newConversation.id);
          window.dispatchEvent(new Event("conversations:refresh"));
        } catch (err) {}

        // Step 3: Add optimistic user message FIRST (before navigation)
        const tempId = `temp_${Date.now()}`;
        const userMsg: Message = {
          id: tempId,
          conversation_id: newConversation.id,
          role: "user",
          content,
          tokens_used: 0,
          model: newConversation.model,
          createdAt: new Date().toISOString(),
          localStatus: "pending",
          attachments: attachments?.map((att) => ({
            id: att.id,
            public_id: att.public_id,
            secure_url: att.secure_url,
            resource_type: att.resource_type,
            format: att.format,
            original_filename: att.original_filename,
            size_bytes: att.size_bytes,
            width: att.width,
            height: att.height,
            thumbnail_url: att.thumbnail_url,
            extracted_text: att.extracted_text,
          })),
        };

        // Step 4: Batch state updates together

        setCurrentConversation(newConversation as any);
        setMessages([userMsg]);

        // Step 5: Join WebSocket room SYNCHRONOUSLY before navigation
        if (isConnected) {
          joinConversation(newConversation.id);
        } else {
        }

        // Step 6: Notify WebSocket about conversation creation
        if (isConnected) {
          try {
            websocketService.notifyConversationCreated(newConversation as any);
          } catch (err) {}
        }

        // Step 7: Navigate FIRST (before sending)

        navigate(`/conversations/${newConversation.id}`, { replace: true });

        // Scroll to show user message
        try {
          window.dispatchEvent(new Event("messages:scrollToBottom"));
        } catch {}

        // Step 8: Send message IMMEDIATELY after navigation (no artificial delay)
        if (isConnected) {
          try {
            // INSTANT AI TYPING INDICATOR - Add typing message BEFORE sending
            const typingId = `typing_ai_${Date.now()}`;
            const typingMsg: Message = {
              id: typingId,
              conversation_id: newConversation.id,
              role: "assistant",
              content: "",
              tokens_used: 0,
              model: newConversation.model,
              createdAt: new Date().toISOString(),
              isTyping: true,
            };
            setMessages((prev) => [...prev, typingMsg]);

            // Send directly via websocketService instead of hook
            // (hook may not have updated conversation prop yet)
            websocketService.sendMessage(
              newConversation.id,
              content,
              attachments?.map((att) => ({
                public_id: att.public_id,
                secure_url: att.secure_url,
                resource_type: att.resource_type,
                format: att.format,
                extracted_text: att.extracted_text,
              }))
            );

            // Final conversation list update after message sent (secondary priority)
            try {
              moveConversationToTop(newConversation.id);
              updateConversationOptimistic(newConversation.id, {
                message_count: 1,
                updatedAt: new Date().toISOString(),
              });
              // Background refresh to sync any server-side changes
              refreshConversations().catch(() => {});
            } catch (err) {}

            setIsSendingMessage(false);

            // NOTE: Don't clear isCreatingAndSendingRef here!
            // It will be cleared in handleMessageComplete after receiving the complete message
            // This prevents useEffect from reloading messages while streaming is in progress

            // WebSocket is fire-and-forget, response will come via event listeners
            return;
          } catch (err) {
            // Continue to HTTP fallback
          }
        } else {
        }

        // Step 9: Fallback to HTTP streaming
        // logging removed: starting HTTP fallback

        // Add typing indicator
        const typingId = `typing_${Date.now()}`;
        const typingMsg: Message = {
          id: typingId,
          conversation_id: newConversation.id,
          role: "assistant",
          content: "",
          tokens_used: 0,
          model: newConversation.model,
          createdAt: new Date().toISOString(),
          isTyping: true,
        };
        setMessages((prev) => [...prev, typingMsg]);

        // logging removed: added typing indicator, sending HTTP request

        try {
          const svc = await import("../services/chat.service");
          await svc.sendMessageStream(
            newConversation.id,
            content,
            // onChunk
            (chunk) => {
              setMessages((prev) =>
                prev.map((m) =>
                  m.id === typingId
                    ? { ...m, content: (m.content || "") + chunk }
                    : m
                )
              );
            },
            // onDone
            (result: any) => {
              // logging removed: HTTP response received
              const serverUserMsg = result?.userMessage;
              const assistantMsg = result?.assistantMessage;

              setMessages((prev) => {
                // Remove typing indicator
                const withoutTyping = prev.filter((m) => m.id !== typingId);

                // Replace optimistic user message with server version
                let replacedList = withoutTyping.map((m) =>
                  m.id === tempId && serverUserMsg ? serverUserMsg : m
                );

                // Add server user message if not already present
                if (
                  serverUserMsg &&
                  !replacedList.some((m) => m.id === serverUserMsg.id)
                ) {
                  replacedList.push(serverUserMsg);
                }

                // Add assistant message
                if (assistantMsg) {
                  replacedList.push(assistantMsg);
                }

                return replacedList;
              });

              // Scroll to bottom
              try {
                setTimeout(
                  () =>
                    window.dispatchEvent(new Event("messages:scrollToBottom")),
                  40
                );
              } catch {}

              // Update conversation metadata
              if (result?.conversation) {
                const conv = result.conversation;
                setCurrentConversation((prev) =>
                  prev
                    ? {
                        ...prev,
                        total_tokens_used: conv.total_tokens_used,
                        message_count: conv.message_count,
                        updatedAt: new Date().toISOString(),
                      }
                    : prev
                );

                try {
                  moveConversationToTop(newConversation.id);
                  updateConversationOptimistic(newConversation.id, {
                    message_count: conv.message_count,
                    updatedAt: new Date().toISOString(),
                  });
                  refreshConversations().catch(() => {});
                  notifyMessageSent(newConversation.id);
                } catch {}
              }
            },
            // onError
            (err) => {
              antdMessage.error("Failed to send message");
              // Mark optimistic message as failed
              setMessages((prev) =>
                prev.map((m) =>
                  m.id === tempId ? { ...m, localStatus: "failed" } : m
                )
              );
              // Remove typing indicator
              setMessages((prev) => prev.filter((m) => m.id !== typingId));
            },
            // attachments
            attachments?.map((att) => ({
              public_id: att.public_id,
              secure_url: att.secure_url,
              resource_type: att.resource_type,
              format: att.format,
              extracted_text: att.extracted_text,
            })),
            // metadata for resend/edit
            metadata
          );
        } catch (err) {
          antdMessage.error("Failed to send message");
          setMessages((prev) =>
            prev.map((m) =>
              m.id === tempId ? { ...m, localStatus: "failed" } : m
            )
          );
          setMessages((prev) => prev.filter((m) => m.id !== typingId));
        } finally {
          setIsSendingMessage(false);
          // CRITICAL: Clear flag even on error
          isCreatingAndSendingRef.current = false;
        }

        return; // End of new conversation flow
      } catch (err: any) {
        antdMessage.error(
          err?.response?.data?.message || "Failed to create conversation"
        );
        setCurrentConversation(null);
        setMessages([]);
        setIsSendingMessage(false);
        // CRITICAL: Clear flag on conversation creation error
        isCreatingAndSendingRef.current = false;
        return;
      }
    }

    // ============ EXISTING CONVERSATION FLOW ============
    if (isConnected) {
      // ⚡ HIGHEST PRIORITY: Refresh conversation list IMMEDIATELY when user sends message
      // This ensures conversation moves to top BEFORE AI starts processing
      try {
        notifyMessageSent(currentConversation.id);
        moveConversationToTop(currentConversation.id);
        updateConversationOptimistic(currentConversation.id, {
          updatedAt: new Date().toISOString(),
        });
        // Trigger immediate background refresh
        refreshConversations().catch(() => {});
      } catch (err) {}

      const tempId = `temp_${Date.now()}`;
      const userMsg: Message = {
        id: tempId,
        conversation_id: currentConversation.id,
        role: "user",
        content,
        tokens_used: 0,
        model: currentConversation.model,
        createdAt: new Date().toISOString(),
        localStatus: "sending",
        retryCount: 0,
        attachments: attachments?.map((att) => ({
          id: att.id,
          public_id: att.public_id,
          secure_url: att.secure_url,
          resource_type: att.resource_type,
          format: att.format,
          original_filename: att.original_filename,
          size_bytes: att.size_bytes,
          width: att.width,
          height: att.height,
          thumbnail_url: att.thumbnail_url,
          extracted_text: att.extracted_text,
        })),
      };
      setMessages((prev) => [...prev, userMsg]);

      // INSTANT AI TYPING INDICATOR - Add typing message immediately
      const typingId = `typing_ai_${Date.now()}`;
      const typingMsg: Message = {
        id: typingId,
        conversation_id: currentConversation.id,
        role: "assistant",
        content: "",
        tokens_used: 0,
        model: currentConversation.model,
        createdAt: new Date().toISOString(),
        isTyping: true,
      };
      setMessages((prev) => [...prev, typingMsg]);

      try {
        setTimeout(
          () => window.dispatchEvent(new Event("messages:scrollToBottom")),
          40
        );
      } catch {}

      try {
        // Mark as pending while sending
        setMessages((prev) =>
          prev.map((m) =>
            m.id === tempId ? { ...m, localStatus: "pending" } : m
          )
        );

        // Send with attachments
        await sendRealtimeMessage(
          content,
          attachments?.map((att) => ({
            public_id: att.public_id,
            secure_url: att.secure_url,
            resource_type: att.resource_type,
            format: att.format,
            extracted_text: att.extracted_text,
          }))
        );

        // Mark as sent on success
        setMessages((prev) =>
          prev.map((m) => (m.id === tempId ? { ...m, localStatus: "sent" } : m))
        );

        // Secondary update after message confirmed sent (background)
        try {
          updateConversationOptimistic(currentConversation.id, {
            message_count: (currentConversation.message_count || 0) + 1,
            updatedAt: new Date().toISOString(),
          });
        } catch {}

        return;
      } catch (err: unknown) {
        const error = err as Error & { code?: string };
        const errorMsg =
          error.code === "WEBSOCKET_DISCONNECTED"
            ? "Connection lost. Message will be retried."
            : error.message || "Failed to send message";

        // Mark message as failed with error details
        setMessages((prev) =>
          prev.map((m) =>
            m.id === tempId
              ? {
                  ...m,
                  localStatus: "failed",
                  errorMessage: errorMsg,
                  lastAttemptAt: new Date().toISOString(),
                }
              : m
          )
        );

        // Remove typing indicators
        setMessages((prev) => prev.filter((msg) => !msg.isTyping));

        try {
          window.dispatchEvent(
            new CustomEvent("ai:typing:stop", {
              detail: { conversationId: currentConversation.id },
            })
          );
        } catch {}

        antdMessage.error(
          `Failed to send message: ${errorMsg}. Click retry to try again.`
        );

        // Don't return - continue to HTTP fallback
      }
    }

    // HTTP fallback for existing conversation
    // ⚡ HIGHEST PRIORITY: Refresh conversation list IMMEDIATELY (HTTP fallback path)
    try {
      notifyMessageSent(currentConversation.id);
      moveConversationToTop(currentConversation.id);
      updateConversationOptimistic(currentConversation.id, {
        updatedAt: new Date().toISOString(),
      });
      // Trigger immediate background refresh
      refreshConversations().catch(() => {});
    } catch (err) {}

    const tempId = `temp_${Date.now()}`;
    const userMsg: Message = {
      id: tempId,
      conversation_id: currentConversation.id,
      role: "user",
      content,
      tokens_used: 0,
      model: currentConversation.model,
      createdAt: new Date().toISOString(),
      localStatus: "pending",
      attachments: attachments?.map((att) => ({
        id: att.id,
        public_id: att.public_id,
        secure_url: att.secure_url,
        resource_type: att.resource_type,
        format: att.format,
        original_filename: att.original_filename,
        size_bytes: att.size_bytes,
        width: att.width,
        height: att.height,
        thumbnail_url: att.thumbnail_url,
        extracted_text: att.extracted_text,
      })),
    };

    setMessages((prev) => [...prev, userMsg]);
    setIsSendingMessage(true);

    const typingId = `typing_${Date.now()}`;
    const typingMsg: Message = {
      id: typingId,
      conversation_id: currentConversation.id,
      role: "assistant",
      content: "",
      tokens_used: 0,
      model: currentConversation.model,
      createdAt: new Date().toISOString(),
      isTyping: true,
    };
    setMessages((prev) => [...prev, typingMsg]);

    try {
      setTimeout(
        () => window.dispatchEvent(new Event("messages:scrollToBottom")),
        60
      );
    } catch {}

    try {
      const svc = await import("../services/chat.service");
      await svc.sendMessageStream(
        currentConversation.id,
        content,
        (chunk) => {
          setMessages((prev) =>
            prev.map((m) =>
              m.id === typingId
                ? { ...m, content: (m.content || "") + chunk }
                : m
            )
          );
        },
        (result: any) => {
          const serverUserMsg = result?.userMessage;
          const assistantMsg = result?.assistantMessage;

          setMessages((prev) => {
            const withoutTyping = prev.filter((m) => m.id !== typingId);
            let replacedList = withoutTyping.map((m) =>
              m.id === tempId && serverUserMsg ? serverUserMsg : m
            );
            if (
              serverUserMsg &&
              !replacedList.some((m) => m.id === serverUserMsg.id)
            ) {
              replacedList.push(serverUserMsg);
            }
            if (assistantMsg) replacedList.push(assistantMsg);
            return replacedList;
          });

          try {
            setTimeout(
              () => window.dispatchEvent(new Event("messages:scrollToBottom")),
              40
            );
          } catch {}

          if (result?.conversation) {
            const conv = result.conversation;
            setCurrentConversation((prev) =>
              prev
                ? {
                    ...prev,
                    total_tokens_used: conv.total_tokens_used,
                    message_count: conv.message_count,
                    updatedAt: new Date().toISOString(),
                  }
                : prev
            );

            try {
              moveConversationToTop(currentConversation.id);
              updateConversationOptimistic(currentConversation.id, {
                message_count: conv.message_count,
                updatedAt: new Date().toISOString(),
              });
              refreshConversations().catch(() => {});
              window.dispatchEvent(new Event("message:sent"));
            } catch {}
          }

          try {
            window.dispatchEvent(
              new CustomEvent("ai:typing:stop", {
                detail: { conversationId: currentConversation.id },
              })
            );
          } catch {}
        },
        (err) => {
          antdMessage.error("Failed to stream AI response");
          setMessages((prev) =>
            prev.map((m) =>
              m.id === tempId ? { ...m, localStatus: "failed" } : m
            )
          );
          setMessages((prev) => prev.filter((m) => m.id !== typingId));

          try {
            window.dispatchEvent(
              new CustomEvent("ai:typing:stop", {
                detail: { conversationId: currentConversation.id },
              })
            );
          } catch {}
        },
        // attachments
        attachments?.map((att) => ({
          public_id: att.public_id,
          secure_url: att.secure_url,
          resource_type: att.resource_type,
          format: att.format,
          extracted_text: att.extracted_text,
        })),
        // metadata for resend/edit
        metadata
      );
    } catch (err) {
      antdMessage.error("Failed to send message");
      setMessages((prev) =>
        prev.map((m) => (m.id === tempId ? { ...m, localStatus: "failed" } : m))
      );
      setMessages((prev) => prev.filter((m) => m.id !== typingId));

      try {
        window.dispatchEvent(
          new CustomEvent("ai:typing:stop", {
            detail: { conversationId: currentConversation.id },
          })
        );
      } catch {}
    } finally {
      setIsSendingMessage(false);
    }
  };

  // Helper function để tránh duplicate logic
  const sendMessageViaWebSocketOrHTTP = async (
    conversation: Conversation,
    content: string,
    tempId: string,
    userMsg: Message,
    attachments?: FileAttachment[]
  ) => {
    // Try WebSocket first
    if (isConnected) {
      try {
        await sendRealtimeMessage(
          content,
          attachments?.map((att) => ({
            public_id: att.public_id,
            secure_url: att.secure_url,
            resource_type: att.resource_type,
            format: att.format,
            extracted_text: att.extracted_text,
          }))
        );
        moveConversationToTop(conversation.id);
        await refreshConversations();
        return true;
      } catch (err) {}
    }

    // Fallback to HTTP
    const typingMsg: Message = {
      id: `typing_${Date.now()}`,
      conversation_id: conversation.id,
      role: "assistant",
      content: "",
      tokens_used: 0,
      model: conversation.model,
      createdAt: new Date().toISOString(),
      isTyping: true,
    };
    setMessages((prev) => [...prev, typingMsg]);

    try {
      const svc = await import("../services/chat.service");
      await svc.sendMessageStream(
        conversation.id,
        content,
        (chunk) => {
          /* handle chunk */
        },
        (result) => {
          /* handle completion */
        },
        (err) => {
          /* handle error */
        },
        undefined, // attachments
        undefined // metadata
      );
      return true;
    } catch (err) {
      setMessages((prev) =>
        prev.map((m) => (m.id === tempId ? { ...m, localStatus: "failed" } : m))
      );
      return false;
    }
  };

  // Load earlier messages (pagination)
  const loadEarlier = async () => {
    if (!currentConversation) return;
    const nextPage = messagesPage + 1;
    try {
      await loadMessages(currentConversation.id, nextPage);
    } catch (err) {
      antdMessage.error("Failed to load earlier messages");
    }
  };

  // Retry handler for failed messages with exponential backoff
  const handleRetryMessage = async (
    failedMessage: Message | PendingMessage
  ): Promise<void> => {
    if (!currentConversation) return;

    const retryCount = (failedMessage as Message).retryCount || 0;
    const maxRetries = 3;

    // Check if max retries reached
    if (retryCount >= maxRetries) {
      antdMessage.error(`Maximum retry attempts (${maxRetries}) reached`);
      return;
    }

    // Calculate exponential backoff delay: 1s, 2s, 4s
    const backoffDelay = Math.pow(2, retryCount) * 1000;

    // Mark as sending (show loading state)
    setMessages((prev) =>
      prev.map((m) =>
        m.id === failedMessage.id
          ? {
              ...m,
              localStatus: "sending",
              retryCount: retryCount + 1,
              lastAttemptAt: new Date().toISOString(),
            }
          : m
      )
    );

    // Wait for backoff delay
    if (retryCount > 0) {
      antdMessage.info(`Retrying in ${backoffDelay / 1000} seconds...`);
      await new Promise((resolve) => setTimeout(resolve, backoffDelay));
    }

    // Try WebSocket first if connected
    if (isConnected) {
      try {
        // Mark as pending for WebSocket attempt
        setMessages((prev) =>
          prev.map((m) =>
            m.id === failedMessage.id ? { ...m, localStatus: "pending" } : m
          )
        );

        // Send via WebSocket
        websocketService.sendMessage(
          currentConversation.id,
          failedMessage.content,
          undefined // No attachments on retry (already uploaded previously)
        );

        // Success message will be handled by WebSocket event listeners
        antdMessage.success("Message sent successfully");
        return;
      } catch (error: unknown) {
        const err = error as Error & { code?: string };
        // WebSocket failed, fallback to HTTP
        antdMessage.warning("WebSocket failed, trying HTTP...");

        // Mark with error for potential retry
        setMessages((prev) =>
          prev.map((m) =>
            m.id === failedMessage.id
              ? {
                  ...m,
                  errorMessage:
                    err.code === "WEBSOCKET_DISCONNECTED"
                      ? "Connection lost"
                      : "Failed to send",
                }
              : m
          )
        );
      }
    }

    // HTTP fallback
    const typingId = `typing_retry_${Date.now()}`;
    const typingMsg: Message = {
      id: typingId,
      conversation_id: currentConversation.id,
      role: "assistant",
      content: "",
      tokens_used: 0,
      model: currentConversation.model,
      createdAt: new Date().toISOString(),
      isTyping: true,
    };
    setMessages((prev) => [...prev, typingMsg]);

    try {
      setIsSendingMessage(true);
      const svc = await import("../services/chat.service");

      await svc.sendMessageStream(
        currentConversation.id,
        failedMessage.content,
        (chunk) => {
          setMessages((prev) =>
            prev.map((m) =>
              m.id === typingId
                ? { ...m, content: (m.content || "") + chunk }
                : m
            )
          );
        },
        (result: unknown) => {
          const res = result as {
            userMessage?: Message;
            assistantMessage?: Message;
            conversation?: {
              total_tokens_used: number;
              message_count: number;
            };
          };
          const userMsg = res?.userMessage;
          const assistantMsg = res?.assistantMessage;

          setMessages((prev) => {
            const withoutTyping = prev.filter((m) => m.id !== typingId);
            const replaced = withoutTyping.map((m) =>
              m.id === failedMessage.id && userMsg
                ? { ...userMsg, localStatus: "sent" as const }
                : m
            );
            if (assistantMsg) return [...replaced, assistantMsg];
            return replaced;
          });

          if (res?.conversation) {
            setCurrentConversation((prev) =>
              prev && res.conversation
                ? {
                    ...prev,
                    total_tokens_used: res.conversation.total_tokens_used,
                    message_count: res.conversation.message_count,
                  }
                : prev
            );

            moveConversationToTop(currentConversation.id);
            updateConversationOptimistic(currentConversation.id, {
              message_count: res.conversation.message_count,
              updatedAt: new Date().toISOString(),
            });

            try {
              window.dispatchEvent(new Event("message:sent"));
            } catch {}
            refreshConversations().catch(() => {});
          }

          antdMessage.success("Message sent successfully");

          try {
            window.dispatchEvent(
              new CustomEvent("ai:typing:stop", {
                detail: { conversationId: currentConversation.id },
              })
            );
          } catch {}
        },
        (err: unknown) => {
          const error = err as Error;
          const errorMsg =
            error.message || "Failed to send message. Please try again.";

          setMessages((prev) =>
            prev.map((m) =>
              m.id === failedMessage.id
                ? {
                    ...m,
                    localStatus: "failed",
                    errorMessage: errorMsg,
                    lastAttemptAt: new Date().toISOString(),
                  }
                : m
            )
          );

          setMessages((prev) => prev.filter((m) => m.id !== typingId));

          // Show specific error message
          if (retryCount + 1 >= maxRetries) {
            antdMessage.error(
              `Failed after ${maxRetries} attempts. Please check your connection.`
            );
          } else {
            antdMessage.error(
              `Retry ${retryCount + 1} failed. ${
                maxRetries - retryCount - 1
              } attempts remaining.`
            );
          }

          try {
            window.dispatchEvent(
              new CustomEvent("ai:typing:stop", {
                detail: { conversationId: currentConversation.id },
              })
            );
          } catch {}
        },
        undefined, // attachments
        undefined // metadata
      );
    } catch (err: unknown) {
      const error = err as Error;
      const errorMsg =
        error.message || "Network error. Please check your connection.";

      setMessages((prev) =>
        prev.map((m) =>
          m.id === failedMessage.id
            ? {
                ...m,
                localStatus: "failed",
                errorMessage: errorMsg,
                lastAttemptAt: new Date().toISOString(),
              }
            : m
        )
      );

      setMessages((prev) => prev.filter((m) => m.id !== typingId));

      if (retryCount + 1 >= maxRetries) {
        antdMessage.error(
          `Failed after ${maxRetries} attempts. Please try again later.`
        );
      } else {
        antdMessage.error(`Retry ${retryCount + 1} failed. You can try again.`);
      }

      try {
        window.dispatchEvent(
          new CustomEvent("ai:typing:stop", {
            detail: { conversationId: currentConversation.id },
          })
        );
      } catch {}
    } finally {
      setIsSendingMessage(false);
    }
  };

  /**
   * Handle resending a user message (with AI context)
   */
  const handleResendMessage = async (
    message: Message | PendingMessage
  ): Promise<void> => {
    if (!currentConversation) return;

    // Only allow resending user messages
    if (message.role !== "user") return;

    // Send the original message content with resend metadata
    // The server will handle building the context prompt
    await handleSendMessage(message.content, undefined, {
      resendMessageId: message.id,
    });
  };

  /**
   * Handle editing and resending a user message (with AI context)
   */
  const handleEditMessage = async (
    message: Message | PendingMessage,
    newContent: string
  ): Promise<void> => {
    if (!currentConversation) return;

    // Only allow editing user messages
    if (message.role !== "user") return;

    // Send the edited message with edit metadata
    // The server will handle building the context prompt
    await handleSendMessage(newContent, undefined, {
      editMessageId: message.id,
      originalContent: message.content,
    });
  };

  /**
   * Handle requesting follow-up suggestions for a message
   */
  const handleRequestFollowups = (messageId: string, content: string) => {
    if (!isConnected) {
      antdMessage.warning("Not connected to server");
      return;
    }

    if (!user?.id) {
      antdMessage.warning("User not authenticated");
      return;
    }

    // Find the bot message and the last user message before it
    const msgIndex = messages.findIndex((m) => m.id === messageId);
    if (msgIndex === -1) {
      // logging removed: message not found
      return;
    }

    const lastBotMessage = content;
    let lastUserMessage = "";

    // Find the most recent user message before this bot message
    for (let i = msgIndex - 1; i >= 0; i--) {
      if (messages[i].role === "user") {
        lastUserMessage = messages[i].content;
        break;
      }
    }

    // Validate that we have both messages
    if (!lastUserMessage || lastUserMessage.trim().length === 0) {
      // logging removed: no user message before bot message
      antdMessage.warning(
        "Cannot generate suggestions: conversation context not found"
      );
      return;
    }

    if (!lastBotMessage || lastBotMessage.trim().length === 0) {
      // logging removed: bot message is empty
      antdMessage.warning(
        "Cannot generate suggestions: message content is empty"
      );
      return;
    }

    // logging removed: requesting suggestions with context

    // Mark message as loading suggestions
    setMessages((prev) =>
      prev.map((msg) =>
        msg.id === messageId ? { ...msg, isLoadingFollowups: true } : msg
      )
    );

    // Request suggestions via websocket with both messages and sessionId for multi-tab sync
    const sessionId = String(user.id);
    websocketService.requestFollowups(
      messageId,
      lastUserMessage,
      lastBotMessage,
      sessionId
    );
  };

  /**
   * Handle requesting conversation-based follow-up suggestions (for input lightbulb)
   * 🔥 FIX: Always fetch fresh suggestions based on current context
   */
  const handleRequestConversationSuggestions = () => {
    if (!isConnected) {
      antdMessage.warning("Not connected to server");
      return;
    }

    if (!user?.id) {
      antdMessage.warning("User not authenticated");
      return;
    }

    if (!currentConversation) {
      antdMessage.warning("No active conversation");
      return;
    }

    // Get up to 10 recent messages for context
    const recentMessages = messages
      .filter((m) => m.role === "user" || m.role === "assistant")
      .slice(-10)
      .map((m) => ({
        role: m.role,
        content: m.content,
      }));

    if (recentMessages.length === 0) {
      antdMessage.info("Start a conversation to get suggestions");
      return;
    }

    // Set loading state and clear old suggestions
    setIsLoadingConversationSuggestions(true);
    setConversationSuggestions([]);

    // Request fresh suggestions via websocket based on current context
    // forceRegenerate = true ensures we always get new suggestions
    const sessionId = String(user.id);

    websocketService.requestConversationFollowups(
      currentConversation.id,
      recentMessages,
      sessionId,
      true // Force regenerate on every lightbulb click
    );
  };

  /**
   * Fetch New Chat suggestions based on recent activity across all conversations
   */
  const fetchNewChatSuggestions = async (forceRegenerate = false) => {
    if (!user?.id) return;

    try {
      // Only show loading if we're forcing regenerate (clicking + button)
      if (forceRegenerate) {
        setIsLoadingNewChatSuggestions(true);
        setNewChatSuggestions([]);
      }
      // Otherwise, keep showing cached suggestions while fetching new ones in background

      // Ensure websocket is connected so we can use the conversation followups socket handler.
      // If it's not connected, attempt to connect first (this is fast and resolves when ready).
      try {
        await websocketService.connect();
      } catch (connErr) {
        // If socket connection fails, we still proceed to attempt an HTTP fallback below.
      }

      // Request suggestions via websocket if connected
      const sessionId = String(user.id);
      const tempConversationId = "new_chat_suggestions";

      if (websocketService.isConnected()) {
        // For new chat suggestions, we pass forceRegenerate flag
        // Server will use cached suggestions unless forceRegenerate is true
        websocketService.requestConversationFollowups(
          tempConversationId,
          [], // Empty messages array - server will handle context
          sessionId,
          forceRegenerate
        );
      } else {
        // Could not connect to websocket; bail out and clear loading state
        if (forceRegenerate) {
          setIsLoadingNewChatSuggestions(false);
          setNewChatSuggestions([]);
        }
      }
    } catch (err) {
      if (forceRegenerate) {
        setIsLoadingNewChatSuggestions(false);
        setNewChatSuggestions([]);
      }
    }
  };

  /**
   * Handle clicking a follow-up suggestion
   */
  const handleFollowupClick = (suggestion: string) => {
    if (!currentConversation) return;
    handleSendMessage(suggestion);
  };

  /**
   * Handle asking about selected text from AI message
   */
  const handleAskAboutSelection = (question: string, selectedText: string) => {
    if (!currentConversation) return;
    // Combine user's question with the selected text
    const message = `${question} : ${selectedText}`;
    handleSendMessage(message);
  };

  // Listen for follow-up response events
  useEffect(() => {
    const handleFollowupsResponse = (event: CustomEvent) => {
      const { messageId, suggestions } = event.detail;
      // logging removed: received suggestions

      setMessages((prev) =>
        prev.map((msg) =>
          msg.id === messageId
            ? {
                ...msg,
                followupSuggestions: suggestions,
                isLoadingFollowups: false,
              }
            : msg
        )
      );
    };

    const handleFollowupsError = (event: CustomEvent) => {
      const { messageId, error } = event.detail;
      // logging removed: followups error

      setMessages((prev) =>
        prev.map((msg) =>
          msg.id === messageId ? { ...msg, isLoadingFollowups: false } : msg
        )
      );

      // Show user-friendly error message
      const errorMsg =
        typeof error === "string"
          ? error
          : "Unable to generate suggestions. Please try again.";
      antdMessage.error(errorMsg);
    };

    window.addEventListener(
      "followups_response",
      handleFollowupsResponse as EventListener
    );
    window.addEventListener(
      "followups_error",
      handleFollowupsError as EventListener
    );

    return () => {
      window.removeEventListener(
        "followups_response",
        handleFollowupsResponse as EventListener
      );
      window.removeEventListener(
        "followups_error",
        handleFollowupsError as EventListener
      );
    };
  }, [antdMessage]);

  // Set up websocket handlers for follow-ups
  useEffect(() => {
    websocketService.setHandlers({
      onFollowupsResponse: (data) => {
        window.dispatchEvent(
          new CustomEvent("followups_response", { detail: data })
        );
      },
      onFollowupsError: (data) => {
        window.dispatchEvent(
          new CustomEvent("followups_error", { detail: data })
        );
      },
    });

    // Listen for conversation followup responses
    const handleConversationFollowupsResponse = (event: CustomEvent) => {
      const { conversationId, suggestions } = event.detail;
      if (conversationId === currentConversation?.id) {
        setConversationSuggestions(suggestions);
        setIsLoadingConversationSuggestions(false);
      }
    };

    const handleConversationFollowupsError = (event: CustomEvent) => {
      const { conversationId, error } = event.detail;
      if (conversationId === currentConversation?.id) {
        setIsLoadingConversationSuggestions(false);
        const errorMsg =
          typeof error === "string"
            ? error
            : "Unable to generate suggestions. Please try again.";
        antdMessage.error(errorMsg);
      }
    };

    window.addEventListener(
      "conversation_followups_response",
      handleConversationFollowupsResponse as EventListener
    );
    window.addEventListener(
      "conversation_followups_error",
      handleConversationFollowupsError as EventListener
    );

    return () => {
      window.removeEventListener(
        "conversation_followups_response",
        handleConversationFollowupsResponse as EventListener
      );
      window.removeEventListener(
        "conversation_followups_error",
        handleConversationFollowupsError as EventListener
      );
    };
  }, [currentConversation?.id, antdMessage]);

  /**
   * Handle pin toggle from MessageBubble with OPTIMISTIC UPDATE
   * Using Set for O(1) lookup performance
   */
  const handlePinToggle = async (messageId: string, isPinned: boolean) => {
    // 🚀 OPTIMISTIC UPDATE: Update pinnedMessageIds Set immediately
    setPinnedMessageIds((prev) => {
      const newSet = new Set(prev);
      if (isPinned) {
        newSet.add(messageId);
      } else {
        newSet.delete(messageId);
      }
      return newSet;
    });

    // Update messages array (for message bubble UI)
    setMessages((prev) =>
      prev.map((msg) =>
        msg.id === messageId ? { ...msg, pinned: isPinned } : msg
      )
    );

    // 🚀 PERFORMANCE: Update cache immediately
    if (currentConversation?.id) {
      const { default: messageCache } = await import(
        "../services/message-cache.service"
      );
      messageCache.updateMessage(currentConversation.id, messageId, {
        pinned: isPinned,
      });
    }

    // Trigger dropdown refresh (still useful for fetching full message data)
    setPinnedRefreshTrigger((prev) => prev + 1);
  };

  // Listen for pin/unpin events from websocket (real-time sync)
  useEffect(() => {
    const handleMessagePinned = async (event: Event) => {
      const {
        conversationId: eventConvId,
        messageId,
        message,
      } = (event as CustomEvent).detail;

      // Only update if it's for the current conversation
      if (eventConvId === currentConversation?.id) {
        // 🚀 OPTIMISTIC UPDATE: Add to pinnedMessageIds Set immediately
        setPinnedMessageIds((prev) => {
          const newSet = new Set(prev);
          newSet.add(messageId);
          return newSet;
        });

        // Batch state updates together
        setMessages((prev) => {
          const exists = prev.some((msg) => msg.id === messageId);
          if (!exists) return prev; // Early return if message not found

          // Check if already pinned to avoid unnecessary update
          const currentMsg = prev.find((msg) => msg.id === messageId);
          if (currentMsg?.pinned) return prev;

          return prev.map((msg) =>
            msg.id === messageId ? { ...msg, pinned: true } : msg
          );
        });

        // 🚀 PERFORMANCE: Update cache asynchronously without blocking
        import("../services/message-cache.service")
          .then(({ default: messageCache }) => {
            messageCache.updateMessage(eventConvId, messageId, {
              pinned: true,
            });
          })
          .catch(() => {});

        // Trigger dropdown refresh
        setPinnedRefreshTrigger((prev) => prev + 1);
      }
    };

    const handleMessageUnpinned = async (event: Event) => {
      const { conversationId: eventConvId, messageId } = (event as CustomEvent)
        .detail;

      // Only update if it's for the current conversation
      if (eventConvId === currentConversation?.id) {
        // 🚀 OPTIMISTIC UPDATE: Remove from pinnedMessageIds Set immediately
        setPinnedMessageIds((prev) => {
          const newSet = new Set(prev);
          newSet.delete(messageId);
          return newSet;
        });

        setMessages((prev) => {
          // Check if already unpinned to avoid unnecessary update
          const currentMsg = prev.find((msg) => msg.id === messageId);
          if (!currentMsg?.pinned) return prev;

          return prev.map((msg) =>
            msg.id === messageId ? { ...msg, pinned: false } : msg
          );
        });

        // 🚀 PERFORMANCE: Update cache asynchronously without blocking
        import("../services/message-cache.service")
          .then(({ default: messageCache }) => {
            messageCache.updateMessage(eventConvId, messageId, {
              pinned: false,
            });
          })
          .catch(() => {});

        // Trigger dropdown refresh
        setPinnedRefreshTrigger((prev) => prev + 1);
      }
    };

    window.addEventListener("message:pinned", handleMessagePinned);
    window.addEventListener("message:unpinned", handleMessageUnpinned);

    return () => {
      window.removeEventListener("message:pinned", handleMessagePinned);
      window.removeEventListener("message:unpinned", handleMessageUnpinned);
    };
  }, [currentConversation?.id]);

  return (
    <Layout className={styles.chatPageLayout}>
      <Layout className={styles.mainLayout}>
        {/* Sidebar component */}
        <Sidebar
          currentConversationId={currentConversation?.id || null}
          onSelectConversation={handleSelectConversation}
          onNewConversation={handleNewConversation}
          onHighlightMessage={handleSearchResultClick}
          unreadConversations={unreadConversations}
          onSettingsClick={() => setSettingsModalOpen(true)}
          onProfileClick={() => setProfileModalOpen(true)}
          onMemoryClick={() => setMemoryDashboardOpen(true)}
        />

        {/* Main content area */}
        <Content className={styles.contentArea}>
          {/* Main content */}

          {/* Always show chat interface (either empty or with messages) */}
          {!currentConversation ? (
            <>
              {/* Empty conversation - show placeholder and input */}
              <div className={styles.conversationHeader}>
                <div className={styles.conversationHeaderLeft}>
                  <Title level={4} className={styles.conversationTitle}>
                    New Chat
                  </Title>
                  <NetworkStatus position="inline" />
                </div>
              </div>

              {/* Empty message list with placeholder */}
              <MessageList
                messages={[]}
                isLoading={false}
                showScrollButton={false}
                messageRefs={messageRefs}
                highlightedMessageId={highlightedMessageId}
                onRequestFollowups={handleRequestFollowups}
                onFollowupClick={handleFollowupClick}
                onPinToggle={handlePinToggle}
                onAskAboutSelection={handleAskAboutSelection}
                onResend={handleResendMessage}
                onEdit={handleEditMessage}
              />

              {/* New Chat suggestions - display above input */}
              <NewChatSuggestions
                suggestions={newChatSuggestions}
                isLoading={isLoadingNewChatSuggestions}
                onSuggestionClick={(suggestion) => {
                  // Send the suggestion as a message to create new conversation
                  handleSendMessage(suggestion);
                }}
              />

              {/* Chat input for new conversation */}
              <ChatInput
                onSendMessage={handleSendMessage}
                conversationId={undefined}
                disabled={isSendingMessage}
                placeholder="Type your message to start a new conversation..."
                onTypingStart={() => isConnected && startTyping()}
                onTypingStop={() => isConnected && stopTyping()}
                onRequestSuggestions={handleRequestConversationSuggestions}
                suggestions={conversationSuggestions}
                isLoadingSuggestions={isLoadingConversationSuggestions}
              />
            </>
          ) : (
            <>
              {/* Conversation header */}
              <div className={styles.conversationHeader}>
                <div className={styles.conversationHeaderLeft}>
                  <div className={styles.conversationTitleContainer}>
                    <Title level={4} className={styles.conversationTitle}>
                      {currentConversation.title || "New Chat"}
                    </Title>
                  </div>
                  <NetworkStatus position="inline" />
                </div>

                {/* Semantic Search within conversation */}
                <div className={styles.conversationSearchContainer}>
                  <ConversationSearch
                    conversationId={currentConversation.id}
                    onResultClick={handleSearchResultClick}
                  />
                  {/* Pinned Messages Dropdown */}
                  <PinnedMessagesDropdown
                    conversationId={currentConversation.id}
                    onMessageClick={handleSearchResultClick}
                    refreshTrigger={pinnedRefreshTrigger}
                    pinnedMessageIds={pinnedMessageIds}
                  />
                </div>
              </div>

              {/* Messages list */}
              <MessageList
                messages={messages}
                isLoading={isSendingMessage || isSendingRealtimeMessage}
                showScrollButton
                onLoadEarlier={loadEarlier}
                hasMore={messagesHasMore}
                onRetry={handleRetryMessage}
                messageRefs={messageRefs}
                highlightedMessageId={highlightedMessageId}
                onRequestFollowups={handleRequestFollowups}
                onFollowupClick={handleFollowupClick}
                onPinToggle={handlePinToggle}
                onAskAboutSelection={handleAskAboutSelection}
                onResend={handleResendMessage}
                onEdit={handleEditMessage}
                isAITyping={isAITyping}
              />

              {/* Chat input - disable while AI is typing to mirror sender tab behaviour */}
              <ChatInput
                onSendMessage={handleSendMessage}
                conversationId={currentConversation.id}
                disabled={
                  isAITyping || isSendingMessage || isSendingRealtimeMessage
                }
                placeholder="Type your message here..."
                onTypingStart={() => isConnected && startTyping()}
                onTypingStop={() => isConnected && stopTyping()}
                onRequestSuggestions={handleRequestConversationSuggestions}
                suggestions={conversationSuggestions}
                isLoadingSuggestions={isLoadingConversationSuggestions}
              />
            </>
          )}
        </Content>
      </Layout>

      {/* New Conversation Modal - Deprecated: now using inline draft mode */}
      {/* 
      <ConversationForm
        open={isModalVisible}
        onCancel={() => setIsModalVisible(false)}
        onSubmit={handleCreateSubmit}
        loading={isCreating}
      />
      */}

      {/* Settings Modal */}
      <SettingsModal
        open={settingsModalOpen}
        onCancel={() => setSettingsModalOpen(false)}
      />

      {/* Profile Modal */}
      <ProfileModal
        open={profileModalOpen}
        onCancel={() => setProfileModalOpen(false)}
      />

      {/* Memory Dashboard Modal */}
      <MemoryDashboard
        visible={memoryDashboardOpen}
        onClose={() => setMemoryDashboardOpen(false)}
      />
    </Layout>
  );
};

export default ChatPage;
